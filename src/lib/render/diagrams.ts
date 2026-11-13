import { Copy, createElement, type IconNode, Maximize2 } from 'lucide'
import { readPalette, themeVariables } from './diagram-theme'

let nextId = 0
let queue: Promise<unknown> = Promise.resolve()
let isWatchingTheme = false

export type DiagramAction = 'open' | 'copy' | 'svg' | 'png'

const ACTIONS: { action: DiagramAction; title: string; icon?: IconNode; label?: string }[] = [
  { action: 'open', title: 'Open full size', icon: Maximize2 },
  { action: 'copy', title: 'Copy as image', icon: Copy },
  { action: 'svg', title: 'Save as SVG', label: 'SVG' },
  { action: 'png', title: 'Save as PNG', label: 'PNG' },
]

/** Mermaid's theme for the app's colors and font as they are now. */
const currentTheme = () => themeVariables(readPalette())

async function draw(source: string) {
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: currentTheme(),
    // Without it, Mermaid leaves its scratch elements in the page when a diagram doesn't parse.
    suppressErrorRendering: true,
  })
  const { svg } = await mermaid.render(`mermaid-${nextId++}`, source)
  return svg
}

/** Diagrams take the app's colors and font, so redraw every one when the theme, the accent color
 * or the font changes. */
function redrawOnThemeChange() {
  let drawnWith = JSON.stringify(currentTheme())
  const redraw = () => {
    const theme = JSON.stringify(currentTheme())
    if (theme === drawnWith) return
    drawnWith = theme
    for (const image of document.querySelectorAll<HTMLElement>(
      '.diagram[data-source] > .diagram-image',
    )) {
      renderMermaid(image.parentElement?.dataset.source ?? '').then(
        (svg) => (image.innerHTML = svg),
        () => {},
      )
    }
  }
  new MutationObserver(redraw).observe(document.documentElement, { attributeFilter: ['style'] })
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw)
}

/** Renders a Mermaid diagram to SVG markup, loading Mermaid the first time. */
export function renderMermaid(source: string): Promise<string> {
  if (!isWatchingTheme) {
    isWatchingTheme = true
    redrawOnThemeChange()
  }
  // Mermaid keeps global state while rendering, so diagrams are drawn one at a time.
  const svg = queue.then(() => draw(source))
  queue = svg.catch(() => {})
  return svg
}

/** A rendered diagram, keeping its source to redraw it and the note it belongs to. */
export function diagramElement(svg: string, source: string, note: string) {
  const diagram = document.createElement('div')
  diagram.className = 'diagram'
  diagram.dataset.source = source
  diagram.dataset.note = note
  const image = document.createElement('div')
  image.className = 'diagram-image'
  image.innerHTML = svg
  diagram.append(image)
  return diagram
}

const previewDraws = new WeakMap<HTMLElement, number>()

/** Draws the diagram of a block being edited into `element`. When the source stops parsing, the
 * last diagram that worked stays, faded, above the error. */
export async function drawDiagramPreview(element: HTMLElement, source: string, note: string) {
  const draw = (previewDraws.get(element) ?? 0) + 1
  previewDraws.set(element, draw)
  if (!source.trim()) {
    element.replaceChildren()
    return
  }
  try {
    const svg = await renderMermaid(source)
    if (previewDraws.get(element) !== draw) return
    const diagram = diagramElement(svg, source, note)
    diagram.append(diagramToolbar())
    element.replaceChildren(diagram)
  } catch (error) {
    if (previewDraws.get(element) !== draw) return
    let message = element.querySelector<HTMLElement>(':scope > .diagram-error')
    if (!message) {
      message = Object.assign(document.createElement('div'), { className: 'diagram-error' })
      element.append(message)
    }
    message.textContent = String(error)
    element.querySelector(':scope > .diagram')?.classList.add('stale')
  }
}

/** Buttons shown over a diagram on hover; the app runs them by their `data-diagram-action`. */
export function diagramToolbar() {
  const toolbar = document.createElement('div')
  toolbar.className = 'diagram-toolbar'
  // The focus and the editor's selection stay where they were.
  toolbar.addEventListener('mousedown', (event) => event.preventDefault())
  for (const { action, title, icon, label } of ACTIONS) {
    const button = Object.assign(document.createElement('button'), { type: 'button', title })
    button.dataset.diagramAction = action
    button.setAttribute('aria-label', title)
    button.append(icon ? createElement(icon, { width: 14, height: 14 }) : (label ?? ''))
    toolbar.append(button)
  }
  return toolbar
}
