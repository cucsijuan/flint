import { syntaxTree } from '@codemirror/language'
import type { EditorState, Range } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view'
import type { SyntaxNode, Tree } from '@lezer/common'
import { isExternalUrl, isImage, linkTargetOfUrl } from '../paths'
import { renderMath } from '../render/math'
import { resolvedLinks, urlAttributes } from './links'
import { pointerDown, pointerReleased } from './pointer'
import { previewContext } from './preview-context'
import { wikiLinkParts } from './wikilink'

class BulletWidget extends WidgetType {
  toDOM() {
    const bullet = document.createElement('span')
    bullet.className = 'cm-live-bullet'
    bullet.textContent = '•'
    return bullet
  }
}

export class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly width: string,
  ) {
    super()
  }

  eq(other: ImageWidget) {
    return other.src === this.src && other.width === this.width
  }

  toDOM(view: EditorView) {
    const image = document.createElement('img')
    image.className = 'cm-live-image'
    image.src = this.src
    if (/^\d+$/.test(this.width)) image.width = Number(this.width)
    image.addEventListener('load', () => view.requestMeasure())
    return image
  }
}

class MathWidget extends WidgetType {
  constructor(
    readonly tex: string,
    readonly isDisplay: boolean,
  ) {
    super()
  }

  eq(other: MathWidget) {
    return other.tex === this.tex && other.isDisplay === this.isDisplay
  }

  toDOM(view: EditorView) {
    const element = document.createElement('span')
    element.className = 'cm-live-math'
    void renderMath(this.tex, this.isDisplay).then((math) => {
      element.replaceChildren(math)
      view.requestMeasure()
    })
    return element
  }

  ignoreEvent() {
    return false
  }
}

export class FootnoteWidget extends WidgetType {
  constructor(readonly number: number) {
    super()
  }

  eq(other: FootnoteWidget) {
    return other.number === this.number
  }

  toDOM() {
    const footnote = document.createElement('sup')
    footnote.className = 'cm-live-footnote'
    footnote.textContent = String(this.number)
    return footnote
  }
}

/** Numbers footnotes like the reading view: by first reference, counting only defined labels. */
function footnoteNumbers(state: EditorState, tree: Tree) {
  const text = state.doc.toString()
  const defined = new Set(
    Array.from(text.matchAll(/^ {0,3}\[\^([^\]\s]+)\]:/gm), (match) => match[1]),
  )
  const numbers = new Map<string, number>()
  tree.iterate({
    enter: ({ name, from, to }) => {
      if (name !== 'FootnoteReference' || text[to] === ':') return
      const label = text.slice(from + 2, to - 1)
      if (defined.has(label) && !numbers.has(label)) numbers.set(label, numbers.size + 1)
    },
  })
  return numbers
}

class RuleWidget extends WidgetType {
  toDOM() {
    const rule = document.createElement('span')
    rule.className = 'cm-live-rule'
    return rule
  }
}

/** Replaces a code block's opening fence with its language and a copy button. */
export class LanguageWidget extends WidgetType {
  constructor(readonly language: string) {
    super()
  }

  eq(other: LanguageWidget) {
    return other.language === this.language
  }

  toDOM(view: EditorView) {
    const fence = document.createElement('span')
    fence.className = 'cm-live-fence'
    const label = Object.assign(document.createElement('span'), {
      className: 'cm-live-language',
      textContent: this.language,
    })
    const copy = Object.assign(document.createElement('button'), {
      type: 'button',
      className: 'copy-code',
      textContent: 'Copy',
    })
    copy.addEventListener('mousedown', (event) => event.preventDefault())
    copy.addEventListener('click', () => {
      const code = codeTextAt(view.state, view.posAtDOM(fence))
      void navigator.clipboard.writeText(code).then(() => {
        copy.textContent = 'Copied'
        setTimeout(() => (copy.textContent = 'Copy'), COPIED_MS)
      })
    })
    fence.append(label, copy)
    return fence
  }
}

function codeTextAt(state: EditorState, position: number) {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, 1);
    node;
    node = node.parent
  ) {
    if (node.name !== 'FencedCode') continue
    const text = node.getChild('CodeText')
    return text ? state.sliceDoc(text.from, text.to) : ''
  }
  return ''
}

