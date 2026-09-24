import { tags } from '@lezer/highlight'
import type { MarkdownConfig } from '@lezer/markdown'

const HASH = 35
const TAG_CHAR = /[\p{L}\p{N}_/-]/u

export const hashtagSyntax: MarkdownConfig = {
  defineNodes: [{ name: 'Hashtag', style: tags.labelName }],
  parseInline: [
    {
      name: 'Hashtag',
      parse(cx, next, pos) {
        if (next !== HASH) return -1
        const previous = pos > cx.offset ? cx.char(pos - 1) : -1
        if (previous !== -1 && !/\s/.test(String.fromCharCode(previous))) return -1
        let end = pos + 1
        while (end < cx.end && TAG_CHAR.test(cx.slice(end, end + 1))) end++
        const tag = cx.slice(pos + 1, end)
        if (!tag || /^\d+$/.test(tag)) return -1
        return cx.addElement(cx.elt('Hashtag', pos, end))
      },
    },
  ],
}
