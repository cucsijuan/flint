import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

const URL = /^[a-z][a-z\d+.-]*:\/\/\S+$/i

/** Turns every non-empty selection into `[text](url)`, or returns null when `text` isn't a URL. */
export function linkSelection(state: EditorState, text: string): TransactionSpec | null {
  const url = text.trim()
  if (!URL.test(url) || state.selection.ranges.every((range) => range.empty)) return null
  return {
    ...state.changeByRange((range) => {
      if (range.empty) return { range }
      const insert = `[${state.sliceDoc(range.from, range.to)}](${url})`
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.cursor(range.from + insert.length),
      }
    }),
    userEvent: 'input.paste',
  }
}

/** Pasting a URL over selected text links the text, like Obsidian. */
export const pasteLink = EditorView.domEventHandlers({
  paste(event, view) {
    const transaction = linkSelection(view.state, event.clipboardData?.getData('text/plain') ?? '')
    if (!transaction) return false
    event.preventDefault()
    view.dispatch(transaction)
    return true
  },
})
