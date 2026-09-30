<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte'
  import { canvasContext } from '../../lib/canvas/context'
  import type { FlowNode } from '../../lib/canvas/flow'
  import { type LinkPreview, linkPreview } from '../../lib/canvas/link-preview'
  import type { LinkNode } from '../../lib/canvas/model'
  import { workspace } from '../../lib/workspace.svelte'
  import CardShell from './CardShell.svelte'

  let { id, data, selected }: NodeProps<FlowNode> = $props()

  const canvas = canvasContext()
  const node = $derived(data.node as LinkNode)

  let preview = $state<LinkPreview | null>(null)
  let isLoading = $state(true)

  $effect(() => {
    const url = node.url
    let isCurrent = true
    preview = null
    isLoading = true
    linkPreview(url)
      .then((found) => {
        if (isCurrent) preview = found
      })
      .catch(() => undefined)
      .finally(() => {
        if (isCurrent) isLoading = false
      })
    return () => (isCurrent = false)
  })

  function finishEditing(input: HTMLInputElement, save: boolean) {
    const url = input.value.trim()
    if (save && url && url !== node.url) canvas.updateNode(id, { url })
    canvas.edit(null)
  }
</script>

<CardShell {node} {selected} kind="link">
  {#if canvas.editing === id}
    <form
      class="edit"
      onsubmit={(event) => {
        event.preventDefault()
        finishEditing(event.currentTarget.elements.namedItem('url') as HTMLInputElement, true)
      }}
    >
      <!-- svelte-ignore a11y_autofocus -->
      <input
        name="url"
        class="nodrag nokey"
        value={node.url}
        autofocus
        onblur={(event) => finishEditing(event.currentTarget, true)}
        onkeydown={(event) => event.key === 'Escape' && finishEditing(event.currentTarget, false)}
      />
    </form>
  {:else}
    <div class="link" role="presentation" ondblclick={() => workspace.openUrl(node.url)}>
      {#if preview?.image}
        <img src={preview.image} alt="" draggable="false" />
      {/if}
      <div class="text">
        <strong>{preview?.title ?? node.url}</strong>
        {#if preview?.description}<p>{preview.description}</p>{/if}
        <span class="url">
          {isLoading ? 'Loading preview…' : (preview?.site ?? node.url)}
        </span>
      </div>
    </div>
  {/if}
</CardShell>

<style>
  .link {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  img {
    flex: 1 1 0;
    min-height: 0;
    width: 100%;
    object-fit: cover;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 14px;
    overflow: hidden;
  }

  strong {
    overflow: hidden;
    font-size: 14px;
    text-overflow: ellipsis;
  }

  p {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    color: var(--text-muted);
    font-size: 12px;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
  }

  .url {
    overflow: hidden;
    color: var(--text-faint);
    font-size: 12px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .edit {
    padding: 12px;
  }

  input {
    width: 100%;
  }
</style>
