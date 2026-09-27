export interface Command {
  id: string
  name: string
  /** For example `Mod+Shift+K`. `Mod` is Ctrl, or ⌘ on macOS. */
  hotkey?: string
  /** Replaces `hotkey` on macOS, where some shortcuts mean something else. */
  macHotkey?: string
  run: () => unknown
  isAvailable?: () => boolean
}

export const isMac = navigator.userAgent.includes('Mac')

const LETTER_OR_DIGIT = /^(?:Key[A-Z]|Digit\d)$/

/** On macOS `Mod` is only ⌘, so Ctrl keeps its text-editing shortcuts (Ctrl+A, Ctrl+E…). */
export function hotkeyOf(event: KeyboardEvent, mac = isMac) {
  // Option+letter types a symbol on macOS, so read which key was pressed instead.
  const typed = mac && event.altKey && LETTER_OR_DIGIT.test(event.code) ? event.code.at(-1) : null
  const key = typed ?? (event.key.length === 1 ? event.key.toUpperCase() : event.key)
  return [
    (mac ? event.metaKey : event.ctrlKey || event.metaKey) && 'Mod',
    mac && event.ctrlKey && 'Ctrl',
    event.altKey && 'Alt',
    event.shiftKey && 'Shift',
    key,
  ]
    .filter(Boolean)
    .join('+')
}

const KEY_SYMBOLS: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
}

const MAC_MODIFIERS: Record<string, string> = { Mod: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧' }

export function displayHotkey(hotkey: string, mac = isMac) {
  const keys = hotkey.split('+').map((key) => KEY_SYMBOLS[key] ?? key)
  if (mac) return keys.map((key) => MAC_MODIFIERS[key] ?? key).join('')
  return keys.map((key) => (key === 'Mod' ? 'Ctrl' : key)).join('+')
}

class CommandRegistry {
  #commands = $state<Command[]>([])

  register(...commands: Command[]) {
    const ids = new Set(commands.map((command) => command.id))
    const forPlatform = commands.map((command) => ({
      ...command,
      hotkey: isMac ? (command.macHotkey ?? command.hotkey) : command.hotkey,
    }))
    this.#commands = [...this.#commands.filter((command) => !ids.has(command.id)), ...forPlatform]
  }

  /** `label` followed by the command's hotkey, for tooltips. */
  label(label: string, id: string) {
    const hotkey = this.#commands.find((command) => command.id === id)?.hotkey
    return hotkey ? `${label} (${displayHotkey(hotkey)})` : label
  }

  unregister(id: string) {
    this.#commands = this.#commands.filter((command) => command.id !== id)
  }

  available() {
    return this.#commands.filter((command) => command.isAvailable?.() ?? true)
  }

  run(id: string) {
    const command = this.available().find((candidate) => candidate.id === id)
    if (command) void command.run()
  }

  handleKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented) return false
    const hotkey = hotkeyOf(event)
    const command = this.available().find((candidate) => candidate.hotkey === hotkey)
    if (!command) return false
    event.preventDefault()
    void command.run()
    return true
  }
}

export const commands = new CommandRegistry()