export class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly position: number,
  ) {
    super()
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.position === this.position
  }

  toDOM(view: EditorView) {
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.className = 'cm-live-task'
    checkbox.checked = this.checked
    checkbox.addEventListener('mousedown', (event) => event.preventDefault())
    checkbox.addEventListener('click', () => {
      view.dispatch({
        changes: {
          from: this.position + 1,
          to: this.position + 2,
          insert: this.checked ? ' ' : 'x',
        },
      })
    })
    return checkbox
  }

  ignoreEvent() {
    return true
  }
}

export const isAloneOnLine = (state: EditorState, from: number, to: number) =>
  state.doc.lineAt(from).text.trim() === state.sliceDoc(from, to)

const COPIED_MS = 1500

const hide = Decoration.replace({})
const bullet = Decoration.replace({ widget: new BulletWidget() })
const rule = Decoration.replace({ widget: new RuleWidget() })
const quoteLine = Decoration.line({ class: 'cm-live-quote' })
const codeLine = Decoration.line({ class: 'cm-live-code' })

const INLINE_MARK_PARENTS: Record<string, string[]> = {
  EmphasisMark: ['Emphasis', 'StrongEmphasis'],
  HighlightMark: ['Highlight'],
  StrikethroughMark: ['Strikethrough'],
  CodeMark: ['InlineCode'],
}

