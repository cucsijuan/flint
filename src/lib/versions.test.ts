import { describe, expect, it } from 'vitest'
import { compareVersions } from './versions'

describe('compareVersions', () => {
  it('orders versions part by part', () => {
    expect(compareVersions('0.12.0', '0.11.9')).toBe(1)
    expect(compareVersions('0.9.0', '0.10.0')).toBe(-1)
    expect(compareVersions('1.0', '1.0.0')).toBe(0)
  })
})
