import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export type EntryKind = 'file' | 'folder'

export interface Entry {
  path: string
  kind: EntryKind
}

export interface VaultInfo {
  root: string
  name: string
}

export const openVault = (path: string) => invoke<VaultInfo>('open_vault', { path })
export const listEntries = () => invoke<Entry[]>('list_entries')
export const readNote = (path: string) => invoke<string>('read_note', { path })
export const writeNote = (path: string, contents: string) =>
  invoke('write_note', { path, contents })
export const createNote = (path: string) => invoke('create_note', { path })
export const createFolder = (path: string) => invoke('create_folder', { path })
export const renameEntry = (from: string, to: string) => invoke('rename_entry', { from, to })
export const trashEntry = (path: string) => invoke('trash_entry', { path })

export const onVaultChanged = (handler: (paths: string[]) => void): Promise<UnlistenFn> =>
  listen<string[]>('vault-changed', (event) => handler(event.payload))
