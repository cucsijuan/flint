import { syntaxTree } from '@codemirror/language'
import { type EditorState, type Line, Prec, type Range, StateField } from '@codemirror/state'
import {
  type Command,
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  WidgetType,
} from '@codemirror/view'
import { isExternalUrl, isImage, linkTargetOfUrl, NOTE_EXTENSION } from '../paths'
import { hydrate } from '../render/hydrate'
import { renderMarkdown } from '../render/markdown'
import { linkRevision, resolvedLinks } from './links'
import { ImageWidget, isAloneOnLine } from './live-preview'
import { pointerDown, pointerReleased } from './pointer'
import { type PreviewContext, previewContext } from './preview-context'
import { wikiLinkParts } from './wikilink'

abstract class BlockWidget extends WidgetType {
  protected container(view: EditorView, className: string) {
    const element = document.createElement('div')
    element.className = `cm-live-block markdown ${className}`
    element.addEventListener('mousedown', (event) => {
      if ((event.target as HTMLElement).closest('a')) return
      event.preventDefault()
      view.dispatch({ selection: { anchor: view.posAtDOM(element) } })
      view.focus()
    })
    return element
  }

  ignoreEvent(event: Event) {
    return !(event.target as HTMLElement).closest('[data-link], [data-tag]')
  }
}

class TableWidget extends BlockWidget {
  constructor(readonly markdown: string) {
    super()
  }

  eq(other: TableWidget) {
    return other.markdown === this.markdown
  }

  toDOM(view: EditorView) {
    const element = this.container(view, 'cm-live-table')
    element.innerHTML = renderMarkdown(this.markdown)
    return element
  }
}

class NoteEmbedWidget extends BlockWidget {
  constructor(
    readonly destination: string,
    readonly context: PreviewContext,
    readonly revision: number,
  ) {
    super()
  }

  eq(other: NoteEmbedWidget) {
    return other.destination === this.destination && other.revision === this.revision
  }

  toDOM(view: EditorView) {
    const element = this.container(view, 'cm-live-embed')
    void this.render(element, view)
    return element
  }

  updateDOM(element: HTMLElement, view: EditorView) {
    void this.render(element, view)
    return true
  }

  private async render(element: HTMLElement, view: EditorView) {
    const content = document.createElement('div')
    content.innerHTML = renderMarkdown(`![[${this.destination}]]`)
    await hydrate(content, this.context)
    element.replaceChildren(...content.childNodes)
    view.requestMeasure()
  }
}

class ImageBlockWidget extends BlockWidget {
  constructor(readonly image: ImageWidget) {
    super()
  }

  eq(other: ImageBlockWidget) {
    return other.image.eq(this.image)
  }

  toDOM(view: EditorView) {
    const element = this.container(view, 'cm-live-image-block')
    element.append(this.image.toDOM(view))
    return element
  }
}

function blockDecorations(state: EditorState): DecorationSet {
  const context = state.facet(previewContext)
  const resolved = state.field(resolvedLinks, false)
  const revision = state.field(linkRevision, false) ?? 0
  const { doc, selection } = state
  const decorations: Range<Decoration>[] = []
  const isEditing = (from: number, to: number) =>
    selection.ranges.some((range) => range.from <= to && range.to >= from)
  const block = (from: number, to: number, widget: WidgetType) =>
    decorations.push(Decoration.replace({ widget, block: true }).range(from, to))
  const below = (position: number, widget: WidgetType) =>
    decorations.push(Decoration.widget({ widget, block: true, side: 1 }).range(position))
  const image = (
    line: Line,
    isEditingLine: boolean,
    path: string | null | undefined,
    width = '',
  ) => {
    if (!path || !context) return
    const src = isExternalUrl(path) ? path : context.assetUrl(path)
    const widget = new ImageBlockWidget(new ImageWidget(src, width))
    if (isEditingLine) below(line.to, widget)
    else block(line.from, line.to, widget)
  }

  syntaxTree(state).iterate({
    enter: ({ name, node }) => {
      if (name === 'Table') {
        const from = doc.lineAt(node.from).from
        const to = doc.lineAt(node.to).to
        if (!isEditing(from, to)) block(from, to, new TableWidget(doc.sliceString(from, to)))
        return false
      }
      if ((name !== 'WikiLink' && name !== 'Image') || !context) return
      const line = doc.lineAt(node.from)
      const isAlone = isAloneOnLine(state, node.from, node.to)
      const isEmbed = doc.sliceString(node.from, node.from + 1) === '!'
      if (!isEmbed || !isAlone) return
      const isEditingLine = isEditing(line.from, line.to)
      if (name === 'Image') {
        const url = node.getChild('URL')
        const text = url ? doc.sliceString(url.from, url.to) : ''
        const path = isExternalUrl(text) ? text : resolved?.get(linkTargetOfUrl(text))
        image(line, isEditingLine, path)
        return false
      }
      const { target, destination, aliasNode } = wikiLinkParts(state, node)
      const path = target ? resolved?.get(target) : context.source
      if (isImage(target)) {
        const width = aliasNode ? doc.sliceString(aliasNode.from, aliasNode.to) : ''
        image(line, isEditingLine, path, width)
      } else if (path?.toLowerCase().endsWith(NOTE_EXTENSION)) {
        const embed = new NoteEmbedWidget(destination, context, revision)
        if (isEditingLine) below(line.to, embed)
        else block(line.from, line.to, embed)
      }
    },
  })
  return Decoration.set(decorations, true)
}

const blockDecorationsField = StateField.define<DecorationSet>({
  create: blockDecorations,
  update(decorations, transaction) {
    const isStale =
      transaction.docChanged ||
      (transaction.selection && !transaction.state.field(pointerDown, false)) ||
      pointerReleased(transaction) ||
      syntaxTree(transaction.startState) !== syntaxTree(transaction.state) ||
      transaction.startState.field(resolvedLinks, false) !==
        transaction.state.field(resolvedLinks, false)
    return isStale ? blockDecorations(transaction.state) : decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})

/** Arrow keys would jump over a rendered block; stop at its edge so it shows its source. */
const enterBlock =
  (forward: boolean): Command =>
  (view) => {
    const { state } = view
    const { main } = state.selection
    if (!main.empty) return false
    const current = state.doc.lineAt(main.head).number
    const next = current + (forward ? 1 : -1)
    if (next < 1 || next > state.doc.lines) return false
    const line = state.doc.line(next)
    let isBlockEdge = false
    state.field(blockDecorationsField).between(line.from, line.to, (from, to, decoration) => {
      if (decoration.spec.block && from < to && (forward ? from === line.from : to === line.to)) {
        isBlockEdge = true
      }
    })
    if (!isBlockEdge) return false
    view.dispatch({ selection: { anchor: forward ? line.from : line.to }, scrollIntoView: true })
    return true
  }

export const blockPreview = [
  blockDecorationsField,
  Prec.high(
    keymap.of([
      { key: 'ArrowDown', run: enterBlock(true) },
      { key: 'ArrowUp', run: enterBlock(false) },
    ]),
  ),
]
