import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { type EditorState, type Line, Prec, type Range, StateField } from '@codemirror/state'
import {
  type Command,
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  WidgetType,
} from '@codemirror/view'
import { isBase, isCanvas, isExternalUrl, isImage, linkTargetOfUrl, NOTE_EXTENSION } from '../paths'
import { hydrate, rendersCodeBlock } from '../render/hydrate'
import { renderMarkdown } from '../render/markdown'
import { readProperties } from '../properties'
import { processors } from '../render/processors.svelte'
import { linkRevision, resolvedLinks } from './links'
import { ImageWidget, isAloneOnLine } from './live-preview'
import { pointerDown, pointerReleased } from './pointer'
import { mountProperties } from './properties-widget.svelte'
import { formatTable, parseTable, tableData, type TableData } from './table'
import { mountTable } from './table-widget.svelte'
import { type PreviewContext, previewContext, propertiesDisplay } from './preview-context'
import { wikiLinkParts } from './wikilink'

const CALLOUT_START = /^\s*>\s*\[![\w-]+\]/

const INTERACTIVE = 'a, button, input, select, textarea, summary, [data-interactive]'

/** Rendered blocks change height after CodeMirror measures them (images, folds, forms). */
const resizeObservers = new WeakMap<HTMLElement, ResizeObserver>()

abstract class BlockWidget extends WidgetType {
  protected container(view: EditorView, className: string) {
    const element = document.createElement('div')
    element.className = `cm-live-block markdown ${className}`
    element.addEventListener('mousedown', (event) => {
      if ((event.target as HTMLElement).closest(INTERACTIVE)) return
      event.preventDefault()
      view.dispatch({ selection: { anchor: view.posAtDOM(element) } })
      view.focus()
    })
    const observer = new ResizeObserver(() => view.requestMeasure())
    observer.observe(element)
    resizeObservers.set(element, observer)
    return element
  }

  destroy(element: HTMLElement) {
    resizeObservers.get(element)?.disconnect()
  }

  ignoreEvent(event: Event) {
    return !(event.target as HTMLElement).closest('[data-link], [data-tag]')
  }
}

/** Markdown rendered like the reading view: tables, callouts, embedded notes and plugin code blocks. */
class MarkdownWidget extends BlockWidget {
  constructor(
    readonly markdown: string,
    readonly firstLine: number,
    readonly className: string,
    readonly context: PreviewContext,
    readonly revision: string,
  ) {
    super()
  }

  eq(other: MarkdownWidget) {
    return (
      other.markdown === this.markdown &&
      other.firstLine === this.firstLine &&
      other.revision === this.revision
    )
  }

  toDOM(view: EditorView) {
    const element = this.container(view, this.className)
    element.innerHTML = this.html()
    void hydrate(element, this.context)
    return element
  }

  updateDOM(element: HTMLElement) {
    const content = document.createElement('div')
    content.innerHTML = this.html()
    void hydrate(content, this.context).then(() => element.replaceChildren(...content.childNodes))
    return true
  }

  private html() {
    return renderMarkdown(this.markdown, { firstLine: this.firstLine })
  }
}

const mountedProperties = new WeakMap<HTMLElement, ReturnType<typeof mountProperties>>()

/** The frontmatter as an editable form; moving the cursor into it shows the YAML. */
class PropertiesWidget extends BlockWidget {
  constructor(
    readonly yaml: string,
    readonly context: PreviewContext,
  ) {
    super()
  }

  eq(other: PropertiesWidget) {
    return other.yaml === this.yaml
  }

  toDOM(view: EditorView) {
    const element = this.container(view, 'cm-live-properties')
    mountedProperties.set(element, mountProperties(element, this.properties(), this.edit()))
    return element
  }

  updateDOM(element: HTMLElement) {
    mountedProperties.get(element)?.update(this.properties())
    return true
  }

  destroy(element: HTMLElement) {
    super.destroy(element)
    mountedProperties.get(element)?.destroy()
  }

  private properties() {
    return readProperties(this.yaml) ?? []
  }

