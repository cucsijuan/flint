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

  available() {
    return this.#commands.filter((command) => command.isAvailable?.() ?? true)
  }

  handleKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented) return
    const hotkey = hotkeyOf(event)
    const command = this.available().find((candidate) => candidate.hotkey === hotkey)
    if (!command) return
    event.preventDefault()
    void command.run()
  }
}

export const commands = new CommandRegistry()
