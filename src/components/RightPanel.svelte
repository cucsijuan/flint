<script lang="ts">
  import { Link, Tags, Waypoints } from '@lucide/svelte'
  import { Tabs } from 'bits-ui'
  import { workspace } from '../lib/workspace.svelte'
  import BacklinksPanel from './BacklinksPanel.svelte'
  import GraphPanel from './GraphPanel.svelte'
  import TagsPanel from './TagsPanel.svelte'
</script>

<aside>
  <Tabs.Root bind:value={workspace.rightTab} class="panel-tabs">
    <Tabs.List class="tab-list">
      <Tabs.Trigger class="tab" value="backlinks" title="Backlinks"><Link size={16} /></Tabs.Trigger
      >
      <Tabs.Trigger class="tab" value="tags" title="Tags"><Tags size={16} /></Tabs.Trigger>
      <Tabs.Trigger class="tab" value="graph" title="Local graph">
        <Waypoints size={16} />
      </Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content class="tab-content" value="backlinks">
      {#if workspace.note}
        <BacklinksPanel path={workspace.note.path} />
      {:else}
        <p class="empty">No note is open.</p>
      {/if}
    </Tabs.Content>
    <Tabs.Content class="tab-content" value="tags"><TagsPanel /></Tabs.Content>
    <Tabs.Content class="tab-content" value="graph">
      {#if workspace.note}
        <GraphPanel scope={{ center: workspace.note.path, depth: workspace.localGraphDepth }} />
      {:else}
        <p class="empty">No note is open.</p>
      {/if}
    </Tabs.Content>
  </Tabs.Root>
</aside>

<style>
  aside {
    height: 100%;
    background: var(--background-secondary);
  }

  .empty {
    padding: 12px;
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
