import { markdown } from '@codemirror/lang-markdown'
import { ensureSyntaxTree, foldable, foldEffect } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { foldedLines, folding } from './folding'

function state(doc: string) {
  const created = EditorState.create({ doc, extensions: [markdown(), folding(() => {})] })
  ensureSyntaxTree(created, doc.length, 5000)
  return created
}

function foldedText(doc: string, line: number) {
  const current = state(doc)
  const { from, to } = current.doc.line(line)
  const range = foldable(current, from, to)
  return range && current.sliceDoc(range.from, range.to)
}

describe('folding', () => {
  it('folds a list item over its sub-items', () => {
    expect(foldedText('- a\n  - a1\n\n  - a2\n- b', 1)).toBe('\n  - a1\n\n  - a2')
    expect(foldedText('- a\n  - a1\n- b', 3)).toBeNull()
  })

  it('folds a heading over its section', () => {
    expect(foldedText('# A\ntext\n## A1\nmore\n# B', 1)).toBe('\ntext\n## A1\nmore')
  })

  it('reports folds as line numbers', () => {
    const current = state('# A\ntext\n# B\n- b\n  - b1')
    const folded = current.update({
      effects: [foldEffect.of({ from: 3, to: 8 }), foldEffect.of({ from: 16, to: 23 })],
    }).state
    expect(foldedLines(folded)).toEqual([
      { from: 1, to: 2 },
      { from: 4, to: 5 },
    ])
  })
})
