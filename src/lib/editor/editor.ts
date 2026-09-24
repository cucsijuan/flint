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
import { completion, type CompletionSources } from './completion'
import { hashtagSyntax } from './hashtag'
import { type LinkResolver, type Navigation, navigation } from './links'
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
  { tag: tags.labelName, class: 'cm-hashtag' },
])

const APP_HOTKEYS = new Set(['Mod-g'])
const editorSearchKeymap = searchKeymap.filter((binding) => !APP_HOTKEYS.has(binding.key ?? ''))

const mode = new Compartment()
const pluginExtensions = new Compartment()
const externalChange = Annotation.define<boolean>()

const modeExtension = (editorMode: EditorMode): Extension =>
  editorMode === 'live' ? livePreview : []

export interface EditorOptions {
  doc: string
  mode: EditorMode
  onChange: (doc: string) => void
  resolveLinks: LinkResolver
  navigation: Navigation
  completion: CompletionSources
  plugins: Extension[]
}

export function createEditorState({
  doc,
  mode: editorMode,
  onChange,
  resolveLinks,
  navigation: handlers,
  completion: sources,
  plugins,
}: EditorOptions) {
  return EditorState.create({
    doc,
    extensions: [
      minimalSetup,
      keymap.of([indentWithTab, ...editorSearchKeymap]),
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: [wikiLinkSyntax, hashtagSyntax],
      }),
      navigation(resolveLinks, handlers),
      completion(sources),
      syntaxHighlighting(markdownStyle),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ spellcheck: 'true' }),
      mode.of(modeExtension(editorMode)),
      pluginExtensions.of(plugins),
      EditorView.updateListener.of((update) => {
        const isUserEdit = !update.transactions.some((tr) => tr.annotation(externalChange))
        if (update.docChanged && isUserEdit) onChange(update.state.doc.toString())
      }),
    ],
  })
}

export const setPluginExtensions = (view: EditorView, plugins: Extension[]) =>
  view.dispatch({ effects: pluginExtensions.reconfigure(plugins) })

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

export function scrollToLine(view: EditorView, number: number) {
  const line = view.state.doc.line(Math.min(Math.max(number, 1), view.state.doc.lines))
  view.dispatch({
    selection: { anchor: line.from },
    effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
  })
  view.focus()
}

export function scrollToHeading(view: EditorView, heading: string) {
  const wanted = heading.trim().toLowerCase()
  for (let number = 1; number <= view.state.doc.lines; number++) {
    if (HEADING_LINE.exec(view.state.doc.line(number).text)?.[1].toLowerCase() === wanted) {
      scrollToLine(view, number)
      return
    }
  }
}
