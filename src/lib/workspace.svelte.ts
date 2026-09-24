import { ask, open } from '@tauri-apps/plugin-dialog'
import { documents } from './documents'
import { noteOpened, vaultChanged } from './events'
import type { GraphFilters } from './graph'
import * as layouts from './layout'
import { NOTE_EXTENSION, basename, join, parentOf, uniqueName } from './paths'
import { getSetting, setSetting, type EditorMode, type LinkUpdate } from './settings'
import { buildTree } from './tree'
import * as vault from './vault'

const SEARCH_DELAY_MS = 200
const LAYOUT_SAVE_DELAY_MS = 500
const NOTICE_MS = 5000
const LAYOUT_CONFIG = 'workspace'

export type LeftTab = 'files' | 'search'
export type RightTab = 'backlinks' | 'tags' | 'graph' | (string & {})

export interface Jump {
  tabId: string
  heading?: string
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
  mode = $state<EditorMode>('live')
  renaming = $state<string | null>(null)
  notice = $state<string | null>(null)
  linkTargets = $state<vault.LinkTarget[]>([])
  indexVersion = $state(0)
  tags = $state<vault.TagCount[]>([])
  jump = $state<Jump | null>(null)
  leftTab = $state<LeftTab>('files')
  rightTab = $state<RightTab>('backlinks')
  showRightPanel = $state(true)
  linkUpdate = $state<LinkUpdate>('ask')
  checkForUpdates = $state(true)
  isSettingsOpen = $state(false)
  isQuickSwitcherOpen = $state(false)
  isCommandPaletteOpen = $state(false)
  searchQuery = $state('')
  searchResults = $state<vault.SearchResult[]>([])
  searchError = $state<string | null>(null)
  searchFocus = $state(0)
  graph = $state<vault.Graph>({ nodes: [], links: [] })
  graphFilters = $state<GraphFilters>({
    showTags: false,
    showUnresolved: true,
    showOrphans: true,
    query: '',
  })
  localGraphDepth = $state(1)

  #isWatching = false
  #noticeTimer: ReturnType<typeof setTimeout> | undefined
  #searchTimer: ReturnType<typeof setTimeout> | undefined
  #layoutTimer: ReturnType<typeof setTimeout> | undefined

  constructor() {
    documents.onError = (error) => this.notify(String(error))
  }

  async restore() {
    this.mode = (await getSetting('editorMode')) ?? 'live'
    this.showRightPanel = (await getSetting('showRightPanel')) ?? true
    this.linkUpdate = (await getSetting('linkUpdate')) ?? 'ask'
    this.checkForUpdates = (await getSetting('checkForUpdates')) ?? true
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
      await setSetting('lastVault', path)
      if (!this.#isWatching) {
        this.#isWatching = true
        await vault.onVaultChanged((paths) => this.#onExternalChange(paths))
      }
    })
  }

  flush() {
    return documents.flush()
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
    this.mode = this.mode === 'live' ? 'source' : 'live'
    void setSetting('editorMode', this.mode)
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

  setLinkUpdate(value: LinkUpdate) {
    this.linkUpdate = value
    void setSetting('linkUpdate', value)
  }

  resolveLinks(targets: string[], source = this.notePath ?? '') {
    return vault.resolveLinks(source, targets)
  }

  async headingsFor(target: string, source = this.notePath ?? '') {
    const [path] = target ? await this.resolveLinks([target], source) : [source || null]
    return path ? vault.noteHeadings(path) : []
  }

  async openLink(destination: string, source = this.notePath ?? '', options?: OpenOptions) {
    const hash = destination.indexOf('#')
    const target = hash === -1 ? destination : destination.slice(0, hash)
    const heading = hash === -1 ? '' : destination.slice(hash + 1)
    await this.#run(async () => {
      let [path] = target ? await this.resolveLinks([target], source) : [source || null]
      if (!path) {
        path = target.toLowerCase().endsWith(NOTE_EXTENSION) ? target : target + NOTE_EXTENSION
        await vault.createNote(path)
        await this.#refresh()
      }
      if (heading) this.openNoteAt(path, { heading }, options)
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
    const target = join(parentOf(path), name)
    if (!trimmed || target === path) return
    await this.#run(async () => {
      await this.flush()
      const linkCount = await vault.incomingLinkCount(path)
      const updateLinks = linkCount > 0 && (await this.#shouldUpdateLinks(linkCount))
      const updated = await vault.renameEntry(path, target, updateLinks)
      documents.rename(path, target)
      this.updateLayout((layout) => layouts.renamePaths(layout, path, target))
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
