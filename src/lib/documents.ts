import { ChangeSet } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { applyChanges, replaceDoc } from './editor/editor'
import { Emitter } from './events'
import { isWithin, replacePrefix } from './paths'
import * as vault from './vault'

const SAVE_DELAY_MS = 400

interface Document {
  contents: string
  views: Set<EditorView>
  saveTimer?: ReturnType<typeof setTimeout>
}

function difference(from: string, to: string) {
  let start = 0
  while (start < from.length && start < to.length && from[start] === to[start]) start++
  let end = 0
  while (
    end < from.length - start &&
    end < to.length - start &&
    from[from.length - 1 - end] === to[to.length - 1 - end]
  ) {
    end++
  }
  return { from: start, to: from.length - end, insert: to.slice(start, to.length - end) }
}

class Documents {
  onError: (error: unknown) => void = console.error
  #documents = new Map<string, Document>()
  #listeners = new Map<string, Set<(contents: string) => void>>()
  /** Notes with edits not written to disk yet. */
  #unsaved = new Set<string>()
  readonly saveStateChanged = new Emitter<void>()

  isUnsaved(path: string) {
    return this.#unsaved.has(path)
  }

  #setUnsaved(path: string, isUnsaved: boolean) {
    if (this.#unsaved.has(path) === isUnsaved) return
    if (isUnsaved) this.#unsaved.add(path)
    else this.#unsaved.delete(path)
    this.saveStateChanged.emit()
  }

  subscribe(path: string, listener: (contents: string) => void) {
    const listeners = this.#listeners.get(path) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(path, listeners)
    return () => void listeners.delete(listener)
  }

  #notify(path: string, contents: string) {
    for (const listener of this.#listeners.get(path) ?? []) listener(contents)
  }

  async load(path: string) {
    let document = this.#documents.get(path)
    if (!document) {
      const contents = await vault.readNote(path)
      document = this.#documents.get(path) ?? { contents, views: new Set() }
      this.#documents.set(path, document)
    }
    return document.contents
  }

  attach(path: string, view: EditorView) {
    this.#documents.get(path)?.views.add(view)
  }

  detach(path: string, view: EditorView) {
    const document = this.#documents.get(path)
    if (!document) return
    document.views.delete(view)
    if (document.views.size === 0 && !document.saveTimer) this.#documents.delete(path)
  }

  edit(path: string, source: EditorView | null, changes: ChangeSet, contents: string) {
    const document = this.#documents.get(path)
    if (!document) return
    document.contents = contents
    for (const view of document.views) if (view !== source) applyChanges(view, changes)
    this.#notify(path, contents)
    clearTimeout(document.saveTimer)
    document.saveTimer = setTimeout(() => void this.#save(path), SAVE_DELAY_MS)
    this.#setUnsaved(path, true)
  }

  /** Edits a note that may not be open, as if it were typed into every editor showing it. */
  async update(path: string, edit: (text: string) => string | null) {
    const contents = await this.load(path)
    const next = edit(contents)
    if (next === null || next === contents) return
    this.edit(path, null, ChangeSet.of(difference(contents, next), contents.length), next)
  }

  isOpen(path: string) {
    return this.#documents.has(path)
  }

  async reload(path: string) {
    const document = this.#documents.get(path)
    if (!document || document.saveTimer) return
    const contents = await vault.readNote(path)
    if (contents === document.contents) return
    document.contents = contents
    for (const view of document.views) replaceDoc(view, contents)
    this.#notify(path, contents)
  }

  async flush() {
    await Promise.all(
      [...this.#documents].filter(([, doc]) => doc.saveTimer).map(([path]) => this.#save(path)),
    )
  }

  rename(from: string, to: string) {
    for (const [path, document] of [...this.#documents]) {
      if (!isWithin(path, from)) continue
      this.#documents.delete(path)
      this.#documents.set(replacePrefix(path, from, to), document)
    }
  }

  forget(path: string) {
    for (const [known, document] of [...this.#documents]) {
      if (!isWithin(known, path)) continue
      clearTimeout(document.saveTimer)
      this.#documents.delete(known)
    }
  }

  async #save(path: string) {
    const document = this.#documents.get(path)
    if (!document) return
    clearTimeout(document.saveTimer)
    document.saveTimer = undefined
    try {
      await vault.writeNote(path, document.contents)
      if (!document.saveTimer) this.#setUnsaved(path, false)
    } catch (error) {
      this.onError(error)
    }
    if (document.views.size === 0) this.#documents.delete(path)
  }
}

export const documents = new Documents()
