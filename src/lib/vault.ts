import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export type EntryKind = 'file' | 'folder' | 'attachment'

export interface Entry {
  path: string
  kind: EntryKind
}

export interface VaultInfo {
  root: string
  name: string
}

export const launchVault = () => invoke<string | null>('launch_vault')
export const currentVault = () => invoke<VaultInfo | null>('current_vault')
export const hasAllFilesAccess = () =>
  invoke<{ granted: boolean }>('plugin:storage|has_all_files_access')
export const requestAllFilesAccess = () =>
  invoke<{ granted: boolean }>('plugin:storage|request_all_files_access')
export const pickFolder = () => invoke<{ path: string | null }>('plugin:storage|pick_folder')
export const openWebViewer = (url: string) => invoke('open_web_viewer', { url })
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
/** A note's name or alias written in another note without a link. */
export interface Mention {
  source: string
  target: string
  line: number
  /** The mention as written. */
  text: string
  context: string
}

export interface OutgoingLink {
  /** The link's target as written. */
  target: string
  /** The note or attachment it resolves to, if any. */
  path: string | null
  line: number
}

export const unlinkedMentions = (path: string) => invoke<Mention[]>('unlinked_mentions', { path })
export const outgoingLinks = (path: string) => invoke<OutgoingLink[]>('outgoing_links', { path })
export const outgoingMentions = (path: string) => invoke<Mention[]>('outgoing_mentions', { path })
/** A note as Bases sees it. */
export interface BaseFile {
  path: string
  tags: string[]
  links: string[]
  backlinks: string[]
  embeds: string[]
  properties: Record<string, unknown>
  size: number
  ctime: number
  mtime: number
}

export const baseFiles = () => invoke<BaseFile[]>('base_files')

export interface PdfOptions {
  widthMm: number
  heightMm: number
  landscape: boolean
  marginMm: number
  /** 1 prints at 100%. */
  scale: number
}

export interface ExportFile {
  /** Relative to the export folder. */
  path: string
  contents: string
}

/** Writes exported pages into `folder`, copying the vault attachments they use. */
export const exportFiles = (
  folder: string,
  files: ExportFile[],
  attachments: { source: string; path: string }[],
) => invoke('export_files', { folder, files, attachments })

/** Prints the page, showing only the print area, to a PDF at `path`. */
export const exportPdf = (path: string, options: PdfOptions) =>
  invoke('export_pdf', { path, options })

/** A snapshot of a note kept for file recovery. */
export interface Snapshot {
  /** Milliseconds since the epoch. */
  time: number
  size: number
}

export interface DeletedNote {
  path: string
  time: number
}

export const noteHistory = (path: string) => invoke<Snapshot[]>('note_history', { path })
export const historySnapshot = (path: string, time: number) =>
  invoke<string | null>('history_snapshot', { path, time })
export const deletedNotes = () => invoke<DeletedNote[]>('deleted_notes')
export const setHistorySettings = (intervalMinutes: number, retentionDays: number) =>
  invoke('set_history_settings', { intervalMinutes, retentionDays })

export interface HttpRequest {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

export interface HttpResponse {
  status: number
  headers: Record<string, string>
  body: string
}

export const pluginHttpRequest = (request: HttpRequest) =>
  invoke<HttpResponse>('plugin_http_request', { request })
export const pluginSecret = (plugin: string, key: string) =>
  invoke<string | null>('plugin_secret_get', { plugin, key })
export const setPluginSecret = (plugin: string, key: string, value: string) =>
  invoke('plugin_secret_set', { plugin, key, value })
export const deletePluginSecret = (plugin: string, key: string) =>
  invoke('plugin_secret_delete', { plugin, key })
export const incomingLinkCount = (path: string) => invoke<number>('incoming_link_count', { path })

export type SearchSort =
  | 'name-ascending'
  | 'name-descending'
  | 'modified-newest'
  | 'modified-oldest'
  | 'created-newest'
  | 'created-oldest'

export const search = (query: string, sort: SearchSort) =>
  invoke<SearchResult[]>('search', { query, sort })
/** `text` with the search's matches replaced, everywhere or only on `line`. */
export const replaceText = (
  query: string,
  replacement: string,
  text: string,
  line?: number,
  occurrence?: number,
) =>
  invoke<{ text: string; count: number }>('replace_text', {
    query,
    replacement,
    text,
    line,
    occurrence,
  })
export const matchingNotes = (queries: string[]) =>
  invoke<string[][]>('matching_notes', { queries })
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
  /** The oldest Flint version the plugin works with. */
  minAppVersion?: string
}

export interface CommunityPlugin {
  id: string
  name: string
  author: string
  description: string
  /** `owner/name` on GitHub. */
  repo: string
  /** For repositories holding several plugins: this plugin's release tags start with it. */
  tagPrefix?: string
}

export const communityPlugins = () => invoke<CommunityPlugin[]>('community_plugins')
export const latestPluginVersions = (plugins: CommunityPlugin[]) =>
  invoke<(string | null)[]>('latest_plugin_versions', { plugins })
export const installPlugin = (plugin: CommunityPlugin) =>
  invoke<PluginManifest>('install_plugin', { plugin })

export interface PluginListing {
  folder: string
  manifest: PluginManifest | null
  error: string | null
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

export const saveAttachment = (path: string, bytes: Uint8Array) =>
  invoke('save_attachment', { path, data: toBase64(bytes) })
export const importAttachment = (source: string, path: string) =>
  invoke('import_attachment', { source, path })
export const saveClipboardImage = (path: string) =>
  invoke<boolean>('save_clipboard_image', { path })
export const clipboardFiles = () => invoke<string[]>('clipboard_files')
export const clipboardText = () => invoke<string>('clipboard_text')
export const setClipboardText = (text: string) => invoke('set_clipboard_text', { text })
export const copyEntry = (from: string, to: string) => invoke('copy_entry', { from, to })
export const redirectLinks = (from: string, to: string) =>
  invoke<number>('redirect_links', { from, to })
export const showInFileManager = (path: string) => invoke('show_in_file_manager', { path })
export const openExternally = (path: string) => invoke('open_externally', { path })
export const assetUrl = (root: string, path: string) => convertFileSrc(`${root}/${path}`)

export interface FontFamily {
  name: string
  monospaced: boolean
}

export const systemFonts = () => invoke<FontFamily[]>('system_fonts')
export interface SpellingLanguage {
  code: string
  installed: boolean
}

export const spellingLanguages = () => invoke<SpellingLanguage[]>('spelling_languages')
export const checkSpelling = (words: string[]) => invoke<string[]>('check_spelling', { words })
export const spellingSuggestions = (word: string) =>
  invoke<string[]>('spelling_suggestions', { word })
export const addToDictionary = (word: string) => invoke('add_to_dictionary', { word })
export const setSpellingLanguages = (languages: string[]) =>
  invoke('set_spelling_languages', { languages })
export const snippets = () => invoke<string[]>('snippets')
export const readSnippet = (name: string) => invoke<string>('read_snippet', { name })
export const readConfig = (name: string) => invoke<string | null>('read_config', { name })
export const writeConfig = (name: string, contents: string) =>
  invoke('write_config', { name, contents })

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
/** Plugin folders whose code changed on disk. */
export const onPluginsChanged = (handler: (folders: string[]) => void): Promise<UnlistenFn> =>
  listen<string[]>('plugins-changed', (event) => handler(event.payload))
