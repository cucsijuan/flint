import { indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { yamlFrontmatter } from '@codemirror/lang-yaml'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { searchKeymap } from '@codemirror/search'
import {
  Annotation,
  type ChangeSet,
  Compartment,
  EditorState,
  type Extension,
  Prec,
  Transaction,
} from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { classHighlighter, tags } from '@lezer/highlight'
import { vim } from '@replit/codemirror-vim'
import { minimalSetup } from 'codemirror'
import { flash } from '../flash'
import { blockLines } from '../render/source'
import type { EditorMode, PropertiesDisplay } from '../settings'
import { attachmentInput, type SaveAttachment } from './attachments'
import { blockPreview } from './blocks'
import { completion, type CompletionSources } from './completion'
import { type FoldedLines, folding } from './folding'
import { hashtagSyntax } from './hashtag'
import { type LinkResolver, type Navigation, navigation } from './links'
import { livePreview } from './live-preview'
import { obsidianSyntax, obsidianTags } from './obsidian-syntax'
import { pasteLink } from './paste-link'
import { pointer } from './pointer'
import { type PreviewContext, previewContext, propertiesDisplay } from './preview-context'
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
  { tag: obsidianTags.highlight, class: 'cm-highlight' },
  { tag: obsidianTags.math, class: 'cm-math' },
  { tag: obsidianTags.footnote, class: 'cm-footnote' },
  { tag: tags.comment, class: 'cm-comment' },
])

const mode = new Compartment()
const pluginExtensions = new Compartment()
const properties = new Compartment()
const vimMode = new Compartment()
const remoteChange = Annotation.define<boolean>()

const modeExtension = (editorMode: EditorMode): Extension =>
  editorMode === 'live' ? [livePreview, blockPreview] : []

export interface EditorOptions {
  doc: string
  mode: EditorMode
  vimMode: boolean
  propertiesDisplay: PropertiesDisplay
  onChange: (changes: ChangeSet, doc: string) => void
  onKeydown: (event: KeyboardEvent) => boolean
  resolveLinks: LinkResolver
  navigation: Navigation
  completion: CompletionSources
  plugins: Extension[]
  preview: PreviewContext
  saveAttachment: SaveAttachment
  onFoldsChange: (folds: FoldedLines[]) => void
}

export function createEditorState({
  doc,
  mode: editorMode,
  vimMode: isVimMode,
  propertiesDisplay: display,
  onChange,
  onKeydown,
  resolveLinks,
  navigation: handlers,
  completion: sources,
  plugins,
  preview,
  saveAttachment,
  onFoldsChange,
}: EditorOptions) {
  return EditorState.create({
    doc,
    extensions: [
      Prec.highest(EditorView.domEventHandlers({ keydown: onKeydown })),
      vimMode.of(isVimMode ? vim() : []),
      minimalSetup,
      keymap.of([indentWithTab, ...searchKeymap]),
      yamlFrontmatter({
        content: markdown({
          base: markdownLanguage,
          codeLanguages: languages,
          extensions: [wikiLinkSyntax, hashtagSyntax, obsidianSyntax],
        }),
      }),
      pointer,
      folding(onFoldsChange),
      navigation(resolveLinks, handlers),
      completion(sources),
      syntaxHighlighting(markdownStyle),
      syntaxHighlighting(classHighlighter),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ spellcheck: 'true' }),
      mode.of(modeExtension(editorMode)),
      pluginExtensions.of(plugins),
      previewContext.of(preview),
      properties.of(propertiesDisplay.of(display)),
      pasteLink,
      attachmentInput(saveAttachment),
      EditorView.updateListener.of((update) => {
        const isLocalEdit = !update.transactions.some((tr) => tr.annotation(remoteChange))
        if (update.docChanged && isLocalEdit) onChange(update.changes, update.state.doc.toString())
      }),
    ],
  })
}

export const setPluginExtensions = (view: EditorView, plugins: Extension[]) =>
  view.dispatch({ effects: pluginExtensions.reconfigure(plugins) })

export const setMode = (view: EditorView, editorMode: EditorMode) =>
  view.dispatch({ effects: mode.reconfigure(modeExtension(editorMode)) })

export const setVimMode = (view: EditorView, isEnabled: boolean) =>
  view.dispatch({ effects: vimMode.reconfigure(isEnabled ? vim() : []) })

export const setPropertiesDisplay = (view: EditorView, display: PropertiesDisplay) =>
  view.dispatch({ effects: properties.reconfigure(propertiesDisplay.of(display)) })

const remote = [remoteChange.of(true), Transaction.addToHistory.of(false)]

export function replaceDoc(view: EditorView, doc: string) {
  const { state } = view
  const anchor = Math.min(state.selection.main.anchor, doc.length)
  view.dispatch({
    changes: { from: 0, to: state.doc.length, insert: doc },
    selection: { anchor },
    annotations: remote,
  })
}

export const applyChanges = (view: EditorView, changes: ChangeSet) =>
  view.dispatch({ changes, annotations: remote })

const HEADING_LINE = /^#{1,6}\s+(.*?)\s*#*\s*$/

/** Moves to line `number` and flashes it and the `count - 1` lines after it. */
export function scrollToLine(view: EditorView, number: number, count = 1) {
  const { doc } = view.state
  const line = doc.line(Math.min(Math.max(number, 1), doc.lines))
  view.dispatch({
    selection: { anchor: line.from },
    effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
  })
  view.focus()
  requestAnimationFrame(() => {
    for (let index = 0; index < count && line.number + index <= doc.lines; index++) {
      const { from } = doc.line(line.number + index)
      const node = view.domAtPos(from).node
      flash((node instanceof Element ? node : node.parentElement)?.closest('.cm-line'))
    }
  })
}

export function scrollToBlock(view: EditorView, id: string) {
  const range = blockLines(view.state.doc.toString().split('\n'), id)
  if (range) scrollToLine(view, range[0] + 1, range[1] - range[0])
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
