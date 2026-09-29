import { parse } from 'yaml'
import {
  compare,
  DateValue,
  Duration,
  display,
  equals,
  ExpressionError,
  type FileInfo,
  isList,
  isTruthy,
  Link,
  parseDate,
  parseExpression,
  evaluate,
  type Row,
  run,
  type Scope,
  type Value,
} from './expression'

export type FilterNode =
  string | { and: FilterNode[] } | { or: FilterNode[] } | { not: FilterNode[] }

export type Direction = 'ASC' | 'DESC'

export type ViewType = 'table' | 'cards' | 'list' | 'map'

export interface ViewConfig {
  type: ViewType
  name: string
  filters?: FilterNode
  /** Property ids shown, in order: `note.x` (or just `x`), `file.x` or `formula.x`. */
  order?: string[]
  sort?: { property: string; direction: Direction }[]
  groupBy?: { property: string; direction: Direction }
  limit?: number
  /** Property id → summary name. */
  summaries?: Record<string, string>
  /** Property id → column width in pixels. */
  columnSize?: Record<string, number>
  [key: string]: unknown
}

export interface BaseConfig {
  filters?: FilterNode
  formulas?: Record<string, string>
  properties?: Record<string, { displayName?: string }>
  /** Custom summaries: name → formula over `values`. */
  summaries?: Record<string, string>
  views: ViewConfig[]
}

/** Obsidian's property types, from `types.json`. */
export type PropertyType =
  'text' | 'multitext' | 'number' | 'checkbox' | 'date' | 'datetime' | 'aliases' | 'tags'

export const DEFAULT_VIEW: ViewConfig = { type: 'table', name: 'Table' }

export function parseBase(source: string): BaseConfig {
  const parsed: unknown = source.trim() ? parse(source) : {}
  const config = (
    typeof parsed === 'object' && parsed !== null ? parsed : {}
  ) as Partial<BaseConfig>
  const views = Array.isArray(config.views) && config.views.length ? config.views : [DEFAULT_VIEW]
  return { ...config, views }
}

// ---------------------------------------------------------------------------------------------
// Properties

/** `status` and `note.status` are the same property. */
export const propertyId = (id: string) => (/^(note|file|formula)\./.test(id) ? id : `note.${id}`)

export function propertyName(id: string, config: BaseConfig) {
  const full = propertyId(id)
  const custom = config.properties?.[full]?.displayName ?? config.properties?.[id]?.displayName
  return custom ?? full.slice(full.indexOf('.') + 1)
}

const WIKILINK = /^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]$/

