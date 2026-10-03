export type Theme = 'system' | 'light' | 'dark'

/** Stored in `.flint/appearance.json`, with Obsidian's keys. */
export interface AppearanceSettings {
  theme: Theme
  /** A CSS color; empty keeps the theme's accent. */
  accentColor: string
  baseFontSize: number
  textFontFamily: string
  monospaceFontFamily: string
  enabledCssSnippets: string[]
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'system',
  accentColor: '',
  baseFontSize: 16,
  textFontFamily: '',
  monospaceFontFamily: '',
  enabledCssSnippets: [],
}

export function applyAppearance(
  settings: AppearanceSettings,
  readableLineLength: boolean,
  readableLineWidth: number,
  root = document.documentElement,
) {
  const set = (name: string, value: string) =>
    value ? root.style.setProperty(name, value) : root.style.removeProperty(name)
  if (settings.theme === 'system') delete root.dataset.theme
  else root.dataset.theme = settings.theme
  set('--accent', settings.accentColor)
  set('--font-text', settings.textFontFamily && `${settings.textFontFamily}, system-ui, sans-serif`)
  set('--font-mono', settings.monospaceFontFamily && `${settings.monospaceFontFamily}, monospace`)
  set('--font-size', `${settings.baseFontSize}px`)
  set('--line-width', readableLineLength ? `${readableLineWidth}px` : '100%')
}

/** Replaces the page's snippet stylesheets with `snippets` (name → CSS). */
export function applySnippets(snippets: Map<string, string>) {
  for (const style of document.head.querySelectorAll('style[data-snippet]')) style.remove()
  for (const [name, css] of snippets) {
    const style = Object.assign(document.createElement('style'), { textContent: css })
    style.dataset.snippet = name
    document.head.append(style)
  }
}
