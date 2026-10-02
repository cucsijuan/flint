import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { ask, open, save } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { SvelteSet } from 'svelte/reactivity'
import {
  adjacentDailyNote,
  applyTemplate,
  dailyNoteDate,
  dailyNotePath,
  type DailyNoteSettings,
  type Dayjs,
  dayjs,
  DEFAULT_DAILY_NOTES,
  DEFAULT_TEMPLATES,
  DEFAULT_UNIQUE_NOTES,
  type TemplateSettings,
  type UniqueNoteSettings,
} from './dates'
import {
  addGroup,
  type Bookmark,
  type BookmarkItem,
  type BookmarkPath,
  type BookmarkTarget,
  containsBookmark,
  moveBookmark,
  parseBookmarks,
  removeBookmarkAt,
  renameBookmarks,
  renameGroup,
  serializeBookmarks,
  toggleBookmark,
  ungroup,
} from './bookmarks'
import { type AppearanceSettings, DEFAULT_APPEARANCE } from './appearance'
import { commands } from './commands.svelte'
import { VaultConfig } from './config.svelte'
import { parseHotkeys, serializeHotkeys } from './hotkeys'
import { newBlockId, type NoteBlock, noteBlocks, noteContent, withBlockId } from './render/source'
import { documents } from './documents'
import { activeView } from './editor/active'
import { noteOpened, vaultChanged } from './events'
import { exportNoteHtml, exportSite } from './export/html'
import { linkMention } from './mentions'
import { renameProperty, setProperty } from './properties'
import { DEFAULT_GRAPH, type GraphSettings } from './graph'
import * as layouts from './layout'
import {
  NOTE_EXTENSION,
  basename,
  extensionOf,
  BASE_EXTENSION,
  CANVAS_EXTENSION,
  isBase,
  isCanvas,
  isImage,
  isWithin,
  join,
  noteTitle,
  parentOf,
  replacePrefix,
  uniqueName,
} from './paths'
import {
  type EditorMode,
  getSetting,
  DEFAULT_VAULT_SETTINGS,
  type VaultSettings,
  setSetting,
} from './settings'
import type { AttachmentSource } from './editor/attachments'
import type { FoldedLines } from './editor/folding'
import type { PropertyType } from './bases/base'
import type { NewNoteDefaults } from './bases/edit'
import { buildTree } from './tree'
import { isAndroid } from './platform'
import { isPopout, popoutView } from './popout'
import * as vault from './vault'

export type ReplaceScope = 'note' | 'folder' | 'vault'
const BLOCK_SEARCH_NOTES = 20
const NEW_BASE = 'views:\n  - type: table\n    name: Table\n'
const NEW_CANVAS = '{\n\t"nodes": [],\n\t"edges": []\n}'
const BLOCK_SEARCH_RESULTS = 50

const SEARCH_DELAY_MS = 200
const LAYOUT_SAVE_DELAY_MS = 500
const NOTICE_MS = 5000
const LAYOUT_CONFIG = 'workspace'
const BOOKMARKS_CONFIG = 'bookmarks'
const SNIPPETS_FOLDER = '.flint/snippets'
const HOTKEYS_CONFIG = 'hotkeys'
const ATTACHMENTS_FOLDER = 'attachments'

const timestamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14)

export type LeftTab = 'files' | 'search' | 'bookmarks' | 'properties'
export type RightTab =
  | 'backlinks'
  | 'outgoing'
  | 'outline'
  | 'properties'
  | 'tags'
  | 'graph'
  | 'calendar'
  | (string & {})

export interface Jump {
  tabId: string
  heading?: string
  /** A block id, without its `^`. */
  block?: string
  line?: number
}

export interface OpenOptions {
  newTab?: boolean
}

