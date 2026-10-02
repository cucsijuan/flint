// @vitest-environment jsdom
import { completionStatus, currentCompletions } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { completion } from './completion'

describe('slash typing', () => {
  it('opens the list when / is typed', async () => {
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        extensions: completion({
          targets: () => [],
          headings: async () => [],
          blocks: async () => null,
          searchBlocks: async () => [],
          addBlockId: () => '',
          tags: () => [],
          slash: {
            commands: () => [],
            runCommand: () => {},
            templates: () => [],
            insertTemplate: () => {},
          },
        }),
      }),
    })
    view.dispatch({
      changes: { from: 0, insert: '/' },
      selection: { anchor: 1 },
      userEvent: 'input.type',
    })
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(completionStatus(view.state)).toBe('active')
    expect(currentCompletions(view.state).length).toBeGreaterThan(5)
  })
})
