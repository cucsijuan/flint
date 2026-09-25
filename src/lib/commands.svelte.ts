export interface Command {
  id: string
  name: string
  hotkey?: string
  run: () => unknown
  isAvailable?: () => boolean
}

const isMac = navigator.userAgent.includes('Mac')

export function hotkeyOf(event: KeyboardEvent) {
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key
  return [
    (event.ctrlKey || event.metaKey) && 'Mod',
    event.altKey && 'Alt',
    event.shiftKey && 'Shift',
    key,
  ]
    .filter(Boolean)
    .join('+')
}

export const displayHotkey = (hotkey: string) =>
  hotkey.replace('Mod', isMac ? '⌘' : 'Ctrl').replaceAll('+', isMac ? '' : '+')

class CommandRegistry {
  #commands = $state<Command[]>([])

  register(...commands: Command[]) {
    const ids = new Set(commands.map((command) => command.id))
    this.#commands = [...this.#commands.filter((command) => !ids.has(command.id)), ...commands]
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
