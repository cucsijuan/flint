export class Emitter<T> {
  #listeners = new Set<(value: T) => void>()

  on(listener: (value: T) => void) {
    this.#listeners.add(listener)
    return () => void this.#listeners.delete(listener)
  }

  emit(value: T) {
    for (const listener of this.#listeners) {
      try {
        listener(value)
      } catch (error) {
        console.error(error)
      }
    }
  }
}

export const noteOpened = new Emitter<string | null>()
export const vaultChanged = new Emitter<string[]>()
