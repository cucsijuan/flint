// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { extractSection, hydrate, type HydrateContext, stripFrontmatter } from './hydrate'
import { renderMarkdown } from './markdown'

const notes: Record<string, string> = {
  'Other.md': '# Other\n\nIntro\n\n## Part\n\nPart body\n\n## Next\n\nNext body',
  'Loop.md': '![[Loop]]',
}
const paths: Record<string, string> = {
  Other: 'Other.md',
  Loop: 'Loop.md',
  'pic.png': 'assets/pic.png',
  'assets/pic.png': 'assets/pic.png',
}
const context: HydrateContext = {
  source: 'Note.md',
  resolve: async (targets) => targets.map((target) => paths[target] ?? null),
  assetUrl: (path) => `asset://${path}`,
  readNote: async (path) => notes[path],
}

async function hydrated(text: string) {
  const root = document.createElement('div')
  root.innerHTML = renderMarkdown(text)
  await hydrate(root, context)
  return root
}

describe('hydrate', () => {
  it('marks unresolved links', async () => {
    const root = await hydrated('[[Other]] [[Missing]]')
    expect([...root.querySelectorAll('a.unresolved')].map((link) => link.textContent)).toEqual([
      'Missing',
    ])
  })

  it('embeds images, including standard markdown ones', async () => {
    const root = await hydrated(
      '![[pic.png|120]] ![alt](assets/pic.png) ![web](https://x.com/a.png)',
    )
    const sources = [...root.querySelectorAll('img')].map((image) => image.getAttribute('src'))
    expect(sources).toEqual([
      'asset://assets/pic.png',
      'asset://assets/pic.png',
      'https://x.com/a.png',
    ])
    expect(root.querySelector('img')?.width).toBe(120)
  })

  it('embeds notes and sections, stopping at the depth limit', async () => {
    const section = await hydrated('![[Other#Part]]')
    expect(section.querySelector('.embed-body')?.textContent).toContain('Part body')
    expect(section.querySelector('.embed-body')?.textContent).not.toContain('Next body')

    const loop = await hydrated('![[Loop]]')
    expect(loop.querySelectorAll('.note-embed')).toHaveLength(3)
  })

  it('shows missing embeds as text', async () => {
    const root = await hydrated('![[Nowhere]]')
    expect(root.querySelector('.missing')?.textContent).toBe('Nowhere')
  })
})

describe('text helpers', () => {
  it('strips frontmatter and extracts sections', () => {
    expect(stripFrontmatter('---\ntags: [a]\n---\nBody')).toBe('Body')
    expect(extractSection(notes['Other.md'], 'part')).toBe('## Part\n\nPart body\n')
  })
})
