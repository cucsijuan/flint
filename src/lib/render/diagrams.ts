import { Copy, createElement, type IconNode, Maximize2 } from 'lucide'

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

const isDark = () => {
  const forced = document.documentElement.style.colorScheme
  return forced ? forced === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
}

async function draw(source: string) {
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark() ? 'dark' : 'default',
    themeVariables: { useGradient: false },
  })
  const { svg } = await mermaid.render(`mermaid-${nextId++}`, source)
  return svg
}

/** Diagrams take their colors from the theme, so redraw every one when it changes. */
function redrawOnThemeChange() {
  let wasDark = isDark()
  const redraw = () => {
    if (isDark() === wasDark) return
    wasDark = isDark()
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
