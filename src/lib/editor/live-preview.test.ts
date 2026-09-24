import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { CheckboxWidget, LanguageWidget, previewDecorations } from './live-preview'
import { wikiLinkSyntax } from './wikilink'

function preview(doc: string, cursor = doc.length) {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: markdown({ base: markdownLanguage, extensions: wikiLinkSyntax }),
  })
  const tree = ensureSyntaxTree(state, doc.length, 5000)
  if (!tree) throw new Error('Parsing timed out')
  const replaced: string[] = []
  const lineClasses: string[] = []
  previewDecorations(state, 0, doc.length, tree).between(0, doc.length, (from, to, decoration) => {
    const { widget, class: className } = decoration.spec
    if (from === to && className) lineClasses.push(className)
    else if (decoration.spec.class === undefined) {
      const text = doc.slice(from, to)
      if (widget instanceof CheckboxWidget) replaced.push(`[${widget.checked ? 'x' : ' '}]`)
      else if (widget instanceof LanguageWidget) replaced.push(`<${widget.language}>`)
      else replaced.push(text)
    }
  })
  return { replaced, lineClasses }
}

describe('live preview', () => {
  it('hides heading marks unless the cursor is on the heading', () => {
    expect(preview('# Title\n\nbody').replaced).toEqual(['# '])
    expect(preview('# Title\n\nbody', 3).replaced).toEqual([])
  })

  it('hides inline marks unless the cursor is inside the span', () => {
    const doc = 'a **bold** and `code` and ~~gone~~\n'
    expect(preview(doc).replaced).toEqual(['**', '**', '`', '`', '~~', '~~'])
    expect(preview(doc, doc.indexOf('bold')).replaced).toEqual(['`', '`', '~~', '~~'])
  })

  it('shows only the label of links', () => {
    expect(preview('see [docs](https://example.com)\n').replaced).toEqual([
      '[',
      '](https://example.com)',
    ])
  })

  it('renders bullets and task checkboxes away from the cursor', () => {
    const doc = '- item\n- [ ] todo\n- [x] done\n\nend'
    expect(preview(doc).replaced).toEqual(['-', '- ', '[ ]', '- ', '[x]'])
    expect(preview(doc, 0).replaced).toEqual(['- ', '[ ]', '- ', '[x]'])
  })

  it('shows only the target, subpath or alias of wikilinks', () => {
    expect(preview('[[Note]] and ![[Image]]\n').replaced).toEqual(['[[', ']]', '![[', ']]'])
    expect(preview('[[Note#Part]]\n').replaced).toEqual(['[[', ']]'])
    expect(preview('[[Note#Part|Shown]]\n').replaced).toEqual(['[[Note#Part|', ']]'])
    expect(preview('[[Note]]', 3).replaced).toEqual([])
  })

  it('leaves ordered list numbers visible', () => {
    expect(preview('1. first\n\nend').replaced).toEqual([])
  })

  it('hides code fences and labels the language unless the cursor is in the block', () => {
    const doc = '```js\nlet a\n```\n\n```\nplain\n```\n\nend'
    expect(preview(doc).replaced).toEqual(['<js>', '```', '```', '```'])
    expect(preview(doc, doc.indexOf('let')).replaced).toEqual(['```', '```'])
  })

  it('styles quote and code block lines', () => {
    const { lineClasses } = preview('> quote\n\n```js\nlet a\n```\n\nend')
    expect(lineClasses).toEqual(['cm-live-quote', 'cm-live-code', 'cm-live-code', 'cm-live-code'])
  })
})
