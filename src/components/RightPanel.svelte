<script lang="ts">
  import { ArrowUpRight, Link, ListTree, SlidersHorizontal, Tags, Waypoints } from '@lucide/svelte'
  import { Tabs } from 'bits-ui'
  import { pluginHost } from '../lib/plugins/host.svelte'
  import { workspace } from '../lib/workspace.svelte'
  import BacklinksPanel from './BacklinksPanel.svelte'
  import GraphPanel from './GraphPanel.svelte'
  import OutgoingLinksPanel from './OutgoingLinksPanel.svelte'
  import OutlinePanel from './OutlinePanel.svelte'
  import PropertiesPanel from './PropertiesPanel.svelte'
  import PluginIcon from './PluginIcon.svelte'
  import PluginView from './PluginView.svelte'
  import TagsPanel from './TagsPanel.svelte'
</script>

<aside>
  <Tabs.Root bind:value={workspace.rightTab} class="panel-tabs">
    <Tabs.List class="tab-list">
      <Tabs.Trigger class="tab" value="backlinks" title="Backlinks"><Link size={16} /></Tabs.Trigger
      >
      <Tabs.Trigger class="tab" value="outgoing" title="Outgoing links">
        <ArrowUpRight size={16} />
      </Tabs.Trigger>
      <Tabs.Trigger class="tab" value="outline" title="Outline">
        <ListTree size={16} />
      </Tabs.Trigger>
      <Tabs.Trigger class="tab" value="properties" title="Properties">
        <SlidersHorizontal size={16} />
      </Tabs.Trigger>
      <Tabs.Trigger class="tab" value="tags" title="Tags"><Tags size={16} /></Tabs.Trigger>
      <Tabs.Trigger class="tab" value="graph" title="Local graph">
        <Waypoints size={16} />
      </Tabs.Trigger>
      {#each pluginHost.sidebarTabs as tab (tab.key)}
        <Tabs.Trigger class="tab text" value={tab.key} title={tab.name}>
          <PluginIcon name={tab.icon} fallback={tab.name.slice(0, 2)} />
        </Tabs.Trigger>
      {/each}
    </Tabs.List>
    <Tabs.Content class="tab-content" value="backlinks">
      {#if workspace.notePath}
        <BacklinksPanel path={workspace.notePath} />
      {:else}
        <p class="empty">No note is open.</p>
      {/if}
    </Tabs.Content>
    <Tabs.Content class="tab-content" value="outgoing">
      {#if workspace.notePath}
        <OutgoingLinksPanel path={workspace.notePath} />
      {:else}
        <p class="empty">No note is open.</p>
      {/if}
    </Tabs.Content>
    <Tabs.Content class="tab-content" value="outline">
      {#if workspace.notePath}
        <OutlinePanel path={workspace.notePath} />
      {:else}
        <p class="empty">No note is open.</p>
      {/if}
    </Tabs.Content>
    <Tabs.Content class="tab-content" value="properties">
      {#if workspace.notePath}
        <PropertiesPanel path={workspace.notePath} />
      {:else}
        <p class="empty">No note is open.</p>
      {/if}
    </Tabs.Content>
    <Tabs.Content class="tab-content" value="tags"><TagsPanel /></Tabs.Content>
    {#each pluginHost.sidebarTabs as tab (tab.key)}
      <Tabs.Content class="tab-content" value={tab.key}
        ><PluginView render={tab.render} /></Tabs.Content
      >
    {/each}
    <Tabs.Content class="tab-content" value="graph">
      {#if workspace.notePath}
        <GraphPanel scope={{ center: workspace.notePath, depth: workspace.localGraphDepth }} />
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