export function previewDecorations(
  state: EditorState,
  from = 0,
  to = state.doc.length,
  tree: Tree = syntaxTree(state),
): DecorationSet {
  const { doc, selection } = state
  const resolved = state.field(resolvedLinks, false)
  const context = state.facet(previewContext)
  const imageAt = (from: number, to: number, path: string | null | undefined, width = '') => {
    if (!path || !context) return false
    const src = isExternalUrl(path) ? path : context.assetUrl(path)
    decorations.push(Decoration.replace({ widget: new ImageWidget(src, width) }).range(from, to))
    return true
  }
  const decorations: Range<Decoration>[] = []
  let footnotes: Map<string, number> | undefined

  const touchesSelection = (start: number, end: number) =>
    selection.ranges.some((range) => range.from <= end && range.to >= start)
  const linesTouchSelection = (start: number, end: number) =>
    touchesSelection(doc.lineAt(start).from, doc.lineAt(end).to)
  const withTrailingSpace = (end: number) => (doc.sliceString(end, end + 1) === ' ' ? end + 1 : end)
  const eachLine = (node: SyntaxNode, decoration: Decoration) => {
    for (let position = node.from; position <= node.to;) {
      const line = doc.lineAt(position)
      decorations.push(decoration.range(line.from))
      position = line.to + 1
    }
  }

  tree.iterate({
    from,
    to,
    enter: ({ name, node }) => {
      const parent = node.parent
      switch (name) {
        case 'HeaderMark':
          if (parent?.name.startsWith('ATXHeading') && !linesTouchSelection(node.from, node.to)) {
            decorations.push(hide.range(node.from, withTrailingSpace(node.to)))
          }
          break
        case 'EmphasisMark':
        case 'HighlightMark':
        case 'StrikethroughMark':
        case 'CodeMark':
          if (
            parent &&
            INLINE_MARK_PARENTS[name].includes(parent.name) &&
            !touchesSelection(parent.from, parent.to)
          ) {
            decorations.push(hide.range(node.from, node.to))
          }
          break
        case 'Link': {
          const marks = node.getChildren('LinkMark')
          if (marks.length >= 2 && !touchesSelection(node.from, node.to)) {
            const [open, close] = marks
            const url = node.getChild('URL')
            const attributes = url ? urlAttributes(doc.sliceString(url.from, url.to)) : {}
            decorations.push(
              hide.range(node.from, open.to),
              Decoration.mark({ class: 'cm-live-link', attributes }).range(open.to, close.from),
              hide.range(close.from, node.to),
            )
          }
          break
        }
        case 'WikiLink': {
          if (touchesSelection(node.from, node.to)) break
          const { target, destination, targetNode, subpathNode, aliasNode } = wikiLinkParts(
            state,
            node,
          )
          const isEmbed = doc.sliceString(node.from, node.from + 1) === '!'
          if (isEmbed && isImage(target)) {
            if (isAloneOnLine(state, node.from, node.to)) break
            const alias = aliasNode ? doc.sliceString(aliasNode.from, aliasNode.to) : ''
            if (imageAt(node.from, node.to, resolved?.get(target), alias)) break
          }
          const shown = aliasNode ?? {
            from: (targetNode ?? subpathNode)?.from ?? node.from,
            to: (subpathNode ?? targetNode)?.to ?? node.to,
          }
          const isUnresolved = target !== '' && resolved?.get(target) === null
          if (shown.from > node.from) decorations.push(hide.range(node.from, shown.from))
          decorations.push(
            Decoration.mark({
              tagName: 'a',
              class: isUnresolved ? 'cm-live-link cm-live-unresolved' : 'cm-live-link',
              attributes: { href: '#', 'data-link': destination },
            }).range(shown.from, shown.to),
          )
          if (node.to > shown.to) decorations.push(hide.range(shown.to, node.to))
          break
        }
        case 'InlineMath': {
          if (touchesSelection(node.from, node.to)) break
          const [open, close] = node.getChildren('MathMark')
          if (!open || !close) break
          const widget = new MathWidget(
            doc.sliceString(open.to, close.from),
            open.to - open.from === 2,
          )
          decorations.push(Decoration.replace({ widget }).range(node.from, node.to))
          break
        }
        case 'FootnoteReference': {
          if (
            doc.sliceString(node.to, node.to + 1) === ':' ||
            touchesSelection(node.from, node.to)
          ) {
            break
          }
          footnotes ??= footnoteNumbers(state, tree)
          const number = footnotes.get(doc.sliceString(node.from + 2, node.to - 1))
          if (number === undefined) break
          const widget = new FootnoteWidget(number)
          decorations.push(Decoration.replace({ widget }).range(node.from, node.to))
          break
        }
        case 'Hashtag':
          decorations.push(
            Decoration.mark({
              class: 'cm-live-tag',
              attributes: { 'data-tag': doc.sliceString(node.from + 1, node.to) },
            }).range(node.from, node.to),
          )
          break
        case 'Image': {
          const url = node.getChild('URL')
          if (!url || touchesSelection(node.from, node.to)) break
          if (isAloneOnLine(state, node.from, node.to)) return false
          const text = doc.sliceString(url.from, url.to)
          imageAt(
            node.from,
            node.to,
            isExternalUrl(text) ? text : resolved?.get(linkTargetOfUrl(text)),
          )
          return false
        }
        case 'Blockquote':
          eachLine(node, quoteLine)
          break
        case 'QuoteMark':
          if (!linesTouchSelection(node.from, node.to)) {
            decorations.push(hide.range(node.from, withTrailingSpace(node.to)))
          }
          break
        case 'ListMark':
          if (parent?.parent?.name === 'BulletList' && !linesTouchSelection(node.from, node.to)) {
            decorations.push(
              parent.getChild('Task')
                ? hide.range(node.from, withTrailingSpace(node.to))
                : bullet.range(node.from, node.to),
            )
          }
          break
        case 'TaskMarker':
          if (!linesTouchSelection(node.from, node.to)) {
            const checked = /x/i.test(doc.sliceString(node.from + 1, node.to - 1))
            decorations.push(
              Decoration.replace({ widget: new CheckboxWidget(checked, node.from) }).range(
                node.from,
                node.to,
              ),
            )
          }
          break
        case 'HorizontalRule':
          if (!linesTouchSelection(node.from, node.to)) {
            decorations.push(rule.range(node.from, node.to))
          }
          break
        case 'FencedCode': {
          eachLine(node, codeLine)
          const [open, close] = node.getChildren('CodeMark')
          if (!open || linesTouchSelection(node.from, node.to)) break
          const info = node.getChild('CodeInfo')
          const language = info ? doc.sliceString(info.from, info.to) : ''
          decorations.push(
            Decoration.replace({ widget: new LanguageWidget(language) }).range(
              open.from,
              info?.to ?? open.to,
            ),
          )
          if (close) decorations.push(hide.range(close.from, close.to))
          break
        }
      }
    },
  })

  return Decoration.set(decorations, true)
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.build(view)
    }

    update(update: ViewUpdate) {
      const isPointerDown = update.state.field(pointerDown, false)
      if (
        update.docChanged ||
        (update.selectionSet && !isPointerDown) ||
        update.transactions.some(pointerReleased) ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state) ||
        update.startState.field(resolvedLinks, false) !== update.state.field(resolvedLinks, false)
      ) {
        this.decorations = this.build(update.view)
      }
    }

    build({ state, viewport }: EditorView) {
      return previewDecorations(state, viewport.from, viewport.to)
    }
  },
  { decorations: (plugin) => plugin.decorations },
)
