import { Document, isMap, isScalar, isSeq, parseDocument } from 'yaml'
import type { PropertyType as VaultPropertyType } from './bases/base'

const FRONTMATTER = /^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/
const DATE = /^\d{4}-\d{2}-\d{2}$/

export type PropertyType = 'text' | 'list' | 'number' | 'checkbox' | 'date' | 'other'

export interface Property {
  key: string
  type: PropertyType
  value: unknown
}

export const PROPERTY_TYPES: PropertyType[] = ['text', 'list', 'number', 'checkbox', 'date']

/** The vault-wide type (Obsidian's `types.json`) each editor type is saved as. */
export const VAULT_TYPES: Record<Exclude<PropertyType, 'other'>, VaultPropertyType> = {
  text: 'text',
  list: 'multitext',
  number: 'number',
  checkbox: 'checkbox',
  date: 'date',
}

export function propertyType(value: unknown): PropertyType {
  if (Array.isArray(value)) return 'list'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'checkbox'
  if (typeof value === 'string') return DATE.test(value) ? 'date' : 'text'
  return value === null || value === undefined ? 'text' : 'other'
}

/** The YAML between the note's `---` lines, or `null` when it has no frontmatter. */
export const frontmatterOf = (note: string) => {
  const match = FRONTMATTER.exec(note)
  return match ? (match[1] ?? '') : null
}

/** The note's properties, or `null` when it has no frontmatter. */
export function readProperties(note: string): Property[] | null {
  const match = FRONTMATTER.exec(note)
  if (!match) return null
  const value: unknown = parseDocument(match[1] ?? '').toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value).map(([key, item]) => ({
    key,
    type: propertyType(item),
    value: item,
  }))
}

/** Applies `edit` to the frontmatter; it returns whether it changed anything. */
function editFrontmatter(note: string, edit: (document: Document) => boolean) {
  const match = FRONTMATTER.exec(note)
  let document: Document = parseDocument(match?.[1] ?? '')
  if (!isMap(document.contents)) document = new Document({})
  if (!edit(document)) return note
  const body = match ? note.slice(match[0].length) : note
  if (isMap(document.contents) && document.contents.items.length === 0) return body
  return `---\n${document.toString({ nullStr: '', flowCollectionPadding: false })}---\n${body}`
}

export const setProperty = (note: string, key: string, value: unknown) =>
  editFrontmatter(note, (document) => {
    const existing = document.get(key, true)
    const node = document.createNode(value)
    if (isSeq(existing) && isSeq(node)) node.flow = existing.flow
    document.set(key, node)
    return true
  })

export const removeProperty = (note: string, key: string) =>
  editFrontmatter(note, (document) => document.delete(key))

export const renameProperty = (note: string, from: string, to: string) =>
  editFrontmatter(note, (document) => {
    if (!isMap(document.contents) || document.has(to)) return false
    const pair = document.contents.items.find(
      (item) => isScalar(item.key) && item.key.value === from,
    )
    if (!pair) return false
    pair.key = document.createNode(to)
    return true
  })

/** Converts a value when its property changes type. */
export function convertValue(value: unknown, type: PropertyType): unknown {
  const text = Array.isArray(value) ? value.join(', ') : value === null ? '' : String(value)
  switch (type) {
    case 'list':
      return Array.isArray(value) ? value : text ? [text] : []
    case 'number':
      return Number.isFinite(Number(text)) && text ? Number(text) : null
    case 'checkbox':
      return value === true || text === 'true'
    case 'date':
      return DATE.test(text) ? text : null
    default:
      return text
  }
}
