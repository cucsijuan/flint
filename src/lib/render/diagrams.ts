let nextId = 0
let queue: Promise<unknown> = Promise.resolve()
let isWatchingTheme = false

const isDark = () => {
  const forced = document.documentElement.dataset.theme
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
    for (const diagram of document.querySelectorAll<HTMLElement>('.diagram[data-source]')) {
      renderMermaid(diagram.dataset.source ?? '').then(
        (svg) => (diagram.innerHTML = svg),
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
