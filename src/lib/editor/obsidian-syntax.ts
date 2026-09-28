import { Tag, tags } from '@lezer/highlight'
import type { BlockContext, InlineContext, Line, MarkdownConfig } from '@lezer/markdown'

const DOLLAR = 36
const PERCENT = 37
const EQUALS = 61
const BACKSLASH = 92
const OPEN_BRACKET = 91
const CARET = 94

/** Styles for the syntax below, used by the editor's highlight style. */
export const obsidianTags = {
  highlight: Tag.define(),
  math: Tag.define(),
  footnote: Tag.define(),
}

const HighlightDelimiter = { resolve: 'Highlight', mark: 'HighlightMark' }

/** An inline span between `fence` marks, like `$x$` or `%%note%%`; `-1` when there is none. */
function fencedInline(
  cx: InlineContext,
  pos: number,
  fence: string,
  node: string,
  mark: string,
  isValidClose: (at: number) => boolean = () => true,
) {
  const contentStart = pos + fence.length
  for (let at = contentStart; at < cx.end; at++) {
    if (cx.char(at) === BACKSLASH) {
      at++
      continue
    }
    if (cx.slice(at, at + fence.length) !== fence || at === contentStart || !isValidClose(at)) {
      continue
    }
    const end = at + fence.length
    return cx.addElement(
      cx.elt(node, pos, end, [cx.elt(mark, pos, contentStart), cx.elt(mark, at, end)]),
    )
  }
  return -1
}

/** A block from a line starting with `fence` to the next `fence`, like `$$` math or `%%` comments. */
function fencedBlock(cx: BlockContext, line: Line, fence: string, node: string, mark: string) {
  if (!line.text.startsWith(fence, line.pos)) return false
  const from = cx.lineStart + line.pos
  const marks = [cx.elt(mark, from, from + fence.length)]
  let search = line.pos + fence.length
  let end = -1
  do {
    const close = line.text.indexOf(fence, search)
    if (close !== -1) {
      marks.push(cx.elt(mark, cx.lineStart + close, cx.lineStart + close + fence.length))
      end = cx.lineStart + line.text.length
      cx.nextLine()
      break
    }
    search = 0
  } while (cx.nextLine())
  cx.addElement(cx.elt(node, from, end === -1 ? cx.prevLineEnd() : end, marks))
  return true
}

/** Obsidian's additions to Markdown: math, `==highlights==`, `%%comments%%`, footnotes and `^block` ids. */
export const obsidianSyntax: MarkdownConfig = {
  defineNodes: [
    { name: 'InlineMath', style: obsidianTags.math },
    { name: 'BlockMath', block: true, style: obsidianTags.math },
    { name: 'MathMark', style: tags.processingInstruction },
    { name: 'Highlight', style: { 'Highlight/...': obsidianTags.highlight } },
    { name: 'HighlightMark', style: tags.processingInstruction },
    { name: 'Comment', style: { 'Comment/...': tags.comment } },
    { name: 'CommentBlock', block: true, style: { 'CommentBlock/...': tags.comment } },
    { name: 'CommentMark', style: tags.comment },
    { name: 'FootnoteReference', style: obsidianTags.footnote },
    { name: 'BlockId', style: tags.meta },
  ],
  parseBlock: [
    {
      name: 'BlockMath',
      before: 'FencedCode',
      parse: (cx, line) => fencedBlock(cx, line, '$$', 'BlockMath', 'MathMark'),
    },
    {
      name: 'CommentBlock',
      before: 'FencedCode',
      parse: (cx, line) => fencedBlock(cx, line, '%%', 'CommentBlock', 'CommentMark'),
    },
  ],
  parseInline: [
    {
      name: 'InlineMath',
      before: 'Emphasis',
      parse(cx, next, pos) {
        if (next !== DOLLAR) return -1
        if (cx.char(pos + 1) === DOLLAR)
          return fencedInline(cx, pos, '$$', 'InlineMath', 'MathMark')
        if (/\s/.test(cx.slice(pos + 1, pos + 2))) return -1
        // Like Obsidian: `$5 and $10` isn't math.
        const isValidClose = (at: number) =>
          !/\s/.test(cx.slice(at - 1, at)) && !/\d/.test(cx.slice(at + 1, at + 2))
        return fencedInline(cx, pos, '$', 'InlineMath', 'MathMark', isValidClose)
      },
    },
    {
      name: 'Comment',
      before: 'Emphasis',
      parse: (cx, next, pos) =>
        next === PERCENT && cx.char(pos + 1) === PERCENT
          ? fencedInline(cx, pos, '%%', 'Comment', 'CommentMark')
          : -1,
    },
    {
      name: 'Highlight',
      after: 'Emphasis',
      parse(cx, next, pos) {
        if (next !== EQUALS || cx.char(pos + 1) !== EQUALS || cx.char(pos + 2) === EQUALS) return -1
        const before = cx.slice(pos - 1, pos)
        const after = cx.slice(pos + 2, pos + 3)
        const spaceBefore = /\s|^$/.test(before)
        const spaceAfter = /\s|^$/.test(after)
        return cx.addDelimiter(HighlightDelimiter, pos, pos + 2, !spaceAfter, !spaceBefore)
      },
    },
    {
      name: 'FootnoteReference',
      before: 'Link',
      parse(cx, next, pos) {
        if (next !== OPEN_BRACKET || cx.char(pos + 1) !== CARET) return -1
        const close = cx.slice(pos, cx.end).indexOf(']')
        const label = cx.slice(pos + 2, pos + close)
        if (close <= 2 || /[\s\]]/.test(label)) return -1
        return cx.addElement(cx.elt('FootnoteReference', pos, pos + close + 1))
      },
    },
    {
      name: 'BlockId',
      parse(cx, next, pos) {
        if (next !== CARET || (pos > cx.offset && !/\s/.test(cx.slice(pos - 1, pos)))) return -1
        const id = /^\^[A-Za-z0-9-]+(?=[ \t]*(?:\n|$))/.exec(cx.slice(pos, cx.end))
        return id ? cx.addElement(cx.elt('BlockId', pos, pos + id[0].length)) : -1
      },
    },
  ],
}
