import { commands } from './commands.svelte'
import { checkForUpdates } from './updates'
import { workspace } from './workspace.svelte'

const hasVault = () => workspace.info !== null
const hasNote = () => workspace.note !== null

export function registerAppCommands() {
  commands.register(
    {
      id: 'command-palette',
      name: 'Open command palette',
      hotkey: 'Mod+P',
      run: () => (workspace.isCommandPaletteOpen = true),
    },
    {
      id: 'quick-switcher',
      name: 'Open quick switcher',
      hotkey: 'Mod+O',
      isAvailable: hasVault,
      run: () => (workspace.isQuickSwitcherOpen = true),
    },
    {
      id: 'search',
      name: 'Search in all notes',
      hotkey: 'Mod+Shift+F',
      isAvailable: hasVault,
      run: () => workspace.openSearch(),
    },
    {
      id: 'open-graph',
      name: 'Open graph view',
      hotkey: 'Mod+G',
      isAvailable: hasVault,
      run: () => (workspace.view = 'graph'),
    },
    {
      id: 'show-local-graph',
      name: 'Show local graph',
      isAvailable: hasVault,
      run: () => workspace.showRightTab('graph'),
    },
    {
      id: 'show-files',
      name: 'Show file explorer',
      isAvailable: hasVault,
      run: () => (workspace.leftTab = 'files'),
    },
    {
      id: 'new-note',
      name: 'Create new note',
      hotkey: 'Mod+N',
      isAvailable: hasVault,
      run: () => workspace.createNote(),
    },
    {
      id: 'new-folder',
      name: 'Create new folder',
      isAvailable: hasVault,
      run: () => workspace.createFolder(),
    },
    {
      id: 'rename-note',
      name: 'Rename current note',
      isAvailable: hasNote,
      run: () => {
        workspace.leftTab = 'files'
        workspace.renaming = workspace.note?.path ?? null
      },
    },
    {
      id: 'delete-note',
      name: 'Delete current note',
      isAvailable: hasNote,
      run: () => workspace.note && workspace.trash(workspace.note.path),
    },
    {
      id: 'toggle-source-mode',
      name: 'Toggle live preview and source mode',
      hotkey: 'Mod+E',
      isAvailable: hasNote,
      run: () => workspace.toggleMode(),
    },
    {
      id: 'toggle-right-panel',
      name: 'Toggle right sidebar',
      isAvailable: hasVault,
      run: () => workspace.toggleRightPanel(),
    },
    {
      id: 'show-backlinks',
      name: 'Show backlinks',
      isAvailable: hasVault,
      run: () => workspace.showRightTab('backlinks'),
    },
    {
      id: 'show-tags',
      name: 'Show tags',
      isAvailable: hasVault,
      run: () => workspace.showRightTab('tags'),
    },
    {
      id: 'open-vault',
      name: 'Open another vault',
      run: () => workspace.chooseVault(),
    },
    {
      id: 'check-for-updates',
      name: 'Check for updates',
      run: () => checkForUpdates({ isManual: true }),
    },
    {
      id: 'open-settings',
      name: 'Open settings',
      hotkey: 'Mod+,',
      run: () => (workspace.isSettingsOpen = true),
    },
  )
}
