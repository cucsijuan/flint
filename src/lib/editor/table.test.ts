import { describe, expect, it } from 'vitest'
import {
  alignColumn,
  cellSource,
  deleteColumn,
  deleteRow,
  formatTable,
  insertColumn,
  insertRow,
  moveColumn,
  moveRow,
  parseTable,
  tableData,
} from './table'

const markdown = '| Name | Price |\n| :--- | ---: |\n| Tea  | 3 |\n| Cake \\| pie | 5 |'

describe('parseTable', () => {
  it('reads cells with their source positions', () => {
    const { rows } = parseTable(markdown)
    expect(rows.map((row) => row.map((cell) => cell.text))).toEqual([
      ['Name', 'Price'],
      ['Tea', '3'],
      ['Cake \\| pie', '5'],
    ])
    const tea = rows[1][0]
    expect(markdown.slice(tea.from, tea.to)).toBe('Tea')
  })

  it('reads alignments and tables without edge pipes', () => {
    expect(parseTable(markdown).alignments).toEqual(['left', 'right'])
    const bare = parseTable('a | b\n:-: | -\n1 | 2')
    expect(bare.alignments).toEqual(['center', null])
    expect(bare.rows[1].map((cell) => cell.text)).toEqual(['1', '2'])
  })

  it('pads short rows and drops extra cells', () => {
    const data = tableData(parseTable('| a | b |\n| - | - |\n| 1 |\n| 1 | 2 | 3 |'))
    expect(data.rows).toEqual([
      ['a', 'b'],
      ['1', ''],
      ['1', '2'],
    ])
  })
})

describe('table edits', () => {
  const data = tableData(parseTable(markdown))

  it('formats a table back to Markdown', () => {
    expect(formatTable(data)).toBe(
      '| Name | Price |\n| :--- | ---: |\n| Tea | 3 |\n| Cake \\| pie | 5 |',
    )
  })

  it('inserts, deletes and moves rows', () => {
    expect(insertRow(data, 2).rows[2]).toEqual(['', ''])
    expect(deleteRow(data, 1).rows).toHaveLength(2)
    expect(moveRow(data, 2, 1).rows.map((row) => row[0])).toEqual(['Name', 'Cake \\| pie', 'Tea'])
  })

  it('inserts, deletes, moves and aligns columns', () => {
    expect(insertColumn(data, 1)).toMatchObject({
      rows: [
        ['Name', '', 'Price'],
        ['Tea', '', '3'],
        ['Cake \\| pie', '', '5'],
      ],
      alignments: ['left', null, 'right'],
    })
    expect(deleteColumn(data, 0)).toMatchObject({ rows: [['Price'], ['3'], ['5']] })
    expect(moveColumn(data, 1, 0).alignments).toEqual(['right', 'left'])
    expect(alignColumn(data, 0, 'center').alignments).toEqual(['center', 'right'])
  })

  it('keeps typed text inside its cell', () => {
    expect(cellSource('a | b\nc \\| d')).toBe('a \\| b c \\| d')
  })
})
