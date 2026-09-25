<script lang="ts">
  import { getCurrentWebview } from '@tauri-apps/api/webview'
  import { getCurrentWindow } from '@tauri-apps/api/window'
  import { Pane, PaneGroup, PaneResizer } from 'paneforge'
  import { onMount } from 'svelte'
  import CommandPalette from './components/CommandPalette.svelte'
  import LayoutView from './components/LayoutView.svelte'
  import QuickSwitcher from './components/QuickSwitcher.svelte'
  import RightPanel from './components/RightPanel.svelte'
  import SettingsDialog from './components/SettingsDialog.svelte'
  import Sidebar from './components/Sidebar.svelte'
  import Welcome from './components/Welcome.svelte'
  import { listen } from '@tauri-apps/api/event'
  import { dropFiles } from './lib/editor/attachments'
  import { registerAppCommands, rememberContextTarget } from './lib/app-commands'
  import { checkForUpdates } from './lib/updates'
  import { commands } from './lib/commands.svelte'
  import { pluginHost } from './lib/plugins/host.svelte'
  import { workspace } from './lib/workspace.svelte'

  registerAppCommands()

  let restored = $state(false)

  onMount(() => {
    void workspace.restore().finally(() => {
      restored = true
      if (workspace.checkForUpdates && !import.meta.env.DEV) {
        void checkForUpdates({ isManual: false })
      }
    })
    const closing = getCurrentWindow().onCloseRequested(() => workspace.flush())
    const menuActions = listen<string>('context-menu-action', ({ payload }) =>
      commands.run(payload),
    )
    // Only Linux enables native file drops; WebKitGTK reports their position in CSS pixels.
    const fileDrops = getCurrentWebview().onDragDropEvent(({ payload }) => {
      if (payload.type === 'drop') dropFiles(payload.paths, payload.position.x, payload.position.y)
    })
    return () => {
      void closing.then((unlisten) => unlisten())
      void fileDrops.then((unlisten) => unlisten())
      void menuActions.then((unlisten) => unlisten())
    }
  })

  $effect(() => {
    if (workspace.info?.root) void pluginHost.load()
  })

  function onContextMenu(event: MouseEvent) {
    rememberContextTarget(event.target)
    const allowsNativeMenu = (event.target as Element).closest(
      '.cm-editor, .markdown, input, textarea',
    )
    if (!allowsNativeMenu) event.preventDefault()
  }

  function preventFileDrop(event: DragEvent) {
    const types = event.dataTransfer?.types ?? []
    const isFileDrag = types.includes('Files') || types.includes('text/uri-list')
    if (!isFileDrag || (event.target as Element).closest('.cm-editor')) return
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
  {:else}
    <Welcome />
  {/if}
{/if}

<SettingsDialog />
<QuickSwitcher />
<CommandPalette />

{#if workspace.notice}
  <div class="notice" role="alert">{workspace.notice}</div>
{/if}

<style>
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
