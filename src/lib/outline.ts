import { markdownLanguage } from '@codemirror/lang-markdown'
import { noteContent } from './render/source'

export interface OutlineHeading {
  level: number
  text: string
  /** 1-based line in the note. */
  line: number
}

const HEADING = /^(?:ATX|Setext)Heading(\d)$/

export function outlineOf(note: string): OutlineHeading[] {
  const { text, firstLine } = noteContent(note)
  const headings: OutlineHeading[] = []
  markdownLanguage.parser.parse(text).iterate({
    enter: (node) => {
      const level = HEADING.exec(node.name)?.[1]
      if (!level) return
      const marks = node.node.getChildren('HeaderMark')
      const opening = marks[0]?.from === node.from ? marks[0] : null
      const closing = marks.at(-1) === opening ? null : marks.at(-1)
      const from = opening?.to ?? node.from
      const to = closing?.from ?? node.to
      headings.push({
        level: Number(level),
        text: text.slice(from, to).trim(),
        line: firstLine + text.slice(0, node.from).split('\n').length,
      })
      return false
    },
  })
  return headings
}
