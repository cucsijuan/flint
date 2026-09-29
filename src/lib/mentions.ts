const LINKED = /\[\[[^\]]*\]\]|\[[^\]]*\]\([^)]*\)|`[^`]*`|[a-zA-Z][a-zA-Z0-9+.-]*:\/\/\S+/g
const WORD = /[\p{L}\p{N}_]/u

/** `text` with the first unlinked `mention` on its 1-based `line` turned into a link, or null. */
export function linkMention(text: string, line: number, mention: string, linkText: string) {
  const lines = text.split('\n')
  const content = lines[line - 1]
  if (content === undefined) return null
  const linked = [...content.matchAll(LINKED)].map((found) => [
    found.index,
    found.index + found[0].length,
  ])
  for (let start = content.indexOf(mention); start !== -1;) {
    const end = start + mention.length
    const isWord = !WORD.test(content[start - 1] ?? '') && !WORD.test(content[end] ?? '')
    const isLinked = linked.some(([from, to]) => start < to && from < end)
    if (isWord && !isLinked) {
      const link = mention === linkText ? `[[${linkText}]]` : `[[${linkText}|${mention}]]`
      lines[line - 1] = content.slice(0, start) + link + content.slice(end)
      return lines.join('\n')
    }
    start = content.indexOf(mention, start + 1)
  }
  return null
}
