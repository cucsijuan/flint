// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

let theme = ''
vi.mock('mermaid', () => ({
  default: {
    initialize: (config: { theme: string }) => (theme = config.theme),
    render: async (id: string, source: string) => {
      if (source.includes('oops')) throw new Error('Parse error on line 1')
      return {
        svg: `<svg id="${id}" data-theme="${theme}" viewBox="0 0 120 40"><text>${source.trim()}</text></svg>`,
      }
    },
  },
}))

let prefersDark = false
const themeListeners: (() => void)[] = []
vi.stubGlobal('matchMedia', () => ({
  get matches() {
    return prefersDark
  },
  addEventListener: (_type: string, listener: () => void) => themeListeners.push(listener),
}))

const { hydrate } = await import('./hydrate')
const { renderMarkdown } = await import('./markdown')

async function hydrated(text: string) {
  const root = document.createElement('div')
  root.innerHTML = renderMarkdown(text)
  document.body.append(root)
  await hydrate(root, {
    source: 'Notes/Flow.md',
    resolve: async (targets) => targets.map(() => null),
    assetUrl: (path) => path,
    readNote: async () => '',
    editNote: async () => {},
  })
  return root
}

describe('Mermaid diagrams', () => {
  it('render with their source, their note and a toolbar', async () => {
    const root = await hydrated('```mermaid\ngraph LR\n  A --> B\n```')
    const diagram = root.querySelector<HTMLElement>('.diagram')

    expect(root.querySelector('pre')).toBeNull()
    expect(diagram?.dataset.source).toBe('graph LR\n  A --> B\n')
    expect(diagram?.dataset.note).toBe('Notes/Flow.md')
    expect(diagram?.querySelector('.diagram-image > svg text')?.textContent).toBe(
      'graph LR\n  A --> B',
    )
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('.diagram-toolbar button')]
    expect(buttons.map((button) => [button.dataset.diagramAction, button.title])).toEqual([
      ['open', 'Open full size'],
      ['copy', 'Copy as image'],
      ['svg', 'Save as SVG'],
      ['png', 'Save as PNG'],
    ])
  })

  it('show what went wrong below the code when they fail', async () => {
    const root = await hydrated('```mermaid\noops\n```')
    expect(root.querySelector('pre')).not.toBeNull()
    expect(root.querySelector('.diagram')).toBeNull()
    expect(root.querySelector('.diagram-error')?.textContent).toContain('Parse error on line 1')
  })

  it('redraw in the new theme, keeping their toolbar', async () => {
    const root = await hydrated('```mermaid\ngraph TD\n  C --> D\n```')
    const svg = () => root.querySelector('.diagram-image > svg')
    expect(svg()?.getAttribute('data-theme')).toBe('default')

    prefersDark = true
    for (const listener of themeListeners) listener()

    await vi.waitFor(() => expect(svg()?.getAttribute('data-theme')).toBe('dark'))
    expect(root.querySelectorAll('.diagram-toolbar button')).toHaveLength(4)
  })
})
