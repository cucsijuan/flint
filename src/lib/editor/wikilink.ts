import type { EditorState } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'
import { tags } from '@lezer/highlight'
import type { Element, InlineContext, MarkdownConfig } from '@lezer/markdown'

const BANG = 33
const OPEN_BRACKET = 91

export const wikiLinkSyntax: MarkdownConfig = {
  defineNodes: [
    { name: 'WikiLink' },
    { name: 'WikiLinkMark', style: tags.processingInstruction },
    { name: 'WikiLinkTarget', style: tags.link },
    { name: 'WikiLinkSubpath', style: tags.link },
    { name: 'WikiLinkAlias', style: tags.link },
  ],
  parseInline: [
    {
      name: 'WikiLink',
      before: 'Link',
      parse(cx, next, pos) {
        const isEmbed = next === BANG
        const open = pos + (isEmbed ? 1 : 0)
        if (cx.char(open) !== OPEN_BRACKET || cx.char(open + 1) !== OPEN_BRACKET) return -1
        const innerStart = open + 2
        const rest = cx.slice(innerStart, cx.end)
        const close = rest.indexOf(']]')
        const inner = rest.slice(0, close)
        if (close <= 0 || /[\n[]/.test(inner)) return -1
        const end = innerStart + close + 2
        cx.addElement(cx.elt('WikiLink', pos, end, parts(cx, inner, pos, innerStart, end)))
        return end
      },
    },
  ],
}

function parts(cx: InlineContext, inner: string, start: number, innerStart: number, end: number) {
  const pipe = inner.indexOf('|')
  const destination = pipe === -1 ? inner : inner.slice(0, pipe)
  const hash = destination.indexOf('#')
  const target = hash === -1 ? destination : destination.slice(0, hash)
  const children: Element[] = [cx.elt('WikiLinkMark', start, innerStart)]
  if (target) children.push(cx.elt('WikiLinkTarget', innerStart, innerStart + target.length))
  if (hash !== -1) {
    children.push(cx.elt('WikiLinkSubpath', innerStart + hash, innerStart + destination.length))
  }
  if (pipe !== -1) {
    const aliasStart = innerStart + pipe + 1
    children.push(cx.elt('WikiLinkMark', aliasStart - 1, aliasStart))
    if (aliasStart < end - 2) children.push(cx.elt('WikiLinkAlias', aliasStart, end - 2))
  }
  children.push(cx.elt('WikiLinkMark', end - 2, end))
  return children
}

export function wikiLinkParts(state: EditorState, node: SyntaxNode) {
  const text = (child: SyntaxNode | null) => (child ? state.sliceDoc(child.from, child.to) : '')
  const targetNode = node.getChild('WikiLinkTarget')
  const subpathNode = node.getChild('WikiLinkSubpath')
  return {
    target: text(targetNode),
    destination: text(targetNode) + text(subpathNode),
    targetNode,
    subpathNode,
    aliasNode: node.getChild('WikiLinkAlias'),
  }
}
