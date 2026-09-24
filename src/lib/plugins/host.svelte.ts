import * as autocomplete from '@codemirror/autocomplete'
import * as language from '@codemirror/language'
import * as state from '@codemirror/state'
import * as view from '@codemirror/view'
import { ask } from '@tauri-apps/plugin-dialog'
import type { ActivatePlugin, Disposer, FlintApi, SidebarTab } from '../../../plugin-api'
import { commands } from '../commands.svelte'
import { activeView } from '../editor/active'
import { noteOpened, vaultChanged } from '../events'
import * as vault from '../vault'
import { workspace } from '../workspace.svelte'
import { isCompatibleLicense } from './licenses'

export type PluginStatus = 'off' | 'on' | 'failed'

export interface Plugin {
  folder: string
  manifest: vault.PluginManifest | null
  status: PluginStatus
  error: string | null
  hasCompatibleLicense: boolean
}

export interface PluginSidebarTab extends SidebarTab {
  key: string
}

interface LoadedPlugin {
  disposers: Disposer[]
  style?: HTMLStyleElement
}

const once = (dispose: Disposer): Disposer => {
  let isDisposed = false
  return () => {
    if (isDisposed) return
    isDisposed = true
    dispose()
  }
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

class PluginHost {
  plugins = $state<Plugin[]>([])
  editorExtensions = $state.raw<state.Extension[]>([])
  sidebarTabs = $state.raw<PluginSidebarTab[]>([])

  #loaded = new Map<string, LoadedPlugin>()

  async load() {
    this.unloadAll()
    const [listings, enabled] = await Promise.all([vault.listPlugins(), vault.enabledPlugins()])
    this.plugins = listings.map(({ folder, manifest, error }) => ({
      folder,
      manifest,
      error,
      status: 'off',
      hasCompatibleLicense: isCompatibleLicense(manifest?.license ?? ''),
    }))
    for (const plugin of this.plugins) {
      if (plugin.manifest && enabled.includes(plugin.manifest.id)) await this.#activate(plugin)
    }
  }

  unloadAll() {
    for (const id of [...this.#loaded.keys()]) this.#deactivate(id)
  }

  async setEnabled(plugin: Plugin, isEnabled: boolean) {
    const manifest = plugin.manifest
    if (!manifest) return
    if (isEnabled) {
      if (!(await this.#confirm(plugin, manifest))) return
      await this.#activate(plugin)
    } else {
      this.#deactivate(manifest.id)
      plugin.status = 'off'
    }
    const enabledIds = this.plugins.flatMap((candidate) =>
      candidate.status === 'on' && candidate.manifest ? [candidate.manifest.id] : [],
    )
    await vault.setEnabledPlugins(enabledIds)
  }

  #confirm(plugin: Plugin, manifest: vault.PluginManifest) {
    const license = plugin.hasCompatibleLicense
      ? ''
      : `\n\nIts license (${manifest.license || 'none declared'}) is not a free license compatible with Flint's AGPL.`
    return ask(
      `"${manifest.name}" can read and change every note in this vault and run any code inside Flint. Only turn on plugins you trust.${license}`,
      { title: 'Turn on plugin', kind: 'warning', okLabel: 'Turn on', cancelLabel: 'Cancel' },
    )
  }

  async #activate(plugin: Plugin) {
    const manifest = plugin.manifest
    if (!manifest) return
    const loaded: LoadedPlugin = { disposers: [] }
    this.#loaded.set(manifest.id, loaded)
    try {
      const source = await vault.readPluginFile(plugin.folder, 'main.js')
      if (source === null) throw new Error('main.js not found')
      const styles = await vault.readPluginFile(plugin.folder, 'styles.css')
      if (styles !== null) {
        loaded.style = document.createElement('style')
        loaded.style.dataset.plugin = manifest.id
        loaded.style.textContent = styles
        document.head.append(loaded.style)
      }
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
      const module = await import(/* @vite-ignore */ url).finally(() => URL.revokeObjectURL(url))
      const activate: unknown = module.default
      if (typeof activate !== 'function') throw new Error('main.js has no default export function')
      const cleanup = await (activate as ActivatePlugin)(this.#api(plugin, manifest, loaded))
      if (typeof cleanup === 'function') loaded.disposers.push(cleanup)
      plugin.status = 'on'
      plugin.error = null
    } catch (error) {
      this.#deactivate(manifest.id)
      plugin.status = 'failed'
      plugin.error = messageOf(error)
    }
  }

  #deactivate(id: string) {
    const loaded = this.#loaded.get(id)
    if (!loaded) return
    this.#loaded.delete(id)
    for (const dispose of loaded.disposers.reverse()) {
      try {
        dispose()
      } catch (error) {
        console.error(error)
      }
    }
    loaded.style?.remove()
  }

  #api(plugin: Plugin, manifest: vault.PluginManifest, loaded: LoadedPlugin): FlintApi {
    const track = (dispose: Disposer) => {
      const disposer = once(dispose)
      loaded.disposers.push(disposer)
      return disposer
    }
    const guard = (run: () => unknown) => async () => {
      try {
        await run()
      } catch (error) {
        workspace.notify(`${manifest.name}: ${messageOf(error)}`)
      }
    }

    return {
      pluginId: manifest.id,
      commands: {
        register: ({ id, name, hotkey, run, isAvailable }) => {
          const commandId = `${manifest.id}:${id}`
          commands.register({
            id: commandId,
            name: `${manifest.name}: ${name}`,
            hotkey,
            isAvailable,
            run: guard(run),
          })
          return track(() => commands.unregister(commandId))
        },
      },
      editor: {
        registerExtension: (extension) => {
          this.editorExtensions = [...this.editorExtensions, extension]
          return track(() => {
            this.editorExtensions = this.editorExtensions.filter((known) => known !== extension)
          })
        },
        activeView,
        replaceSelection: (text) => {
          const editor = activeView()
          editor?.dispatch(editor.state.replaceSelection(text))
          editor?.focus()
        },
      },
      vault: {
        list: vault.listEntries,
        read: vault.readNote,
        write: async (path, contents) => void (await vault.writeNote(path, contents)),
        create: async (path) => void (await vault.createNote(path)),
        onChange: (listener) => track(vaultChanged.on(listener)),
      },
      workspace: {
        activeNote: () => workspace.notePath,
        openNote: async (path) => workspace.openNote(path),
        onNoteOpen: (listener) => track(noteOpened.on(listener)),
      },
      ui: {
        notice: (message) => workspace.notify(message),
        registerSidebarTab: (tab) => {
          const key = `${manifest.id}:${tab.id}`
          this.sidebarTabs = [...this.sidebarTabs, { ...tab, key }]
          return track(() => {
            this.sidebarTabs = this.sidebarTabs.filter((known) => known.key !== key)
            if (workspace.rightTab === key) workspace.rightTab = 'backlinks'
          })
        },
      },
      storage: {
        load: async <T>() => {
          const data = await vault.readPluginData(plugin.folder)
          return data === null ? null : (JSON.parse(data) as T)
        },
        save: async (data) =>
          void (await vault.writePluginData(plugin.folder, JSON.stringify(data, null, 2))),
      },
      codemirror: { state, view, language, autocomplete },
    }
  }
}

export const pluginHost = new PluginHost()
