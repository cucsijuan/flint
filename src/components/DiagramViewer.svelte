<script lang="ts">
  import { Copy, Scan, X, ZoomIn, ZoomOut } from '@lucide/svelte'
  import { diagrams } from '../lib/diagrams.svelte'
  import { fit, type Point, type Size, type View, zoomAt } from '../lib/pan-zoom'
  import { diagramSize } from '../lib/render/diagram-image'
  import { diagramElement, renderMermaid } from '../lib/render/diagrams'

  const PADDING = 32
  const ZOOM_STEP = 1.25
  /** How much each pixel scrolled with the wheel zooms. */
  const WHEEL_ZOOM = 0.002
  const LINE_HEIGHT = 16

  const viewing = $derived(diagrams.viewing)
  let stage = $state<HTMLElement>()
  let diagram = $state<HTMLElement | null>(null)
  let error = $state<string | null>(null)
  let size: Size = { width: 0, height: 0 }
  let view = $state<View>({ x: 0, y: 0, zoom: 1 })
  let dragFrom = $state<Point | null>(null)

  $effect(() => {
    const current = viewing
    diagram = null
    error = null
    if (!current) return
    let isCurrent = true
    renderMermaid(current.source).then(
      (svg) => {
        if (isCurrent) diagram = diagramElement(svg, current.source, current.note)
      },
      (reason: unknown) => {
        if (isCurrent) error = String(reason)
      },
    )
    return () => (isCurrent = false)
  })

  const stageSize = (): Size => ({
    width: stage?.clientWidth ?? 0,
    height: stage?.clientHeight ?? 0,
  })
  const center = (): Point => {
    const { width, height } = stageSize()
    return { x: width / 2, y: height / 2 }
  }

  /** Takes the focus from the note underneath, so typing can't change it, and gives it back. */
  function holdFocus(element: HTMLElement) {
    const previous = document.activeElement
    element.focus()
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }

  /** Shows the diagram at its own size, scaled by the view, and fits it in the window. */
  function mount(element: HTMLElement) {
    if (!diagram) return
    element.replaceChildren(diagram)
    const svg = diagram.querySelector<SVGSVGElement>('.diagram-image > svg')
    const image = diagram.querySelector<HTMLElement>('.diagram-image')
    size = svg ? diagramSize(svg) : { width: 0, height: 0 }
    image?.style.setProperty('width', `${size.width}px`)
    image?.style.setProperty('height', `${size.height}px`)
    view = fit(size, stageSize(), PADDING)
  }

  const zoomBy = (factor: number, at = center()) => (view = zoomAt(view, factor, at))
  const fitToWindow = () => (view = fit(size, stageSize(), PADDING))
  const actualSize = () => zoomBy(1 / view.zoom)

  function onWheel(event: WheelEvent) {
    event.preventDefault()
    const delta =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * LINE_HEIGHT : event.deltaY
    const box = event.currentTarget as HTMLElement
    const { left, top } = box.getBoundingClientRect()
    zoomBy(Math.exp(-delta * WHEEL_ZOOM), { x: event.clientX - left, y: event.clientY - top })
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return
    dragFrom = { x: event.clientX, y: event.clientY }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragFrom) return
    view = {
      ...view,
      x: view.x + event.clientX - dragFrom.x,
      y: view.y + event.clientY - dragFrom.y,
    }
    dragFrom = { x: event.clientX, y: event.clientY }
  }

  function onKeydown(event: KeyboardEvent) {
    if (!viewing || event.ctrlKey || event.metaKey || event.altKey) return
    const actions: Record<string, () => unknown> = {
      Escape: () => diagrams.close(),
      '+': () => zoomBy(ZOOM_STEP),
      '=': () => zoomBy(ZOOM_STEP),
      '-': () => zoomBy(1 / ZOOM_STEP),
      '0': fitToWindow,
      '1': actualSize,
    }
    const action = actions[event.key]
    if (!action) return
    event.preventDefault()
    event.stopPropagation()
    action()
  }
</script>

<svelte:window onkeydowncapture={onKeydown} />

{#if viewing}
  <div
    class="diagram-viewer"
    role="dialog"
    aria-modal="true"
    aria-label="Diagram"
    tabindex="-1"
    {@attach holdFocus}
  >
    <div
      class="stage"
      class:dragging={dragFrom !== null}
      role="presentation"
      bind:this={stage}
      onwheel={onWheel}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={() => (dragFrom = null)}
      onpointercancel={() => (dragFrom = null)}
    >
      {#if error}
        <p class="error">{error}</p>
      {/if}
      <div
        class="content"
        style:transform="translate({view.x}px, {view.y}px) scale({view.zoom})"
        {@attach mount}
      ></div>
    </div>
    <footer>
      <button title="Zoom out (-)" onclick={() => zoomBy(1 / ZOOM_STEP)}>
        <ZoomOut size={18} />
      </button>
      <button class="zoom" title="Actual size (1)" onclick={actualSize}>
        {Math.round(view.zoom * 100)}%
      </button>
      <button title="Zoom in (+)" onclick={() => zoomBy(ZOOM_STEP)}><ZoomIn size={18} /></button>
      <button title="Fit to window (0)" onclick={fitToWindow}><Scan size={18} /></button>
      <span class="separator"></span>
      <button
        title="Copy as image"
        disabled={!diagram}
        onclick={() => diagram && void diagrams.copy(diagram)}
      >
        <Copy size={18} />
      </button>
      <button
        class="format"
        title="Save as SVG"
        disabled={!diagram}
        onclick={() => diagram && void diagrams.save(diagram, 'svg')}
      >
        SVG
      </button>
      <button
        class="format"
        title="Save as PNG"
        disabled={!diagram}
        onclick={() => diagram && void diagrams.save(diagram, 'png')}
      >
        PNG
      </button>
      <span class="separator"></span>
      <button title="Close (Esc)" onclick={() => diagrams.close()}><X size={18} /></button>
    </footer>
  </div>
{/if}

<style>
  .diagram-viewer {
    position: fixed;
    z-index: 1001;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--background);
    outline: none;
  }

  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  .stage.dragging {
    cursor: grabbing;
  }

  .content {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
  }

  .content :global(.diagram-image svg) {
    display: block;
    width: 100%;
    height: 100%;
  }

  .error {
    margin: 0;
    padding: 24px;
    color: #d04545;
    font-family: var(--font-mono);
    font-size: 0.85em;
    white-space: pre-wrap;
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px;
    border-top: 1px solid var(--border);
  }

  button {
    display: grid;
    place-items: center;
    min-width: 30px;
    height: 30px;
    padding: 0 6px;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--text-muted);
    font: inherit;
    font-size: 13px;
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

  .zoom {
    min-width: 56px;
    font-variant-numeric: tabular-nums;
  }

  .format {
    font-size: 12px;
    font-weight: 600;
  }

  .separator {
    width: 1px;
    height: 18px;
    margin: 0 6px;
    background: var(--border);
  }
</style>
