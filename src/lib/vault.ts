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

export const launchVault = () => invoke<string | null>('launch_vault')
export const openVault = (path: string) => invoke<VaultInfo>('open_vault', { path })
export const listEntries = () => invoke<Entry[]>('list_entries')
export const readNote = (path: string) => invoke<string>('read_note', { path })
export const writeNote = (path: string, contents: string) =>
  invoke('write_note', { path, contents })
export const createNote = (path: string) => invoke('create_note', { path })
export const createFolder = (path: string) => invoke('create_folder', { path })
export const renameEntry = (from: string, to: string, updateLinks: boolean) =>
  invoke<number>('rename_entry', { from, to, updateLinks })
export const trashEntry = (path: string) => invoke('trash_entry', { path })

export interface LinkTarget {
  path: string
  linkText: string
  alias: string | null
}

export interface TagCount {
  tag: string
  count: number
}

export interface SearchResult {
  path: string
  lines: { line: number; segments: { text: string; highlight: boolean }[] }[]
}

export interface Heading {
  level: number
  text: string
}

export interface Backlink {
  source: string
  line: number
  context: string
}

export const linkTargets = () => invoke<LinkTarget[]>('link_targets')
export const resolveLinks = (source: string, targets: string[]) =>
  invoke<(string | null)[]>('resolve_links', { source, targets })
export const noteHeadings = (path: string) => invoke<Heading[]>('note_headings', { path })
export const backlinks = (path: string) => invoke<Backlink[]>('backlinks', { path })
export const incomingLinkCount = (path: string) => invoke<number>('incoming_link_count', { path })

export const search = (query: string) => invoke<SearchResult[]>('search', { query })
export const tags = () => invoke<TagCount[]>('tags')

export type NodeKind = 'note' | 'tag' | 'unresolved'

export interface GraphNode {
  id: string
  label: string
  kind: NodeKind
}

export interface Graph {
  nodes: GraphNode[]
  links: { source: string; target: string }[]
}

export const graph = () => invoke<Graph>('graph')

export interface PluginManifest {
  id: string
  name: string
  version: string
  author: string
  description: string
  license: string
}

export interface PluginListing {
  folder: string
  manifest: PluginManifest | null
  error: string | null
}

export const listPlugins = () => invoke<PluginListing[]>('list_plugins')
export const readPluginFile = (folder: string, file: 'main.js' | 'styles.css') =>
  invoke<string | null>('read_plugin_file', { folder, file })
export const readPluginData = (folder: string) =>
  invoke<string | null>('read_plugin_data', { folder })
export const writePluginData = (folder: string, data: string) =>
  invoke('write_plugin_data', { folder, data })
export const enabledPlugins = () => invoke<string[]>('enabled_plugins')
export const setEnabledPlugins = (enabled: string[]) => invoke('set_enabled_plugins', { enabled })

export const onVaultChanged = (handler: (paths: string[]) => void): Promise<UnlistenFn> =>
  listen<string[]>('vault-changed', (event) => handler(event.payload))
