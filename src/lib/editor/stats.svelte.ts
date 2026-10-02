import type { Text } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { activeView } from './active'

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu
const FRONTMATTER = /^---\n[\s\S]*?\n---(?:\n|$)/

export const countWords = (text: string) => text.match(WORD)?.length ?? 0

/** Words and characters of a note, leaving out its frontmatter. */
export function noteStats(doc: Text) {
  const text = doc.toString().replace(FRONTMATTER, '')
  return { words: countWords(text), characters: [...text].length }
}

/** The counts the status bar shows for the active editor: its selection, or the whole note. */
export const editorStats = $state({ words: 0, characters: 0, isSelection: false })

function report(view: EditorView) {
  const { from, to } = view.state.selection.main
  const counts =
    from === to
      ? noteStats(view.state.doc)
      : (() => {
          const text = view.state.sliceDoc(from, to)
          return { words: countWords(text), characters: [...text].length }
        })()
  editorStats.words = counts.words
  editorStats.characters = counts.characters
  editorStats.isSelection = from !== to
}

let timer: ReturnType<typeof setTimeout> | undefined

export const statsReporter = EditorView.updateListener.of((update) => {
  const isActive = activeView() === update.view || update.focusChanged
  if (!isActive || !(update.docChanged || update.selectionSet || update.focusChanged)) return
  clearTimeout(timer)
  timer = setTimeout(() => report(update.view), 150)
})

/** Counts the active editor right away, when it changes. */
export function reportActive() {
  const view = activeView()
  if (view) report(view)
}
