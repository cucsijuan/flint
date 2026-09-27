import { describe, expect, it } from 'vitest'
import {
  convertValue,
  readProperties,
  removeProperty,
  renameProperty,
  setProperty,
} from './properties'

const note = `---
# a comment
title: Plan
tags: [a, b]
done: false
count: 3
due: 2026-09-26
aliases:
  - First
---
Body`

describe('properties', () => {
  it('reads properties with their types', () => {
    expect(readProperties(note)?.map(({ key, type }) => `${key}:${type}`)).toEqual([
      'title:text',
      'tags:list',
      'done:checkbox',
      'count:number',
      'due:date',
      'aliases:list',
    ])
    expect(readProperties('No frontmatter')).toBeNull()
    expect(readProperties('---\n---\nBody')).toEqual([])
  })

  it('edits values keeping comments, order and list style', () => {
    const edited = setProperty(setProperty(note, 'tags', ['a', 'b', 'c']), 'done', true)
    expect(edited).toContain('# a comment\ntitle: Plan\ntags: [a, b, c]\ndone: true\n')
    expect(edited.endsWith('---\nBody')).toBe(true)
    expect(setProperty('Body', 'new', null)).toBe('---\nnew:\n---\nBody')
  })

  it('renames and removes properties', () => {
    expect(renameProperty(note, 'title', 'name')).toContain('\nname: Plan\ntags')
    expect(renameProperty(note, 'title', 'tags')).toBe(note)
    expect(removeProperty('---\nonly: 1\n---\nBody', 'only')).toBe('Body')
  })

  it('converts values between types', () => {
    expect(convertValue('a', 'list')).toEqual(['a'])
    expect(convertValue(['a', 'b'], 'text')).toBe('a, b')
    expect(convertValue('12', 'number')).toBe(12)
    expect(convertValue('x', 'date')).toBeNull()
  })
})
