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

  it('removes scripts and event handlers from raw HTML', () => {
    const html = renderMarkdown(
      '<img src=x onerror="alert(1)"><script>alert(2)</script>[x](javascript:alert(3))',
    )
    expect(html).not.toMatch(/onerror|<script|href="javascript:/)
  })
})
