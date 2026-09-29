import { describe, expect, it } from 'vitest'
import {
  DateValue,
  display,
  ExpressionError,
  type FileInfo,
  parseDate,
  type Row,
  run,
  type Scope,
  type Value,
} from './expression'

function file(path: string, extra: Partial<FileInfo> = {}): FileInfo {
  const name = path.split('/').pop() ?? path
  return {
    path,
    name,
    basename: name.replace(/\.md$/, ''),
    folder: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '',
    ext: 'md',
    size: 120,
    ctime: Date.UTC(2026, 0, 1),
    mtime: Date.UTC(2026, 0, 2),
    tags: [],
    links: [],
    backlinks: [],
    embeds: [],
    properties: {},
    ...extra,
  }
}

const garden = file('Projects/Garden.md', {
  tags: ['home/outdoors', 'plants'],
  links: ['Tools.md'],
  properties: { status: 'draft' },
})
const tools = file('Tools.md')
const row: Row = {
  file: garden,
  note: {
    status: 'draft',
    price: 12.5,
    items: ['seeds', 'soil', 'seeds'],
    due: parseDate('2026-03-10'),
    'due date': 'later',
    done: false,
  },
}

const scope: Scope = {
  row,
  formulas: { total: 'price * 2', label: 'status.upper() + "!"', loop: 'formula.loop' },
  current: { file: tools, note: {} },
  findFile: (target) =>
    [garden, tools].find(({ path, basename }) => [path, basename].includes(target)) ?? null,
}

const value = (source: string): Value => {
  const result = run(source, scope)
  if (result instanceof ExpressionError) throw result
  return result
}

describe('Bases expressions', () => {
  it('reads properties, file fields and formulas', () => {
    expect(value('status')).toBe('draft')
    expect(value('note.price')).toBe(12.5)
    expect(value('note["due date"]')).toBe('later')
    expect(value('file.name')).toBe('Garden.md')
    expect(value('file.folder')).toBe('Projects')
    expect(value('formula.total')).toBe(25)
    expect(value('formula.label')).toBe('DRAFT!')
    expect(value('this.file.name')).toBe('Tools.md')
    expect(value('missing')).toBeNull()
  })

  it('follows operator precedence and boolean logic', () => {
    expect(value('1 + 2 * 3')).toBe(7)
    expect(value('(1 + 2) * 3')).toBe(9)
    expect(value('10 % 4 == 2 && !done')).toBe(true)
    expect(value('status == "draft" || price > 100')).toBe(true)
    expect(value('price >= 12.5 && price < 13')).toBe(true)
    expect(value('-price')).toBe(-12.5)
  })

  it('calls string, number and list methods', () => {
    expect(value('status.contains("raf")')).toBe(true)
    expect(value('status.title()')).toBe('Draft')
    expect(value('"a,b".split(",")')).toEqual(['a', 'b'])
    expect(value('price.round()')).toBe(13)
    expect(value('price.toFixed(1)')).toBe('12.5')
    expect(value('items.unique()')).toEqual(['seeds', 'soil'])
    expect(value('items.length')).toBe(3)
    expect(value('items.filter(value != "soil").length')).toBe(2)
    expect(value('items.map(value.upper()).join("-")')).toBe('SEEDS-SOIL-SEEDS')
    expect(value('[1, 2, 3].reduce(acc + value, 0)')).toBe(6)
    expect(value('items.contains("soil")')).toBe(true)
    expect(value('/s[eo]/.matches(status)')).toBe(false)
  })

  it('does date arithmetic with durations', () => {
    expect(display(value('due + "1w"'))).toBe('2026-03-17')
    expect(display(value('date("2026-03-10") - "1d"'))).toBe('2026-03-09')
    expect(value('due.month')).toBe(3)
    expect(value('due.format("YYYY/MM")')).toBe('2026/03')
    expect(value('due > date("2026-01-01")')).toBe(true)
    expect(value('(due - date("2026-03-08")) == duration("2d")')).toBe(true)
    expect(value('due - date("2026-03-08")')).not.toBeInstanceOf(DateValue)
  })

  it('checks files for tags, folders, links and properties', () => {
    expect(value('file.hasTag("home")')).toBe(true)
    expect(value('file.hasTag("#plants", "other")')).toBe(true)
    expect(value('file.hasTag("hom")')).toBe(false)
    expect(value('file.inFolder("Projects")')).toBe(true)
    expect(value('file.hasLink("Tools")')).toBe(true)
    expect(value('file.hasProperty("status")')).toBe(true)
    expect(value('if(price > 10, "big", "small")')).toBe('big')
    expect(value('link("Tools").asFile().name')).toBe('Tools.md')
  })

  it('reports broken expressions instead of throwing', () => {
    expect(run('status.nope()', scope)).toBeInstanceOf(ExpressionError)
    expect(run('(1 + 2', scope)).toBeInstanceOf(ExpressionError)
    expect(run('formula.loop', scope)).toBeInstanceOf(ExpressionError)
  })
})
