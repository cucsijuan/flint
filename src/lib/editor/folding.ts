import {
  codeFolding,
  ensureSyntaxTree,
  foldable,
  foldedRanges,
  foldEffect,
  foldService,
  syntaxTree,
  unfoldEffect,
} from '@codemirror/language'
import { type EditorState, RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view'
import { subItemsEnd } from './list-items'

/** A fold as the line numbers where it starts and ends, which survive reopening the note. */
export interface FoldedLines {
  from: number
  to: number
}

const PARSE_TIMEOUT_MS = 500

const listFolding = foldService.of((state, lineStart, lineEnd) => {
  const line = state.doc.lineAt(lineStart)
  const last = subItemsEnd(state.doc, line.number)
  return last > line.number ? { from: lineEnd, to: state.doc.line(last).to } : null
})

function foldAt(state: EditorState, lineEnd: number) {
  let range: { from: number; to: number } | null = null
  foldedRanges(state).between(lineEnd, lineEnd, (from, to) => {
    if (from === lineEnd) range = { from, to }
  })
  return range
}

class FoldIndicator extends WidgetType {
  constructor(readonly isFolded: boolean) {
    super()
  }

  eq(other: FoldIndicator) {
    return other.isFolded === this.isFolded
  }

  toDOM() {
    const indicator = document.createElement('span')
    indicator.className = this.isFolded ? 'cm-fold-indicator is-folded' : 'cm-fold-indicator'
    indicator.setAttribute('aria-hidden', 'true')
    return indicator
  }

  ignoreEvent() {
    return false
  }
}

const folded = Decoration.widget({ widget: new FoldIndicator(true), side: -1 })
const unfolded = Decoration.widget({ widget: new FoldIndicator(false), side: -1 })

function indicators(view: EditorView): DecorationSet {
  const { state } = view
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    for (let position = from; position <= to;) {
      const line = state.doc.lineAt(position)
      const start = line.from + (/^\s*/.exec(line.text)?.[0].length ?? 0)
      if (foldAt(state, line.to)) builder.add(start, start, folded)
      else if (foldable(state, line.from, line.to)) builder.add(start, start, unfolded)
      position = line.to + 1
    }
  }
  return builder.finish()
}

const foldIndicators = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = indicators(view)
    }

    update(update: ViewUpdate) {
      const foldsChanged = update.transactions.some((tr) =>
        tr.effects.some((effect) => effect.is(foldEffect) || effect.is(unfoldEffect)),
      )
      const treeChanged = syntaxTree(update.startState) !== syntaxTree(update.state)
      if (update.docChanged || update.viewportChanged || foldsChanged || treeChanged) {
        this.decorations = indicators(update.view)
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    eventHandlers: {
      mousedown(event, view) {
        if (!(event.target instanceof HTMLElement) || !event.target.matches('.cm-fold-indicator')) {
          return false
        }
        const line = view.state.doc.lineAt(view.posAtDOM(event.target))
        const range = foldAt(view.state, line.to) ?? foldable(view.state, line.from, line.to)
        if (!range) return false
        const isFolded = foldAt(view.state, line.to) !== null
        view.dispatch({ effects: (isFolded ? unfoldEffect : foldEffect).of(range) })
        event.preventDefault()
        return true
      },
    },
  },
)

export function foldedLines(state: EditorState): FoldedLines[] {
  const lines: FoldedLines[] = []
  foldedRanges(state).between(0, state.doc.length, (from, to) => {
    lines.push({ from: state.doc.lineAt(from).number, to: state.doc.lineAt(to).number })
  })
  return lines
}

/** Folds again what was folded when the note was last open, if those lines still fold the same way. */
export function restoreFolds(view: EditorView, folds: FoldedLines[]) {
  const { state } = view
  ensureSyntaxTree(state, state.doc.length, PARSE_TIMEOUT_MS)
  const effects = folds.flatMap(({ from, to }) => {
    if (from > state.doc.lines) return []
    const line = state.doc.line(from)
    const range = foldable(state, line.from, line.to)
    return range && state.doc.lineAt(range.to).number === to ? [foldEffect.of(range)] : []
  })
  if (effects.length) view.dispatch({ effects })
}

/** Folding of headings and lists, with an arrow beside each foldable line; reports folds as they change. */
export function folding(onChange: (folds: FoldedLines[]) => void) {
  return [
    codeFolding({ placeholderText: '…' }),
    listFolding,
    foldIndicators,
    EditorView.updateListener.of((update) => {
      const foldsChanged = update.transactions.some((tr) =>
        tr.effects.some((effect) => effect.is(foldEffect) || effect.is(unfoldEffect)),
      )
      if (foldsChanged || (update.docChanged && foldedRanges(update.state).size)) {
        onChange(foldedLines(update.state))
      }
    }),
  ]
}
