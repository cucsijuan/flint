import { describe, expect, it } from 'vitest'
import { parseHotkeys, serializeHotkeys } from './hotkeys'

describe('hotkeys.json', () => {
  it("reads Obsidian's format, in a fixed modifier order", () => {
    const json = JSON.stringify({
      'toggle-bold': [{ modifiers: ['Shift', 'Mod'], key: 'B' }],
      'new-tab': [],
      broken: 'x',
    })
    expect(parseHotkeys(json)).toEqual({ 'toggle-bold': 'Mod+Shift+B', 'new-tab': null })
    expect(parseHotkeys(null)).toEqual({})
  })

  it('writes what it reads', () => {
    const custom = { 'go-back': 'Mod+Alt+ArrowLeft', 'close-tab': null }
    expect(parseHotkeys(serializeHotkeys(custom))).toEqual(custom)
  })
})
