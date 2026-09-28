// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

const render = (text: string) => {
  const container = document.createElement('div')
  container.innerHTML = renderMarkdown(text)
  return container
}

describe('renderMarkdown', () => {
  it('renders wikilinks with their destination and alias', () => {
    const links = [...render('[[Note]] [[Note#Part]] [[Note|Shown]]').querySelectorAll('a')]
    expect(links.map((link) => [link.dataset.link, link.textContent])).toEqual([
      ['Note', 'Note'],
      ['Note#Part', 'Note › Part'],
      ['Note', 'Shown'],
    ])
  })

  it('leaves embeds as placeholders to be filled later', () => {
    const embed = render('![[Picture.png|Alt]]').querySelector<HTMLElement>('.internal-embed')
    expect(embed?.dataset.embed).toBe('Picture.png')
    expect(embed?.title).toBe('Alt')
  })

  it('renders tags but not headings, numbers or code', () => {
    const tags = render('#tag and #nested/one #123\n\n# Heading\n\n`#code`').querySelectorAll(
      'a.tag',
    )
    expect([...tags].map((tag) => tag.getAttribute('data-tag'))).toEqual(['tag', 'nested/one'])
  })

  it('renders task lists', () => {
    const items = render('- [ ] todo\n- [x] done\n- plain').querySelectorAll('li')
    expect([...items].map((item) => item.querySelector('input')?.checked ?? null)).toEqual([
      false,
      true,
      null,
    ])
    expect(items[0].textContent?.trim()).toBe('todo')
  })

  it('marks blocks with their source lines, offset by the first line', () => {
    const root = render('# Title\n\n- [ ] task\n- two')
    expect(root.querySelector('h1')?.dataset).toMatchObject({ line: '0', lineEnd: '1' })
    expect(root.querySelector('li')?.dataset.line).toBe('2')
    const offset = document.createElement('div')
    offset.innerHTML = renderMarkdown('para', { firstLine: 5 })
    expect(offset.querySelector('p')?.dataset.line).toBe('5')
  })

  it('renders callouts, foldable with + and -', () => {
    const root = render(
      '> [!warning] Careful\n> body\n\n> [!tip]-\n> hidden\n\n> [!note]+ Open\n> shown',
    )
    const [plain, closed, open] = root.querySelectorAll<HTMLElement>('.callout')
    expect(plain.tagName).toBe('DIV')
    expect(plain.dataset.callout).toBe('warning')
    expect(plain.querySelector('.callout-title')?.textContent).toBe('Careful')
    expect(plain.querySelector('.callout-content')?.textContent?.trim()).toBe('body')
    expect(closed.tagName).toBe('DETAILS')
    expect(closed.hasAttribute('open')).toBe(false)
    expect(closed.querySelector('summary')?.textContent).toBe('Tip')
    expect(open.hasAttribute('open')).toBe(true)
  })

  it('renders highlights, footnotes and math placeholders', () => {
    const root = render('==key== $x^2$ and a note[^1]\n\n$$\n\\sum_i\n$$\n\n[^1]: The note.')
    expect(root.querySelector('mark')?.textContent).toBe('key')
    const [inline, block] = root.querySelectorAll<HTMLElement>('.math')
    expect([inline.dataset.tex, inline.tagName]).toEqual(['x^2', 'SPAN'])
    expect(block.classList.contains('math-block')).toBe(true)
    expect(root.querySelector('.footnote-item')?.textContent).toContain('The note.')
  })

  it('hides comments, keeping the text around them', () => {
    const text = render(
      'Shown %%inline%% here\n\n%%\nmany\nlines\n%%\n\n%%start%% then text',
    ).textContent
    expect(text).not.toMatch(/inline|many|start/)
    expect(text).toMatch(/Shown\s+here[\s\S]*then text/)
  })

  it('hides block ids', () => {
    const root = render('Para ^one\n\n- item ^two\n\n| a |\n| - |\n\n^three\n\nText\n^four')
    expect(root.textContent).not.toMatch(/\^|one|two|three|four/)
    expect(root.querySelectorAll('p')).toHaveLength(2)
  })

  it('removes scripts and event handlers from raw HTML', () => {
    const html = renderMarkdown(
      '<img src=x onerror="alert(1)"><script>alert(2)</script>[x](javascript:alert(3))',
    )
    expect(html).not.toMatch(/onerror|<script|href="javascript:/)
  })
})
