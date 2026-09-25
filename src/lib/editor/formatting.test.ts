// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { insertLink, toggleWrap } from './formatting'

function editor(doc: string, from: number, to = from) {
  return new EditorView({
    state: EditorState.create({ doc, selection: { anchor: from, head: to } }),
  })
}

describe('formatting', () => {
  it('wraps and unwraps the selection', () => {
    const view = editor('make this bold', 5, 9)
    toggleWrap(view, '**')
    expect(view.state.doc.toString()).toBe('make **this** bold')
    toggleWrap(view, '**')
    expect(view.state.doc.toString()).toBe('make this bold')
  })

  it('inserts a wikilink around the selection or at the cursor', () => {
    const view = editor('see Note', 4, 8)
    insertLink(view)
    expect(view.state.doc.toString()).toBe('see [[Note]]')
    expect(view.state.selection.main.head).toBe(10)
  })
})
