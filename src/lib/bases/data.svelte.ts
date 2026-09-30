import { basename, extensionOf, NOTE_EXTENSION, parentOf } from '../paths'
import * as vault from '../vault'
import { rowFor } from './base'
import type { FileInfo, Row } from './expression'

function fileInfo(file: vault.BaseFile): FileInfo {
  const name = basename(file.path)
  const ext = extensionOf(file.path)
  return {
    ...file,
    name,
    basename: ext ? name.slice(0, -(ext.length + 1)) : name,
    folder: parentOf(file.path),
    ext,
  }
}

/** Every note of the vault as Bases sees it, reloaded when the index changes. */
class BaseData {
  files = $state.raw<FileInfo[]>([])
  #byKey = new Map<string, FileInfo>()
  #loadedVersion = -1

  async load(version: number) {
    if (version === this.#loadedVersion) return
    this.#loadedVersion = version
    let found: vault.BaseFile[]
    try {
      found = await vault.baseFiles()
    } catch (error) {
      if (this.#loadedVersion === version) this.#loadedVersion = -1
      throw error
    }
    // A newer load started meanwhile; its answer wins.
    if (this.#loadedVersion !== version) return
    const files = found.map(fileInfo)
    this.#byKey = new Map()
    const byLength = [...files].sort((a, b) => b.path.length - a.path.length)
    for (const file of byLength) {
      const withoutExtension = file.path.slice(0, -NOTE_EXTENSION.length).toLowerCase()
      for (const key of [file.basename.toLowerCase(), withoutExtension, file.path.toLowerCase()]) {
        this.#byKey.set(key, file)
      }
    }
    for (const file of files) {
      const aliases = [file.properties.aliases ?? file.properties.alias].flat()
      for (const alias of aliases) {
        const key = typeof alias === 'string' ? alias.trim().toLowerCase() : ''
        if (key && !this.#byKey.has(key)) this.#byKey.set(key, file)
      }
    }
    this.files = files
  }

  /** A note by path, path without extension or name, like a link target. */
  findFile = (target: string) => this.#byKey.get(target.trim().toLowerCase()) ?? null

  rows(types: Record<string, Parameters<typeof rowFor>[1][string]>): Row[] {
    return this.files.map((file) => rowFor(file, types))
  }
}

export const baseData = new BaseData()
