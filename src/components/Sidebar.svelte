<script lang="ts">
  import {
    Bookmark,
    CalendarDays,
    FilePlus,
    Files,
    FolderOpen,
    FolderPlus,
    Search,
    Settings,
  } from '@lucide/svelte'
  import { Tabs } from 'bits-ui'
  import { commands } from '../lib/commands.svelte'
  import { workspace } from '../lib/workspace.svelte'
  import BookmarksPanel from './BookmarksPanel.svelte'
  import FileTree from './FileTree.svelte'
  import SearchPanel from './SearchPanel.svelte'
</script>

<aside>
  <header>
    <span class="vault" title={workspace.info?.root}>{workspace.info?.name}</span>
    <button
      class="icon"
      title={commands.label('New note', 'new-note')}
      onclick={() => workspace.createNote()}
    >
      <FilePlus size={16} />
    </button>
    <button class="icon" title="Open today's daily note" onclick={() => workspace.openDailyNote()}>
      <CalendarDays size={16} />
    </button>
    <button class="icon" title="New folder" onclick={() => workspace.createFolder()}>
      <FolderPlus size={16} />
    </button>
    <button class="icon" title="Open another vault" onclick={() => workspace.chooseVault()}>
      <FolderOpen size={16} />
    </button>
    <button
      class="icon"
      title={commands.label('Settings', 'open-settings')}
      onclick={() => (workspace.isSettingsOpen = true)}
    >
      <Settings size={16} />
    </button>
  </header>
  <Tabs.Root bind:value={workspace.leftTab} class="panel-tabs">
    <Tabs.List class="tab-list">
      <Tabs.Trigger class="tab" value="files" title="Files"><Files size={16} /></Tabs.Trigger>
      <Tabs.Trigger class="tab" value="search" title={commands.label('Search', 'search')}>
        <Search size={16} />
      </Tabs.Trigger>
      <Tabs.Trigger class="tab" value="bookmarks" title="Bookmarks">
        <Bookmark size={16} />
      </Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content class="tab-content" value="files"><FileTree /></Tabs.Content>
    <Tabs.Content class="tab-content" value="search"><SearchPanel /></Tabs.Content>
    <Tabs.Content class="tab-content" value="bookmarks"><BookmarksPanel /></Tabs.Content>
  </Tabs.Root>
</aside>

<style>
  aside {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background-secondary);
  }

  header {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 2px;
    height: var(--header-height);
    padding: 0 8px;
    border-bottom: 1px solid var(--border);
  }

  .vault {
    flex: 1;
    overflow: hidden;
    font-size: 13px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
