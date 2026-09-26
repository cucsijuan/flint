import { describe, expect, it } from 'vitest'
import {
  type Bookmark,
  moveBookmark,
  parseBookmarks,
  renameBookmarks,
  serializeBookmarks,
  toggleBookmark,
} from './bookmarks'

const note: Bookmark = { type: 'file', path: 'a/Note.md', ctime: 1 }
const heading: Bookmark = { type: 'heading', path: 'a/Note.md', subpath: '#Part', ctime: 2 }
const search: Bookmark = { type: 'search', query: 'tag:#x', ctime: 3 }

describe('bookmarks', () => {
  it('toggles bookmarks by what they point to', () => {
    const added = toggleBookmark([note], { type: 'search', query: 'tag:#x' }, 3)
    expect(added).toEqual([note, search])
    expect(toggleBookmark(added, { type: 'file', path: 'a/Note.md' })).toEqual([search])
  })

  it('reorders and follows renamed paths', () => {
    expect(moveBookmark([note, heading, search], 2, 0)).toEqual([search, note, heading])
    expect(renameBookmarks([heading, search], 'a', 'b')).toEqual([
      { ...heading, path: 'b/Note.md' },
      search,
    ])
  })

  it("reads Obsidian's format, skipping groups and broken items", () => {
    const json = JSON.stringify({
      items: [note, { type: 'group', items: [] }, { type: 'file' }, search],
    })
    expect(parseBookmarks(json)).toEqual([note, search])
    expect(parseBookmarks(serializeBookmarks([heading]))).toEqual([heading])
    expect(parseBookmarks(null)).toEqual([])
  })
})
