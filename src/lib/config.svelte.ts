import * as vault from './vault'

type Config = Record<string, unknown>

const SAVE_DELAY_MS = 300

const isRecord = (value: unknown): value is Config =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** `defaults` overridden by each source in turn, keeping only values of the default's type. */
export function mergeConfig<T extends object>(defaults: T, ...sources: unknown[]): T {
  const merged: Config = { ...(defaults as Config) }
  for (const source of sources.filter(isRecord)) {
    for (const [key, fallback] of Object.entries(defaults as Config)) {
      const value = source[key]
      const isSameType = Array.isArray(fallback)
        ? Array.isArray(value)
        : typeof value === typeof fallback && isRecord(value) === isRecord(fallback)
      if (value !== undefined && isSameType) merged[key] = value
    }
  }
  return merged as T
}

/** A JSON file in the vault's `.flint` folder, like Obsidian's per-vault settings. */
export class VaultConfig<T extends object> {
  value = $state() as T
  onError: (error: unknown) => void = console.error
  #saveTimer: ReturnType<typeof setTimeout> | undefined

  constructor(
    readonly name: string,
    readonly defaults: T,
  ) {
    this.value = defaults
  }

  /** Reads the file; `seed` fills in what the file doesn't have yet. */
  async load(seed: Partial<T> = {}) {
    const stored: unknown = JSON.parse((await vault.readConfig(this.name)) ?? '{}')
    this.value = mergeConfig(this.defaults, seed, stored)
  }

  /** Updates the value now and saves it shortly after, so sliders and typing write once. */
  set(changes: Partial<T>) {
    this.value = { ...this.value, ...changes }
    clearTimeout(this.#saveTimer)
    this.#saveTimer = setTimeout(() => void this.flush(), SAVE_DELAY_MS)
  }

  async flush() {
    if (this.#saveTimer === undefined) return
    clearTimeout(this.#saveTimer)
    this.#saveTimer = undefined
    try {
      await vault.writeConfig(this.name, JSON.stringify(this.value, null, 2))
    } catch (error) {
      this.onError(error)
    }
  }
}
