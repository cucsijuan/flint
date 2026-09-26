const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/
const HEADING_LINE = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const TASK_LINE = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])\]/

export interface NoteContent {
  text: string
  /** Line of the note where `text` starts. */
  firstLine: number
}

const lineCount = (text: string) => text.split('\n').length

/** The note without its frontmatter, or only the section under `heading`. */
export function noteContent(text: string, heading = ''): NoteContent {
  const body = text.replace(FRONTMATTER, '')
  const firstLine = lineCount(text) - lineCount(body)
  if (!heading) return { text: body, firstLine }
  const lines = body.split('\n')
  const wanted = heading.trim().toLowerCase()
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