  private edit() {
    const { editNote, source } = this.context
    return (change: (note: string) => string) => void editNote(source, change)
  }
}

const mountedTables = new WeakMap<HTMLElement, ReturnType<typeof mountTable>>()

/** A table edited as a grid: cells turn into text fields when clicked. */
class TableWidget extends BlockWidget {
  constructor(
    readonly markdown: string,
    readonly context: PreviewContext,
    readonly revision: string,
  ) {
    super()
  }

  eq(other: TableWidget) {
    return other.markdown === this.markdown && other.revision === this.revision
  }

  toDOM(view: EditorView) {
    const element = this.container(view, 'cm-live-table')
    const change = (edit: (markdown: string) => { from: number; to: number; insert: string }) => {
      const start = view.posAtDOM(element)
      const { from, to, insert } = edit(table.markdown)
      view.dispatch({
        changes: { from: start + from, to: start + to, insert },
        userEvent: 'input.table',
      })
    }
    const replace = (data: TableData) =>
      change((markdown) => ({ from: 0, to: markdown.length, insert: formatTable(data) }))
    const table = mountTable(element, this.markdown, this.context, {
      cell: (row, column, text) =>
        change((markdown) => {
          const cell = parseTable(markdown).rows[row]?.[column]
          if (cell) return { from: cell.from, to: cell.to, insert: text }
          const data = tableData(parseTable(markdown))
          data.rows[row][column] = text
          return { from: 0, to: markdown.length, insert: formatTable(data) }
        }),
      replace,
      leave: () => view.focus(),
    })
    mountedTables.set(element, table)
    return element
  }

  updateDOM(element: HTMLElement) {
    mountedTables.get(element)?.update(this.markdown)
    return true
  }

  destroy(element: HTMLElement) {
    super.destroy(element)
    mountedTables.get(element)?.destroy()
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
  const revision = `${state.field(linkRevision, false) ?? 0}:${processors.version}`
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

  const rendered = (node: SyntaxNode, className: string) => {
    const first = doc.lineAt(node.from)
    const to = doc.lineAt(node.to).to
    if (!context || isEditing(first.from, to)) return
    const markdown = doc.sliceString(first.from, to)
    block(
      first.from,
      to,
      new MarkdownWidget(markdown, first.number - 1, className, context, revision),
    )
  }

  syntaxTree(state).iterate({
    enter: ({ name, node }) => {
      if (name === 'Frontmatter') {
        const closing = node.getChildren('DashLine').at(-1)
        const to = doc.lineAt(closing?.from ?? node.from).to
        const display = state.facet(propertiesDisplay)
        if (!context || isEditing(0, to) || display === 'source') return false
        if (display === 'hidden') decorations.push(Decoration.replace({ block: true }).range(0, to))
        else block(0, to, new PropertiesWidget(doc.sliceString(0, to), context))
        return false
      }
      if (name === 'Table') {
        const first = doc.lineAt(node.from)
        const to = doc.lineAt(node.to).to
        if (context && !isEditing(first.from, to)) {
          block(first.from, to, new TableWidget(doc.sliceString(first.from, to), context, revision))
        }
        return false
      }
      if (name === 'BlockMath') {
        rendered(node, 'cm-live-math-block')
        return false
      }
      if (name === 'Blockquote' && CALLOUT_START.test(doc.lineAt(node.from).text)) {
        rendered(node, 'cm-live-callout')
        return false
      }
      if (name === 'FencedCode') {
        const info = node.getChild('CodeInfo')
        if (info && rendersCodeBlock(doc.sliceString(info.from, info.to))) {
          rendered(node, 'cm-live-code-block')
        }
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
      } else if (
        path &&
        (path.toLowerCase().endsWith(NOTE_EXTENSION) || isBase(path) || isCanvas(path))
      ) {
        const embed = new MarkdownWidget(
          `![[${destination}]]`,
          0,
          'cm-live-embed',
          context,
          revision,
        )
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
      transaction.reconfigured ||
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
