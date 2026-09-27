import type { ActivatePlugin } from 'flint-plugin-api'

/** Runs when the plugin is turned on. Everything registered here is removed when it's turned off. */
const activate: ActivatePlugin = async (flint) => {
  const settings = { greeting: 'Hello', ...(await flint.storage.load<{ greeting: string }>()) }

  flint.commands.register({
    id: 'greet',
    name: 'Greet the current note',
    isAvailable: () => flint.workspace.activeNote() !== null,
    run: () => flint.ui.notice(`${settings.greeting}, ${flint.workspace.activeNote()}!`),
  })

  flint.ui.registerSidebarTab({
    id: 'panel',
    name: 'My plugin',
    icon: 'sparkles',
    render(element) {
      element.className = 'my-plugin-panel'
      element.textContent = 'Your plugin can draw anything here.'
      return undefined
    },
  })

  flint.ui.registerSettingsTab({
    render(element) {
      const input = Object.assign(document.createElement('input'), { value: settings.greeting })
      input.addEventListener('change', () => {
        settings.greeting = input.value
        void flint.storage.save(settings)
      })
      element.append('Greeting ', input)
      return undefined
    },
  })
}

export default activate
