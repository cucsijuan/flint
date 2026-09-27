import { describe, expect, it } from 'vitest'
import { displayHotkey, hotkeyOf } from './commands.svelte'

const press = (key: string, modifiers: Partial<KeyboardEvent> = {}) =>
  ({
    key,
    code: '',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  }) as KeyboardEvent

describe('hotkeyOf', () => {
  it('normalizes modifiers and letter case', () => {
    expect(hotkeyOf(press('p', { ctrlKey: true }), false)).toBe('Mod+P')
    expect(hotkeyOf(press('F', { metaKey: true, shiftKey: true }), false)).toBe('Mod+Shift+F')
    expect(hotkeyOf(press(',', { ctrlKey: true }), false)).toBe('Mod+,')
    expect(hotkeyOf(press('Escape'), false)).toBe('Escape')
  })

  it('keeps Ctrl apart from ⌘ on macOS and reads Option+letter by key', () => {
    expect(hotkeyOf(press('p', { metaKey: true }), true)).toBe('Mod+P')
    expect(hotkeyOf(press('e', { ctrlKey: true }), true)).toBe('Ctrl+E')
    expect(hotkeyOf(press('ArrowLeft', { ctrlKey: true, altKey: true }), true)).toBe(
      'Ctrl+Alt+ArrowLeft',
    )
    expect(hotkeyOf(press('ø', { altKey: true, code: 'KeyO' }), true)).toBe('Alt+O')
  })
})

describe('displayHotkey', () => {
  it('uses symbols on macOS', () => {
    expect(displayHotkey('Mod+Alt+ArrowLeft', false)).toBe('Ctrl+Alt+←')
    expect(displayHotkey('Mod+Shift+T', true)).toBe('⌘⇧T')
    expect(displayHotkey('Ctrl+Tab', true)).toBe('⌃Tab')
  })
})
