const MODIFIERS = ['Mod', 'Ctrl', 'Alt', 'Shift']

/** Obsidian's `hotkeys.json` entry. */
interface StoredHotkey {
  modifiers: string[]
  key: string
}

/** Reads `hotkeys.json`: command id → hotkey, or `null` when its hotkey was removed. */
export function parseHotkeys(json: string | null): Record<string, string | null> {
  const stored: unknown = JSON.parse(json ?? '{}')
  if (typeof stored !== 'object' || stored === null) return {}
  const custom: Record<string, string | null> = {}
  for (const [id, list] of Object.entries(stored)) {
    if (!Array.isArray(list)) continue
    const first = list[0] as Partial<StoredHotkey> | undefined
    if (!first) {
      custom[id] = null
    } else if (typeof first.key === 'string' && Array.isArray(first.modifiers)) {
      const modifiers = MODIFIERS.filter((modifier) => first.modifiers?.includes(modifier))
      custom[id] = [...modifiers, first.key].join('+')
    }
  }
  return custom
}

export function serializeHotkeys(custom: Record<string, string | null>) {
  const stored: Record<string, StoredHotkey[]> = {}
  for (const [id, hotkey] of Object.entries(custom)) {
    const keys = hotkey?.split('+') ?? []
    const key = keys.pop()
    stored[id] = key ? [{ modifiers: keys, key }] : []
  }
  return JSON.stringify(stored, null, 2)
}
