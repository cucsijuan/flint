import { replacePrefix } from './paths'

export type BookmarkTarget =
  | { type: 'file'; path: string }
  | { type: 'folder'; path: string }
  | { type: 'heading'; path: string; subpath: string }
  | { type: 'search'; query: string }

/** Stored as Obsidian stores them in `bookmarks.json`, so bookmarks survive switching apps. */
export type Bookmark = BookmarkTarget & { ctime: number; title?: string }

export interface BookmarkGroup {
  type: 'group'
  ctime: number
  title: string
  items: BookmarkItem[]
}

/** Kinds Flint doesn't show (graph views, for example), kept so Obsidian still finds them. */
export interface OtherBookmark {
  type: 'other'
  raw: Record<string, unknown>
}

export type BookmarkItem = Bookmark | BookmarkGroup | OtherBookmark

/** Where an item sits: its index in the root list, then in each group down to it. */
export type BookmarkPath = number[]

const keyOf = (bookmark: BookmarkTarget) => {
  switch (bookmark.type) {
    case 'file':
    case 'folder':
      return `${bookmark.type}:${bookmark.path}`
    case 'heading':
      return `heading:${bookmark.path}${bookmark.subpath}`
    case 'search':
      return `search:${bookmark.query}`
  }
}

const isTarget = (item: BookmarkItem): item is Bookmark =>
  item.type !== 'group' && item.type !== 'other'

export const isSameBookmark = (a: BookmarkTarget, b: BookmarkTarget) => keyOf(a) === keyOf(b)

function removeWhere(items: BookmarkItem[], matches: (item: Bookmark) => boolean): BookmarkItem[] {
  return items
    .filter((item) => !(isTarget(item) && matches(item)))
    .map((item) =>
      item.type === 'group' ? { ...item, items: removeWhere(item.items, matches) } : item,
    )
}

export function containsBookmark(items: BookmarkItem[], target: BookmarkTarget): boolean {
  return items.some((item) =>
    item.type === 'group'
      ? containsBookmark(item.items, target)
      : isTarget(item) && isSameBookmark(item, target),
  )
}

/** Removes the bookmark wherever it is, or adds it at the end of the root list. */
export function toggleBookmark(
  items: BookmarkItem[],
  bookmark: BookmarkTarget,
  now = Date.now(),
): BookmarkItem[] {
  return containsBookmark(items, bookmark)
    ? removeWhere(items, (item) => isSameBookmark(item, bookmark))
    : [...items, { ...bookmark, ctime: now }]
}

export function itemAt(items: BookmarkItem[], path: BookmarkPath): BookmarkItem | undefined {
  const [index, ...rest] = path
  const item = items[index]
  if (!rest.length) return item
  return item?.type === 'group' ? itemAt(item.items, rest) : undefined
}

/** The list with the item at `path` changed by `change`; `null` removes it. */
function update(
  items: BookmarkItem[],
  path: BookmarkPath,
  change: (item: BookmarkItem) => BookmarkItem | BookmarkItem[] | null,
): BookmarkItem[] {
  const [index, ...rest] = path
  return items.flatMap((item, at) => {
    if (at !== index) return [item]
    if (rest.length) {
      return item.type === 'group' ? [{ ...item, items: update(item.items, rest, change) }] : [item]
    }
    const changed = change(item)
    return changed === null ? [] : changed
  })
}

function insert(
  items: BookmarkItem[],
  parent: BookmarkPath,
  index: number,
  added: BookmarkItem,
): BookmarkItem[] {
  if (!parent.length) return [...items.slice(0, index), added, ...items.slice(index)]
  return update(items, parent, (group) =>
    group.type === 'group' ? { ...group, items: insert(group.items, [], index, added) } : group,
  )
}

const startsWith = (path: BookmarkPath, prefix: BookmarkPath) =>
  prefix.length <= path.length && prefix.every((index, at) => path[at] === index)

/** Moves the item at `from` into the group at `parent` (the root when empty), at `index`. */
export function moveBookmark(
  items: BookmarkItem[],
  from: BookmarkPath,
  parent: BookmarkPath,
  index: number,
): BookmarkItem[] {
  const moved = itemAt(items, from)
  if (!moved || startsWith(parent, from)) return items
  const removed = update(items, from, () => null)
  const fromParent = from.slice(0, -1)
  const fromIndex = from[from.length - 1]
  // Removing the item shifts what follows it in the same list, and the groups after it.
  const shift = (path: BookmarkPath) =>
    path.map((at, depth) =>
      depth === fromParent.length && startsWith(path, fromParent) && at > fromIndex ? at - 1 : at,
    )
  const target = shift(parent)
  const sameList = target.length === fromParent.length && startsWith(target, fromParent)
  return insert(removed, target, sameList && index > fromIndex ? index - 1 : index, moved)
}

export const addGroup = (items: BookmarkItem[], title: string, now = Date.now()) => [
  ...items,
  { type: 'group' as const, ctime: now, title, items: [] },
]

export const renameGroup = (items: BookmarkItem[], path: BookmarkPath, title: string) =>
  update(items, path, (item) => (item.type === 'group' ? { ...item, title } : item))

/** Removes a group, leaving its bookmarks where it was. */
export const ungroup = (items: BookmarkItem[], path: BookmarkPath) =>
  update(items, path, (item) => (item.type === 'group' ? item.items : item))

export const removeBookmarkAt = (items: BookmarkItem[], path: BookmarkPath) =>
  update(items, path, () => null)

export const renameBookmarks = (items: BookmarkItem[], from: string, to: string): BookmarkItem[] =>
  items.map((item) => {
    if (item.type === 'group') return { ...item, items: renameBookmarks(item.items, from, to) }
    return 'path' in item ? { ...item, path: replacePrefix(item.path, from, to) } : item
  })

function parseItem(raw: unknown): BookmarkItem | null {
  if (typeof raw !== 'object' || raw === null) return null
  const item = raw as Record<string, unknown>
  const { type, path, subpath, query, title, items } = item
  const ctime = typeof item.ctime === 'number' ? item.ctime : 0
  const extra = typeof title === 'string' ? { title } : {}
  if ((type === 'file' || type === 'folder') && typeof path === 'string') {
    return { type, path, ctime, ...extra }
  }
  if (type === 'heading' && typeof path === 'string' && typeof subpath === 'string') {
    return { type, path, subpath, ctime, ...extra }
  }
  if (type === 'search' && typeof query === 'string') return { type, query, ctime, ...extra }
  if (type === 'group') {
    return {
      type,
      ctime,
      title: typeof title === 'string' ? title : '',
      items: parseItems(items),
    }
  }
  const isBroken = ['file', 'folder', 'heading', 'search'].includes(String(type))
  return typeof type === 'string' && !isBroken ? { type: 'other', raw: item } : null
}

const parseItems = (items: unknown): BookmarkItem[] =>
  Array.isArray(items)
    ? items.map(parseItem).filter((item): item is BookmarkItem => item !== null)
    : []

export function parseBookmarks(json: string | null): BookmarkItem[] {
  const stored: unknown = JSON.parse(json ?? '{}')
  return parseItems((stored as { items?: unknown } | null)?.items)
}

const toJson = (item: BookmarkItem): unknown =>
  item.type === 'other'
    ? item.raw
    : item.type === 'group'
      ? { ...item, items: item.items.map(toJson) }
      : item

export const serializeBookmarks = (items: BookmarkItem[]) =>
  JSON.stringify({ items: items.map(toJson) }, null, 2)
