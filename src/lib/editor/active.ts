import type { EditorView } from '@codemirror/view'

let active: EditorView | null = null

export const activeView = () => active

export function setActiveView(view: EditorView | null) {
  active = view
}

let cellFormatter: ((command: string) => void) | null = null

/** While a table cell is being edited, formatting commands apply to it instead of the note. */
export function setCellFormatter(format: ((command: string) => void) | null) {
  cellFormatter = format
}

export function formatInCell(command: string) {
  cellFormatter?.(command)
  return cellFormatter !== null
}
