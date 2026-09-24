import type { EditorView } from '@codemirror/view'

let active: EditorView | null = null

export const activeView = () => active

export function setActiveView(view: EditorView | null) {
  active = view
}
