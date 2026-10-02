<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window'
  import { ChevronLeft, ChevronRight, X } from '@lucide/svelte'
  import { documents } from '../lib/documents'
  import { noteContent } from '../lib/render/source'
  import { splitSlides } from '../lib/slides'
  import { workspace } from '../lib/workspace.svelte'
  import MarkdownPreview from './canvas/MarkdownPreview.svelte'

  const path = $derived(workspace.slidesNote)
  let slides = $state<string[]>([])
  let index = $state(0)

  $effect(() => {
    if (!path) return
    index = 0
    void documents.load(path).then((text) => (slides = splitSlides(noteContent(text).text)))
    void getCurrentWindow()
      .setFullscreen(true)
      .catch(() => undefined)
    return () =>
      void getCurrentWindow()
        .setFullscreen(false)
        .catch(() => undefined)
  })

  const go = (step: number) => (index = Math.max(0, Math.min(slides.length - 1, index + step)))
  const close = () => (workspace.slidesNote = null)

  function onKeydown(event: KeyboardEvent) {
    if (!path) return
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      PageDown: 1,
      ' ': 1,
      ArrowLeft: -1,
      ArrowUp: -1,
      PageUp: -1,
    }
    if (event.key === 'Escape') close()
    else if (event.key in steps) go(steps[event.key])
    else return
    event.preventDefault()
    event.stopPropagation()
  }
</script>

<svelte:window onkeydowncapture={onKeydown} />

{#if path}
  <div class="slides" role="dialog" aria-label="Presentation">
    <div class="slide">
      {#key index}
        {#if slides[index] !== undefined}
          <MarkdownPreview text={slides[index]} source={path} />
        {/if}
      {/key}
    </div>
    <footer>
      <button title="Previous slide" disabled={index === 0} onclick={() => go(-1)}>
        <ChevronLeft size={18} />
      </button>
      <span>{slides.length ? index + 1 : 0} / {slides.length}</span>
      <button title="Next slide" disabled={index >= slides.length - 1} onclick={() => go(1)}>
        <ChevronRight size={18} />
      </button>
      <button title="End presentation (Esc)" onclick={close}><X size={18} /></button>
    </footer>
  </div>
{/if}

<style>
  .slides {
    position: fixed;
    z-index: 1000;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--background);
  }

  .slide {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    width: min(1100px, 90vw);
    min-height: 0;
    margin: 0 auto;
    overflow: auto;
    font-size: clamp(18px, 2.4vw, 32px);
  }

  .slide :global(.markdown) {
    font-size: inherit;
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 10px;
    color: var(--text-faint);
    font-size: 13px;
  }

  button {
    display: grid;
    place-items: center;
    padding: 4px;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }

  button:disabled {
    opacity: 0.3;
    cursor: default;
  }
</style>
