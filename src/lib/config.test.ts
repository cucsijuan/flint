import { describe, expect, it } from 'vitest'
import { mergeConfig } from './config.svelte'

describe('mergeConfig', () => {
  it('layers sources over defaults, ignoring unknown keys and wrong types', () => {
    const defaults = { theme: 'system', size: 16, snippets: [] as string[], nested: { a: 1 } }
    const merged = mergeConfig(
      defaults,
      { theme: 'dark', size: '20' },
      { size: 18, snippets: ['wide.css'], nested: [1], extra: true },
      null,
    )
    expect(merged).toEqual({ theme: 'dark', size: 18, snippets: ['wide.css'], nested: { a: 1 } })
  })
})
