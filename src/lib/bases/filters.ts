import type { FilterNode } from './base'

export type GroupKind = 'and' | 'or' | 'not'

export interface FilterGroup {
  kind: GroupKind
  children: (string | FilterGroup)[]
}

export interface Operator {
  id: string
  label: string
  /** Whether it takes a value. */
  hasValue: boolean
  build: (property: string, value: string) => string
}

const quote = (value: string) =>
  /^-?\d+(?:\.\d+)?$/.test(value) || value === 'true' || value === 'false'
    ? value
    : JSON.stringify(value)

/** Text methods always take text, even when it looks like a number. */
const method =
  (name: string, negated = false) =>
  (property: string, value: string) =>
    `${negated ? '!' : ''}${property}.${name}(${JSON.stringify(value)})`

export const OPERATORS: Operator[] = [
  { id: 'is', label: 'is', hasValue: true, build: (p, v) => `${p} == ${quote(v)}` },
  { id: 'is-not', label: 'is not', hasValue: true, build: (p, v) => `${p} != ${quote(v)}` },
  { id: 'contains', label: 'contains', hasValue: true, build: method('contains') },
  {
    id: 'not-contains',
    label: 'does not contain',
    hasValue: true,
    build: method('contains', true),
  },
  { id: 'starts', label: 'starts with', hasValue: true, build: method('startsWith') },
  { id: 'ends', label: 'ends with', hasValue: true, build: method('endsWith') },
  { id: 'gt', label: '>', hasValue: true, build: (p, v) => `${p} > ${quote(v)}` },
  { id: 'lt', label: '<', hasValue: true, build: (p, v) => `${p} < ${quote(v)}` },
  { id: 'gte', label: '≥', hasValue: true, build: (p, v) => `${p} >= ${quote(v)}` },
  { id: 'lte', label: '≤', hasValue: true, build: (p, v) => `${p} <= ${quote(v)}` },
  { id: 'empty', label: 'is empty', hasValue: false, build: (p) => `${p}.isEmpty()` },
  { id: 'filled', label: 'is not empty', hasValue: false, build: (p) => `!${p}.isEmpty()` },
  {
    id: 'tag',
    label: 'has tag',
    hasValue: true,
    build: (_, v) => `file.hasTag(${JSON.stringify(v)})`,
  },
  {
    id: 'folder',
    label: 'is in folder',
    hasValue: true,
    build: (_, v) => `file.inFolder(${JSON.stringify(v)})`,
  },
]

/** A statement split into the builder's fields, when it has a shape the builder can show. */
export interface Statement {
  property: string
  operator: string
  value: string
}

const unquote = (value: string) => {
  const trimmed = value.trim()
  if (/^"(?:[^"\\]|\\.)*"$/.test(trimmed)) return JSON.parse(trimmed) as string
  if (/^'[^']*'$/.test(trimmed)) return trimmed.slice(1, -1)
  return trimmed
}

const PROPERTY = String.raw`([\p{L}_$][\p{L}\p{N}_$]*(?:\.[\p{L}_$][\p{L}\p{N}_$]*)*)`
const COMPARISON = new RegExp(String.raw`^${PROPERTY}\s*(==|!=|>=|<=|>|<)\s*(.+)$`, 'u')
const METHOD = new RegExp(
  String.raw`^(!?)${PROPERTY}\.(contains|startsWith|endsWith)\((.*)\)$`,
  'u',
)
const EMPTY = new RegExp(String.raw`^(!?)${PROPERTY}\.isEmpty\(\)$`, 'u')
const FILE_CHECK = /^file\.(hasTag|inFolder)\((.*)\)$/

const COMPARISONS: Record<string, string> = {
  '==': 'is',
  '!=': 'is-not',
  '>': 'gt',
  '<': 'lt',
  '>=': 'gte',
  '<=': 'lte',
}

export function parseStatement(source: string): Statement | null {
  const text = source.trim()
  const fileCheck = FILE_CHECK.exec(text)
  if (fileCheck) {
    return {
      property: 'file',
      operator: fileCheck[1] === 'hasTag' ? 'tag' : 'folder',
      value: unquote(fileCheck[2]),
    }
  }
  const empty = EMPTY.exec(text)
  if (empty) return { property: empty[2], operator: empty[1] ? 'filled' : 'empty', value: '' }
  const call = METHOD.exec(text)
  if (call) {
    const [, negated, property, name, value] = call
    const operator =
      name === 'contains'
        ? negated
          ? 'not-contains'
          : 'contains'
        : negated
          ? null
          : name === 'startsWith'
            ? 'starts'
            : 'ends'
    return operator ? { property, operator, value: unquote(value) } : null
  }
  const comparison = COMPARISON.exec(text)
  if (comparison) {
    return {
      property: comparison[1],
      operator: COMPARISONS[comparison[2]],
      value: unquote(comparison[3]),
    }
  }
  return null
}

export function buildStatement({ property, operator, value }: Statement) {
  const found = OPERATORS.find(({ id }) => id === operator) ?? OPERATORS[0]
  return found.build(property, value)
}

export function toGroup(node: FilterNode | undefined): FilterGroup {
  if (node === undefined || node === null) return { kind: 'and', children: [] }
  if (typeof node === 'string') return { kind: 'and', children: [node] }
  const kind: GroupKind = 'and' in node ? 'and' : 'or' in node ? 'or' : 'not'
  const children = ('and' in node ? node.and : 'or' in node ? node.or : node.not) ?? []
  return {
    kind,
    children: children.map((child) => (typeof child === 'string' ? child : toGroup(child))),
  }
}

export function fromGroup(group: FilterGroup): FilterNode | undefined {
  const children = group.children
    .map((child) => (typeof child === 'string' ? child.trim() || undefined : fromGroup(child)))
    .filter((child): child is FilterNode => child !== undefined)
  if (!children.length) return undefined
  if (group.kind === 'and') return { and: children }
  if (group.kind === 'or') return { or: children }
  return { not: children }
}
