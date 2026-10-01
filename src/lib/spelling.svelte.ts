import { Emitter } from './events'
import * as vault from './vault'

/** The dictionary for a language tag or a Hunspell name (`es-AR`, `en_US`), falling back from
 * the region to the language: `es-ar` or `es`. */
export function dictionaryFor(name: string, available: string[]) {
  const code = name.toLowerCase().replace('_', '-')
  if (available.includes(code)) return code
  const language = code.split('-')[0]
  return available.includes(language) ? language : null
}

export interface SpellingMenu {
  x: number
  y: number
  word: string
  replace: (text: string) => void
}

class Spelling {
  /** Changes whenever words may be judged differently: new languages or personal words. */
  readonly changed = new Emitter<void>()
  menu = $state<SpellingMenu | null>(null)
  #known = new Map<string, boolean>()

  async setLanguages(languages: string[]) {
    await vault.setSpellingLanguages(languages)
    this.#known.clear()
    this.changed.emit()
  }

  isMisspelled(word: string) {
    return this.#known.get(word) === false
  }

  /** Looks up the words not judged yet; true when any of them turned out misspelled. */
  async check(words: Iterable<string>) {
    const unknown = [...new Set(words)].filter((word) => !this.#known.has(word))
    if (!unknown.length) return false
    const misspelled = new Set(await vault.checkSpelling(unknown))
    for (const word of unknown) this.#known.set(word, !misspelled.has(word))
    return misspelled.size > 0
  }

  async addToDictionary(word: string) {
    await vault.addToDictionary(word)
    this.#known.set(word, true)
    this.changed.emit()
  }
}

export const spelling = new Spelling()
