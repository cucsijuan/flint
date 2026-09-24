<script lang="ts">
  import { filterGraph } from '../lib/graph'
  import type { GraphNode } from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'
  import GraphFilters from './GraphFilters.svelte'
  import GraphView from './GraphView.svelte'

  let { scope }: { scope?: { center: string; depth: number } } = $props()

  const graph = $derived(filterGraph(workspace.graph, workspace.graphFilters, scope))

  function open(node: GraphNode) {
    if (node.kind === 'note') workspace.openNote(node.id)
    else if (node.kind === 'tag') workspace.openSearch(`tag:${node.label}`)
    else void workspace.openLink(node.label)
  }
</script>

<section>
  <header>
    <GraphFilters />
  </header>
  {#if scope}
    <label class="depth">
      Depth
      <input type="range" min="1" max="3" bind:value={workspace.localGraphDepth} />
      {workspace.localGraphDepth}
    </label>
  {/if}
  <div class="canvas">
    <GraphView {graph} focus={scope?.center ?? workspace.notePath ?? undefined} onOpen={open} />
  </div>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  header {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px;
    border-bottom: 1px solid var(--border);
  }

  header :global(.filters) {
    flex: 1;
  }

  .depth {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    color: var(--text-muted);
    font-size: 12px;
  }

  .depth input {
    flex: 1;
    accent-color: var(--accent);
  }

  .canvas {
    flex: 1;
    min-height: 0;
  }
</style>