class Workspace {
  info = $state<vault.VaultInfo | null>(null)
  entries = $state<vault.Entry[]>([])
  tree = $derived(buildTree(this.entries))
  layout = $state.raw<layouts.Layout>(layouts.createLayout())
  activeTab = $derived(layouts.activeTab(this.layout))
  notePath = $derived(this.activeTab.view.kind === 'note' ? this.activeTab.view.path : null)
  renaming = $state<string | null>(null)
  notice = $state<string | null>(null)
  linkTargets = $state<vault.LinkTarget[]>([])
  indexVersion = $state(0)
  tags = $state<vault.TagCount[]>([])
  jump = $state<Jump | null>(null)
  leftTab = $state<LeftTab>('files')
  rightTab = $state<RightTab>('backlinks')
  showRightPanel = $state(true)
  checkForUpdates = $state(true)
  readonly settings = new VaultConfig('app', DEFAULT_VAULT_SETTINGS)
  readonly dailyNotesConfig = new VaultConfig('daily-notes', DEFAULT_DAILY_NOTES)
  readonly templatesConfig = new VaultConfig('templates', DEFAULT_TEMPLATES)
  /** Obsidian's "Unique note creator" settings, under its file name. */
  readonly uniqueNotesConfig = new VaultConfig('zk-prefixer', DEFAULT_UNIQUE_NOTES)
  /** Saved layouts, by name. */
  readonly workspacesConfig = new VaultConfig('workspaces', {
    workspaces: {} as Record<string, layouts.Layout>,
    active: '',
  })
  workspacePicker = $state<'load' | 'delete' | null>(null)
  /** The note being presented as slides. */
  slidesNote = $state<string | null>(null)
  readonly appearance = new VaultConfig('appearance', DEFAULT_APPEARANCE)
  snippets = $state<string[]>([])
  #snippetCss = $state(new Map<string, string>())
  enabledSnippetCss = $derived(
    new Map(
      [...this.#snippetCss].filter(([name]) =>
        this.appearance.value.enabledCssSnippets.includes(name),
      ),
    ),
  )
  templateNotes = $derived(
    this.entries.filter(
      (entry) => entry.kind === 'file' && isWithin(entry.path, this.templates.folder),
    ),
  )
  isTemplatePickerOpen = $state(false)
  /** The note composer's picker, open for extracting a selection or merging the note. */
  composer = $state<'extract' | 'merge' | null>(null)
  /** Folders open in the file tree; kept here so they stay open when renamed or moved. */
  readonly expandedFolders = new SvelteSet<string>()
  /** The file the tree scrolls to and highlights for a moment. */
  revealed = $state<string | null>(null)
  bookmarks = $state<BookmarkItem[]>([])
  isSettingsOpen = $state(false)
  /** The note whose version history is open. */
  historyNote = $state<string | null>(null)
  isRecoveryOpen = $state(false)
  /** The note the PDF export dialog is open for. */
  pdfNote = $state<string | null>(null)
  isQuickSwitcherOpen = $state(false)
  isCommandPaletteOpen = $state(false)
  searchQuery = $state('')
  searchResults = $state<vault.SearchResult[]>([])
  searchError = $state<string | null>(null)
  searchFocus = $state(0)
  replaceScope = $state<ReplaceScope>('vault')
  graph = $state<vault.Graph>({ nodes: [], links: [] })
  readonly graphConfig = new VaultConfig('graph', DEFAULT_GRAPH)
  /** Property types shared by every base, in Obsidian's `types.json` format. */
  readonly typesConfig = new VaultConfig('types', { types: {} as Record<string, PropertyType> })
  /** Folded lines per note, restored when the note opens again. */
  readonly foldsConfig = new VaultConfig('folds', { notes: {} as Record<string, FoldedLines[]> })
  localGraphDepth = $state(1)

  #legacySettings: Partial<VaultSettings> = {}
  #customHotkeys: Record<string, string | null> = {}
  #isWatching = false
  #noticeTimer: ReturnType<typeof setTimeout> | undefined
  #searchTimer: ReturnType<typeof setTimeout> | undefined
  #layoutTimer: ReturnType<typeof setTimeout> | undefined

  constructor() {
    documents.onError = (error) => this.notify(String(error))
    for (const config of this.#configs()) config.onError = (error) => this.notify(String(error))
  }

  #configs() {
    return [
      this.settings,
      this.dailyNotesConfig,
      this.templatesConfig,
      this.uniqueNotesConfig,
      this.workspacesConfig,
      this.appearance,
      this.graphConfig,
      this.foldsConfig,
      this.typesConfig,
    ]
  }

  get mode() {
    return this.settings.value.editorMode
  }

  get linkUpdate() {
    return this.settings.value.linkUpdate
  }

  get attachmentFolder() {
    return this.settings.value.attachmentFolder
  }

  get propertiesDisplay() {
    return this.settings.value.propertiesDisplay
  }

  get dailyNotes() {
    return this.dailyNotesConfig.value
  }

  get templates() {
    return this.templatesConfig.value
  }

  async restore() {
    this.showRightPanel = (await getSetting('showRightPanel')) ?? true
    this.checkForUpdates = (await getSetting('checkForUpdates')) ?? true
    for (const key of Object.keys(DEFAULT_VAULT_SETTINGS) as (keyof VaultSettings)[]) {
      const value = await getSetting(key)
      if (value !== undefined) this.#legacySettings = { ...this.#legacySettings, [key]: value }
    }
    if (popoutView) {
      const info = await vault.currentVault()
      const view = popoutView
      if (info)
        await this.#run(() => this.#loadVault(info, layouts.navigate(layouts.createLayout(), view)))
      return
    }
    const vaultPath = (await vault.launchVault()) ?? (await getSetting('lastVault'))
    if (vaultPath) await this.openVault(vaultPath)
  }

  /** Moves a tab to a window of its own. */
  async popOut(groupId: string, tab: layouts.Tab) {
    const view = encodeURIComponent(JSON.stringify(tab.view))
    const window = new WebviewWindow(`popout-${Date.now()}`, {
      url: `index.html?popout=${view}`,
      title: 'path' in tab.view ? noteTitle(tab.view.path) : 'Flint',
      width: 900,
      height: 700,
    })
    await new Promise<void>((resolve, reject) => {
      void window.once('tauri://created', () => resolve())
      void window.once('tauri://error', (event) => reject(new Error(String(event.payload))))
    }).then(
      () => this.updateLayout((layout) => layouts.closeTab(layout, groupId, tab.id)),
      (error: unknown) => this.notify(`Couldn't open a new window: ${String(error)}`),
    )
  }

  async chooseVault() {
    const path = isAndroid
      ? await this.#pickAndroidFolder()
      : await open({ directory: true, title: 'Open folder as vault' })
    if (path) await this.openVault(path)
  }

