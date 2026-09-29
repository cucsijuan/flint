import { EditorSelection, EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { linkSelection } from './paste-link'

function paste(doc: string, ranges: [number, number][], text: string) {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.create(ranges.map(([from, to]) => EditorSelection.range(from, to))),
    extensions: EditorState.allowMultipleSelections.of(true),
  })
  const transaction = linkSelection(state, text)
  return transaction && state.update(transaction).state.doc.toString()
}

describe('linkSelection', () => {
  it('links the selected text to a pasted URL', () => {
    expect(paste('see docs here', [[4, 8]], ' https://example.com ')).toBe(
      'see [docs](https://example.com) here',
    )
  })

  it('links every selection', () => {
    expect(
      paste(
        'a b',
        [
          [0, 1],
          [2, 3],
        ],
        'https://x.org',
      ),
    ).toBe('[a](https://x.org) [b](https://x.org)')
  })

  it('leaves ordinary pastes alone', () => {
    expect(paste('text', [[0, 4]], 'not a url')).toBeNull()
    expect(paste('text', [[0, 4]], 'https://a.b and more')).toBeNull()
    expect(paste('text', [[2, 2]], 'https://example.com')).toBeNull()
  })
})
