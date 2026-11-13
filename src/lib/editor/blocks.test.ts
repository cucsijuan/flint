// @vitest-environment jsdom
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { blockPreview, DiagramPreviewWidget } from './blocks'
import { obsidianSyntax } from './obsidian-syntax'
import { previewContext } from './preview-context'
import { wikiLinkSyntax } from './wikilink'

const context = {
  source: 'Flow.md',
  resolve: async (targets: string[]) => targets.map(() => null),
  assetUrl: (path: string) => path,
  readNote: async () => '',
  editNote: async () => {},
}

/** What live preview puts over `doc` with the cursor at `cursor`. */
function blocks(doc: string, cursor: number) {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [
      markdown({ base: markdownLanguage, extensions: [wikiLinkSyntax, obsidianSyntax] }),
      previewContext.of(context),
      blockPreview,
    ],
  })
  const found: string[] = []
  for (const decorations of state.facet(EditorView.decorations)) {
    if (typeof decorations === 'function') continue
    decorations.between(0, doc.length, (from, to, decoration) => {
      const { widget } = decoration.spec
      if (widget instanceof DiagramPreviewWidget) {
        found.push(`diagram of ${JSON.stringify(widget.source)} for ${widget.note} at ${from}`)
      } else if (from < to) found.push(`rendered ${JSON.stringify(doc.slice(from, to))}`)
    })
  }
  return found
}

const diagram = '```mermaid\ngraph LR\n  A --> B\n```'

describe('Mermaid blocks in live preview', () => {
  it('render in place while the cursor is elsewhere', () => {
    const doc = `${diagram}\n\nEnd`
    expect(blocks(doc, doc.length)).toEqual([`rendered ${JSON.stringify(diagram)}`])
  })

  it('show their source with the diagram under it while the cursor is inside', () => {
    const doc = `${diagram}\n\nEnd`
    expect(blocks(doc, doc.indexOf('A -->'))).toEqual([
      `diagram of "graph LR\\n  A --> B" for Flow.md at ${diagram.length}`,
    ])
  })

  it('only do so for diagrams', () => {
    const base = '```base\nviews: []\n```'
    expect(blocks(`${base}\n\nEnd`, base.indexOf('views'))).toEqual([])
    const code = '```js\nlet a\n```'
    expect(blocks(`${code}\n\nEnd`, code.indexOf('let'))).toEqual([])
  })
})
