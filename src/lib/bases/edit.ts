import { parseDocument } from 'yaml'
import { type BaseConfig, type FilterNode, parseBase } from './base'

const KEYS = ['filters', 'formulas', 'properties', 'summaries', 'views'] as const

const isBlank = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === 'object' && Object.keys(value).length === 0)

/** Applies `change` to a `.base` source, rewriting only the keys it touched. */
export function updateBase(source: string, change: (config: BaseConfig) => void): string {
  const before = parseBase(source)
  const after = structuredClone(before)
  change(after)
  const document = parseDocument(source.trim() ? source : '{}')
  for (const key of KEYS) {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue
    if (isBlank(after[key])) document.delete(key)
    else document.set(key, document.createNode(after[key]))
  }
  return document.toString()
}

/** What a new note needs to show up in a base: its folder, tags and properties. */
export interface NewNoteDefaults {
  folder: string
  tags: string[]
  properties: Record<string, unknown>
}

const EQUALS =
  /^\s*(?:note\.)?([\p{L}_$][\p{L}\p{N}_$]*)\s*==\s*(?:"([^"]*)"|'([^']*)'|(-?\d+(?:\.\d+)?)|(true|false))\s*$/u
const IN_FOLDER = /^\s*file\.inFolder\(\s*["']([^"']+)["']\s*\)\s*$/
const HAS_TAG = /^\s*file\.hasTag\(\s*["']#?([^"']+)["']\s*\)\s*$/

/** Reads the simple `and` conditions of the filters, so a new note satisfies them. */
export function newNoteDefaults(filters: (FilterNode | undefined)[]): NewNoteDefaults {
  const defaults: NewNoteDefaults = { folder: '', tags: [], properties: {} }
  const visit = (node: FilterNode | undefined) => {
    if (node === undefined || node === null) return
    if (typeof node === 'string') {
      const equals = EQUALS.exec(node)
      if (equals) {
        const [, key, double, single, number, boolean] = equals
        defaults.properties[key] =
          number !== undefined
            ? Number(number)
            : boolean !== undefined
              ? boolean === 'true'
              : (double ?? single)
      }
      defaults.folder = IN_FOLDER.exec(node)?.[1] ?? defaults.folder
      const tag = HAS_TAG.exec(node)?.[1]
      if (tag) defaults.tags.push(tag)
    } else if ('and' in node) {
      ;(node.and ?? []).forEach(visit)
    }
  }
  filters.forEach(visit)
  return defaults
}
