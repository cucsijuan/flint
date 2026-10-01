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

export interface NoteBlock {
  id: string | null
  /** The block's text, for showing it in suggestions. */
  text: string
  /** The line that holds the block's id, or would. */
  line: number
  /** Tables and quotes take their id on a line of its own after them. */
  isStandalone: boolean
}

const FENCE = /^\s*(?:```|~~~)/
const STANDALONE_ID = /^\s*\^([A-Za-z0-9-]+)\s*$/
const flatten = (lines: string[]) =>
  lines
    .map((line) => line.replace(BLOCK_ID, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Every paragraph, list item, table and quote of a note, with its `^id` if it has one. */
export function noteBlocks(text: string): NoteBlock[] {
  const lines = text.split('\n')
  const blocks: NoteBlock[] = []
  let run: number[] = []
  let isInFence = false
  const flush = () => {
    const last = run.at(-1)
    if (last === undefined) return
    const isStandalone = /^\s*[|>]/.test(lines[run[0]])
    blocks.push({
      id: isStandalone ? null : (BLOCK_ID.exec(lines[last])?.[1] ?? null),
      text: flatten(run.map((index) => lines[index])),
      line: last,
      isStandalone,
    })
    run = []
  }
  const start = lineCount(text) - lineCount(text.replace(FRONTMATTER, ''))
  for (let index = start; index < lines.length; index++) {
    const line = lines[index]
    if (FENCE.test(line)) isInFence = !isInFence
    const standaloneId = STANDALONE_ID.exec(line)?.[1]
    const previous = blocks.at(-1)
    if (standaloneId && !run.length && isBlank(lines[index - 1]) && previous?.isStandalone) {
      previous.id = standaloneId
    } else if (isInFence || FENCE.test(line) || isBlank(line) || HEADING_LINE.test(line)) {
      flush()
    } else if (LIST_ITEM.test(line)) {
      flush()
      const id = BLOCK_ID.exec(line)?.[1] ?? null
      const text = flatten([line.replace(LIST_ITEM, '').replace(/^\[[ xX]\]\s*/, '')])
      blocks.push({ id, text, line: index, isStandalone: false })
    } else if (!(run.length === 0 && indentOf(line) > 0 && previous && !previous.isStandalone)) {
      run.push(index)
    }
  }
  flush()
  return blocks
}

/** `text` with `id` added to `block`, following Obsidian's rules for where ids go. */
export function withBlockId(text: string, block: NoteBlock, id: string) {
  const lines = text.split('\n')
  if (block.isStandalone) lines.splice(block.line + 1, 0, '', `^${id}`)
  else lines[block.line] = `${lines[block.line].trimEnd()} ^${id}`
  return lines.join('\n')
}

/** A new block id, six random letters and digits like Obsidian's. */
export const newBlockId = () => Math.random().toString(36).slice(2, 8).padEnd(6, '0')

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

const FENCE_LINE = /^((?:[ \t]*>)*[ \t]*)(`{3,}|~{3,})/

/** `text` with the inside of the fenced block on lines `[start, end)` replaced, keeping its
 * fences and the `> ` or indentation that puts it in a quote or a list. */
export function replaceFencedContent(text: string, start: number, end: number, content: string) {
  const lines = text.split('\n')
  const opening = FENCE_LINE.exec(lines[start] ?? '')
  if (!opening) return null
  const [, prefix, fence] = opening
  const closing = FENCE_LINE.exec(lines[end - 1] ?? '')
  const isClosed = end - 1 > start && closing?.[2].startsWith(fence[0]) === true
  const inner = content
    .trimEnd()
    .split('\n')
    .map((line) => (line ? prefix + line : prefix.trimEnd()))
  lines.splice(start + 1, (isClosed ? end - 1 : end) - start - 1, ...inner)
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

/** `text` with `block` on its own lines after line `line` (0-based), or at the end without one. */
export function insertBlockAfter(text: string, line: number | null, block: string) {
  const lines = text.split('\n')
  const at = line === null ? lines.length : Math.min(line, lines.length)
  const before = at > 0 && lines[at - 1].trim() !== '' ? [''] : []
  const after = at < lines.length && lines[at].trim() !== '' ? [''] : []
  lines.splice(at, 0, ...before, block, ...after)
  return lines.join('\n')
}
