import { describe, expect, it } from 'vitest'
import { buildStatement, fromGroup, parseStatement, toGroup } from './filters'

describe('filter builder', () => {
  it('splits statements into builder fields and back', () => {
    for (const source of [
      'status == "read"',
      'note.rating >= 4',
      '!tags.contains("draft")',
      'file.name.startsWith("2026")',
      'due.isEmpty()',
      '!due.isEmpty()',
      'file.hasTag("book")',
      'file.inFolder("Books/Fiction")',
    ]) {
      const statement = parseStatement(source)
      if (!statement) throw new Error(`Not parsed: ${source}`)
      expect(buildStatement(statement)).toBe(source)
    }
  })

  it('leaves complex expressions to the raw editor', () => {
    expect(parseStatement('rating * 2 > price')).toBeNull()
    expect(parseStatement('if(a, b, c)')).toBeNull()
  })

  it('converts between filter nodes and editable groups', () => {
    const node = { and: ['a == 1', { or: ['b == 2', 'c == 3'] }] }
    expect(fromGroup(toGroup(node))).toEqual(node)
    expect(fromGroup(toGroup('a == 1'))).toEqual({ and: ['a == 1'] })
    expect(
      fromGroup({ kind: 'not', children: ['', { kind: 'and', children: [] }] }),
    ).toBeUndefined()
  })
})
