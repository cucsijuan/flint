<script lang="ts">
  import { Handle, NodeResizer, Position } from '@xyflow/svelte'
  import type { Snippet } from 'svelte'
  import { type CanvasNode, colorOf, type Side } from '../../lib/canvas/model'

  let {
    node,
    selected = false,
    kind,
    children,
  }: { node: CanvasNode; selected?: boolean; kind: string; children: Snippet } = $props()

  const handles: [Side, Position][] = [
    ['top', Position.Top],
    ['right', Position.Right],
    ['bottom', Position.Bottom],
    ['left', Position.Left],
  ]
</script>

<NodeResizer isVisible={selected} minWidth={60} minHeight={40} />
{#each handles as [side, position] (side)}
  <Handle id={side} type="source" {position} />
{/each}
<div class="card {kind}" class:selected style:--card-color={colorOf(node.color)}>
  {@render children()}
</div>

<style>
  .card {
    --card-accent: var(--card-color, var(--border));
    width: 100%;
    height: 100%;
    overflow: hidden;
    border: 2px solid var(--card-accent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--card-color, transparent) 8%, var(--background));
    color: var(--text);
  }

  .card.selected {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .card.group {
    overflow: visible;
    background: color-mix(in srgb, var(--card-color, var(--text-faint)) 10%, transparent);
  }
</style>
