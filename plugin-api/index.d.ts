import type * as autocomplete from '@codemirror/autocomplete'
import type * as language from '@codemirror/language'
import type * as state from '@codemirror/state'
import type * as view from '@codemirror/view'

export type Disposer = () => void

export interface PluginCommand {
  /** Unique within the plugin; Flint prefixes it with the plugin id. */
  id: string
  name: string
  /** For example `Mod+Shift+K`. `Mod` is Ctrl, or Cmd on macOS. */
  hotkey?: string
  run: () => unknown
  isAvailable?: () => boolean
}

export interface SidebarTab {
  /** Unique within the plugin. */
  id: string
  name: string
  /** Renders into `element`; the returned function runs when the tab is removed. */
  render: (element: HTMLElement) => Disposer | undefined
}

export interface NoteEntry {
  path: string
  kind: 'file' | 'folder'
}

export interface FlintApi {
  /** The id from the plugin's manifest. */
  readonly pluginId: string

  commands: {
    register(command: PluginCommand): Disposer
  }

  editor: {
    /** Adds a CodeMirror extension to every editor. */
    registerExtension(extension: state.Extension): Disposer
    /** The editor showing the active note, if any. */
    activeView(): view.EditorView | null
    /** Replaces the selection in the active editor, or inserts at the cursor. */
    replaceSelection(text: string): void
  }

  vault: {
    list(): Promise<NoteEntry[]>
    read(path: string): Promise<string>
    write(path: string, contents: string): Promise<void>
    create(path: string): Promise<void>
    /** Called with vault-relative paths whenever files change. */
    onChange(listener: (paths: string[]) => void): Disposer
  }

  workspace: {
    activeNote(): string | null
    openNote(path: string): Promise<void>
    onNoteOpen(listener: (path: string | null) => void): Disposer
  }

  ui: {
    notice(message: string): void
    registerSidebarTab(tab: SidebarTab): Disposer
  }

  storage: {
    load<T = unknown>(): Promise<T | null>
    save(data: unknown): Promise<void>
  }

  /** Flint's own CodeMirror modules. Use these instead of bundling CodeMirror. */
  codemirror: {
    state: typeof state
    view: typeof view
    language: typeof language
    autocomplete: typeof autocomplete
  }
}

/** The default export of a plugin's `main.js`. It may return a cleanup function. */
export type ActivatePlugin = (
  flint: FlintApi,
) => Disposer | undefined | Promise<Disposer | undefined>
