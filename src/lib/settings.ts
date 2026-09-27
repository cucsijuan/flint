import { LazyStore } from '@tauri-apps/plugin-store'

export type EditorMode = 'live' | 'source'
export type LinkUpdate = 'ask' | 'always' | 'never'
export type AttachmentFolder = 'root' | 'same' | 'attachments'
export type PropertiesDisplay = 'visible' | 'hidden' | 'source'

interface Settings {
  lastVault: string
  editorMode: EditorMode
  linkUpdate: LinkUpdate
  showRightPanel: boolean
  checkForUpdates: boolean
  attachmentFolder: AttachmentFolder
  propertiesDisplay: PropertiesDisplay
}

const store = new LazyStore('settings.json')

export const getSetting = <K extends keyof Settings>(key: K) => store.get<Settings[K]>(key)

export const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) =>
  store.set(key, value)
