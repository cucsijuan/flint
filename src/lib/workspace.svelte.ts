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
import { getSetting, setSetting, type EditorMode } from './settings'
import { buildTree } from './tree'
import * as vault from './vault'

const SAVE_DELAY_MS = 400
const NOTICE_MS = 5000

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

  #contents = ''
  #saveTimer: ReturnType<typeof setTimeout> | undefined
  #isWatching = false
  #noticeTimer: ReturnType<typeof setTimeout> | undefined
  #revision = 0

  async restore() {
    this.mode = (await getSetting('editorMode')) ?? 'live'
    const lastVault = await getSetting('lastVault')
    if (lastVault) await this.openVault(lastVault)
  }

  async chooseVault() {
    const path = await open({ directory: true, title: 'Open folder as vault' })
    if (path) await this.openVault(path)
  }

  async openVault(path: string) {
    await this.#run(async () => {
      await this.flush()
      this.info = await vault.openVault(path)
      this.note = null
      await this.#refresh()
      await setSetting('lastVault', path)
      if (!this.#isWatching) {
        this.#isWatching = true
        await vault.onVaultChanged((paths) => this.#onExternalChange(paths))
      }
    })
  }

  async openNote(path: string) {
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
      await vault.renameEntry(path, target)
      if (this.note && isWithin(this.note.path, path)) {
        this.note.path = replacePrefix(this.note.path, path, target)
      }
      await this.#refresh()
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
      if (this.note && isWithin(this.note.path, path)) this.note = null
      await this.#refresh()
    })
  }

  #takenPaths() {
    return new Set(this.entries.map((entry) => entry.path))
  }

  #show(path: string, contents: string) {
    this.#contents = contents
    this.note = { path, contents, revision: ++this.#revision, isNewPath: path !== this.note?.path }
  }

  async #refresh() {
    this.entries = await vault.listEntries()
  }

  async #onExternalChange(paths: string[]) {
    await this.#run(async () => {
      await this.#refresh()
      const path = this.note?.path
      if (!path || !paths.includes(path) || this.#saveTimer !== undefined) return
      if (!this.entries.some((entry) => entry.path === path)) {
        this.note = null
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
      this.notice = String(error)
      clearTimeout(this.#noticeTimer)
      this.#noticeTimer = setTimeout(() => (this.notice = null), NOTICE_MS)
    }
  }
}

export const workspace = new Workspace()
