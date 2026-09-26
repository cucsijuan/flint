<script lang="ts">
  import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    Bookmark,
    ChevronLeft,
    ChevronRight,
    PanelRight,
    Pencil,
  } from '@lucide/svelte'
  import { dailyNoteDate } from '../lib/dates'
  import { goBack, goForward, type Tab, toggleReading } from '../lib/layout'
  import { noteTitle } from '../lib/paths'
  import { workspace } from '../lib/workspace.svelte'

  let { tab, path }: { tab: Tab; path: string } = $props()

  const isDailyNote = $derived(dailyNoteDate(path, workspace.dailyNotes) !== null)
  const isBookmarked = $derived(workspace.isBookmarked({ type: 'file', path }))
</script>

<header>
  <div class="actions">
    <button
      class="icon"
      title="Go back (Alt+←)"
      disabled={tab.back.length === 0}
      onclick={() => workspace.updateLayout(goBack)}
    >
      <ArrowLeft size={16} />
    </button>
    <button
      class="icon"
      title="Go forward (Alt+→)"
      disabled={tab.forward.length === 0}
      onclick={() => workspace.updateLayout(goForward)}
    >
      <ArrowRight size={16} />
    </button>
  </div>
  <div class="title">
    {#if isDailyNote}
      <button
        class="icon"
        title="Previous daily note (Ctrl+Alt+←)"
        onclick={() => workspace.openDailyNote(-1)}
      >
        <ChevronLeft size={16} />
      </button>
    {/if}
    <h1>{noteTitle(path)}</h1>
    {#if isDailyNote}
      <button
        class="icon"
        title="Next daily note (Ctrl+Alt+→)"
        onclick={() => workspace.openDailyNote(1)}
      >
        <ChevronRight size={16} />
      </button>
    {/if}
  </div>
  <div class="actions">
    <button
      class="icon"
      class:on={isBookmarked}
      title={isBookmarked ? 'Remove bookmark' : 'Bookmark this note'}
      onclick={() => workspace.toggleBookmark({ type: 'file', path })}
    >
      <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
    </button>
    <button
      class="icon"
      title={tab.isReading ? 'Edit (Ctrl+E)' : 'Reading view (Ctrl+E)'}
      onclick={() => workspace.updateLayout(toggleReading)}
    >
      {#if tab.isReading}<Pencil size={16} />{:else}<BookOpen size={16} />{/if}
    </button>
    <button
      class="icon"
      class:on={workspace.showRightPanel}
      title="Toggle right sidebar"
      onclick={() => workspace.toggleRightPanel()}
    >
      <PanelRight size={16} />
    </button>
  </div>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
  }

  .title {
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  h1 {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    gap: 2px;
  }

  .icon:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .on {
    color: var(--accent);
  }
</style>
