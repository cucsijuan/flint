import { LazyStore } from '@tauri-apps/plugin-store'
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
  pluginHotReload: boolean
  vimMode: boolean
  /** Hunspell dictionary names like `en_US`; empty checks the system's languages. */
  spellcheckLanguages: string[]
  searchSort: SearchSort
}

export const DEFAULT_VAULT_SETTINGS: VaultSettings = {
  editorMode: 'live',
  linkUpdate: 'ask',
  attachmentFolder: 'root',
  propertiesDisplay: 'visible',
  readableLineLength: true,
  pluginHotReload: false,
  vimMode: false,
  spellcheckLanguages: [],
  searchSort: 'name-ascending',
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
