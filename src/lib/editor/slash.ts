import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import type { EditorView } from '@codemirror/view'

export interface SlashSources {
  commands: () => { id: string; name: string }[]
  runCommand: (id: string) => void
  /** Template notes, by the link text "Insert template" takes. */
  templates: () => string[]
  insertTemplate: (template: string) => void
}

/** `/` at the start of a line or after a space, followed by what's typed so far. */
const SLASH = /(?:^|\s)\/[^\s/]*$/

/** Markdown blocks, inserted in place of the `/…` typed; `¦` marks where the cursor goes. */
const BLOCKS: [string, string][] = [
  ['Heading 1', '# ¦'],
  ['Heading 2', '## ¦'],
  ['Heading 3', '### ¦'],
  ['Bullet list', '- ¦'],
  ['Numbered list', '1. ¦'],
  ['Task', '- [ ] ¦'],
  ['Quote', '> ¦'],
  ['Callout', '> [!note]\n> ¦'],
  ['Code block', '```\n¦\n```'],
  ['Math block', '$$\n¦\n$$'],
  ['Table', '| ¦ |  |\n| --- | --- |\n|  |  |'],
  ['Divider', '---\n¦'],
]

// Completions start after the slash, so the list filters by what follows it; applying one
// also removes the slash.
function insertBlock(text: string) {
  return (view: EditorView, _completion: Completion, from: number, to: number) => {
    const cursor = text.indexOf('¦')
    const insert = text.replace('¦', '')
    view.dispatch({
      changes: { from: from - 1, to, insert },
      selection: { anchor: from - 1 + cursor },
    })
  }
}

/** Removes the `/…` typed, then runs `action`. */
const replacing =
  (action: () => void) => (view: EditorView, _completion: Completion, from: number, to: number) => {
    view.dispatch({ changes: { from: from - 1, to } })
    action()
  }

export function completeSlash(
  context: CompletionContext,
  sources: SlashSources,
): CompletionResult | null {
  const match = context.matchBefore(SLASH)
  if (!match) return null
  const from = match.to - match.text.length + match.text.indexOf('/') + 1
  const blocks: Completion[] = BLOCKS.map(([label, text]) => ({
    label,
    type: 'block',
    section: 'Markdown',
    apply: insertBlock(text),
  }))
  const templates: Completion[] = sources.templates().map((template) => ({
    label: template,
    detail: 'template',
    section: 'Templates',
    apply: replacing(() => sources.insertTemplate(template)),
  }))
  const commands: Completion[] = sources.commands().map((command) => ({
    label: command.name,
    section: 'Commands',
    apply: replacing(() => sources.runCommand(command.id)),
  }))
  return {
    from,
    options: [...blocks, ...templates, ...commands],
    filter: true,
    validFor: /^[^\s/]*$/,
  }
}
