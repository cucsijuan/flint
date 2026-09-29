import type { Text } from '@codemirror/state'

const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s/
const TAB_WIDTH = 4

function indentOf(text: string) {
  let column = 0
  for (const char of text) {
    if (char === ' ') column++
    else if (char === '\t') column += TAB_WIDTH
    else break
  }
  return column
}

export const isListItem = (text: string) => LIST_ITEM.test(text)

/** The last line of the list item on line `number` and its sub-items; `number` itself when it has none. */
export function subItemsEnd(doc: Text, number: number) {
  const { text } = doc.line(number)
  if (!isListItem(text)) return number
  const indent = indentOf(text)
  let last = number
  for (let next = number + 1; next <= doc.lines; next++) {
    const line = doc.line(next).text
    if (!line.trim()) continue
    if (indentOf(line) <= indent) break
    last = next
  }
  return last
}

/** The first line of the sibling item above `number`, skipping over that item's sub-items. */
export function previousSiblingStart(doc: Text, number: number) {
  const { text } = doc.line(number)
  let top = number - 1
  if (!isListItem(text)) return top
  const indent = indentOf(text)
  while (top > 1 && doc.line(top).text.trim() && indentOf(doc.line(top).text) > indent) top--
  return top
}