  /** Android shows shared folders only to apps with the all-files permission, so it asks first. */
  async #pickAndroidFolder() {
    try {
      let { granted } = await vault.hasAllFilesAccess()
      if (!granted) ({ granted } = await vault.requestAllFilesAccess())
      if (!granted) {
        this.notify('Flint needs access to your files to open a folder as a vault.')
        return null
      }
      return (await vault.pickFolder()).path
    } catch (error) {
      this.notify(String(error))
      return null
    }
  }

  async openVault(path: string) {
    await this.#run(async () => {
      await this.flush()
      const info = await vault.openVault(path)
      await this.#loadVault(info, await this.#storedLayout())
      await setSetting('lastVault', path)
    })
  }

  async #loadVault(info: vault.VaultInfo, layout: layouts.Layout) {
    this.info = info
    await this.#refresh()
    await this.foldsConfig.load()
    this.#setLayout(layout, { save: false })
    await this.settings.load(this.#legacySettings)
    await this.dailyNotesConfig.load()
    await this.templatesConfig.load()
    await this.uniqueNotesConfig.load()
    await this.workspacesConfig.load()
    await this.appearance.load()
    await this.graphConfig.load()
    await this.typesConfig.load()
    this.#customHotkeys = parseHotkeys(await vault.readConfig(HOTKEYS_CONFIG))
    commands.setCustomHotkeys(this.#customHotkeys)
    await this.reloadSnippets()
    this.bookmarks = parseBookmarks(await vault.readConfig(BOOKMARKS_CONFIG))
    if (!this.#isWatching) {
      this.#isWatching = true
      await vault.onVaultChanged((paths) => this.#onExternalChange(paths))
    }
  }

  async flush() {
    await Promise.all([documents.flush(), ...this.#configs().map((config) => config.flush())])
  }

  get workspaceNames() {
    return Object.keys(this.workspacesConfig.value.workspaces).sort((a, b) => a.localeCompare(b))
  }

  /** Saves the tabs and splits as they are now under `name`. */
  saveWorkspace(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    const { workspaces } = this.workspacesConfig.value
    this.workspacesConfig.set({
      workspaces: { ...workspaces, [trimmed]: $state.snapshot(this.layout) },
      active: trimmed,
    })
    this.notify(`Saved the workspace "${trimmed}".`)
  }

  loadWorkspace(name: string) {
    const saved = this.workspacesConfig.value.workspaces[name]
    if (!layouts.isLayout(saved)) return
    void documents.flush()
    this.#setLayout(saved)
    this.workspacesConfig.set({ active: name })
  }

  deleteWorkspace(name: string) {
    const workspaces = Object.fromEntries(
      Object.entries(this.workspacesConfig.value.workspaces).filter(([known]) => known !== name),
    )
    const active =
      this.workspacesConfig.value.active === name ? '' : this.workspacesConfig.value.active
    this.workspacesConfig.set({ workspaces, active })
  }

  updateLayout(update: (layout: layouts.Layout) => layouts.Layout) {
    this.#setLayout(update(this.layout))
  }

  saveLayoutSoon() {
    // Only the main window's layout is the vault's.
    if (isPopout) return
    clearTimeout(this.#layoutTimer)
    this.#layoutTimer = setTimeout(() => {
      if (this.info) void vault.writeConfig(LAYOUT_CONFIG, JSON.stringify(this.layout))
    }, LAYOUT_SAVE_DELAY_MS)
  }

  openNote(path: string, { newTab = false }: OpenOptions = {}) {
    if (!path.toLowerCase().endsWith(NOTE_EXTENSION)) {
      void this.openFile(path, { newTab })
      return
    }
    const view: layouts.TabView = { kind: 'note', path }
    this.updateLayout((layout) =>
      newTab ? layouts.addTab(layout, view) : layouts.navigate(layout, view),
    )
  }

  async openFile(path: string, { newTab = false }: OpenOptions = {}) {
    if (!isImage(path) && !isBase(path) && !isCanvas(path)) {
      await this.#run(() => vault.openExternally(path))
      return
    }
    const view: layouts.TabView = { kind: 'file', path }
    this.updateLayout((layout) =>
      newTab ? layouts.addTab(layout, view) : layouts.navigate(layout, view),
    )
  }

  assetUrl(path: string) {
    return this.info ? vault.assetUrl(this.info.root, path) : ''
  }

  openNoteAt(path: string, target: Omit<Jump, 'tabId'>, options?: OpenOptions) {
    this.openNote(path, options)
    this.jump = { ...target, tabId: this.activeTab.id }
  }

  openGraph() {
    const existing = layouts
      .groups(this.layout.root)
      .flatMap((group) => group.tabs.map((tab) => ({ group, tab })))
      .find(({ tab }) => tab.view.kind === 'graph')
    this.updateLayout((layout) =>
      existing
        ? layouts.activate(layout, existing.group.id, existing.tab.id)
        : layouts.addTab(layout, { kind: 'graph' }),
    )
  }

  async openOrCreateNote(name: string, options?: OpenOptions) {
    const path = name.toLowerCase().endsWith(NOTE_EXTENSION) ? name : name + NOTE_EXTENSION
    await this.#run(async () => {
      if (!this.entries.some((entry) => entry.path === path)) {
        await vault.createNote(path)
        await this.#refresh()
      }
      this.openNote(path, options)
    })
  }

  toggleMode() {
    this.setMode(this.mode === 'live' ? 'source' : 'live')
  }

  setMode(editorMode: EditorMode) {
    this.setSettings({ editorMode })
  }

  setSettings(changes: Partial<VaultSettings>) {
    this.settings.set(changes)
  }

  toggleRightPanel() {
    this.setRightPanel(!this.showRightPanel)
  }

  showRightTab(tab: RightTab) {
    this.rightTab = tab
    this.setRightPanel(true)
  }

  setRightPanel(isVisible: boolean) {
    this.showRightPanel = isVisible
    void setSetting('showRightPanel', isVisible)
  }

  openSearch(query?: string) {
    this.leftTab = 'search'
    this.searchFocus++
    if (query !== undefined) this.search(query)
  }

  search(query: string) {
    this.searchQuery = query
    clearTimeout(this.#searchTimer)
    this.#searchTimer = setTimeout(() => void this.#runSearch(), SEARCH_DELAY_MS)
  }

  setCheckForUpdates(isEnabled: boolean) {
    this.checkForUpdates = isEnabled
    void setSetting('checkForUpdates', isEnabled)
  }

  async saveAttachment(source: AttachmentSource, notePath: string) {
    const folder = {
      root: '',
      same: parentOf(notePath),
      attachments: ATTACHMENTS_FOLDER,
    }[this.attachmentFolder]
    const dot = source.name.lastIndexOf('.')
    const stem = dot > 0 ? source.name.slice(0, dot) : source.name
    const extension = extensionOf(source.name)
    const isGenericName = !stem || /^image$/i.test(stem)
    const base = isGenericName ? `Pasted image ${timestamp()}` : stem
    const path = uniqueName(this.#takenPaths(), folder, base, extension ? `.${extension}` : '')
    if (!(await source.write(path))) return null
    await this.#refresh()
    return this.linkTargets.find((target) => target.path === path)?.linkText ?? basename(path)
  }

  /** Sets a command's hotkey: a hotkey, `null` for none, or `undefined` to restore the default. */
  setHotkey(id: string, hotkey: string | null | undefined) {
    const others = Object.fromEntries(
      Object.entries(this.#customHotkeys).filter(([known]) => known !== id),
    )
    this.#customHotkeys = hotkey === undefined ? others : { ...others, [id]: hotkey }
    commands.setCustomHotkeys(this.#customHotkeys)
    const json = serializeHotkeys(this.#customHotkeys)
    void this.#run(() => vault.writeConfig(HOTKEYS_CONFIG, json))
  }

  setGraph(changes: Partial<GraphSettings>) {
    this.graphConfig.set(changes)
  }

  setAppearance(changes: Partial<AppearanceSettings>) {
    this.appearance.set(changes)
  }

  toggleSnippet(name: string, isEnabled: boolean) {
    const others = this.appearance.value.enabledCssSnippets.filter((known) => known !== name)
    this.setAppearance({ enabledCssSnippets: isEnabled ? [...others, name] : others })
  }

  async reloadSnippets() {
    await this.#run(async () => {
      this.snippets = await vault.snippets()
      const css = await Promise.all(this.snippets.map((name) => vault.readSnippet(name)))
      this.#snippetCss = new Map(this.snippets.map((name, index) => [name, css[index]]))
    })
  }

  async openSnippetsFolder() {
    await this.#run(async () => {
      await vault.createFolder(SNIPPETS_FOLDER).catch(() => undefined)
      await vault.openExternally(SNIPPETS_FOLDER)
    })
  }

  get uniqueNotes() {
    return this.uniqueNotesConfig.value
  }

  setUniqueNotes(changes: Partial<UniqueNoteSettings>) {
    this.uniqueNotesConfig.set(changes)
  }

  /** Creates a note named after the current date and time, from the unique note template. */
  async createUniqueNote() {
    await this.#run(async () => {
      const now = dayjs()
      const { folder, format, template } = this.uniqueNotes
      const name = now.format(format || DEFAULT_UNIQUE_NOTES.format)
      const path = uniqueName(this.#takenPaths(), folder, name, NOTE_EXTENSION)
      const text = template ? await this.#templateText(template, noteTitle(path), now) : ''
      await vault.createNote(path)
      if (text) await vault.writeNote(path, text)
      await this.#refresh()
      this.openNote(path)
    })
  }

  openRandomNote() {
    const notes = this.entries.filter(
      (entry) => entry.kind === 'file' && entry.path !== this.notePath,
    )
    const note = notes[Math.floor(Math.random() * notes.length)]
    if (note) this.openNote(note.path)
  }

  setDailyNotes(changes: Partial<DailyNoteSettings>) {
    this.dailyNotesConfig.set(changes)
  }

  setTemplates(changes: Partial<TemplateSettings>) {
    this.templatesConfig.set(changes)
  }

  /** Opens today's daily note (creating it from the template), or the closest one before or after. */
  /** Opens the daily note for `date`, creating it from the daily notes template if needed. */
  async openDailyNoteFor(date: Dayjs, options?: OpenOptions) {
    await this.#run(async () => {
      const path = dailyNotePath(date, this.dailyNotes)
      if (!this.#takenPaths().has(path)) {
        const { template } = this.dailyNotes
        const text = template ? await this.#templateText(template, noteTitle(path), date) : ''
        await vault.createNote(path)
        if (text) await vault.writeNote(path, text)
        await this.#refresh()
      }
      this.openNote(path, options)
    })
  }

  async openDailyNote(direction: 0 | 1 | -1 = 0) {
    if (direction === 0) return this.openDailyNoteFor(dayjs())
    await this.#run(async () => {
      const today = dayjs()
      const current = this.notePath ? dailyNoteDate(this.notePath, this.dailyNotes) : null
      const paths = this.entries.map((entry) => entry.path)
      const path = adjacentDailyNote(paths, current ?? today, direction, this.dailyNotes)
      if (path) this.openNote(path)
      else this.notify(direction === 1 ? 'No next daily note' : 'No previous daily note')
    })
  }

  async insertTemplate(template: string) {
    const view = activeView()
    const title = this.notePath ? noteTitle(this.notePath) : ''
    if (!view) return
    await this.#run(async () => {
      view.dispatch(view.state.replaceSelection(await this.#templateText(template, title, dayjs())))
      view.focus()
    })
  }

  async #templateText(template: string, title: string, date: Dayjs) {
    const [path] = await this.resolveLinks([template])
    if (!path) throw new Error(`Template not found: ${template}`)
    return applyTemplate(await vault.readNote(path), { title, date }, this.templates)
  }

  isBookmarked(target: BookmarkTarget) {
    return containsBookmark(this.bookmarks, target)
  }

  toggleBookmark(target: BookmarkTarget) {
    this.#setBookmarks(toggleBookmark(this.bookmarks, target))
  }

  moveBookmark(from: BookmarkPath, parent: BookmarkPath, index: number) {
    this.#setBookmarks(moveBookmark(this.bookmarks, from, parent, index))
  }

  addBookmarkGroup(title: string) {
    this.#setBookmarks(addGroup(this.bookmarks, title))
  }

  renameBookmarkGroup(path: BookmarkPath, title: string) {
    this.#setBookmarks(renameGroup(this.bookmarks, path, title))
  }

  ungroupBookmarks(path: BookmarkPath) {
    this.#setBookmarks(ungroup(this.bookmarks, path))
  }

  removeBookmark(path: BookmarkPath) {
    this.#setBookmarks(removeBookmarkAt(this.bookmarks, path))
  }

  openBookmark(bookmark: Bookmark, options?: OpenOptions) {
    if (bookmark.type === 'search') this.openSearch(bookmark.query)
    else if (bookmark.type === 'folder') this.revealInTree(bookmark.path)
    else if (bookmark.type === 'heading') {
      this.openNoteAt(bookmark.path, { heading: bookmark.subpath.replace(/^#/, '') }, options)
    } else this.openNote(bookmark.path, options)
  }

  #setBookmarks(bookmarks: BookmarkItem[]) {
    this.bookmarks = bookmarks
    void this.#run(() => vault.writeConfig(BOOKMARKS_CONFIG, serializeBookmarks(bookmarks)))
  }

  resolveLinks(targets: string[], source = this.notePath ?? '') {
    return vault.resolveLinks(source, targets)
  }

  async headingsFor(target: string, source = this.notePath ?? '') {
    const [path] = target ? await this.resolveLinks([target], source) : [source || null]
    return path ? vault.noteHeadings(path) : []
  }

  async blocksFor(target: string, source = this.notePath ?? '') {
    const [path] = target ? await this.resolveLinks([target], source) : [source || null]
    if (!path?.toLowerCase().endsWith(NOTE_EXTENSION)) return null
    return { path, blocks: noteBlocks(await documents.load(path)) }
  }

  /** Blocks anywhere in the vault containing every word of `query`, for `[[^^` links. */
  async searchBlocks(query: string) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return []
    const quoted = words.map((word) => `"${word.replaceAll('"', '')}"`).join(' ')
    const notes = await vault.search(quoted, 'modified-newest')
    const found: { path: string; block: NoteBlock }[] = []
    for (const { path } of notes.slice(0, BLOCK_SEARCH_NOTES)) {
      for (const block of noteBlocks(await documents.load(path))) {
        const text = block.text.toLowerCase()
        if (words.every((word) => text.includes(word))) found.push({ path, block })
      }
    }
    return found.slice(0, BLOCK_SEARCH_RESULTS)
  }

  /** Saves the note as one self-contained HTML file, asking where. */
  async exportHtml(path: string) {
    const target = await save({
      title: 'Export to HTML',
      defaultPath: `${noteTitle(path)}.html`,
      filters: [{ name: 'HTML', extensions: ['html'] }],
    })
    if (!target) return
    await this.#run(async () => {
      await exportNoteHtml(path, target)
      this.notify(`Exported to ${target}`)
    })
  }

  /** Saves every note in `folder` (the whole vault when empty) as a website, asking where. */
  async exportSite(folder = '') {
    const target = await open({ directory: true, title: 'Export as a website into…' })
    if (!target) return
    await this.#run(async () => {
      const count = await exportSite(folder, target, (done, total) => {
        if (done % 20 === 0) this.notify(`Exporting ${done} of ${total} notes…`)
      })
      this.notify(`Exported ${count} ${count === 1 ? 'note' : 'notes'} to ${target}`)
    })
  }

  /** Puts an earlier version back as the note's text; it's an ordinary edit, so it can be undone. */
  restoreVersion(path: string, text: string) {
    void this.#run(() => documents.update(path, () => text))
  }

  /** Brings back a deleted note from its last snapshot, and opens it. */
  async restoreDeleted(path: string, text: string) {
    await this.#run(async () => {
      const folder = parentOf(path)
      if (folder) await vault.createFolder(folder).catch(() => undefined)
      await vault.createNote(path)
      await vault.writeNote(path, text)
      await this.#refresh()
      this.openNote(path)
    })
  }

  /** Sets a property's type for the whole vault, like Obsidian's `types.json`. */
  setPropertyType(name: string, type: PropertyType) {
    this.typesConfig.set({ types: { ...this.typesConfig.value.types, [name]: type } })
  }

  /** Renames a property in every note that has it, keeping its vault-wide type. */
  async renamePropertyEverywhere(from: string, to: string) {
    const name = to.trim()
    if (!name || name === from) return
    await this.#run(async () => {
      const files = await vault.baseFiles()
      for (const file of files.filter((known) => from in known.properties)) {
        await documents.update(file.path, (text) => renameProperty(text, from, name))
      }
      const { [from]: type, ...types } = this.typesConfig.value.types
      if (type) this.typesConfig.set({ types: { ...types, [name]: type } })
      await documents.flush()
    })
  }

  /** Writes one frontmatter property of a note, as a base's table cell edits it. */
  setNoteProperty(path: string, key: string, value: unknown) {
    void this.#run(() => documents.update(path, (text) => setProperty(text, key, value)))
  }

  /** Creates a note that a base's filters let through, and opens it. */
  async createNoteFor(defaults: NewNoteDefaults) {
    await this.#run(async () => {
      const path = uniqueName(this.#takenPaths(), defaults.folder, 'Untitled', NOTE_EXTENSION)
      if (defaults.folder) await vault.createFolder(defaults.folder).catch(() => undefined)
      await vault.createNote(path)
      const properties = {
        ...defaults.properties,
        ...(defaults.tags.length ? { tags: defaults.tags } : {}),
      }
      await documents.update(path, (text) =>
        Object.entries(properties).reduce(
          (note, [key, value]) => setProperty(note, key, value),
          text,
        ),
      )
      await documents.flush()
      await this.#refresh()
      this.openNote(path)
    })
  }

  /** Moves the editor's selection into `target` (a note's path, or a name for a new note beside
   * the current one), leaving a link or an embed in its place. */
  async extractSelection(target: string, isNew: boolean) {
    const view = activeView()
    const source = this.notePath
    if (!view || !source) return
    const { from, to } = view.state.selection.main
    const text = view.state.sliceDoc(from, to)
    if (!text.trim()) {
      this.notify('Select some text to extract first.')
      return
    }
    await this.#run(async () => {
      const path = isNew ? await this.createNoteWith(parentOf(source), target, text) : target
      if (!isNew) await documents.update(path, (current) => `${current.trimEnd()}\n\n${text}\n`)
      const linkText = this.linkTargets.find((known) => known.path === path)?.linkText
      const link = linkText ?? noteTitle(path)
      const replacement = {
        link: `[[${link}]]`,
        embed: `![[${link}]]`,
        none: '',
      }[this.settings.value.extractedText]
      view.dispatch({ changes: { from, to, insert: replacement } })
    })
  }

  /** Appends the current note to `target`, points its links there and deletes it. */
  async mergeInto(target: string) {
    const source = this.notePath
    if (!source || source === target) return
    await this.#run(async () => {
      const { text } = noteContent(await documents.load(source))
      await documents.update(target, (current) => `${current.trimEnd()}\n\n${text.trim()}\n`)
      await documents.flush()
      await vault.redirectLinks(source, target)
      documents.forget(source)
      await vault.trashEntry(source)
      await this.#refresh()
      this.openNote(target)
    })
  }

  /** Writes `contents` to a new note named after `title` in `folder`, and returns its path. */
  async createNoteWith(folder: string, title: string, contents: string) {
    const name = title.replace(/[\\/:*?"<>|#^[\]]/g, '').trim() || 'Untitled'
    const path = uniqueName(this.#takenPaths(), folder, name, NOTE_EXTENSION)
    await vault.createNote(path)
    await vault.writeNote(path, contents)
    await this.#refresh()
    return path
  }

  /** Turns an unlinked mention into a link to the note it names. */
  linkMention(mention: vault.Mention) {
    const target = this.linkTargets.find(({ path, alias }) => path === mention.target && !alias)
    const linkText = target?.linkText ?? noteTitle(mention.target)
    void this.#run(() =>
      documents.update(mention.source, (text) =>
        linkMention(text, mention.line, mention.text, linkText),
      ),
    )
  }

  /** Gives `block` of `path` a new `^id` and returns it; the note is left alone if the block changed. */
  addBlockId(path: string, block: NoteBlock) {
    const id = newBlockId()
    void documents.update(path, (text) => {
      const current = noteBlocks(text).find(
        (candidate) => candidate.line === block.line && candidate.text === block.text,
      )
      return current && !current.id ? withBlockId(text, current, id) : null
    })
    return id
  }

  async openLink(destination: string, source = this.notePath ?? '', options?: OpenOptions) {
    const hash = destination.indexOf('#')
    const target = hash === -1 ? destination : destination.slice(0, hash)
    const subpath = hash === -1 ? '' : destination.slice(hash + 1)
    await this.#run(async () => {
      let [path] = target ? await this.resolveLinks([target], source) : [source || null]
      if (!path) {
        path = target.toLowerCase().endsWith(NOTE_EXTENSION) ? target : target + NOTE_EXTENSION
        await vault.createNote(path)
        await this.#refresh()
      }
      if (!path.toLowerCase().endsWith(NOTE_EXTENSION)) await this.openFile(path, options)
      else if (subpath.startsWith('^')) this.openNoteAt(path, { block: subpath.slice(1) }, options)
      else if (subpath) this.openNoteAt(path, { heading: subpath }, options)
      else this.openNote(path, options)
    })
  }

  async createNote(folder = '') {
    const path = uniqueName(this.#takenPaths(), folder, 'Untitled', NOTE_EXTENSION)
    await this.#run(async () => {
      await vault.createNote(path)
      await this.#refresh()
      this.openNote(path)
      this.leftTab = 'files'
      this.renaming = path
    })
  }

  /** Creates a base with one table view and opens it. */
  createBase(folder = '') {
    return this.#createFile(folder, BASE_EXTENSION, NEW_BASE)
  }

  createCanvas(folder = '') {
    return this.#createFile(folder, CANVAS_EXTENSION, NEW_CANVAS)
  }

  async #createFile(folder: string, extension: string, contents: string) {
    const path = uniqueName(this.#takenPaths(), folder, 'Untitled', `.${extension}`)
    await this.#run(async () => {
      await vault.createNote(path)
      await vault.writeNote(path, contents)
      await this.#refresh()
      await this.openFile(path)
      this.leftTab = 'files'
      this.renaming = path
    })
  }

  async createFolder(parent = '') {
    const path = uniqueName(this.#takenPaths(), parent, 'Untitled')
    await this.#run(async () => {
      await vault.createFolder(path)
      await this.#refresh()
      this.renaming = path
    })
  }

  async rename(path: string, newName: string) {
    this.renaming = null
    const trimmed = newName.trim()
    const isNote = this.entries.find((entry) => entry.path === path)?.kind === 'file'
    const extension = isNote ? NOTE_EXTENSION : `.${extensionOf(path)}`
    const keepsExtension = isNote
      ? trimmed.toLowerCase().endsWith(NOTE_EXTENSION)
      : extensionOf(trimmed) !== '' || extension === '.'
    const name = keepsExtension ? trimmed : trimmed + extension
    if (trimmed) await this.#move(path, join(parentOf(path), name))
  }

  /** Shows `path` in the file tree: opens the files panel and every folder above it. */
  revealInTree(path: string) {
    this.leftTab = 'files'
    for (let folder = parentOf(path); folder; folder = parentOf(folder)) {
      this.expandedFolders.add(folder)
    }
    this.revealed = path
  }

  showInFileManager(path: string) {
    void this.#run(() => vault.showInFileManager(path))
  }

  /** Opens a web or mail link in the system's default app. */
  /** Opens a web address in Flint's web viewer, or in the browser when that's turned off. */
  openUrl(url: string, { inBrowser = false } = {}) {
    const useViewer = this.settings.value.webViewer && !inBrowser && /^https?:/i.test(url)
    void this.#run(() => (useViewer ? vault.openWebViewer(url) : openUrl(url)))
  }

  /** Copies a note or attachment next to itself as "Name 1", "Name 2"… */
  async duplicate(path: string) {
    const extension = extensionOf(path) ? `.${extensionOf(path)}` : ''
    const base = basename(path).slice(0, basename(path).length - extension.length)
    const copy = uniqueName(this.#takenPaths(), parentOf(path), base, extension)
    await this.#run(async () => {
      await this.flush()
      await vault.copyEntry(path, copy)
      await this.#refresh()
      if (copy.toLowerCase().endsWith(NOTE_EXTENSION)) this.openNote(copy)
    })
  }

  /** Moves a note, attachment or folder into `folder` ('' is the vault root). */
  async move(path: string, folder: string) {
    if (folder === parentOf(path) || isWithin(folder, path)) return
    const target = join(folder, basename(path))
    if (this.#takenPaths().has(target)) {
      this.notify(`"${basename(path)}" already exists in ${folder || 'the vault root'}.`)
      return
    }
    await this.#move(path, target)
  }

  async #move(path: string, target: string) {
    if (target === path) return
    await this.#run(async () => {
      await this.flush()
      const linkCount = await vault.incomingLinkCount(path)
      const updateLinks = linkCount > 0 && (await this.#shouldUpdateLinks(linkCount))
      const updated = await vault.renameEntry(path, target, updateLinks)
      documents.rename(path, target)
      this.#renameFolds(path, target)
      const bookmarks = renameBookmarks(this.bookmarks, path, target)
      if (serializeBookmarks(bookmarks) !== serializeBookmarks(this.bookmarks)) {
        this.#setBookmarks(bookmarks)
      }
      this.updateLayout((layout) => layouts.renamePaths(layout, path, target))
      for (const folder of [...this.expandedFolders].filter((known) => isWithin(known, path))) {
        this.expandedFolders.delete(folder)
        this.expandedFolders.add(replacePrefix(folder, path, target))
      }
      await this.#refresh()
      if (updated) this.notify(`Updated ${updated} ${updated === 1 ? 'link' : 'links'}.`)
    })
  }

  foldsFor(path: string) {
    return this.foldsConfig.value.notes[path] ?? []
  }

  setFolds(path: string, folds: FoldedLines[]) {
    const others = Object.entries(this.foldsConfig.value.notes).filter(([note]) => note !== path)
    this.foldsConfig.set({
      notes: Object.fromEntries(folds.length ? [...others, [path, folds]] : others),
    })
  }

  #renameFolds(path: string, target: string) {
    const notes = Object.entries(this.foldsConfig.value.notes)
    if (!notes.some(([note]) => isWithin(note, path))) return
    this.foldsConfig.set({
      notes: Object.fromEntries(
        notes.map(([note, folds]) => [replacePrefix(note, path, target), folds]),
      ),
    })
  }

  async #shouldUpdateLinks(count: number) {
    if (this.linkUpdate !== 'ask') return this.linkUpdate === 'always'
    return ask(`Update ${count} ${count === 1 ? 'link' : 'links'} pointing to it?`, {
      title: 'Update links',
      okLabel: 'Update',
      cancelLabel: "Don't update",
    })
  }

  async trash(path: string) {
    const confirmed = await ask(`Move "${basename(path)}" to the trash?`, {
      title: 'Delete',
      kind: 'warning',
    })
    if (!confirmed) return
    await this.#run(async () => {
      await this.flush()
      await vault.trashEntry(path)
      documents.forget(path)
      this.updateLayout((layout) => layouts.closePaths(layout, path))
      await this.#refresh()
    })
  }

  notify(message: string) {
    this.notice = message
    clearTimeout(this.#noticeTimer)
    this.#noticeTimer = setTimeout(() => (this.notice = null), NOTICE_MS)
  }

  #setLayout(next: layouts.Layout, { save = true } = {}) {
    const previousPath = this.notePath
    this.layout = next
    if (this.notePath !== previousPath) noteOpened.emit(this.notePath)
    if (save) this.saveLayoutSoon()
  }

  async #storedLayout() {
    try {
      const stored: unknown = JSON.parse((await vault.readConfig(LAYOUT_CONFIG)) ?? 'null')
      if (!layouts.isLayout(stored)) return layouts.createLayout()
      const existing = new Set(this.entries.map((entry) => entry.path))
      const missing = [...layouts.openPaths(stored)].filter((path) => !existing.has(path))
      return missing.reduce(layouts.closePaths, stored)
    } catch {
      return layouts.createLayout()
    }
  }

  #takenPaths() {
    return new Set(this.entries.map((entry) => entry.path))
  }

  async #refresh() {
    ;[this.entries, this.linkTargets, this.tags, this.graph] = await Promise.all([
      vault.listEntries(),
      vault.linkTargets(),
      vault.tags(),
      vault.graph(),
    ])
    this.indexVersion++
    if (this.searchQuery) await this.#runSearch()
  }

  async #runSearch() {
    try {
      this.searchResults = await vault.search(this.searchQuery, this.settings.value.searchSort)
      this.searchError = null
    } catch (error) {
      this.searchError = String(error)
    }
  }

  setSearchSort(searchSort: vault.SearchSort) {
    this.setSettings({ searchSort })
    void this.#runSearch()
  }

  /** The search results a replacement may touch, given `replaceScope`. */
  get replaceTargets() {
    const note = this.notePath
    if (this.replaceScope === 'vault') return this.searchResults
    if (!note) return []
    const folder = parentOf(note)
    return this.searchResults.filter(({ path }) =>
      this.replaceScope === 'note' ? path === note : isWithin(path, folder) || !folder,
    )
  }

  /** Replaces the search's matches in `path` (only on `line`, or only its `occurrence`th match
   * there, when given); returns the count. */
  async #replaceIn(path: string, replacement: string, line?: number, occurrence?: number) {
    const contents = await documents.load(path)
    const replaced = await vault.replaceText(
      this.searchQuery,
      replacement,
      contents,
      line,
      occurrence,
    )
    if (replaced.count) {
      await documents.update(path, (current) => (current === contents ? replaced.text : null))
    }
    return replaced.count
  }

  async replaceAll(replacement: string) {
    await this.#run(async () => {
      const targets = this.replaceTargets
      let count = 0
      for (const { path } of targets) count += await this.#replaceIn(path, replacement)
      await documents.flush()
      await this.#runSearch()
      this.notify(`Replaced ${count} ${count === 1 ? 'match' : 'matches'}.`)
    })
  }

  async replaceLine(path: string, line: number, replacement: string, occurrence?: number) {
    await this.#run(async () => {
      await this.#replaceIn(path, replacement, line, occurrence)
      await documents.flush()
      await this.#runSearch()
    })
  }

  async #onExternalChange(paths: string[]) {
    vaultChanged.emit(paths)
    await this.#run(async () => {
      await this.#refresh()
      const existing = new Set(this.entries.map((entry) => entry.path))
      for (const path of paths) {
        if (!documents.isOpen(path)) continue
        if (existing.has(path)) await documents.reload(path)
        else {
          documents.forget(path)
          this.updateLayout((layout) => layouts.closePaths(layout, path))
        }
      }
    })
  }

  async #run(action: () => Promise<unknown>) {
    try {
      await action()
    } catch (error) {
      this.notify(String(error))
    }
  }
}

export const workspace = new Workspace()
