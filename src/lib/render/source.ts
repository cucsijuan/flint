const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/
const HEADING_LINE = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const TASK_LINE = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])\]/
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s/
export const BLOCK_ID = /(?:^|\s)\^([A-Za-z0-9-]+)\s*$/

export interface NoteContent {
  text: string
  /** Line of the note where `text` starts. */
  firstLine: number
}

const lineCount = (text: string) => text.split('\n').length
const isBlank = (line: string | undefined) => !line?.trim()
const indentOf = (line: string) => line.length - line.trimStart().length

/** Lines `[start, end)` of the block marked with `^id`, following Obsidian's rules. */
export function blockLines(lines: string[], id: string): [number, number] | null {
  const wanted = id.toLowerCase()
  const marker = lines.findIndex((line) => BLOCK_ID.exec(line)?.[1].toLowerCase() === wanted)
  if (marker === -1) return null
  if (LIST_ITEM.test(lines[marker])) {
    let end = marker + 1
    while (!isBlank(lines[end]) && indentOf(lines[end]) > indentOf(lines[marker])) end++
    return [marker, end]
  }
  // An id alone on its line, after a blank line, marks the block before it (tables, lists, quotes).
  let end = marker + 1
  if (lines[marker].trim().startsWith('^') && isBlank(lines[marker - 1])) {
    end = marker - 1
    while (end > 0 && isBlank(lines[end - 1])) end--
  }
  let start = end - 1
  while (start > 0 && !isBlank(lines[start - 1])) start--
  return start < end ? [start, end] : null
}

export interface BlockId {
  id: string
  /** The block's text, for showing it in suggestions. */
  text: string
}

export function blockIds(text: string): BlockId[] {
  const lines = text.split('\n')
  return lines.flatMap((line) => {
    const id = BLOCK_ID.exec(line)?.[1]
    const range = id ? blockLines(lines, id) : null
    if (!id || !range) return []
    const block = lines.slice(...range).map((line) => line.replace(BLOCK_ID, ''))
    return [{ id, text: block.join(' ').replace(/\s+/g, ' ').trim() }]
  })
}

/** The note without its frontmatter, or only the section under a heading or a `^block`. */
export function noteContent(text: string, subpath = ''): NoteContent {
  const body = text.replace(FRONTMATTER, '')
  const firstLine = lineCount(text) - lineCount(body)
  if (!subpath) return { text: body, firstLine }
  const lines = body.split('\n')
  if (subpath.startsWith('^')) {
    const range = blockLines(lines, subpath.slice(1))
    if (!range) return { text: '', firstLine }
    return { text: lines.slice(...range).join('\n'), firstLine: firstLine + range[0] }
  }
  const wanted = subpath.trim().toLowerCase()
  const start = lines.findIndex((line) => HEADING_LINE.exec(line)?.[2].toLowerCase() === wanted)
  if (start === -1) return { text: '', firstLine }
  const level = HEADING_LINE.exec(lines[start])?.[1].length ?? 1
  const end = lines.findIndex(
    (line, index) => index > start && (HEADING_LINE.exec(line)?.[1].length ?? 7) <= level,
  )
  return {
    text: lines.slice(start, end === -1 ? undefined : end).join('\n'),
    firstLine: firstLine + start,
  }
}

/** Replaces lines `start` (inclusive) to `end` (exclusive); an empty `replacement` removes them. */
export function replaceLines(text: string, start: number, end: number, replacement: string) {
  const lines = text.split('\n')
  lines.splice(start, end - start, ...(replacement ? replacement.split('\n') : []))
  return lines.join('\n')
}

export function toggleTask(text: string, line: number) {
  const lines = text.split('\n')
  const match = TASK_LINE.exec(lines[line] ?? '')
  if (!match) return null
  const [whole, prefix, mark] = match
  lines[line] = `${prefix}${mark === ' ' ? 'x' : ' '}]${lines[line].slice(whole.length)}`
  return lines.join('\n')
}
