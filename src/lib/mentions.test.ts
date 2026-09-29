import { describe, expect, it } from 'vitest'
import { linkMention } from './mentions'

describe('linkMention', () => {
  it('links the first unlinked mention on the line', () => {
    expect(linkMention('intro\nsee [[Flint]] and Flint', 2, 'Flint', 'Flint')).toBe(
      'intro\nsee [[Flint]] and [[Flint]]',
    )
  })

  it('keeps how the mention was written as the alias', () => {
    expect(linkMention('I like flint', 1, 'flint', 'Tools/Flint')).toBe(
      'I like [[Tools/Flint|flint]]',
    )
  })

  it('skips partial words and gives up when nothing is left to link', () => {
    expect(linkMention('Flintstone, Flint', 1, 'Flint', 'Flint')).toBe('Flintstone, [[Flint]]')
    expect(linkMention('only [[Flint]]', 1, 'Flint', 'Flint')).toBeNull()
  })
})
