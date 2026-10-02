<script lang="ts">
  import { getCurrentWebview } from '@tauri-apps/api/webview'
  import { getAllWebviewWindows, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
  import { getCurrentWindow } from '@tauri-apps/api/window'
  import { Pane, PaneGroup, PaneResizer } from 'paneforge'
  import { onMount, tick } from 'svelte'
  import CommandPalette from './components/CommandPalette.svelte'
  import LayoutView from './components/LayoutView.svelte'
  import EditMenu from './components/EditMenu.svelte'
  import HoverPreview from './components/HoverPreview.svelte'
  import MobileShell from './components/mobile/MobileShell.svelte'
  import NoteComposer from './components/NoteComposer.svelte'
  import QuickSwitcher from './components/QuickSwitcher.svelte'
  import RightPanel from './components/RightPanel.svelte'
  import ExportPdfDialog from './components/ExportPdfDialog.svelte'
  import RecoverDeleted from './components/RecoverDeleted.svelte'
  import SettingsDialog from './components/SettingsDialog.svelte'
  import VersionHistory from './components/VersionHistory.svelte'
  import Sidebar from './components/Sidebar.svelte'
  import SlidesView from './components/SlidesView.svelte'
  import StatusBar from './components/StatusBar.svelte'
  import WorkspacePicker from './components/WorkspacePicker.svelte'
  import TemplatePicker from './components/TemplatePicker.svelte'
  import Welcome from './components/Welcome.svelte'
  import { applyAppearance, applySnippets } from './lib/appearance'
  import { dropFiles, fromDisk } from './lib/editor/attachments'
  import { registerAppCommands, rememberContextTarget } from './lib/app-commands'
  import { checkForUpdates } from './lib/updates'
  import { commands } from './lib/commands.svelte'
  import { pluginHost } from './lib/plugins/host.svelte'
  import { editMenu } from './lib/edit-menu.svelte'
  import { isMobile } from './lib/platform'
  import { isPopout } from './lib/popout'
  import { dropOnReadingView } from './lib/reading-drop'
  import { dictionaryFor, spelling } from './lib/spelling.svelte'
  import * as vault from './lib/vault'
  import { workspace } from './lib/workspace.svelte'

  registerAppCommands()

  let restored = $state(false)

  onMount(() => {
    void workspace.restore().finally(async () => {
      restored = true
      // The window starts hidden so the empty webview never flashes on screen.
      await tick()
      await getCurrentWindow().show()
      if (workspace.checkForUpdates && !import.meta.env.DEV) {
        void checkForUpdates({ isManual: false })
      }
    })
    const closing = getCurrentWindow().onCloseRequested(async () => {
      await workspace.flush()
      // Pop-out windows go with the main one.
      if (!isPopout) {
        for (const window of await getAllWebviewWindows()) {
          if (window.label !== getCurrentWebviewWindow().label) await window.close()
        }
      }
    })
    const pluginChanges = vault.onPluginsChanged((folders) => {
      if (workspace.settings.value.pluginHotReload) void pluginHost.reload(folders)
    })
    // Only Linux enables native file drops; WebKitGTK reports their position in CSS pixels.
    const fileDrops = getCurrentWebview().onDragDropEvent(({ payload }) => {
      if (payload.type !== 'drop') return
      const { paths, position } = payload
      if (!dropFiles(paths, position.x, position.y)) {
        dropOnReadingView(paths.map(fromDisk), document.elementFromPoint(position.x, position.y))
      }
    })
    return () => {
      void closing.then((unlisten) => unlisten())
      void fileDrops.then((unlisten) => unlisten())
      void pluginChanges.then((unlisten) => unlisten())
    }
  })

  $effect(() => {
    if (workspace.info?.root) void pluginHost.load()
  })

  $effect(() => {
    const { theme } = workspace.appearance.value
    const { readableLineLength, readableLineWidth } = workspace.settings.value
    applyAppearance(workspace.appearance.value, readableLineLength, readableLineWidth)
    // WebView2 follows the window's theme rather than the page's `color-scheme`.
    void getCurrentWindow()
      .setTheme(theme === 'system' ? null : theme)
      .catch(() => {})
    syncWindowBackground()
  })

  $effect(() => applySnippets(workspace.enabledSnippetCss))

  $effect(() => {
    const { spellcheck, spellcheckLanguages } = workspace.settings.value
    if (!workspace.info || !spellcheck) return
    void vault
      .spellingLanguages()
      .then((languages) => {
        const codes = languages.map((language) => language.code)
        const wanted = spellcheckLanguages.length ? spellcheckLanguages : [navigator.language]
        const chosen = [...new Set(wanted.flatMap((name) => dictionaryFor(name, codes) ?? []))]
        return spelling.setLanguages(chosen)
      })
      .catch((error: unknown) =>
        workspace.notify(`Couldn't load the spell-check dictionaries: ${String(error)}`),
      )
  })

  $effect(() => {
    const { historyInterval, historyRetention } = workspace.settings.value
    if (workspace.info) void vault.setHistorySettings(historyInterval, historyRetention)
  })

  /** Paints the native window in the theme's background, which shows before the webview's first frame. */
  function syncWindowBackground() {
    const [red = 0, green = 0, blue = 0] =
      getComputedStyle(document.body).backgroundColor.match(/\d+/g)?.map(Number) ?? []
    getCurrentWebviewWindow()
      .setBackgroundColor([red, green, blue])
      .catch(() => {})
  }

  function onContextMenu(event: MouseEvent) {
    if (event.defaultPrevented) return
    rememberContextTarget(event.target)
    event.preventDefault()
    editMenu.open(event)
  }

  function preventFileDrop(event: DragEvent) {
    const types = event.dataTransfer?.types ?? []
    const isFileDrag = types.includes('Files') || types.includes('text/uri-list')
    if (!isFileDrag || (event.target as Element).closest('.cm-editor, [data-reading-note]')) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'
  }
</script>

<svelte:window
  onkeydown={(event) => commands.handleKeydown(event)}
  oncontextmenu={onContextMenu}
  ondragover={preventFileDrop}
  ondrop={preventFileDrop}
/>

{#if restored}
  {#if workspace.info}
    <div class="app">
      {#if isMobile}
        <MobileShell />
      {:else if isPopout}
        <div class="popout"><LayoutView node={workspace.layout.root} /></div>
      {:else}
        <PaneGroup direction="horizontal" autoSaveId="layout">
          <Pane id="sidebar" order={1} defaultSize={22} minSize={12} maxSize={50}>
            <Sidebar />
          </Pane>
          <PaneResizer class="resizer" />
          <Pane id="editor" order={2}>
            <LayoutView node={workspace.layout.root} />
          </Pane>
          {#if workspace.showRightPanel}
            <PaneResizer class="resizer" />
            <Pane id="right" order={3} defaultSize={22} minSize={12} maxSize={50}>
              <RightPanel />
            </Pane>
          {/if}
        </PaneGroup>
      {/if}
      {#if !isMobile}<StatusBar />{/if}
    </div>
  {:else}
    <Welcome />
  {/if}
{/if}

<SettingsDialog />
<VersionHistory />
<ExportPdfDialog />
<RecoverDeleted />
<QuickSwitcher />
<EditMenu />
<CommandPalette />
<TemplatePicker />
<NoteComposer />
<HoverPreview />
<WorkspacePicker />
<SlidesView />

{#if workspace.notice}
  <div class="notice" role="alert">{workspace.notice}</div>
{/if}

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .popout {
    flex: 1;
    min-height: 0;
  }

  .app > :global([data-pane-group]) {
    flex: 1;
    min-height: 0;
  }

  :global(.resizer) {
    position: relative;
    z-index: 5;
    width: 1px;
    background: var(--border);
    cursor: col-resize;
  }

  :global(.resizer::after) {
    content: '';
    position: absolute;
    inset: 0 -3px;
  }

  :global(.resizer.vertical) {
    width: auto;
    height: 1px;
    cursor: row-resize;
  }

  :global(.resizer.vertical::after) {
    inset: -3px 0;
  }

  :global(.resizer:hover),
  :global(.resizer[data-active]) {
    background: var(--accent);
  }

  .notice {
    position: fixed;
    right: 16px;
    bottom: 16px;
    max-width: 420px;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--background-secondary);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
    font-size: 13px;
  }
</style>
