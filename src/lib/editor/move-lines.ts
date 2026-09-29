import { foldedRanges, foldEffect } from '@codemirror/language'
import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state'
import { previousSiblingStart, subItemsEnd } from './list-items'

type Direction = -1 | 1
/** An inclusive range of line numbers. */
type Lines = [first: number, last: number]

/** Extends `last` over folded ranges that start within the lines, so hidden text moves with them. */
function overFolds(state: EditorState, first: number, last: number) {
  const { doc } = state
  for (let previous = 0; previous !== last;) {
    previous = last
    foldedRanges(state).between(doc.line(first).from, doc.line(last).to, (_, to) => {
      last = Math.max(last, doc.lineAt(to).number)
    })
  }
  return last
}

/** The lines moved together with `first`–`last`: a list item takes its sub-items, a fold its hidden lines. */
function blockOf(state: EditorState, first: number, last: number): Lines {
  return [first, overFolds(state, first, Math.max(last, subItemsEnd(state.doc, first)))]
}

/** The sibling block right above `first`, skipping over its sub-items and folds. */
function blockAbove(state: EditorState, first: number): Lines | null {
  const { doc } = state
  if (first === 1) return null
  let top = previousSiblingStart(doc, first)
  foldedRanges(state).between(doc.line(top).from, doc.line(top).to, (from, to) => {
    if (from < doc.line(top).from && to >= doc.line(top).from) top = doc.lineAt(from).number
  })
  return [top, first - 1]
}

function foldsIn(state: EditorState, [first, last]: Lines) {
  const { doc } = state
  const start = doc.line(first).from
  const folds: { from: number; to: number }[] = []
  foldedRanges(state).between(start, doc.line(last).to, (from, to) => {
    if (from >= start) folds.push({ from: from - start, to: to - start })
  })
  return folds
}

/** Moves the selected lines past the neighboring block, like swapping two outline items. */
export function moveLines(state: EditorState, direction: Direction): TransactionSpec | null {
  const { doc, selection } = state
  const { from, to } = selection.main
  const block = blockOf(state, doc.lineAt(from).number, doc.lineAt(to).number)
  const [first, last] = block
  const other =
    direction < 0
      ? blockAbove(state, first)
      : last < doc.lines
        ? blockOf(state, last + 1, last + 1)
        : null
  if (!other) return null

  const otherText = doc.sliceString(doc.line(other[0]).from, doc.line(other[1]).to)
  const shift = (otherText.length + 1) * direction
  const changes =
    direction < 0
      ? [
          { from: doc.line(other[0]).from, to: doc.line(first).from },
          { from: doc.line(last).to, insert: `\n${otherText}` },
        ]
      : [
          { from: doc.line(first).from, insert: `${otherText}\n` },
          { from: doc.line(last).to, to: doc.line(other[1]).to },
        ]
  const otherStart = direction < 0 ? doc.line(last).to - otherText.length : doc.line(first).from
  return {
    changes,
    selection: EditorSelection.create(
      selection.ranges.map((range) => range.extend(range.anchor + shift, range.head + shift)),
      selection.mainIndex,
    ),
    effects: foldsIn(state, other).map((fold) =>
      foldEffect.of({ from: otherStart + fold.from, to: otherStart + fold.to }),
    ),
    scrollIntoView: true,
    userEvent: direction < 0 ? 'move.line.up' : 'move.line.down',
  }
}
