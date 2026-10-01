// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

const mounted: string[] = []
vi.mock('../canvas/mount.svelte', () => ({
  mountCanvas: (_element: HTMLElement, path: string) => mounted.push(path),
}))

const { hydrate } = await import('./hydrate')
const { renderMarkdown } = await import('./markdown')

describe('canvas embeds', () => {
  it('mounts the canvas', async () => {
    const root = document.createElement('div')
    root.innerHTML = renderMarkdown('![[Board.canvas]]')
    await hydrate(root, {
      source: 'Note.md',
      resolve: async (targets) =>
        targets.map((target) => (target === 'Board.canvas' ? target : null)),
      assetUrl: (path) => path,
      readNote: async () => '',
      editNote: async () => {},
    })
    expect(mounted).toEqual(['Board.canvas'])
  })
})
