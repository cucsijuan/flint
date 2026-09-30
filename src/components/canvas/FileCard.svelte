<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte'
  import { canvasContext } from '../../lib/canvas/context'
  import type { FlowNode } from '../../lib/canvas/flow'
  import type { FileNode } from '../../lib/canvas/model'
  import { documents } from '../../lib/documents'
  import { vaultChanged } from '../../lib/events'
  import { basename, isImage, NOTE_EXTENSION, noteTitle } from '../../lib/paths'
  import { noteContent } from '../../lib/render/source'
  import * as vault from '../../lib/vault'
  import { workspace } from '../../lib/workspace.svelte'
  import CardEditor from './CardEditor.svelte'
  import CardShell from './CardShell.svelte'
  import MarkdownPreview from './MarkdownPreview.svelte'

  let { id, data, selected }: NodeProps<FlowNode> = $props()

  const canvas = canvasContext()
  const node = $derived(data.node as FileNode)
  const isNote = $derived(node.file.toLowerCase().endsWith(NOTE_EXTENSION))
  let text = $state<string | null>(null)
  let isMissing = $state(false)
  const content = $derived(
    text === null ? null : noteContent(text, node.subpath?.replace(/^#/, '')),
  )

  $effect(() => {
    if (!isNote) return
    const path = node.file
    let isCurrent = true
    const load = () =>
      vault.readNote(path).then(
        (contents) => {
          if (!isCurrent) return
          text = contents
          isMissing = false
        },
        () => {
          if (isCurrent) isMissing = true
        },
      )
    void load()
    const unsubscribeEdits = documents.subscribe(path, (contents) => (text = contents))
    const unsubscribeDisk = vaultChanged.on((paths) => {
      if (paths.includes(path) && !documents.isOpen(path)) void load()
    })
    return () => {
      isCurrent = false
      unsubscribeEdits()
      unsubscribeDisk()
    }
  })

  const open = (event: MouseEvent) =>
    workspace.openLink(node.file + (node.subpath ?? ''), canvas.path, {
      newTab: event.ctrlKey || event.metaKey,
    })
</script>

<button class="name nodrag" title={node.file} onclick={open}>
  {isNote ? noteTitle(node.file) : basename(node.file)}{node.subpath ?? ''}
</button>
<CardShell {node} {selected} kind="file">
  {#if isImage(node.file)}
    <img src={workspace.assetUrl(node.file)} alt={basename(node.file)} draggable="false" />
  {:else if !isNote}
    <div class="other" role="presentation" ondblclick={open}>{basename(node.file)}</div>
  {:else if isMissing}
    <div class="other missing">"{node.file}" doesn't exist.</div>
  {:else}
    <div
      class="body"
      class:nowheel={canvas.editing === id}
      role="presentation"
      ondblclick={() => canvas.edit(id)}
    >
      {#if canvas.editing === id}
        <CardEditor source={node.file} note={node.file} />
      {:else if content}
        <MarkdownPreview text={content.text} firstLine={content.firstLine} source={node.file} />
      {/if}
    </div>
  {/if}
</CardShell>

<style>
  .name {
    position: absolute;
    bottom: 100%;
    left: 0;
    max-width: 100%;
    padding: 0 0 4px;
    overflow: hidden;
    border: none;
    background: none;
    color: var(--text-muted);
    font-size: 13px;
    white-space: nowrap;
    text-overflow: ellipsis;
    cursor: pointer;
  }

  .name:hover {
    color: var(--text);
  }

  .body {
    height: 100%;
    overflow: auto;
    padding: 12px 16px;
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .other {
    display: grid;
    height: 100%;
    padding: 12px;
    place-items: center;
    color: var(--text-muted);
    text-align: center;
  }

  .missing {
    color: var(--text-faint);
  }
</style>
