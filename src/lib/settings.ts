import { LazyStore } from '@tauri-apps/plugin-store'
import { DEFAULT_PDF, type PdfSettings } from './export/pdf-settings'
import type { SearchSort } from './vault'

export type EditorMode = 'live' | 'source'
export type LinkUpdate = 'ask' | 'always' | 'never'
export type AttachmentFolder = 'root' | 'same' | 'attachments'
export type PropertiesDisplay = 'visible' | 'hidden' | 'source'

/** Per-vault settings, stored in `.flint/app.json`. */
export interface VaultSettings {
  editorMode: EditorMode
  linkUpdate: LinkUpdate
  attachmentFolder: AttachmentFolder
  propertiesDisplay: PropertiesDisplay
  readableLineLength: boolean
  /** In pixels, while `readableLineLength` is on. */
  readableLineWidth: number
  pluginHotReload: boolean
  vimMode: boolean
  spellcheck: boolean
  pagePreview: boolean
  /** Opens web links in Flint's web viewer instead of the browser. */
  webViewer: boolean
  /** What replaces a selection extracted into a new note. */
  extractedText: 'link' | 'embed' | 'none'
  /** Dictionary codes like `en` or `es-ar`; empty checks the system's language. */
  spellcheckLanguages: string[]
  searchSort: SearchSort
  /** Minutes between two snapshots of a note, for file recovery. */
  historyInterval: number
  /** Days snapshots are kept. */
  historyRetention: number
  /** The last options picked in the PDF export dialog. */
  pdfExport: PdfSettings
}

export const DEFAULT_VAULT_SETTINGS: VaultSettings = {
  editorMode: 'live',
  linkUpdate: 'ask',
  attachmentFolder: 'root',
  propertiesDisplay: 'visible',
  readableLineLength: true,
  readableLineWidth: 760,
  pluginHotReload: false,
  vimMode: false,
  spellcheck: true,
  pagePreview: true,
  webViewer: true,
  extractedText: 'link',
  spellcheckLanguages: [],
  searchSort: 'name-ascending',
  historyInterval: 5,
  historyRetention: 7,
  pdfExport: DEFAULT_PDF,
}

/** App-wide settings; the vault settings kept here by older versions seed new vaults. */
interface Settings extends Partial<VaultSettings> {
  lastVault: string
  showRightPanel: boolean
  checkForUpdates: boolean
}

const store = new LazyStore('settings.json')

export const getSetting = <K extends keyof Settings>(key: K) => store.get<Settings[K]>(key)

export const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) =>
  store.set(key, value)
