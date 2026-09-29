import { describe, expect, it } from 'vitest'
import { newNoteDefaults, updateBase } from './edit'

describe('editing bases', () => {
  it('rewrites only the keys that changed and keeps comments', () => {
    const source =
      '# my books\nfilters: file.hasTag("book")\nviews:\n  - type: table\n    name: All\n'
    const updated = updateBase(source, (config) => {
      config.views[0].sort = [{ property: 'note.rating', direction: 'DESC' }]
    })
    expect(updated).toContain('# my books')
    expect(updated).toContain('filters: file.hasTag("book")')
    expect(updated).toContain('property: note.rating')
  })

  it('reads new note defaults from simple and-filters', () => {
    expect(
      newNoteDefaults([
        { and: ['file.inFolder("Books")', 'status == "reading"', 'file.hasTag("book")'] },
        'rating == 3',
        { or: ['done == true'] },
      ]),
    ).toEqual({ folder: 'Books', tags: ['book'], properties: { status: 'reading', rating: 3 } })
  })
})
