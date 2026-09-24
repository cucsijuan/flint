import { describe, expect, it } from 'vitest'
import { noteTitle, parentOf, replacePrefix, uniqueName } from './paths'

describe('paths', () => {
  it('derives parents and note titles', () => {
    expect(parentOf('a/b/note.md')).toBe('a/b')
    expect(parentOf('note.md')).toBe('')
    expect(noteTitle('a/My Note.md')).toBe('My Note')
  })

  it('moves paths inside a renamed folder only', () => {
    expect(replacePrefix('old/note.md', 'old', 'new')).toBe('new/note.md')
    expect(replacePrefix('older/note.md', 'old', 'new')).toBe('older/note.md')
  })

  it('picks the first free name', () => {
    const taken = new Set(['dir/Untitled.md', 'dir/Untitled 1.md'])
    expect(uniqueName(taken, 'dir', 'Untitled', '.md')).toBe('dir/Untitled 2.md')
    expect(uniqueName(taken, '', 'Untitled', '.md')).toBe('Untitled.md')
  })
})
