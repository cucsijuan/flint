import { describe, expect, it } from 'vitest'
import { isCompatibleLicense } from './licenses'

describe('isCompatibleLicense', () => {
  it('accepts free licenses compatible with the AGPL', () => {
    for (const id of [
      'MIT',
      'agpl-3.0-or-later',
      'Apache-2.0',
      'MIT OR Proprietary',
      '(MIT AND ISC)',
    ]) {
      expect(isCompatibleLicense(id), id).toBe(true)
    }
  })

  it('rejects missing, proprietary or incompatible licenses', () => {
    for (const id of ['', 'Proprietary', 'GPL-2.0-only', 'MIT AND Proprietary', 'CC-BY-NC-4.0']) {
      expect(isCompatibleLicense(id), id).toBe(false)
    }
  })
})
