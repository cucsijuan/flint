import { ask, open } from '@tauri-apps/plugin-dialog'
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
  type TemplateSettings,
} from './dates'
import {
  type Bookmark,
  type BookmarkTarget,
  isSameBookmark,
  moveBookmark,
  parseBookmarks,
  renameBookmarks,
  serializeBookmarks,
  toggleBookmark,
} from './bookmarks'
import { type AppearanceSettings, DEFAULT_APPEARANCE } from './appearance'
import { commands } from './commands.svelte'
import { VaultConfig } from './config.svelte'
import { parseHotkeys, serializeHotkeys } from './hotkeys'
import { blockIds } from './render/source'
import { documents } from './documents'
import { activeView } from './editor/active'
import { noteOpened, vaultChanged } from './events'
import { DEFAULT_GRAPH, type GraphSettings } from './graph'
import * as layouts from './layout'
import {
  NOTE_EXTENSION,
  basename,
  extensionOf,
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
import { buildTree } from './tree'
import * as vault from './vault'

const SEARCH_DELAY_MS = 200
const LAYOUT_SAVE_DELAY_MS = 500
const NOTICE_MS = 5000
const LAYOUT_CONFIG = 'workspace'
const BOOKMARKS_CONFIG = 'bookmarks'
const SNIPPETS_FOLDER = '.flint/snippets'
const HOTKEYS_CONFIG = 'hotkeys'
const ATTACHMENTS_FOLDER = 'attachments'

const timestamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14)

export type LeftTab = 'files' | 'search' | 'bookmarks'
export type RightTab = 'backlinks' | 'outline' | 'properties' | 'tags' | 'graph' | (string & {})

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
  /** Folders open in the file tree; kept here so they stay open when renamed or moved. */
  readonly expandedFolders = new SvelteSet<string>()
  /** The file the tree scrolls to and highlights for a moment. */
  revealed = $state<string | null>(null)
  bookmarks = $state<Bookmark[]>([])
  isSettingsOpen = $state(false)
  isQuickSwitcherOpen = $state(false)
  isCommandPaletteOpen = $state(false)
  searchQuery = $state('')
  searchResults = $state<vault.SearchResult[]>([])
  searchError = $state<string | null>(null)
  searchFocus = $state(0)
  graph = $state<vault.Graph>({ nodes: [], links: [] })
  readonly graphConfig = new VaultConfig('graph', DEFAULT_GRAPH)
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
      this.appearance,
      this.graphConfig,
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
    const vaultPath = (await vault.launchVault()) ?? (await getSetting('lastVault'))
    if (vaultPath) await this.openVault(vaultPath)
  }

  async chooseVault() {
    const path = await open({ directory: true, title: 'Open folder as vault' })
    if (path) await this.openVault(path)
  }

  async openVault(path: string) {
    await this.#run(async () => {
      await this.flush()
      this.info = await vault.openVault(path)
      await this.#refresh()
      this.#setLayout(await this.#storedLayout(), { save: false })
      await this.settings.load(this.#legacySettings)
      await this.dailyNotesConfig.load()
      await this.templatesConfig.load()
      await this.appearance.load()
      await this.graphConfig.load()
      this.#customHotkeys = parseHotkeys(await vault.readConfig(HOTKEYS_CONFIG))
      commands.setCustomHotkeys(this.#customHotkeys)
      await this.reloadSnippets()
      this.bookmarks = parseBookmarks(await vault.readConfig(BOOKMARKS_CONFIG))
      await setSetting('lastVault', path)
      if (!this.#isWatching) {
        this.#isWatching = true
        await vault.onVaultChanged((paths) => this.#onExternalChange(paths))
      }
    })
  }

  async flush() {
    await Promise.all([documents.flush(), ...this.#configs().map((config) => config.flush())])
  }

  updateLayout(update: (layout: layouts.Layout) => layouts.Layout) {
    this.#setLayout(update(this.layout))
  }

  saveLayoutSoon() {
    clearTimeout(this.#layoutTimer)
    this.#layoutTimer = setTimeout(() => {
      if (this.info) void vault.writeConfig(LAYOUT_CONFIG, JSON.stringify(this.layout))
    }, LAYOUT_SAVE_DELAY_MS)
  }

  openNote(path: string, { newTab = false }: OpenOptions = {}) {
    const view: layouts.TabView = { kind: 'note', path }
    this.updateLayout((layout) =>
      newTab ? layouts.addTab(layout, view) : layouts.navigate(layout, view),
    )
  }

  async openFile(path: string, { newTab = false }: OpenOptions = {}) {
    if (!isImage(path)) {
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
    const extension = extensionOf(source.name) || 'png'
    const isGenericName = !stem || /^image$/i.test(stem)
    const base = isGenericName ? `Pasted image ${timestamp()}` : stem
    const path = uniqueName(this.#takenPaths(), folder, base, `.${extension}`)
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

  setDailyNotes(changes: Partial<DailyNoteSettings>) {
    this.dailyNotesConfig.set(changes)
  }

  setTemplates(changes: Partial<TemplateSettings>) {
    this.templatesConfig.set(changes)
  }

  /** Opens today's daily note (creating it from the template), or the closest one before or after. */
  async openDailyNote(direction: 0 | 1 | -1 = 0) {
    await this.#run(async () => {
      const today = dayjs()
      if (direction === 0) {
        const path = dailyNotePath(today, this.dailyNotes)
        if (!this.#takenPaths().has(path)) {
          const { template } = this.dailyNotes
          const text = template ? await this.#templateText(template, noteTitle(path), today) : ''
          await vault.createNote(path)
          if (text) await vault.writeNote(path, text)
          await this.#refresh()
        }
        this.openNote(path)
        return
      }
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
    return this.bookmarks.some((bookmark) => isSameBookmark(bookmark, target))
  }

  toggleBookmark(target: BookmarkTarget) {
    this.#setBookmarks(toggleBookmark(this.bookmarks, target))
  }

  moveBookmark(from: number, to: number) {
    this.#setBookmarks(moveBookmark(this.bookmarks, from, to))
  }

  openBookmark(bookmark: Bookmark, options?: OpenOptions) {
    if (bookmark.type === 'search') this.openSearch(bookmark.query)
    else if (bookmark.type === 'heading') {
      this.openNoteAt(bookmark.path, { heading: bookmark.subpath.replace(/^#/, '') }, options)
    } else this.openNote(bookmark.path, options)
  }

  #setBookmarks(bookmarks: Bookmark[]) {
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
    return path?.toLowerCase().endsWith(NOTE_EXTENSION) ? blockIds(await documents.load(path)) : []
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
    const name =
      isNote && !trimmed.toLowerCase().endsWith(NOTE_EXTENSION) ? trimmed + NOTE_EXTENSION : trimmed
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
      this.searchResults = await vault.search(this.searchQuery)
      this.searchError = null
    } catch (error) {
      this.searchError = String(error)
    }
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
