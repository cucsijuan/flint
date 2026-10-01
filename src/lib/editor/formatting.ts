import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export function toggleWrap(view: EditorView, marker: string) {
  const { state } = view
  view.dispatch(
    state.changeByRange((range) => {
      const before = state.sliceDoc(range.from - marker.length, range.from)
      const after = state.sliceDoc(range.to, range.to + marker.length)
      if (before === marker && after === marker) {
        return {
          changes: [
            { from: range.from - marker.length, to: range.from },
            { from: range.to, to: range.to + marker.length },
          ],
          range: EditorSelection.range(range.from - marker.length, range.to - marker.length),
        }
      }
      return {
        changes: [
          { from: range.from, insert: marker },
          { from: range.to, insert: marker },
        ],
        range: EditorSelection.range(range.from + marker.length, range.to + marker.length),
      }
    }),
  )
  view.focus()
}

export function insertLink(view: EditorView) {
  const { state } = view
  view.dispatch(
    state.changeByRange((range) => {
      const text = state.sliceDoc(range.from, range.to)
      const insert = `[[${text}]]`
      const cursor = range.from + 2 + text.length
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.cursor(cursor),
      }
    }),
  )
  view.focus()
}

/** `toggleWrap` for plain text and a selection, as in a text field. */
export function toggleWrapText(text: string, from: number, to: number, marker: string) {
  const before = text.slice(from - marker.length, from)
  const after = text.slice(to, to + marker.length)
  if (from >= marker.length && before === marker && after === marker) {
    return {
      text:
        text.slice(0, from - marker.length) + text.slice(from, to) + text.slice(to + marker.length),
      from: from - marker.length,
      to: to - marker.length,
    }
  }
  return {
    text: text.slice(0, from) + marker + text.slice(from, to) + marker + text.slice(to),
    from: from + marker.length,
    to: to + marker.length,
  }
}
