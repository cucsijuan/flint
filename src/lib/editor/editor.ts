import { indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { searchKeymap } from '@codemirror/search'
import { Annotation, Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { minimalSetup } from 'codemirror'
import type { EditorMode } from '../settings'
import { linkCompletion, type LinkCompletionSources } from './link-completion'
import { type LinkResolver, wikiLinks } from './links'
import { livePreview } from './live-preview'
import { wikiLinkSyntax } from './wikilink'

const markdownStyle = HighlightStyle.define([
  { tag: tags.heading1, class: 'cm-h cm-h1' },
  { tag: tags.heading2, class: 'cm-h cm-h2' },
  { tag: tags.heading3, class: 'cm-h cm-h3' },
  { tag: tags.heading4, class: 'cm-h cm-h4' },
  { tag: tags.heading5, class: 'cm-h cm-h5' },
  { tag: tags.heading6, class: 'cm-h cm-h6' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, class: 'cm-inline-code' },
  { tag: [tags.link, tags.url], class: 'cm-md-link' },
  { tag: [tags.processingInstruction, tags.contentSeparator, tags.meta], class: 'cm-md-mark' },
  { tag: tags.quote, class: 'cm-md-quote' },
])

const mode = new Compartment()
const externalChange = Annotation.define<boolean>()

const modeExtension = (editorMode: EditorMode): Extension =>
  editorMode === 'live' ? livePreview : []

export interface EditorOptions {
  doc: string
  mode: EditorMode
  onChange: (doc: string) => void
  onToggleMode: () => void
  resolveLinks: LinkResolver
  openLink: (destination: string) => void
  completion: LinkCompletionSources
}

export function createEditorState({
  doc,
  mode: editorMode,
  onChange,
  onToggleMode,
  resolveLinks,
  openLink,
  completion,
}: EditorOptions) {
  return EditorState.create({
    doc,
    extensions: [
      minimalSetup,
      keymap.of([
        indentWithTab,
        ...searchKeymap,
        {
          key: 'Mod-e',
          run: () => {
            onToggleMode()
            return true
          },
        },
      ]),
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: wikiLinkSyntax,
      }),
      wikiLinks(resolveLinks, openLink),
      linkCompletion(completion),
      syntaxHighlighting(markdownStyle),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ spellcheck: 'true' }),
      mode.of(modeExtension(editorMode)),
      EditorView.updateListener.of((update) => {
        const isUserEdit = !update.transactions.some((tr) => tr.annotation(externalChange))
        if (update.docChanged && isUserEdit) onChange(update.state.doc.toString())
      }),
    ],
  })
}

export const setMode = (view: EditorView, editorMode: EditorMode) =>
  view.dispatch({ effects: mode.reconfigure(modeExtension(editorMode)) })

export function replaceDoc(view: EditorView, doc: string) {
  const { state } = view
  const anchor = Math.min(state.selection.main.anchor, doc.length)
  view.dispatch({
    changes: { from: 0, to: state.doc.length, insert: doc },
    selection: { anchor },
    annotations: externalChange.of(true),
  })
}

const HEADING_LINE = /^#{1,6}\s+(.*?)\s*#*\s*$/

export function scrollToHeading(view: EditorView, heading: string) {
  const wanted = heading.trim().toLowerCase()
  for (let number = 1; number <= view.state.doc.lines; number++) {
    const line = view.state.doc.line(number)
    if (HEADING_LINE.exec(line.text)?.[1].toLowerCase() === wanted) {
      view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 40 }),
      })
      return
    }
  }
}
