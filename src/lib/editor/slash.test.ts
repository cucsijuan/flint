import { CompletionContext } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { completeSlash, type SlashSources } from './slash'

const sources: SlashSources = {
  commands: () => [{ id: 'open-graph', name: 'Open graph view' }],
  runCommand: () => {},
  templates: () => ['Templates/Meeting'],
  insertTemplate: () => {},
}

const complete = (doc: string) =>
  completeSlash(new CompletionContext(EditorState.create({ doc }), doc.length, false), sources)

describe('slash commands', () => {
  it('opens after a slash at the start of a line or a word', () => {
    const result = complete('Some text /ta')
    expect(result?.from).toBe(10)
    const labels = result?.options.map((option) => option.label)
    expect(labels).toContain('Table')
    expect(labels).toContain('Templates/Meeting')
    expect(labels).toContain('Open graph view')
    expect(complete('/')?.from).toBe(0)
  })

  it('stays closed inside words and paths', () => {
    expect(complete('and/or')).toBeNull()
    expect(complete('https://example.com')).toBeNull()
  })
})
