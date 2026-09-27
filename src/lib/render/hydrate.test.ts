// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { hydrate, type HydrateContext } from './hydrate'
import { renderMarkdown } from './markdown'
import { processors } from './processors.svelte'

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
  editNote: async () => {},
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

describe('interactive content', () => {
  it('toggles tasks in their source note', async () => {
    const edits: string[] = []
    const root = document.createElement('div')
    root.innerHTML = renderMarkdown('- [ ] one\n- [ ] two', { firstLine: 4 })
    const text = '---\na: 1\n---\n\n- [ ] one\n- [ ] two'
    await hydrate(root, {
      ...context,
      editNote: async (path, edit) => void edits.push(`${path}: ${edit(text)}`),
    })
    root.querySelectorAll('input')[1].dispatchEvent(new Event('change'))
    expect(edits).toEqual(['Note.md: ---\na: 1\n---\n\n- [ ] one\n- [x] two'])
  })

  it('treats Markdown links to vault paths as internal links', async () => {
    const root = await hydrated('[a](Other%20Note.md#Part) [b](https://x.com) [c](Missing.md)')
    const links = [...root.querySelectorAll('a')].map((link) => [
      link.dataset.link ?? null,
      link.classList.contains('unresolved'),
    ])
    expect(links).toEqual([
      ['Other Note.md#Part', true],
      [null, false],
      ['Missing.md', true],
    ])
  })

  it('adds copy buttons to code blocks', async () => {
    const root = await hydrated('```\ncode\n```')
    expect(root.querySelector('pre button.copy-code')).not.toBeNull()
  })

  it('runs plugin processors with the source of each block', async () => {
    const seen: string[] = []
    const removeCode = processors.addCodeBlockProcessor('chart', (source, element, markdown) => {
      element.textContent = `chart of ${source.trim()}`
      seen.push(`${markdown.sourcePath} ${JSON.stringify(markdown.sectionOf(element))}`)
    })
    const removePost = processors.addPostProcessor((element) => {
      element.querySelector('p')?.classList.add('processed')
    })
    const root = await hydrated('Intro\n\n```chart\n1 2\n```')
    removeCode()
    removePost()

    expect(root.querySelector('.code-block-plugin')?.textContent).toBe('chart of 1 2')
    expect(root.querySelector('p.processed')).not.toBeNull()
    expect(seen).toEqual(['Note.md {"lineStart":2,"lineEnd":5}'])
    expect(processors.codeBlock('chart')).toBeUndefined()
  })
})
