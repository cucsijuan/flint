import { commands } from './commands.svelte'
import { activeView } from './editor/active'
import { insertLink, toggleWrap } from './editor/formatting'
import * as layouts from './layout'
import { checkForUpdates } from './updates'
import { workspace } from './workspace.svelte'

const hasVault = () => workspace.info !== null
const hasNote = () => workspace.notePath !== null
const isEditing = () => hasNote() && !workspace.activeTab.isReading && activeView() !== null

let contextTarget: Element | null = null

export function rememberContextTarget(target: EventTarget | null) {
  contextTarget = target instanceof Element ? target : null
}

function wrap(marker: string) {
  const view = activeView()
  if (view) toggleWrap(view, marker)
}

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
      run: () => workspace.openGraph(),
    },
    {
      id: 'new-tab',
      name: 'New tab',
      hotkey: 'Mod+T',
      isAvailable: hasVault,
      run: () => workspace.updateLayout((layout) => layouts.addTab(layout)),
    },
    {
      id: 'close-tab',
      name: 'Close current tab',
      hotkey: 'Mod+W',
      isAvailable: hasVault,
      run: () =>
        workspace.updateLayout((layout) =>
          layouts.closeTab(layout, layout.activeGroupId, workspace.activeTab.id),
        ),
    },
    {
      id: 'close-other-tabs',
      name: 'Close other tabs',
      isAvailable: hasVault,
      run: () =>
        workspace.updateLayout((layout) =>
          layouts.closeOtherTabs(layout, layout.activeGroupId, workspace.activeTab.id),
        ),
    },
    {
      id: 'next-tab',
      name: 'Go to next tab',
      hotkey: 'Mod+Tab',
      isAvailable: hasVault,
      run: () => workspace.updateLayout((layout) => layouts.cycleTab(layout, 1)),
    },
    {
      id: 'previous-tab',
      name: 'Go to previous tab',
      hotkey: 'Mod+Shift+Tab',
      isAvailable: hasVault,
      run: () => workspace.updateLayout((layout) => layouts.cycleTab(layout, -1)),
    },
    {
      id: 'split-right',
      name: 'Split right',
      isAvailable: hasVault,
      run: () =>
        workspace.updateLayout((layout) => layouts.split(layout, layout.activeGroupId, 'right')),
    },
    {
      id: 'split-down',
      name: 'Split down',
      isAvailable: hasVault,
      run: () =>
        workspace.updateLayout((layout) => layouts.split(layout, layout.activeGroupId, 'bottom')),
    },
    {
      id: 'go-back',
      name: 'Navigate back',
      hotkey: 'Alt+ArrowLeft',
      isAvailable: hasVault,
      run: () => workspace.updateLayout(layouts.goBack),
    },
    {
      id: 'go-forward',
      name: 'Navigate forward',
      hotkey: 'Alt+ArrowRight',
      isAvailable: hasVault,
      run: () => workspace.updateLayout(layouts.goForward),
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
        workspace.renaming = workspace.notePath
      },
    },
    {
      id: 'delete-note',
      name: 'Delete current note',
      isAvailable: hasNote,
      run: () => workspace.notePath && workspace.trash(workspace.notePath),
    },
    {
      id: 'toggle-bold',
      name: 'Toggle bold',
      hotkey: 'Mod+B',
      isAvailable: isEditing,
      run: () => wrap('**'),
    },
    {
      id: 'toggle-italic',
      name: 'Toggle italic',
      hotkey: 'Mod+I',
      isAvailable: isEditing,
      run: () => wrap('*'),
    },
    {
      id: 'toggle-strikethrough',
      name: 'Toggle strikethrough',
      isAvailable: isEditing,
      run: () => wrap('~~'),
    },
    {
      id: 'toggle-inline-code',
      name: 'Toggle inline code',
      isAvailable: isEditing,
      run: () => wrap('`'),
    },
    {
      id: 'insert-link',
      name: 'Insert internal link',
      hotkey: 'Mod+K',
      isAvailable: isEditing,
      run: () => {
        const view = activeView()
        if (view) insertLink(view)
      },
    },
    {
      id: 'open-link-in-new-tab',
      name: 'Open link under the cursor in a new tab',
      isAvailable: () => contextTarget?.closest('[data-link]') != null,
      run: () => {
        const link = contextTarget?.closest<HTMLElement>('[data-link]')?.dataset.link
        if (link !== undefined)
          void workspace.openLink(link, workspace.notePath ?? '', { newTab: true })
      },
    },
    {
      id: 'toggle-reading',
      name: 'Toggle reading view',
      hotkey: 'Mod+E',
      isAvailable: hasNote,
      run: () => workspace.updateLayout(layouts.toggleReading),
    },
    {
      id: 'toggle-source-mode',
      name: 'Toggle live preview and source mode',
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
