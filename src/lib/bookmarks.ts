import { replacePrefix } from './paths'

export type BookmarkTarget =
  | { type: 'file'; path: string }
  | { type: 'heading'; path: string; subpath: string }
  | { type: 'search'; query: string }

/** Stored as Obsidian stores them in `bookmarks.json`, so bookmarks survive switching apps. */
export type Bookmark = BookmarkTarget & { ctime: number }

const keyOf = (bookmark: BookmarkTarget) => {
  switch (bookmark.type) {
    case 'file':
      return `file:${bookmark.path}`
    case 'heading':
      return `heading:${bookmark.path}${bookmark.subpath}`
    case 'search':
      return `search:${bookmark.query}`
  }
}

export const isSameBookmark = (a: BookmarkTarget, b: BookmarkTarget) => keyOf(a) === keyOf(b)

export function toggleBookmark(bookmarks: Bookmark[], bookmark: BookmarkTarget, now = Date.now()) {
  const without = bookmarks.filter((known) => !isSameBookmark(known, bookmark))
  return without.length < bookmarks.length ? without : [...bookmarks, { ...bookmark, ctime: now }]
}

/** Moves the bookmark at `from` so that it ends up at index `to` of the result. */
export function moveBookmark(bookmarks: Bookmark[], from: number, to: number) {
  const moved = [...bookmarks]
  const [bookmark] = moved.splice(from, 1)
  moved.splice(to, 0, bookmark)
  return moved
}

export const renameBookmarks = (bookmarks: Bookmark[], from: string, to: string) =>
  bookmarks.map((bookmark) =>
    'path' in bookmark ? { ...bookmark, path: replacePrefix(bookmark.path, from, to) } : bookmark,
  )

export function parseBookmarks(json: string | null): Bookmark[] {
  const stored: unknown = JSON.parse(json ?? '{}')
  const items = (stored as { items?: unknown } | null)?.items
  if (!Array.isArray(items)) return []
  return items.filter((item): item is Bookmark => {
    const { type, path, subpath, query } = item as Record<string, unknown>
    if (type === 'file') return typeof path === 'string'
    if (type === 'heading') return typeof path === 'string' && typeof subpath === 'string'
    return type === 'search' && typeof query === 'string'
  })
}

export const serializeBookmarks = (bookmarks: Bookmark[]) =>
  JSON.stringify({ items: bookmarks }, null, 2)
