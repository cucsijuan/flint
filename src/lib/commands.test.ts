import { describe, expect, it } from 'vitest'
import { hotkeyOf } from './commands.svelte'

const press = (key: string, modifiers: Partial<KeyboardEvent> = {}) =>
  ({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  }) as KeyboardEvent

describe('hotkeyOf', () => {
  it('normalizes modifiers and letter case', () => {
    expect(hotkeyOf(press('p', { ctrlKey: true }))).toBe('Mod+P')
    expect(hotkeyOf(press('F', { metaKey: true, shiftKey: true }))).toBe('Mod+Shift+F')
    expect(hotkeyOf(press(',', { ctrlKey: true }))).toBe('Mod+,')
    expect(hotkeyOf(press('Escape'))).toBe('Escape')
  })
})
