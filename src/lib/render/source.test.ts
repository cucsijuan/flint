import { describe, expect, it } from 'vitest'
import { noteContent, replaceLines, toggleTask } from './source'

const note = '---\ntags: [a]\n---\n# Other\n\nIntro\n\n## Part\n\nPart body\n\n## Next\n\nNext body'

describe('note source', () => {
  it('strips frontmatter and extracts sections with their first line', () => {
    expect(noteContent('---\ntags: [a]\n---\nBody')).toEqual({ text: 'Body', firstLine: 3 })
    expect(noteContent(note, 'part')).toEqual({ text: '## Part\n\nPart body\n', firstLine: 7 })
    expect(noteContent(note, 'missing').text).toBe('')
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
})
