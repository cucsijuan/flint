export type Alignment = 'left' | 'center' | 'right' | null

/** A cell's trimmed text and where it sits in the table's source. */
export interface Cell {
  text: string
  from: number
  to: number
}

export interface Table {
  /** The header row first; rows shorter than the header lack their missing cells. */
  rows: Cell[][]
  alignments: Alignment[]
}

/** Plain cell texts, every row as wide as the header. */
export interface TableData {
  rows: string[][]
  alignments: Alignment[]
}

function splitRow(line: string, offset: number): Cell[] {
  const cells: Cell[] = []
  let start = 0
  const push = (end: number) => {
    const raw = line.slice(start, end)
    const leading = raw.length - raw.trimStart().length
    const text = raw.trim()
    const from = offset + start + leading
    cells.push({ text, from, to: from + text.length })
  }
  for (let index = 0; index < line.length; index++) {
    if (line[index] === '\\') index++
    else if (line[index] === '|') {
      push(index)
      start = index + 1
    }
  }
  push(line.length)
  const trimmed = line.trim()
  if (trimmed.startsWith('|')) cells.shift()
  if (trimmed.length > 1 && trimmed.endsWith('|') && !trimmed.endsWith('\\|')) cells.pop()
  return cells
}

function alignmentOf(delimiter: string): Alignment {
  const text = delimiter.trim()
  const left = text.startsWith(':')
  const right = text.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  return left ? 'left' : null
}

export function parseTable(markdown: string): Table {
  const rows: Cell[][] = []
  let alignments: Alignment[] = []
  let offset = 0
  markdown.split('\n').forEach((line, index) => {
    const cells = splitRow(line, offset)
    if (index === 1) alignments = cells.map((cell) => alignmentOf(cell.text))
    else if (line.trim()) rows.push(cells)
    offset += line.length + 1
  })
  const width = rows[0]?.length ?? 0
  return { rows: rows.map((row) => row.slice(0, width)), alignments: alignments.slice(0, width) }
}

export function tableData({ rows, alignments }: Table): TableData {
  const width = rows[0]?.length ?? 0
  return {
    rows: rows.map((row) => Array.from({ length: width }, (_, index) => row[index]?.text ?? '')),
    alignments: Array.from({ length: width }, (_, index) => alignments[index] ?? null),
  }
}

const DELIMITERS: Record<string, string> = {
  left: ':---',
  center: ':---:',
  right: '---:',
  null: '---',
}

export function formatTable({ rows, alignments }: TableData) {
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`
  const delimiter = line(alignments.map((alignment) => DELIMITERS[String(alignment)]))
  const [header = [], ...body] = rows
  return [line(header), delimiter, ...body.map(line)].join('\n')
}

/** Escapes pipes so typed text stays inside its cell, and keeps it on one line. */
export const cellSource = (text: string) =>
  text.replace(/\r?\n/g, ' ').replace(/(^|[^\\])\|/g, '$1\\|')

const move = <T>(items: T[], from: number, to: number) => {
  const moved = [...items]
  moved.splice(to, 0, ...moved.splice(from, 1))
  return moved
}

export const insertRow = (data: TableData, index: number): TableData => ({
  ...data,
  rows: data.rows.toSpliced(
    index,
    0,
    data.alignments.map(() => ''),
  ),
})

export const deleteRow = (data: TableData, index: number): TableData => ({
  ...data,
  rows: data.rows.toSpliced(index, 1),
})

export const moveRow = (data: TableData, from: number, to: number): TableData => ({
  ...data,
  rows: move(data.rows, from, to),
})

export const insertColumn = (data: TableData, index: number): TableData => ({
  rows: data.rows.map((row) => row.toSpliced(index, 0, '')),
  alignments: data.alignments.toSpliced(index, 0, null),
})

export const deleteColumn = (data: TableData, index: number): TableData => ({
  rows: data.rows.map((row) => row.toSpliced(index, 1)),
  alignments: data.alignments.toSpliced(index, 1),
})

export const moveColumn = (data: TableData, from: number, to: number): TableData => ({
  rows: data.rows.map((row) => move(row, from, to)),
  alignments: move(data.alignments, from, to),
})

export const alignColumn = (data: TableData, index: number, alignment: Alignment): TableData => ({
  ...data,
  alignments: data.alignments.with(index, alignment),
})
