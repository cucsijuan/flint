<script lang="ts">
  import { documents } from '../lib/documents'
  import { hoverPreview } from '../lib/hover-preview.svelte'
  import { noteTitle } from '../lib/paths'
  import { noteContent } from '../lib/render/source'
  import { workspace } from '../lib/workspace.svelte'
  import MarkdownPreview from './canvas/MarkdownPreview.svelte'

  const WIDTH = 460
  const HEIGHT = 340
  const GAP = 6

  const preview = $derived(hoverPreview.current)
  let text = $state<string | null>(null)

  $effect(() => {
    const path = preview?.path
    text = null
    if (!path) return
    let isCurrent = true
    void documents.load(path).then((contents) => {
      if (isCurrent) text = contents
    })
    return () => (isCurrent = false)
  })

  const content = $derived(text === null || !preview ? null : noteContent(text, preview.subpath))
  const position = $derived.by(() => {
    if (!preview) return { left: 0, top: 0 }
    const { anchor } = preview
    const below = anchor.bottom + GAP + HEIGHT <= window.innerHeight
    return {
      left: Math.max(8, Math.min(anchor.left, window.innerWidth - WIDTH - 8)),
      top: below ? anchor.bottom + GAP : Math.max(8, anchor.top - GAP - HEIGHT),
    }
  })
</script>

<svelte:document
  onpointerover={hoverPreview.onPointerOver}
  onpointerout={hoverPreview.onPointerOut}
  onkeydown={hoverPreview.onKeyDown}
/>

{#if preview}
  <div
    class="hover-preview"
    role="dialog"
    tabindex="-1"
    style:left="{position.left}px"
    style:top="{position.top}px"
    style:width="{WIDTH}px"
    style:max-height="{HEIGHT}px"
    onpointerenter={() => hoverPreview.keepOpen()}
    onpointerleave={() => hoverPreview.scheduleHide()}
  >
    <button
      class="title"
      onclick={(event) => {
        if (!preview) return
        hoverPreview.close()
        void workspace.openLink(
          preview.path + (preview.subpath ? `#${preview.subpath}` : ''),
          preview.path,
          { newTab: event.ctrlKey || event.metaKey },
        )
      }}
    >
      {noteTitle(preview.path)}{preview.subpath ? ` › ${preview.subpath.replace(/^\^/, '')}` : ''}
    </button>
    <div class="body">
      {#if content}
        <MarkdownPreview text={content.text} firstLine={content.firstLine} source={preview.path} />
      {/if}
    </div>
  </div>
{/if}

<style>
  .hover-preview {
    position: fixed;
    z-index: 900;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--background);
    box-shadow: 0 8px 28px rgb(0 0 0 / 25%);
  }

  .title {
    flex-shrink: 0;
    padding: 8px 14px;
    border: none;
    border-bottom: 1px solid var(--border);
    background: var(--background-secondary);
    color: var(--text);
    font: inherit;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }

  .title:hover {
    color: var(--accent);
  }

  .body {
    min-height: 0;
    overflow: auto;
    padding: 12px 16px;
  }
</style>
