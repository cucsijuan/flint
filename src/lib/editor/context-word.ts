import { EditorView } from '@codemirror/view'

let pending: { view: EditorView; from: number; to: number } | null = null

/** The editor word under a right-click, remembered so a spelling suggestion can replace it. */
export function contextWord(event: MouseEvent) {
  const editor = (event.target as Element).closest<HTMLElement>('.cm-editor')
  const view = editor ? EditorView.findFromDOM(editor) : null
  const position = view?.posAtCoords(event)
  const word = view && position != null ? view.state.wordAt(position) : null
  pending = view && word ? { view, from: word.from, to: word.to } : null
  return pending ? pending.view.state.sliceDoc(pending.from, pending.to) : null
}

export function replaceContextWord(text: string) {
  if (!pending) return
  const { view, from, to } = pending
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } })
  view.focus()
  pending = null
}
