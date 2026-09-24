<script lang="ts">
  import { workspace } from '../lib/workspace.svelte'
</script>

<div class="filters">
  <input type="search" placeholder="Filter by path…" bind:value={workspace.graphFilters.query} />
  <label><input type="checkbox" bind:checked={workspace.graphFilters.showTags} /> Tags</label>
  <label>
    <input type="checkbox" bind:checked={workspace.graphFilters.showUnresolved} /> Missing notes
  </label>
  <label><input type="checkbox" bind:checked={workspace.graphFilters.showOrphans} /> Orphans</label>
</div>

<style>
  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    font-size: 12px;
    color: var(--text-muted);
  }

  label {
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  input[type='search'] {
    flex: 1;
    min-width: 120px;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background);
    color: var(--text);
    font: inherit;
  }

  input[type='checkbox'] {
    accent-color: var(--accent);
  }
</style>
