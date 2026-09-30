<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte'
  import { canvasContext } from '../../lib/canvas/context'
  import type { FlowNode } from '../../lib/canvas/flow'
  import type { GroupNode } from '../../lib/canvas/model'
  import { workspace } from '../../lib/workspace.svelte'
  import CardShell from './CardShell.svelte'

  let { id, data, selected }: NodeProps<FlowNode> = $props()

  const canvas = canvasContext()
  const node = $derived(data.node as GroupNode)

  function finishEditing(input: HTMLInputElement, save: boolean) {
    const label = input.value.trim()
    if (save && label !== (node.label ?? '')) canvas.updateNode(id, { label: label || undefined })
    canvas.edit(null)
  }
</script>

{#if canvas.editing === id}
  <!-- svelte-ignore a11y_autofocus -->
  <input
    class="label nodrag nokey"
    value={node.label ?? ''}
    autofocus
    onblur={(event) => finishEditing(event.currentTarget, true)}
    onkeydown={(event) => {
      if (event.key === 'Enter') finishEditing(event.currentTarget, true)
      else if (event.key === 'Escape') finishEditing(event.currentTarget, false)
    }}
  />
{:else}
  <div class="label" role="presentation" ondblclick={() => canvas.edit(id)}>
    {node.label || 'Group'}
  </div>
{/if}
<CardShell {node} {selected} kind="group">
  {#if node.background}
    <div
      class="background {node.backgroundStyle ?? 'cover'}"
      style:background-image="url('{workspace.assetUrl(node.background)}')"
    ></div>
  {/if}
</CardShell>

<style>
  .label {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 6px;
    padding: 2px 10px;
    border-radius: 6px;
    background: var(--background-secondary);
    color: var(--text-muted);
    font-size: 16px;
    white-space: nowrap;
  }

  .label:not(input):empty {
    display: none;
  }

  .background {
    width: 100%;
    height: 100%;
    background-position: center;
    background-repeat: no-repeat;
    opacity: 0.6;
  }

  .cover {
    background-size: cover;
  }

  .ratio {
    background-size: contain;
  }

  .repeat {
    background-repeat: repeat;
  }
</style>
