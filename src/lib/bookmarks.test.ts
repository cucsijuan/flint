import { describe, expect, it } from 'vitest'
import {
  addGroup,
  type Bookmark,
  type BookmarkGroup,
  type BookmarkItem,
  containsBookmark,
  moveBookmark,
  parseBookmarks,
  renameBookmarks,
  renameGroup,
  serializeBookmarks,
  toggleBookmark,
  ungroup,
} from './bookmarks'

const note: Bookmark = { type: 'file', path: 'a/Note.md', ctime: 1 }
const heading: Bookmark = { type: 'heading', path: 'a/Note.md', subpath: '#Part', ctime: 2 }
const search: Bookmark = { type: 'search', query: 'tag:#x', ctime: 3 }
const group = (items: BookmarkItem[], ctime = 10): BookmarkGroup => ({
  type: 'group',
  ctime,
  title: 'Group',
  items,
})

describe('bookmarks', () => {
  it('toggles bookmarks by what they point to, inside groups too', () => {
    const added = toggleBookmark([note], { type: 'search', query: 'tag:#x' }, 3)
    expect(added).toEqual([note, search])
    expect(toggleBookmark(added, { type: 'file', path: 'a/Note.md' })).toEqual([search])
    const grouped = [group([note])]
    expect(containsBookmark(grouped, { type: 'file', path: 'a/Note.md' })).toBe(true)
    expect(toggleBookmark(grouped, { type: 'file', path: 'a/Note.md' })).toEqual([group([])])
  })

  it('moves items within a list, into groups and out of them', () => {
    expect(moveBookmark([note, heading, search], [2], [], 0)).toEqual([search, note, heading])
    expect(moveBookmark([note, heading, search], [0], [], 3)).toEqual([heading, search, note])
    expect(moveBookmark([note, group([heading])], [0], [1], 1)).toEqual([group([heading, note])])
    expect(moveBookmark([group([heading]), note], [0, 0], [], 2)).toEqual([
      group([]),
      note,
      heading,
    ])
    const nested = [group([], 10), group([], 11)]
    expect(moveBookmark(nested, [0], [0], 0)).toEqual(nested)
    expect(moveBookmark(nested, [0], [1], 0)).toEqual([group([group([], 10)], 11)])
  })

  it('creates, renames and dissolves groups', () => {
    const items = addGroup([note], 'Work', 5)
    expect(items).toEqual([note, { type: 'group', ctime: 5, title: 'Work', items: [] }])
    expect(renameGroup(items, [1], 'Home')[1]).toMatchObject({ title: 'Home' })
    expect(ungroup([group([heading, search]), note], [0])).toEqual([heading, search, note])
  })

  it('follows renamed paths', () => {
    expect(renameBookmarks([group([heading]), search], 'a', 'b')).toEqual([
      group([{ ...heading, path: 'b/Note.md' }]),
      search,
    ])
  })

  it("reads Obsidian's format, keeping groups and kinds it doesn't show", () => {
    const graph = { type: 'graph', ctime: 4, title: 'My graph' }
    const json = JSON.stringify({
      items: [
        note,
        { type: 'group', ctime: 9, title: 'G', items: [search] },
        { type: 'file' },
        graph,
      ],
    })
    const parsed = parseBookmarks(json)
    expect(parsed).toEqual([
      note,
      { type: 'group', ctime: 9, title: 'G', items: [search] },
      { type: 'other', raw: graph },
    ])
    expect(JSON.parse(serializeBookmarks(parsed)).items[2]).toEqual(graph)
    expect(parseBookmarks(serializeBookmarks([heading]))).toEqual([heading])
    expect(parseBookmarks(null)).toEqual([])
  })
})
