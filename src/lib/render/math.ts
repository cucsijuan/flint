const cache = new Map<string, Promise<HTMLElement>>()

/** Renders TeX with MathJax, the engine Obsidian uses, loading it the first time. */
export function renderMath(tex: string, display: boolean): Promise<HTMLElement> {
  const key = `${display ? 'block' : 'inline'}:${tex}`
  let rendered = cache.get(key)
  if (!rendered) {
    rendered = import('./mathjax').then(({ typeset }) => typeset(tex, display))
    cache.set(key, rendered)
  }
  return rendered.then((element) => element.cloneNode(true) as HTMLElement)
}
