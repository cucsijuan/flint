import { describe, expect, it } from 'vitest'
import { dictionaryFor } from './spelling.svelte'

describe('dictionaryFor', () => {
  it('picks the regional dictionary, else the language', () => {
    const available = ['en', 'es', 'es-ar', 'pt-pt']
    expect(dictionaryFor('es-AR', available)).toBe('es-ar')
    expect(dictionaryFor('es-ES', available)).toBe('es')
    expect(dictionaryFor('en_US', available)).toBe('en')
    expect(dictionaryFor('ja', available)).toBeNull()
  })
})
