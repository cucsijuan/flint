<script lang="ts">
  import { Pane, PaneGroup, PaneResizer } from 'paneforge'
  import type { LayoutNode } from '../lib/layout'
  import { workspace } from '../lib/workspace.svelte'
  import LayoutView from './LayoutView.svelte'
  import TabGroup from './TabGroup.svelte'

  let { node }: { node: LayoutNode } = $props()

  function rememberSizes(sizes: number[]) {
    if (node.type !== 'split') return
    node.sizes = sizes
    workspace.saveLayoutSoon()
  }
</script>

{#if node.type === 'group'}
  <TabGroup group={node} />
{:else}
  <PaneGroup direction={node.direction} onLayoutChange={rememberSizes}>
    {#each node.children as child, index (child.id)}
      {#if index > 0}<PaneResizer class="resizer {node.direction}" />{/if}
      <Pane id={child.id} order={index} defaultSize={node.sizes?.[index]} minSize={10}>
        <LayoutView node={child} />
      </Pane>
    {/each}
  </PaneGroup>
{/if}
