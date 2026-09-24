import { ask, open } from '@tauri-apps/plugin-dialog'
import {
  NOTE_EXTENSION,
  basename,
  isWithin,
  join,
  parentOf,
  replacePrefix,
  uniqueName,
} from './paths'
import { getSetting, setSetting, type EditorMode, type LinkUpdate } from './settings'
import { noteOpened, vaultChanged } from './events'
import type { GraphFilters } from './graph'
import { buildTree } from './tree'
import * as vault from './vault'

const SAVE_DELAY_MS = 400
const SEARCH_DELAY_MS = 200
const NOTICE_MS = 5000

export type LeftTab = 'files' | 'search'
export type RightTab = 'backlinks' | 'tags' | 'graph' | (string & {})
export type MainView = 'editor' | 'graph'

export interface Jump {
  heading?: string
  line?: number
  id: number
}

export interface OpenNote {
  path: string
  contents: string
  revision: number
  isNewPath: boolean
}

class Workspace {
  info = $state<vault.VaultInfo | null>(null)
  entries = $state<vault.Entry[]>([])
  tree = $derived(buildTree(this.entries))
  note = $state<OpenNote | null>(null)
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
  isSettingsOpen = $state(false)
  isQuickSwitcherOpen = $state(false)
  isCommandPaletteOpen = $state(false)
  searchQuery = $state('')
  searchResults = $state<vault.SearchResult[]>([])
  searchError = $state<string | null>(null)
  searchFocus = $state(0)
  view = $state<MainView>('editor')
  graph = $state<vault.Graph>({ nodes: [], links: [] })
  graphFilters = $state<GraphFilters>({
    showTags: false,
    showUnresolved: true,
    showOrphans: true,
    query: '',
  })
  localGraphDepth = $state(1)

  #contents = ''
  #saveTimer: ReturnType<typeof setTimeout> | undefined
  #isWatching = false
  #noticeTimer: ReturnType<typeof setTimeout> | undefined
  #revision = 0
  #jumpId = 0
  #searchTimer: ReturnType<typeof setTimeout> | undefined

  async restore() {
    this.mode = (await getSetting('editorMode')) ?? 'live'
    this.showRightPanel = (await getSetting('showRightPanel')) ?? true
    this.linkUpdate = (await getSetting('linkUpdate')) ?? 'ask'
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
      this.#closeNote()
      await this.#refresh()
      await setSetting('lastVault', path)
      if (!this.#isWatching) {
        this.#isWatching = true
        await vault.onVaultChanged((paths) => this.#onExternalChange(paths))
      }
    })
  }

  async openNote(path: string) {
    this.view = 'editor'
    if (this.note?.path === path) return
    await this.#run(async () => {
      await this.flush()
      this.#show(path, await vault.readNote(path))
    })
  }

  edit(contents: string) {
    this.#contents = contents
    clearTimeout(this.#saveTimer)
    this.#saveTimer = setTimeout(() => this.flush(), SAVE_DELAY_MS)
  }

  async flush() {
    const note = this.note
    if (this.#saveTimer === undefined || !note) return
    clearTimeout(this.#saveTimer)
    this.#saveTimer = undefined
    await this.#run(() => vault.writeNote(note.path, this.#contents))
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

  async openNoteAt(path: string, target: Omit<Jump, 'id'>) {
    await this.openNote(path)
    this.jump = { ...target, id: ++this.#jumpId }
  }

  async openOrCreateNote(name: string) {
    const path = name.toLowerCase().endsWith(NOTE_EXTENSION) ? name : name + NOTE_EXTENSION
    await this.#run(async () => {
      if (!this.entries.some((entry) => entry.path === path)) {
        await vault.createNote(path)
        await this.#refresh()
      }
      await this.openNote(path)
    })
  }

  setLinkUpdate(value: LinkUpdate) {
    this.linkUpdate = value
    void setSetting('linkUpdate', value)
  }

  resolveLinks(targets: string[]) {
    return vault.resolveLinks(this.note?.path ?? '', targets)
  }

  async headingsFor(target: string) {
    const [path] = target ? await this.resolveLinks([target]) : [this.note?.path ?? null]
    return path ? vault.noteHeadings(path) : []
  }

  async openLink(destination: string) {
    const hash = destination.indexOf('#')
    const target = hash === -1 ? destination : destination.slice(0, hash)
    const heading = hash === -1 ? '' : destination.slice(hash + 1)
    await this.#run(async () => {
      let [path] = target ? await this.resolveLinks([target]) : [this.note?.path ?? null]
      if (!path) {
        path = target.toLowerCase().endsWith(NOTE_EXTENSION) ? target : target + NOTE_EXTENSION
        await vault.createNote(path)
        await this.#refresh()
      }
      if (heading) await this.openNoteAt(path, { heading })
      else await this.openNote(path)
    })
  }

  async createNote(folder = '') {
    const path = uniqueName(this.#takenPaths(), folder, 'Untitled', NOTE_EXTENSION)
    await this.#run(async () => {
      await vault.createNote(path)
      await this.#refresh()
      await this.openNote(path)
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
      if (this.note && isWithin(this.note.path, path)) {
        this.note.path = replacePrefix(this.note.path, path, target)
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
      if (this.note && isWithin(this.note.path, path)) this.#closeNote()
      await this.#refresh()
    })
  }

  #takenPaths() {
    return new Set(this.entries.map((entry) => entry.path))
  }

  #closeNote() {
    this.note = null
    noteOpened.emit(null)
  }

  #show(path: string, contents: string) {
    this.#contents = contents
    const isNewPath = path !== this.note?.path
    this.note = { path, contents, revision: ++this.#revision, isNewPath }
    if (isNewPath) noteOpened.emit(path)
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
      const path = this.note?.path
      if (!path || !paths.includes(path) || this.#saveTimer !== undefined) return
      if (!this.entries.some((entry) => entry.path === path)) {
        this.#closeNote()
        return
      }
      const contents = await vault.readNote(path)
      if (contents !== this.#contents) this.#show(path, contents)
    })
  }

  async #run(action: () => Promise<unknown>) {
    try {
      await action()
    } catch (error) {
      this.notify(String(error))
    }
  }

  notify(message: string) {
    this.notice = message
    clearTimeout(this.#noticeTimer)
    this.#noticeTimer = setTimeout(() => (this.notice = null), NOTICE_MS)
  }
}

export const workspace = new Workspace()
