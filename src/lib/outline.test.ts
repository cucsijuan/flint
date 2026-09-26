import { describe, expect, it } from 'vitest'
import { outlineOf } from './outline'

describe('outlineOf', () => {
  it('lists headings with their level and line, skipping frontmatter and code', () => {
    const note =
      '---\ntitle: x\n---\n# One\n\ntext\n\n## Two ##\n\n```\n# not a heading\n```\n\nThree\n-----'
    expect(outlineOf(note)).toEqual([
      { level: 1, text: 'One', line: 4 },
      { level: 2, text: 'Two', line: 8 },
      { level: 2, text: 'Three', line: 14 },
    ])
  })
})
