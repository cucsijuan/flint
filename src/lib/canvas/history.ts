const LIMIT = 200

/** Undo and redo over snapshots of the whole canvas file. */
export class CanvasHistory {
  #undo: string[] = []
  #redo: string[] = []

  record(previous: string) {
    this.#undo.push(previous)
    if (this.#undo.length > LIMIT) this.#undo.shift()
    this.#redo = []
  }

  undo(current: string) {
    const previous = this.#undo.pop()
    if (previous !== undefined) this.#redo.push(current)
    return previous
  }

  redo(current: string) {
    const next = this.#redo.pop()
    if (next !== undefined) this.#undo.push(current)
    return next
  }
}
