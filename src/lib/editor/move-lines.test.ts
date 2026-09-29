import { codeFolding, foldedRanges, foldEffect } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { moveLines } from './move-lines'

function move(doc: string, line: number, direction: -1 | 1, folds: [number, number][] = []) {
  let state = EditorState.create({ doc, extensions: codeFolding() })
  state = state.update({
    selection: { anchor: state.doc.line(line).from },
    effects: folds.map(([from, to]) => foldEffect.of({ from, to })),
  }).state
  const transaction = moveLines(state, direction)
  if (!transaction) return null
  const next = state.update(transaction).state
  const folded: string[] = []
  foldedRanges(next).between(0, next.doc.length, (from, to) => {
    folded.push(next.sliceDoc(from, to))
  })
  return {
    doc: next.doc.toString(),
    line: next.doc.lineAt(next.selection.main.head).number,
    folded,
  }
}

describe('moveLines', () => {
  it('swaps plain lines and keeps the cursor on the moved line', () => {
    expect(move('a\nb\nc', 2, -1)).toMatchObject({ doc: 'b\na\nc', line: 1 })
    expect(move('a\nb\nc', 2, 1)).toMatchObject({ doc: 'a\nc\nb', line: 3 })
  })

  it('stops at the edges of the note', () => {
    expect(move('a\nb', 1, -1)).toBeNull()
    expect(move('a\nb', 2, 1)).toBeNull()
  })

  it('moves a list item with its sub-items past whole sibling items', () => {
    const doc = '- a\n  - a1\n- b\n  - b1\n- c'
    expect(move(doc, 3, -1)?.doc).toBe('- b\n  - b1\n- a\n  - a1\n- c')
    expect(move(doc, 3, 1)?.doc).toBe('- a\n  - a1\n- c\n- b\n  - b1')
  })

  it('moves folded headings with their sections and keeps them folded', () => {
    const doc = '# A\ntext a\n# B\ntext b'
    const folds: [number, number][] = [
      [3, 10],
      [14, 21],
    ]
    const swapped = { doc: '# B\ntext b\n# A\ntext a', folded: ['\ntext b', '\ntext a'] }
    expect(move(doc, 1, 1, folds)).toEqual({ ...swapped, line: 3 })
    expect(move(doc, 3, -1, folds)).toEqual({ ...swapped, line: 1 })
  })
})
