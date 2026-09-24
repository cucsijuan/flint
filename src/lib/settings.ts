import { LazyStore } from '@tauri-apps/plugin-store'

export type EditorMode = 'live' | 'source'

interface Settings {
  lastVault: string
  editorMode: EditorMode
}

const store = new LazyStore('settings.json')

export const getSetting = <K extends keyof Settings>(key: K) => store.get<Settings[K]>(key)

export const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) =>
  store.set(key, value)
