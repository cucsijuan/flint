import { syntaxTree } from '@codemirror/language'
import { type EditorState, type Range, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view'
import { NOTE_EXTENSION } from '../paths'
import { hydrate } from '../render/hydrate'
import { renderMarkdown } from '../render/markdown'
import { resolvedLinks } from './links'
import { type PreviewContext, previewContext } from './preview-context'
import { wikiLinkParts } from './wikilink'

abstract class BlockWidget extends WidgetType {
  constructor(readonly from: number) {
    super()
  }

  protected container(view: EditorView, className: string) {
    const element = document.createElement('div')
    element.className = `cm-live-block markdown ${className}`
    element.addEventListener('mousedown', (event) => {
      if ((event.target as HTMLElement).closest('a')) return
      event.preventDefault()
      view.dispatch({ selection: { anchor: this.from } })
      view.focus()
    })
    return element
  }

  ignoreEvent(event: Event) {
    return !(event.target as HTMLElement).closest('[data-link], [data-tag]')
  }
}

class TableWidget extends BlockWidget {
  constructor(
    from: number,
    readonly markdown: string,
  ) {
    super(from)
  }

  eq(other: TableWidget) {
    return other.markdown === this.markdown && other.from === this.from
  }

  toDOM(view: EditorView) {
    const element = this.container(view, 'cm-live-table')
    element.innerHTML = renderMarkdown(this.markdown)
    return element
  }
}

class NoteEmbedWidget extends BlockWidget {
  constructor(
    from: number,
    readonly destination: string,
    readonly context: PreviewContext,
  ) {
    super(from)
  }

  eq(other: NoteEmbedWidget) {
    return other.destination === this.destination && other.from === this.from
  }

  toDOM(view: EditorView) {
    const element = this.container(view, 'cm-live-embed')
    element.innerHTML = renderMarkdown(`![[${this.destination}]]`)
    void hydrate(element, this.context)
    return element
  }
}

function blockDecorations(state: EditorState): DecorationSet {
  const context = state.facet(previewContext)
  const resolved = state.field(resolvedLinks, false)
  const { doc, selection } = state
  const decorations: Range<Decoration>[] = []
  const isEditing = (from: number, to: number) =>
    selection.ranges.some((range) => range.from <= to && range.to >= from)
  const block = (from: number, to: number, widget: WidgetType) =>
    decorations.push(Decoration.replace({ widget, block: true }).range(from, to))

  syntaxTree(state).iterate({
    enter: ({ name, node }) => {
      if (name === 'Table') {
        const from = doc.lineAt(node.from).from
        const to = doc.lineAt(node.to).to
        if (!isEditing(from, to)) block(from, to, new TableWidget(from, doc.sliceString(from, to)))
        return false
      }
      if (name !== 'WikiLink' || !context) return
      const line = doc.lineAt(node.from)
      const isAlone = line.text.trim() === doc.sliceString(node.from, node.to)
      const isEmbed = doc.sliceString(node.from, node.from + 1) === '!'
      if (!isEmbed || !isAlone || isEditing(line.from, line.to)) return
      const { target, destination } = wikiLinkParts(state, node)
      const path = target ? resolved?.get(target) : context.source
      if (path?.toLowerCase().endsWith(NOTE_EXTENSION)) {
        block(line.from, line.to, new NoteEmbedWidget(line.from, destination, context))
      }
    },
  })
  return Decoration.set(decorations, true)
}

export const blockPreview = StateField.define<DecorationSet>({
  create: blockDecorations,
  update(decorations, transaction) {
    const isStale =
      transaction.docChanged ||
      transaction.selection ||
      syntaxTree(transaction.startState) !== syntaxTree(transaction.state) ||
      transaction.startState.field(resolvedLinks, false) !==
        transaction.state.field(resolvedLinks, false)
    return isStale ? blockDecorations(transaction.state) : decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})
