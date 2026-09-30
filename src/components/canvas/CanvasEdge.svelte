<script lang="ts">
  import { BaseEdge, EdgeLabel, type EdgeProps, getBezierPath } from '@xyflow/svelte'
  import { canvasContext } from '../../lib/canvas/context'
  import type { FlowEdge } from '../../lib/canvas/flow'
  import { colorOf } from '../../lib/canvas/model'

  let {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerStart,
    markerEnd,
    data,
    selected,
  }: EdgeProps<FlowEdge> = $props()

  const canvas = canvasContext()
  const [path, labelX, labelY] = $derived(
    getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }),
  )
  const label = $derived(data?.edge.label ?? '')
  const color = $derived(colorOf(data?.edge.color) ?? 'var(--canvas-edge)')

  function finishEditing(input: HTMLInputElement, save: boolean) {
    const next = input.value.trim()
    if (save && next !== label) canvas.updateEdge(id, { label: next || undefined })
    canvas.edit(null)
  }
</script>

<BaseEdge
  {id}
  {path}
  {markerStart}
  {markerEnd}
  style="stroke: {color}; stroke-width: {selected ? 3 : 2}px"
/>
{#if label || canvas.editing === id}
  <EdgeLabel x={labelX} y={labelY} class="canvas-edge-label">
    {#if canvas.editing === id}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="nodrag nokey"
        value={label}
        autofocus
        onblur={(event) => finishEditing(event.currentTarget, true)}
        onkeydown={(event) => {
          if (event.key === 'Enter') finishEditing(event.currentTarget, true)
          else if (event.key === 'Escape') finishEditing(event.currentTarget, false)
        }}
      />
    {:else}
      <span role="presentation" ondblclick={() => canvas.edit(id)}>{label}</span>
    {/if}
  </EdgeLabel>
{/if}

<style>
  :global(.canvas-edge-label) {
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--background);
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
