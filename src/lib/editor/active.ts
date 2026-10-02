import type { EditorView } from '@codemirror/view'

let active: EditorView | null = null

export const activeView = () => active

export function setActiveView(view: EditorView | null) {
  active = view
}

let cellFormatter: ((command: string) => boolean) | null = null

/** While a table cell is being edited, formatting commands apply to it instead of the note. */
export function setCellFormatter(format: ((command: string) => boolean) | null) {
  cellFormatter = format
  return () => {
    if (cellFormatter === format) cellFormatter = null
  }
}

export const formatInCell = (command: string) => cellFormatter?.(command) ?? false
