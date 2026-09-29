import { describe, expect, it } from 'vitest'
import { type Context, parseBase, query, rowFor, summarize, SUMMARIES, toValue } from './base'
import { DateValue, display, type FileInfo, Link } from './expression'

function file(path: string, properties: Record<string, unknown>, tags: string[] = []): FileInfo {
  const name = path.split('/').pop() ?? path
  return {
    path,
    name,
    basename: name.replace(/\.md$/, ''),
    folder: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '',
    ext: 'md',
    size: 1,
    ctime: 0,
    mtime: 0,
    tags,
    links: [],
    backlinks: [],
    embeds: [],
    properties,
  }
}

const files = [
  file('Books/Dune.md', { status: 'read', rating: 5, pages: 600 }, ['book']),
  file('Books/Emma.md', { status: 'reading', rating: 3, pages: 400 }, ['book']),
  file('Books/Ulysses.md', { status: 'read', rating: 4 }, ['book', 'classic']),
  file('Notes/Todo.md', { status: 'open' }),
]
const rows = files.map((info) => rowFor(info, { rating: 'number' }))
const context: Context = { formulas: {}, current: null, findFile: () => null }

const base = parseBase(`
filters:
  and:
    - file.inFolder("Books")
    - 'file.hasTag("book")'
formulas:
  score: rating * 2
views:
  - type: table
    name: Read
    filters:
      or:
        - status == "read"
        - rating > 4
    sort:
      - property: rating
        direction: DESC
`)
const names = (result: ReturnType<typeof query>) =>
  result.groups.map((group) => group.rows.map((row) => row.file.basename))

describe('bases', () => {
  it('reads a .base file and falls back to a table view', () => {
    expect(base.views[0]).toMatchObject({ type: 'table', name: 'Read' })
    expect(parseBase('').views).toEqual([{ type: 'table', name: 'Table' }])
  })

  it('filters by the base and the view, then sorts', () => {
    expect(
      names(query(rows, base, base.views[0], { ...context, formulas: base.formulas ?? {} })),
    ).toEqual([['Dune', 'Ulysses']])
  })

  it('groups, orders groups and limits rows', () => {
    const view = {
      type: 'table' as const,
      name: 'All',
      groupBy: { property: 'status', direction: 'ASC' as const },
      limit: 3,
    }
    const result = query(rows, { views: [view] }, view, context)
    expect(result.total).toBe(4)
    expect(result.groups.map((group) => display(group.key))).toEqual(['read', 'reading'])
    expect(names(result)).toEqual([['Dune', 'Ulysses'], ['Emma']])
  })

  it('converts frontmatter values to their types', () => {
    expect(toValue('2026-01-05')).toBeInstanceOf(DateValue)
    expect(toValue('[[Dune|the book]]')).toEqual(new Link('Dune', 'the book'))
    expect(toValue('7', 'number')).toBe(7)
    expect(toValue('solo', 'multitext')).toEqual(['solo'])
  })

  it('summarizes columns with built-in and custom summaries', () => {
    const ratings = [5, 3, 4, null]
    expect(SUMMARIES.Average(ratings)).toBe(4)
    expect(SUMMARIES.Median(ratings)).toBe(4)
    expect(SUMMARIES.Empty(ratings)).toBe(1)
    expect(SUMMARIES.Unique([1, 1, 2])).toBe(2)
    const custom = { views: [], summaries: { Top: 'values.filter(value > 3).length' } }
    expect(summarize('Top', ratings, custom, context)).toBe('2')
  })
})
