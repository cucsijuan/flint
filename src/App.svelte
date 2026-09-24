<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window'
  import { Pane, PaneGroup, PaneResizer } from 'paneforge'
  import { onMount } from 'svelte'
  import BacklinksPanel from './components/BacklinksPanel.svelte'
  import NoteEditor from './components/NoteEditor.svelte'
  import SettingsDialog from './components/SettingsDialog.svelte'
  import Sidebar from './components/Sidebar.svelte'
  import Welcome from './components/Welcome.svelte'
  import { workspace } from './lib/workspace.svelte'

  let restored = $state(false)

  onMount(() => {
    void workspace.restore().finally(() => (restored = true))
    const closing = getCurrentWindow().onCloseRequested(() => workspace.flush())
    return () => void closing.then((unlisten) => unlisten())
  })

  function onKeydown(event: KeyboardEvent) {
    if (!(event.ctrlKey || event.metaKey)) return
    if (event.key.toLowerCase() === 'n' && workspace.info) {
      event.preventDefault()
      void workspace.createNote()
    }
    if (event.key === ',') {
      event.preventDefault()
      workspace.isSettingsOpen = true
    }
  }

  function onContextMenu(event: MouseEvent) {
    const allowsNativeMenu = (event.target as Element).closest('.cm-editor, input, textarea')
    if (!allowsNativeMenu) event.preventDefault()
  }
</script>

<svelte:window onkeydown={onKeydown} oncontextmenu={onContextMenu} />

{#if restored}
  {#if workspace.info}
    <PaneGroup direction="horizontal" autoSaveId="layout">
      <Pane id="sidebar" order={1} defaultSize={22} minSize={12} maxSize={50}>
        <Sidebar />
      </Pane>
      <PaneResizer class="resizer" />
      <Pane id="editor" order={2}>
        {#if workspace.note}
          <NoteEditor note={workspace.note} />
        {:else}
          <div class="empty">Select or create a note.</div>
        {/if}
      </Pane>
      {#if workspace.note && workspace.showBacklinks}
        <PaneResizer class="resizer" />
        <Pane id="backlinks" order={3} defaultSize={22} minSize={12} maxSize={50}>
          <BacklinksPanel path={workspace.note.path} />
        </Pane>
      {/if}
    </PaneGroup>
  {:else}
    <Welcome />
  {/if}
{/if}

<SettingsDialog />

{#if workspace.notice}
  <div class="notice" role="alert">{workspace.notice}</div>
{/if}

<style>
  .empty {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--text-muted);
  }

  :global(.resizer) {
    width: 1px;
    background: var(--border);
  }

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
