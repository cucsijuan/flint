<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte'
  import { canvasContext } from '../../lib/canvas/context'
  import type { FlowNode } from '../../lib/canvas/flow'
  import type { TextNode } from '../../lib/canvas/model'
  import CardEditor from './CardEditor.svelte'
  import CardShell from './CardShell.svelte'
  import MarkdownPreview from './MarkdownPreview.svelte'

  let { id, data, selected }: NodeProps<FlowNode> = $props()

  const canvas = canvasContext()
  const node = $derived(data.node as TextNode)
  const setText = (text: string) => canvas.updateNode(id, { text })
</script>

<CardShell {node} {selected} kind="text">
  <div
    class="body"
    class:nowheel={canvas.editing === id}
    role="presentation"
    ondblclick={() => canvas.edit(id)}
  >
    {#if canvas.editing === id}
      <CardEditor source={canvas.path} text={node.text} onchange={setText} />
    {:else}
      <MarkdownPreview text={node.text} source={canvas.path} onedit={setText} />
    {/if}
  </div>
</CardShell>

<style>
  .body {
    height: 100%;
    overflow: auto;
    padding: 12px 16px;
  }
</style>
