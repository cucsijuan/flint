import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateEffect, type Text } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'
import { spelling } from '../spelling.svelte'

const CHECK_DELAY_MS = 300
const WORD = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu
/** Markdown that isn't prose: code, links' targets, tags, math, comments, HTML. */
const SKIPPED = new Set([
  'InlineCode',
  'FencedCode',
  'CodeBlock',
  'CodeText',
  'URL',
  'Autolink',
  'WikiLinkTarget',
  'WikiLinkSubpath',
  'Hashtag',
  'InlineMath',
  'BlockMath',
  'Comment',
  'CommentBlock',
  'HTMLTag',
  'HTMLBlock',
  'BlockId',
  'FootnoteReference',
  'LinkLabel',
])

const misspelled = Decoration.mark({ class: 'cm-misspelled' })
const recheck = StateEffect.define<null>()

/** Where the frontmatter ends, as a document position; 0 without one. */
function frontmatterEnd(doc: Text) {
  if (doc.lines < 2 || doc.line(1).text !== '---') return 0
  for (let number = 2; number <= doc.lines; number++) {
    if (doc.line(number).text === '---') return doc.line(number).to
  }
  return 0
}

interface Word {
  from: number
  to: number
  text: string
}

function visibleWords(view: EditorView): Word[] {
  const { state } = view
  const tree = syntaxTree(state)
  const skipUntil = frontmatterEnd(state.doc)
  const words: Word[] = []
  for (const { from, to } of view.visibleRanges) {
    const text = state.sliceDoc(from, to)
    for (const match of text.matchAll(WORD)) {
      const start = from + match.index
      if (start < skipUntil || match[0].length < 2) continue
      let isProse = true
      for (let node = tree.resolveInner(start, 1); node.parent; node = node.parent) {
        if (SKIPPED.has(node.name)) {
          isProse = false
          break
        }
      }
      if (isProse) words.push({ from: start, to: start + match[0].length, text: match[0] })
    }
  }
  return words
}

function decorate(words: Word[]) {
  const builder = new RangeSetBuilder<Decoration>()
  for (const word of words) {
    if (spelling.isMisspelled(word.text)) builder.add(word.from, word.to, misspelled)
  }
  return builder.finish()
}

/** Flint's own spell checking: underlines misspelled words and offers suggestions for them. */
export const spellcheck = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    #timer: ReturnType<typeof setTimeout> | undefined
    #stopListening: () => void

    constructor(readonly view: EditorView) {
      this.decorations = decorate(visibleWords(view))
      this.#stopListening = spelling.changed.on(() => view.dispatch({ effects: recheck.of(null) }))
      this.#schedule()
    }

    update(update: ViewUpdate) {
      const isRecheck = update.transactions.some((tr) => tr.effects.some((e) => e.is(recheck)))
      if (update.docChanged || update.viewportChanged || isRecheck) {
        this.decorations = isRecheck
          ? decorate(visibleWords(update.view))
          : this.decorations.map(update.changes)
        this.#schedule()
      }
    }

    #schedule() {
      clearTimeout(this.#timer)
      this.#timer = setTimeout(() => {
        const words = visibleWords(this.view)
        void spelling
          .check(words.map((word) => word.text))
          .then(() => {
            this.decorations = decorate(visibleWords(this.view))
            this.view.dispatch({})
          })
          .catch(() => undefined)
      }, CHECK_DELAY_MS)
    }

    destroy() {
      clearTimeout(this.#timer)
      this.#stopListening()
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    eventHandlers: {
      contextmenu(event, view) {
        if (!(event.target as Element).closest('.cm-misspelled')) return false
        const position = view.posAtCoords(event)
        const range = position === null ? null : view.state.wordAt(position)
        if (!range) return false
        event.preventDefault()
        const word = view.state.sliceDoc(range.from, range.to)
        spelling.menu = {
          x: event.clientX,
          y: event.clientY,
          word,
          replace: (text) => {
            view.dispatch({
              changes: { from: range.from, to: range.to, insert: text },
              selection: { anchor: range.from + text.length },
            })
            view.focus()
          },
        }
        return true
      },
    },
  },
)

export const spellcheckTheme = EditorView.baseTheme({
  '.cm-misspelled': {
    textDecoration: 'underline wavy #e03e3e',
    textDecorationSkipInk: 'none',
    textUnderlineOffset: '3px',
  },
})
