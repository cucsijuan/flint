import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

const MARKER = /[*_~=`%]/
/** How far around a selection to look for formatting marks. */
const RUN_LIMIT = 16

const runLength = (chars: string[]) => {
  const end = chars.findIndex((char) => !MARKER.test(char))
  return end === -1 ? chars.length : end
}

/** The edits that toggle `marker` around `[from, to)`. It counts as present even with other marks
 * between it and the text, as in `~~**text**~~`, so marks come off in any order. */
function markerEdits(
  slice: (from: number, to: number) => string,
  length: number,
  from: number,
  to: number,
  marker: string,
) {
  const left = slice(Math.max(0, from - RUN_LIMIT), from)
  const right = slice(to, Math.min(length, to + RUN_LIMIT))
  const leftRun = left.slice(left.length - runLength([...left].reverse()))
  const rightRun = right.slice(0, runLength([...right]))
  for (let at = leftRun.length - marker.length; at >= 0; at--) {
    if (leftRun.slice(at, at + marker.length) !== marker) continue
    const mirrored = [...leftRun.slice(at + marker.length)].reverse().join('')
    if (!rightRun.startsWith(mirrored + marker)) continue
    const leftStart = from - leftRun.length + at
    const rightStart = to + mirrored.length
    return {
      changes: [
        { from: leftStart, to: leftStart + marker.length, insert: '' },
        { from: rightStart, to: rightStart + marker.length, insert: '' },
      ],
      from: from - marker.length,
      to: to - marker.length,
    }
  }
  return {
    changes: [
      { from, to: from, insert: marker },
      { from: to, to, insert: marker },
    ],
    from: from + marker.length,
    to: to + marker.length,
  }
}

export function toggleWrap(view: EditorView, marker: string) {
  const { state } = view
  view.dispatch(
    state.changeByRange((range) => {
      const edits = markerEdits(
        (from, to) => state.sliceDoc(from, to),
        state.doc.length,
        range.from,
        range.to,
        marker,
      )
      return { changes: edits.changes, range: EditorSelection.range(edits.from, edits.to) }
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
  const edits = markerEdits((start, end) => text.slice(start, end), text.length, from, to, marker)
  const changed = [...edits.changes]
    .sort((a, b) => b.from - a.from)
    .reduce(
      (result, change) => result.slice(0, change.from) + change.insert + result.slice(change.to),
      text,
    )
  return { text: changed, from: edits.from, to: edits.to }
}

/** Adds `prefix` to the start of each selected line, or removes it where every line has it. */
export function toggleLinePrefix(view: EditorView, prefix: string) {
  const { state } = view
  const lines = new Set<number>()
  for (const range of state.selection.ranges) {
    for (let at = range.from; at <= range.to;) {
      const line = state.doc.lineAt(at)
      lines.add(line.number)
      at = line.to + 1
    }
  }
  const all = [...lines].map((number) => state.doc.line(number))
  const isRemoving = all.every((line) => line.text.startsWith(prefix))
  view.dispatch({
    changes: all.map((line) =>
      isRemoving
        ? { from: line.from, to: line.from + prefix.length }
        : { from: line.from, insert: prefix },
    ),
  })
  view.focus()
}
