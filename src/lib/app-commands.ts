import { foldAll, toggleFold, unfoldAll } from '@codemirror/language'
import type { Command as EditorCommand } from '@codemirror/view'
import { commands } from './commands.svelte'
import { documents } from './documents'
import { activeView, formatInCell } from './editor/active'
import { insertLink, toggleWrap } from './editor/formatting'
import { moveLines } from './editor/move-lines'
import * as layouts from './layout'
import { parentOf } from './paths'
import { readProperties } from './properties'
import { checkForUpdates } from './updates'
import { workspace } from './workspace.svelte'
import { recorder } from './recorder.svelte'

const hasVault = () => workspace.info !== null
const hasNote = () => workspace.notePath !== null
const isInTableCell = () => document.activeElement?.closest('[data-table-cell]') != null
const isEditing = () =>
  hasNote() && !workspace.activeTab.isReading && activeView() !== null && !isInTableCell()

let contextTarget: Element | null = null

export function rememberContextTarget(target: EventTarget | null) {
  contextTarget = target instanceof Element ? target : null
}

function wrap(marker: string) {
  const view = activeView()
  if (view) toggleWrap(view, marker)
}

function runInEditor(command: EditorCommand) {
  const view = activeView()
  if (view) command(view)
}

function move(direction: -1 | 1) {
  const view = activeView()
  const transaction = view && moveLines(view.state, direction)
  if (transaction) view.dispatch(transaction)
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
      isAvailable: () => hasVault() && !workspace.activeTab.isPinned,
      run: () =>
        workspace.updateLayout((layout) =>
          layouts.closeTab(layout, layout.activeGroupId, workspace.activeTab.id),
        ),
    },
    {
      id: 'toggle-audio-recording',
      name: 'Start or stop recording audio',
      isAvailable: () => hasNote() || recorder.isRecording,
      run: () => recorder.toggle(),
    },
    {
      id: 'start-presentation',
      name: 'Start presentation',
      isAvailable: hasNote,
      run: () => (workspace.slidesNote = workspace.notePath),
    },
    {
      id: 'manage-workspaces',
      name: 'Load or save a workspace',
      isAvailable: hasVault,
      run: () => (workspace.workspacePicker = 'load'),
    },
    {
      id: 'save-workspace',
      name: 'Save the current workspace',
      isAvailable: () => hasVault() && workspace.workspacesConfig.value.active !== '',
      run: () => workspace.saveWorkspace(workspace.workspacesConfig.value.active),
    },
    {
      id: 'delete-workspace',
      name: 'Delete a workspace',
      isAvailable: () => hasVault() && workspace.workspaceNames.length > 0,
      run: () => (workspace.workspacePicker = 'delete'),
    },
    {
      id: 'toggle-pin',
      name: 'Toggle pin',
      isAvailable: hasVault,
      run: () =>
        workspace.updateLayout((layout) =>
          layouts.togglePin(layout, layout.activeGroupId, workspace.activeTab.id),
        ),
    },
    {
      id: 'toggle-stacked-tabs',
      name: 'Toggle stacked tabs',
      isAvailable: hasVault,
      run: () =>
        workspace.updateLayout((layout) => layouts.toggleStacked(layout, layout.activeGroupId)),
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
      macHotkey: 'Ctrl+Tab',
      isAvailable: hasVault,
      run: () => workspace.updateLayout((layout) => layouts.cycleTab(layout, 1)),
    },
    {
      id: 'previous-tab',
      name: 'Go to previous tab',
      hotkey: 'Mod+Shift+Tab',
      macHotkey: 'Ctrl+Shift+Tab',
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
      macHotkey: 'Mod+Alt+ArrowLeft',
      isAvailable: hasVault,
      run: () => workspace.updateLayout(layouts.goBack),
    },
    {
      id: 'go-forward',
      name: 'Navigate forward',
      hotkey: 'Alt+ArrowRight',
      macHotkey: 'Mod+Alt+ArrowRight',
      isAvailable: hasVault,
      run: () => workspace.updateLayout(layouts.goForward),
    },
    {
      id: 'show-properties',
      name: 'Show properties',
      isAvailable: hasVault,
      run: () => workspace.showRightTab('properties'),
    },
    {
      id: 'add-properties',
      name: 'Add properties to current note',
      isAvailable: hasNote,
      run: () => {
        const path = workspace.notePath
        if (path)
          void documents.update(path, (note) => (readProperties(note) ? null : `---\n---\n${note}`))
      },
    },
    {
      id: 'bookmark-note',
      name: 'Bookmark or unbookmark current note',
      isAvailable: hasNote,
      run: () =>
        workspace.notePath && workspace.toggleBookmark({ type: 'file', path: workspace.notePath }),
    },
    {
      id: 'show-bookmarks',
      name: 'Show bookmarks',
      isAvailable: hasVault,
      run: () => (workspace.leftTab = 'bookmarks'),
    },
    {
      id: 'reveal-active-file',
      name: 'Reveal current file in navigation',
      isAvailable: hasNote,
      run: () => workspace.notePath && workspace.revealInTree(workspace.notePath),
    },
    {
      id: 'show-outline',
      name: 'Show outline',
      isAvailable: hasVault,
      run: () => workspace.showRightTab('outline'),
    },
    {
      id: 'show-local-graph',
      name: 'Show local graph',
      isAvailable: hasVault,
      run: () => workspace.showRightTab('graph'),
    },
    {
      id: 'show-all-properties',
      name: 'Show all properties',
      isAvailable: hasVault,
      run: () => (workspace.leftTab = 'properties'),
    },
    {
      id: 'show-calendar',
      name: 'Show calendar',
      isAvailable: hasVault,
      run: () => workspace.showRightTab('calendar'),
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
      id: 'new-base',
      name: 'Create new base',
      isAvailable: hasVault,
      run: () => workspace.createBase(workspace.notePath ? parentOf(workspace.notePath) : ''),
    },
    {
      id: 'new-canvas',
      name: 'Create new canvas',
      isAvailable: hasVault,
      run: () => workspace.createCanvas(workspace.notePath ? parentOf(workspace.notePath) : ''),
    },
    {
      id: 'extract-selection',
      name: 'Extract current selection',
      isAvailable: isEditing,
      run: () => (workspace.composer = 'extract'),
    },
    {
      id: 'merge-note',
      name: 'Merge current file with another file',
      isAvailable: hasNote,
      run: () => (workspace.composer = 'merge'),
    },
    {
      id: 'new-unique-note',
      name: 'Create new unique note',
      isAvailable: hasVault,
      run: () => workspace.createUniqueNote(),
    },
    {
      id: 'open-random-note',
      name: 'Open random note',
      isAvailable: hasVault,
      run: () => workspace.openRandomNote(),
    },
    {
      id: 'open-daily-note',
      name: "Open today's daily note",
      isAvailable: hasVault,
      run: () => workspace.openDailyNote(),
    },
    {
      id: 'open-previous-daily-note',
      name: 'Open previous daily note',
      hotkey: 'Mod+Alt+ArrowLeft',
      macHotkey: 'Ctrl+Alt+ArrowLeft',
      isAvailable: hasVault,
      run: () => workspace.openDailyNote(-1),
    },
    {
      id: 'open-next-daily-note',
      name: 'Open next daily note',
      hotkey: 'Mod+Alt+ArrowRight',
      macHotkey: 'Ctrl+Alt+ArrowRight',
      isAvailable: hasVault,
      run: () => workspace.openDailyNote(1),
    },
    {
      id: 'insert-template',
      name: 'Insert template',
      hotkey: 'Mod+Shift+T',
      isAvailable: isEditing,
      run: () => {
        if (workspace.templateNotes.length) workspace.isTemplatePickerOpen = true
        else workspace.notify(`No templates in the "${workspace.templates.folder}" folder`)
      },
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
      run: () => formatInCell('toggle-bold') || wrap('**'),
    },
    {
      id: 'toggle-italic',
      name: 'Toggle italic',
      hotkey: 'Mod+I',
      isAvailable: isEditing,
      run: () => formatInCell('toggle-italic') || wrap('*'),
    },
    {
      id: 'toggle-strikethrough',
      name: 'Toggle strikethrough',
      isAvailable: isEditing,
      run: () => formatInCell('toggle-strikethrough') || wrap('~~'),
    },
    {
      id: 'toggle-inline-code',
      name: 'Toggle inline code',
      isAvailable: isEditing,
      run: () => formatInCell('toggle-inline-code') || wrap('`'),
    },
    {
      id: 'move-line-up',
      name: 'Move line up',
      hotkey: 'Alt+ArrowUp',
      isAvailable: isEditing,
      run: () => move(-1),
    },
    {
      id: 'move-line-down',
      name: 'Move line down',
      hotkey: 'Alt+ArrowDown',
      isAvailable: isEditing,
      run: () => move(1),
    },
    {
      id: 'toggle-fold',
      name: 'Toggle fold on the current line',
      isAvailable: isEditing,
      run: () => runInEditor(toggleFold),
    },
    {
      id: 'fold-all',
      name: 'Fold all headings and lists',
      isAvailable: isEditing,
      run: () => runInEditor(foldAll),
    },
    {
      id: 'unfold-all',
      name: 'Unfold all headings and lists',
      isAvailable: isEditing,
      run: () => runInEditor(unfoldAll),
    },
    {
      id: 'insert-link',
      name: 'Insert internal link',
      hotkey: 'Mod+K',
      isAvailable: isEditing,
      run: () => {
        const view = activeView()
        if (!formatInCell('insert-link') && view) insertLink(view)
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
      id: 'export-pdf',
      name: 'Export to PDF',
      isAvailable: hasNote,
      run: () => (workspace.pdfNote = workspace.notePath),
    },
    {
      id: 'export-html',
      name: 'Export to HTML',
      isAvailable: hasNote,
      run: () => workspace.notePath && void workspace.exportHtml(workspace.notePath),
    },
    {
      id: 'export-site',
      name: 'Export vault as a website',
      isAvailable: hasVault,
      run: () => void workspace.exportSite(),
    },
    {
      id: 'open-version-history',
      name: 'Open version history',
      isAvailable: hasNote,
      run: () => (workspace.historyNote = workspace.notePath),
    },
    {
      id: 'recover-deleted-notes',
      name: 'Recover deleted notes',
      isAvailable: hasVault,
      run: () => (workspace.isRecoveryOpen = true),
    },
    {
      id: 'toggle-readable-line-length',
      name: 'Toggle readable line length',
      isAvailable: hasVault,
      run: () =>
        workspace.setSettings({ readableLineLength: !workspace.settings.value.readableLineLength }),
    },
    {
      id: 'show-outgoing-links',
      name: 'Show outgoing links',
      isAvailable: hasVault,
      run: () => workspace.showRightTab('outgoing'),
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
