<script lang="ts">
  import { FilePlus, FolderOpen, FolderPlus, Settings } from '@lucide/svelte'
  import { workspace } from '../lib/workspace.svelte'
  import FileTree from './FileTree.svelte'
</script>

<aside>
  <header>
    <span class="vault" title={workspace.info?.root}>{workspace.info?.name}</span>
    <button class="icon" title="New note (Ctrl+N)" onclick={() => workspace.createNote()}>
      <FilePlus size={16} />
    </button>
    <button class="icon" title="New folder" onclick={() => workspace.createFolder()}>
      <FolderPlus size={16} />
    </button>
    <button class="icon" title="Open another vault" onclick={() => workspace.chooseVault()}>
      <FolderOpen size={16} />
    </button>
    <button
      class="icon"
      title="Settings (Ctrl+,)"
      onclick={() => (workspace.isSettingsOpen = true)}
    >
      <Settings size={16} />
    </button>
  </header>
  <FileTree />
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
    gap: 2px;
    padding: 6px 8px;
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