/** A frontmatter value as Bases sees it, converted to its declared type. */
export function toValue(raw: unknown, type?: PropertyType): Value {
  if (raw === null || raw === undefined) return null
  if (Array.isArray(raw)) {
    const itemType =
      type === 'multitext' || type === 'tags' || type === 'aliases' ? 'text' : undefined
    return raw.map((item) => toValue(item, itemType))
  }
  if (type === 'multitext' || type === 'tags' || type === 'aliases') return [toValue(raw, 'text')]
  if (type === 'number') {
    const number = Number(raw)
    return Number.isNaN(number) ? null : number
  }
  if (type === 'checkbox') return raw === true || raw === 'true'
  if (typeof raw === 'string') {
    const link = WIKILINK.exec(raw.trim())
    if (link) return new Link(link[1].trim(), link[2]?.trim() || null)
    if (type === 'date' || type === 'datetime' || type === undefined) {
      const date = parseDate(raw)
      if (date) return date
    }
    return raw
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') return raw
  if (raw instanceof Date) return parseDate(raw.toISOString())
  if (typeof raw === 'object') {
    return Object.fromEntries(Object.entries(raw).map(([key, item]) => [key, toValue(item)]))
  }
  return String(raw)
}

export function rowFor(file: FileInfo, types: Record<string, PropertyType>): Row {
  const note = Object.fromEntries(
    Object.entries(file.properties).map(([key, raw]) => [key, toValue(raw, types[key])]),
  )
  return { file, note }
}

// ---------------------------------------------------------------------------------------------
// Querying

export interface Context {
  formulas: Record<string, string>
  current: Row | null
  findFile: (target: string) => FileInfo | null
}

const scopeFor = (row: Row, context: Context): Scope => ({ row, ...context })

/** A property's value for a row, or the error its formula raised. */
export function valueOf(row: Row, id: string, context: Context): Value | ExpressionError {
  return run(propertyId(id), scopeFor(row, context))
}

export function matchesFilter(filter: FilterNode | undefined, row: Row, context: Context): boolean {
  if (filter === undefined || filter === null) return true
  if (typeof filter === 'string') {
    const result = run(filter, scopeFor(row, context))
    return !(result instanceof ExpressionError) && isTruthy(result)
  }
  if ('and' in filter) return (filter.and ?? []).every((part) => matchesFilter(part, row, context))
  if ('or' in filter) return (filter.or ?? []).some((part) => matchesFilter(part, row, context))
  if ('not' in filter) return !(filter.not ?? []).some((part) => matchesFilter(part, row, context))
  return true
}

const plain = (value: Value | ExpressionError) => (value instanceof ExpressionError ? null : value)

export interface Group {
  /** The value rows share, or null for rows without one. */
  key: Value
  rows: Row[]
}

export interface QueryResult {
  groups: Group[]
  /** Every row that passed the filters, before the limit. */
  total: number
}

/** The rows a view shows: filtered by the base and the view, sorted, grouped and limited. */
export function query(
  rows: Row[],
  config: BaseConfig,
  view: ViewConfig,
  context: Context,
): QueryResult {
  const matching = rows.filter(
    (row) =>
      matchesFilter(config.filters, row, context) && matchesFilter(view.filters, row, context),
  )
  const sorts = view.sort ?? []
  const sorted = matching
    .map((row) => ({
      row,
      keys: sorts.map(({ property }) => plain(valueOf(row, property, context))),
    }))
    .sort((a, b) => {
      for (const [index, { direction }] of sorts.entries()) {
        const order = compare(a.keys[index], b.keys[index])
        if (order) return direction === 'DESC' ? -order : order
      }
      return a.row.file.path.localeCompare(b.row.file.path)
    })
    .map(({ row }) => row)
  const limited = view.limit ? sorted.slice(0, view.limit) : sorted
  if (!view.groupBy) return { groups: [{ key: null, rows: limited }], total: matching.length }

  const { property, direction } = view.groupBy
  const groups: Group[] = []
  for (const row of limited) {
    const key = plain(valueOf(row, property, context))
    const group = groups.find((candidate) => equals(candidate.key, key))
    if (group) group.rows.push(row)
    else groups.push({ key, rows: [row] })
  }
  groups.sort((a, b) => (direction === 'DESC' ? -1 : 1) * compare(a.key, b.key))
  return { groups, total: matching.length }
}

// ---------------------------------------------------------------------------------------------
// Summaries

const numbers = (values: Value[]) =>
  values
    .map((value) => (value instanceof DateValue ? null : typeof value === 'number' ? value : null))
    .filter((value): value is number => value !== null)

const dates = (values: Value[]) =>
  values.filter((value): value is DateValue => value instanceof DateValue)

const isBlank = (value: Value) =>
  value === null || value === '' || (isList(value) && value.length === 0)

const median = (sorted: number[]) => {
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** Obsidian's built-in summaries, by the names `.base` files use. */
export const SUMMARIES: Record<string, (values: Value[]) => Value> = {
  Average: (values) => {
    const found = numbers(values)
    return found.length ? found.reduce((sum, value) => sum + value, 0) / found.length : null
  },
  Min: (values) => (numbers(values).length ? Math.min(...numbers(values)) : null),
  Max: (values) => (numbers(values).length ? Math.max(...numbers(values)) : null),
  Sum: (values) => numbers(values).reduce((sum, value) => sum + value, 0),
  Range: (values) => {
    const found = numbers(values)
    if (found.length) return Math.max(...found) - Math.min(...found)
    const timestamps = dates(values).map((date) => date.value.valueOf())
    if (!timestamps.length) return null
    return new Duration([
      { amount: Math.max(...timestamps) - Math.min(...timestamps), unit: 'millisecond' },
    ])
  },
  Median: (values) => {
    const found = numbers(values).sort((a, b) => a - b)
    return found.length ? median(found) : null
  },
  Stddev: (values) => {
    const found = numbers(values)
    if (!found.length) return null
    const mean = found.reduce((sum, value) => sum + value, 0) / found.length
    return Math.sqrt(found.reduce((sum, value) => sum + (value - mean) ** 2, 0) / found.length)
  },
  Earliest: (values) => dates(values).sort((a, b) => compare(a, b))[0] ?? null,
  Latest: (values) => dates(values).sort((a, b) => compare(b, a))[0] ?? null,
  Checked: (values) => values.filter((value) => value === true).length,
  Unchecked: (values) => values.filter((value) => value === false).length,
  Empty: (values) => values.filter(isBlank).length,
  Filled: (values) => values.filter((value) => !isBlank(value)).length,
  Unique: (values) =>
    values.filter((value, index) => values.findIndex((other) => equals(other, value)) === index)
      .length,
}

/** Summarizes a column with a built-in summary or a custom formula over `values`. */
export function summarize(
  name: string,
  values: Value[],
  config: BaseConfig,
  context: Context,
): string {
  const builtIn = SUMMARIES[name]
  if (builtIn) return display(builtIn(values))
  const formula = config.summaries?.[name]
  if (!formula) return ''
  try {
    const empty: Row = { file: emptyFile, note: {} }
    return display(
      evaluate(parseExpression(formula), { ...scopeFor(empty, context), locals: { values } }),
    )
  } catch {
    return '—'
  }
}

const emptyFile: FileInfo = {
  path: '',
  name: '',
  basename: '',
  folder: '',
  ext: '',
  size: 0,
  ctime: 0,
  mtime: 0,
  tags: [],
  links: [],
  backlinks: [],
  embeds: [],
  properties: {},
}
