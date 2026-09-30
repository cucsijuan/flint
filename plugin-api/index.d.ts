import type * as autocomplete from '@codemirror/autocomplete'
import type * as language from '@codemirror/language'
import type * as state from '@codemirror/state'
import type * as view from '@codemirror/view'

export type Disposer = () => void

export interface PluginCommand {
  /** Unique within the plugin; Flint prefixes it with the plugin id. */
  id: string
  name: string
  /** For example `Mod+Shift+K`. `Mod` is Ctrl, or ⌘ on macOS. */
  hotkey?: string
  /** Replaces `hotkey` on macOS, where `Ctrl` is the Control key. */
  macHotkey?: string
  run: () => unknown
  isAvailable?: () => boolean
}

export interface SidebarTab {
  /** Unique within the plugin. */
  id: string
  name: string
  /** A Lucide icon name from https://lucide.dev/icons, like `bar-chart-3`. Defaults to the name's first letters. */
  icon?: string
  /** Renders into `element`; the returned function runs when the tab is removed. */
  render: (element: HTMLElement) => Disposer | undefined
}

export interface SettingsTab {
  /** Renders into `element` when the section opens; the returned function runs when it closes. */
  render: (element: HTMLElement) => Disposer | undefined
}

export interface NoteEntry {
  path: string
  kind: 'file' | 'folder' | 'attachment'
}

export interface MarkdownSection {
  /** First source line of the block, 0-based. */
  lineStart: number
  /** Line after the block's last line. */
  lineEnd: number
}

/**
 * Where rendered Markdown came from. Buttons, inputs, links, `summary` and elements with a
 * `data-interactive` attribute receive clicks in live preview instead of moving the cursor.
 */
export interface MarkdownContext {
  /** The note the content was rendered from. */
  sourcePath: string
  /** The source lines of the innermost block containing `element`. */
  sectionOf(element: HTMLElement): MarkdownSection | null
  /** Replaces source lines of the note (an empty `text` removes them); open editors update and it is saved. */
  replaceLines(lineStart: number, lineEnd: number, text: string): Promise<void>
}

export type PostProcessor = (element: HTMLElement, context: MarkdownContext) => unknown

export type CodeBlockProcessor = (
  source: string,
  element: HTMLElement,
  context: MarkdownContext,
) => unknown

export interface HttpRequest {
  /** An `http://` or `https://` URL. */
  url: string
  /** Defaults to `GET`. */
  method?: string
  headers?: Record<string, string>
  body?: string
  /** Defaults to 30 seconds. */
  timeoutMs?: number
}

export interface HttpResponse {
  status: number
  headers: Record<string, string>
  body: string
  /** The body parsed as JSON. */
  json<T = unknown>(): T
}

/** A row a plugin shows in a data view. */
export interface DataRow {
  /** Unique within the view. */
  id: string
  /** The row's name; clicking it calls `onOpen`. */
  title: string
  /** Property values by name: text, numbers, booleans, lists, links like `[[Note]]`, or dates as `YYYY-MM-DD`. */
  values: Record<string, unknown>
}

export interface DataViewOptions {
  rows: DataRow[]
  /** Properties shown until the user picks others. */
  columns?: string[]
  /** The layout it starts with, unless `config` restores a saved view. */
  layout?: 'table' | 'cards' | 'list' | 'map'
  /** A view the user arranged earlier, as `onConfigChange` handed it over (in `.base` format). */
  config?: string
  /** The user changed filters, sorting, columns or layout; save `config` to restore the view later. */
  onConfigChange?: (config: string) => void
  onOpen?: (id: string) => void
  /** The user edited a cell; without it, cells are read-only. */
  onEdit?: (id: string, property: string, value: unknown) => void
  /** Shows a New button that calls it. */
  onNew?: () => void
}

/** A data view rendered by `ui.renderDataView`. */
export interface DataView {
  update(options: Partial<DataViewOptions>): void
  destroy(): void
}

export interface FlintApi {
  /** The id from the plugin's manifest. */
  readonly pluginId: string

  commands: {
    register(command: PluginCommand): Disposer
  }

  editor: {
    /** Adds a CodeMirror extension to every editor. */
    registerExtension(extension: state.Extension): Disposer
    /** The editor showing the active note, if any. */
    activeView(): view.EditorView | null
    /** Replaces the selection in the active editor, or inserts at the cursor. */
    replaceSelection(text: string): void
  }

  vault: {
    list(): Promise<NoteEntry[]>
    read(path: string): Promise<string>
    write(path: string, contents: string): Promise<void>
    create(path: string): Promise<void>
    /** Called with vault-relative paths whenever files change. */
    onChange(listener: (paths: string[]) => void): Disposer
  }

  workspace: {
    activeNote(): string | null
    openNote(path: string): Promise<void>
    onNoteOpen(listener: (path: string | null) => void): Disposer
  }

  ui: {
    notice(message: string): void
    registerSidebarTab(tab: SidebarTab): Disposer
    /** Adds a section named after the plugin to Settings. */
    registerSettingsTab(tab: SettingsTab): Disposer
    /** Shows rows with the views of Bases: table, cards, list or map, with filters, sorting,
     * grouping and summaries. It cleans up once `element` leaves the page; `destroy` ends it sooner. */
    renderDataView(element: HTMLElement, options: DataViewOptions): DataView
  }

  markdown: {
    /** Runs on every rendered block of Markdown: the reading view and embedded notes. */
    registerPostProcessor(processor: PostProcessor): Disposer
    /** Renders fenced code blocks of `language` into `element` instead of showing the code. */
    registerCodeBlockProcessor(language: string, processor: CodeBlockProcessor): Disposer
  }

  /** Requests made from Flint's backend, so servers don't need to allow the app's origin (CORS).
   * Certificates are checked against the system's store, where companies install their own. */
  http: {
    request(request: HttpRequest): Promise<HttpResponse>
  }

  /** Secrets such as API tokens, kept in the system's keychain rather than in the vault. */
  secrets: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
    delete(key: string): Promise<void>
  }

  storage: {
    load<T = unknown>(): Promise<T | null>
    save(data: unknown): Promise<void>
  }

  /** Flint's own CodeMirror modules. Use these instead of bundling CodeMirror. */
  codemirror: {
    state: typeof state
    view: typeof view
    language: typeof language
    autocomplete: typeof autocomplete
  }
}

/** The default export of a plugin's `main.js`. It may return a cleanup function. */
/** The default export of a plugin's `main.js`; it may return a function to run when it's turned off. */
export type ActivatePlugin = (
  flint: FlintApi,
) => Disposer | undefined | Promise<Disposer | undefined> | Promise<void>
