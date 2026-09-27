import * as vault from './vault'

type Config = Record<string, unknown>

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

  set(changes: Partial<T>) {
    this.value = { ...this.value, ...changes }
    return vault.writeConfig(this.name, JSON.stringify(this.value, null, 2))
  }
}
