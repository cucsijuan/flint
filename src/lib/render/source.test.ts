import { describe, expect, it } from 'vitest'
import {
  blockLines,
  insertBlockAfter,
  noteBlocks,
  noteContent,
  replaceFencedContent,
  replaceLines,
  toggleTask,
  withBlockId,
} from './source'

const note = '---\ntags: [a]\n---\n# Other\n\nIntro\n\n## Part\n\nPart body\n\n## Next\n\nNext body'

describe('note source', () => {
  it('strips frontmatter and extracts sections with their first line', () => {
    expect(noteContent('---\ntags: [a]\n---\nBody')).toEqual({ text: 'Body', firstLine: 3 })
    expect(noteContent(note, 'part')).toEqual({ text: '## Part\n\nPart body\n', firstLine: 7 })
    expect(noteContent(note, 'missing').text).toBe('')
  })

  it('finds blocks marked with ^ids', () => {
    const text = [
      'Intro',
      'first para ^para',
      '',
      '- one',
      '- two ^item',
      '  - child',
      '- three',
      '',
      '| a |',
      '| - |',
      '',
      '^table',
    ].join('\n')
    const lines = text.split('\n')
    expect(blockLines(lines, 'para')).toEqual([0, 2])
    expect(blockLines(lines, 'ITEM')).toEqual([4, 6])
    expect(blockLines(lines, 'table')).toEqual([8, 10])
    expect(blockLines(lines, 'missing')).toBeNull()
    expect(noteContent(`---\na: 1\n---\n${text}`, '^item')).toEqual({
      text: '- two ^item\n  - child',
      firstLine: 7,
    })
    expect(noteBlocks(text).map(({ id, text, line }) => `${line} ${id}: ${text}`)).toEqual([
      '1 para: Intro first para',
      '3 null: one',
      '4 item: two',
      '5 null: child',
      '6 null: three',
      '9 table: | a | | - |',
    ])
  })

  it('adds block ids where Obsidian expects them', () => {
    const text = '---\na: 1\n---\nA paragraph\n\n> quote\n\n```\ncode\n```'
    const [paragraph, quote] = noteBlocks(text)
    expect(noteBlocks(text)).toHaveLength(2)
    expect(withBlockId(text, paragraph, 'abc')).toContain('A paragraph ^abc\n')
    expect(withBlockId(text, quote, 'q1')).toContain('> quote\n\n^q1\n')
  })

  it('toggles tasks only on task lines', () => {
    const text = '- [ ] a\n  * [x] b\n1. [ ] c\n- plain'
    expect(toggleTask(text, 0)).toBe('- [x] a\n  * [x] b\n1. [ ] c\n- plain')
    expect(toggleTask(text, 1)).toBe('- [ ] a\n  * [ ] b\n1. [ ] c\n- plain')
    expect(toggleTask(text, 2)).toBe('- [ ] a\n  * [x] b\n1. [x] c\n- plain')
    expect(toggleTask(text, 3)).toBeNull()
  })

  it('replaces and removes lines', () => {
    expect(replaceLines('a\nb\nc', 1, 2, 'x\ny')).toBe('a\nx\ny\nc')
    expect(replaceLines('a\nb\nc', 0, 2, '')).toBe('c')
  })

  it('replaces fenced content inside quotes and lists, keeping the fences', () => {
    const text = 'intro\n> ~~~~base\n> old: 1\n> ~~~~\n- item\n  ```base\n  a: 1\n  ```'
    expect(replaceFencedContent(text, 1, 4, 'views:\n  - type: table\n')).toBe(
      'intro\n> ~~~~base\n> views:\n>   - type: table\n> ~~~~\n- item\n  ```base\n  a: 1\n  ```',
    )
    expect(replaceFencedContent(text, 5, 8, 'b: 2')).toBe(
      'intro\n> ~~~~base\n> old: 1\n> ~~~~\n- item\n  ```base\n  b: 2\n  ```',
    )
    expect(replaceFencedContent(text, 0, 1, 'x')).toBeNull()
  })
})

describe('insertBlockAfter', () => {
  it('puts the block on its own lines after a block or at the end', () => {
    expect(insertBlockAfter('# A\nText\n\nMore', 2, '![[x.png]]')).toBe(
      '# A\nText\n\n![[x.png]]\n\nMore',
    )
    expect(insertBlockAfter('# A\nText', 1, '![[x.png]]')).toBe('# A\n\n![[x.png]]\n\nText')
    expect(insertBlockAfter('Text', null, '![[x.png]]')).toBe('Text\n\n![[x.png]]')
  })
})
