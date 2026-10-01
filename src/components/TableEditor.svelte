<script lang="ts" module>
  import type { TableData } from '../lib/editor/table'

  export interface TableEdits {
    /** Replaces one cell's source text. */
    cell: (row: number, column: number, text: string) => void
    /** Rewrites the whole table. */
    replace: (data: TableData) => void
    /** Returns the keyboard to the note. */
    leave: () => void
  }
</script>

<script lang="ts">
  import {
    alignColumn,
    type Alignment,
    cellSource,
    deleteColumn,
    deleteRow,
    insertColumn,
    insertRow,
    moveColumn,
    moveRow,
    parseTable,
    tableData,
  } from '../lib/editor/table'
  import { commands, hotkeyOf } from '../lib/commands.svelte'
  import { toggleWrapText } from '../lib/editor/formatting'
  import { hydrate, type HydrateContext } from '../lib/render/hydrate'
  import { renderInlineMarkdown } from '../lib/render/markdown'
  import TableGrip, { type GripItem } from './TableGrip.svelte'

  let {
    markdown,
    context,
    edits,
  }: { markdown: string; context: HydrateContext; edits: TableEdits } = $props()

  const data = $derived(tableData(parseTable(markdown)))
  const width = $derived(data.alignments.length)
  let editing = $state<{ row: number; column: number } | null>(null)
  let draft = $state('')

  const isEditing = (row: number, column: number) =>
    editing?.row === row && editing.column === column

  function edit(row: number, column: number) {
    if (row >= data.rows.length) edits.replace(insertRow(data, data.rows.length))
    editing = { row, column }
    draft = data.rows[row]?.[column] ?? ''
  }

  function startEditing(event: MouseEvent, row: number, column: number) {
    if ((event.target as HTMLElement).closest('a, [data-link], [data-tag], input')) return
    event.preventDefault()
    edit(row, column)
  }

  /** Formatting commands, applied to the cell instead of the note around the table. */
  const CELL_FORMATS: Record<string, [string, string]> = {
    'toggle-bold': ['**', '**'],
    'toggle-italic': ['*', '*'],
    'toggle-strikethrough': ['~~', '~~'],
    'toggle-inline-code': ['`', '`'],
    'insert-link': ['[[', ']]'],
  }

  function format(event: KeyboardEvent, row: number, column: number) {
    const hotkey = hotkeyOf(event)
    const command = commands
      .all()
      .find((known) => known.id in CELL_FORMATS && known.hotkey === hotkey)
    if (!command) return false
    event.preventDefault()
    const input = event.currentTarget as HTMLTextAreaElement
    const [open, close] = CELL_FORMATS[command.id]
    const result =
      open === close
        ? toggleWrapText(draft, input.selectionStart, input.selectionEnd, open)
        : {
            text: `${draft.slice(0, input.selectionStart)}${open}${draft.slice(input.selectionStart, input.selectionEnd)}${close}${draft.slice(input.selectionEnd)}`,
            from: input.selectionEnd + open.length,
            to: input.selectionEnd + open.length,
          }
    draft = result.text
    edits.cell(row, column, cellSource(draft))
    requestAnimationFrame(() => input.setSelectionRange(result.from, result.to))
    return true
  }

  function onKeydown(event: KeyboardEvent, row: number, column: number) {
    if (format(event, row, column)) return
    if (event.key === 'Tab') {
      event.preventDefault()
      const index = row * width + column + (event.shiftKey ? -1 : 1)
      if (index >= 0) edit(Math.floor(index / width), index % width)
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      edit(row + 1, column)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      editing = null
      edits.leave()
    }
  }

  function stopEditing(row: number, column: number) {
    if (isEditing(row, column)) editing = null
  }

  const rendered = (text: string) => (element: HTMLElement) => {
    element.innerHTML = renderInlineMarkdown(text)
    void hydrate(element, context)
  }

  const focus = (element: HTMLTextAreaElement) => {
    element.focus()
    element.setSelectionRange(element.value.length, element.value.length)
  }

  const align = (column: number, alignment: Alignment) =>
    edits.replace(alignColumn(data, column, alignment))

  let hovered = $state<{ row: number; column: number } | null>(null)

  const rowItems = (row: number): GripItem[] => [
    ['Add row above', () => edits.replace(insertRow(data, row))],
    ['Add row below', () => edits.replace(insertRow(data, row + 1))],
    null,
    ['Move row up', () => edits.replace(moveRow(data, row, row - 1)), row === 1],
    [
      'Move row down',
      () => edits.replace(moveRow(data, row, row + 1)),
      row === data.rows.length - 1,
    ],
    null,
    ['Delete row', () => edits.replace(deleteRow(data, row))],
  ]

  const columnItems = (column: number): GripItem[] => [
    ['Add column before', () => edits.replace(insertColumn(data, column))],
    ['Add column after', () => edits.replace(insertColumn(data, column + 1))],
    null,
    ['Move column left', () => edits.replace(moveColumn(data, column, column - 1)), column === 0],
    [
      'Move column right',
      () => edits.replace(moveColumn(data, column, column + 1)),
      column === width - 1,
    ],
    null,
    ['Align left', () => align(column, 'left')],
    ['Align center', () => align(column, 'center')],
    ['Align right', () => align(column, 'right')],
    null,
    ['Delete column', () => edits.replace(deleteColumn(data, column)), width === 1],
  ]
</script>

{#snippet cell(row: number, column: number, text: string)}
  {#if isEditing(row, column)}
    <textarea
      class="cell-input"
      rows="1"
      data-table-cell
      bind:value={draft}
      oninput={() => edits.cell(row, column, cellSource(draft))}
      onkeydown={(event) => onKeydown(event, row, column)}
      onblur={() => stopEditing(row, column)}
      {@attach focus}></textarea>
  {:else}
    <div
      class="cell"
      role="textbox"
      tabindex="-1"
      onmousedown={(event) => startEditing(event, row, column)}
      {@attach rendered(text)}
    ></div>
  {/if}
{/snippet}

<div class="table-wrap" data-interactive>
  <table class="table-editor" onmouseleave={() => (hovered = null)}>
    <thead>
      <tr>
        {#each data.rows[0] ?? [] as text, column (column)}
          <th
            style:text-align={data.alignments[column]}
            onmouseenter={() => (hovered = { row: 0, column })}
          >
            <TableGrip
              label="Column"
              kind="column"
              isShown={hovered?.column === column}
              items={columnItems(column)}
            />
            {#if column === 0}
              <TableGrip
                label="Row"
                kind="row"
                isShown={hovered?.row === 0}
                items={[['Add row below', () => edits.replace(insertRow(data, 1))]]}
              />
            {/if}
            {@render cell(0, column, text)}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each data.rows.slice(1) as cells, index (index)}
        {@const row = index + 1}
        <tr>
          {#each cells as text, column (column)}
            <td
              style:text-align={data.alignments[column]}
              onmouseenter={() => (hovered = { row, column })}
            >
              {#if column === 0}
                <TableGrip
                  label="Row"
                  kind="row"
                  isShown={hovered?.row === row}
                  items={rowItems(row)}
                />
              {/if}
              {@render cell(row, column, text)}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
  <button
    class="add add-column"
    title="Add column"
    onclick={() => edits.replace(insertColumn(data, width))}>+</button
  >
  <button
    class="add add-row"
    title="Add row"
    onclick={() => edits.replace(insertRow(data, data.rows.length))}>+</button
  >
</div>

<style>
  .table-wrap {
    display: inline-grid;
    grid-template-columns: auto 18px;
    grid-template-rows: auto 18px;
    max-width: 100%;
    padding-top: 0.5em;
  }

  .table-wrap > :global(table) {
    margin: 0;
  }

  .add {
    padding: 0;
    border: none;
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text-muted);
    font: inherit;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
  }

  .table-wrap:hover .add {
    opacity: 1;
  }

  .add:hover {
    background: var(--hover);
    color: var(--text);
  }

  .add-column {
    grid-row: 1;
    grid-column: 2;
    margin-left: 2px;
  }

  .add-row {
    grid-row: 2;
    grid-column: 1;
    margin-top: 2px;
  }

  .table-editor th,
  .table-editor td {
    position: relative;
    min-width: 3em;
  }

  .cell {
    min-height: 1.4em;
    cursor: text;
    outline: none;
  }

  .cell-input {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    text-align: inherit;
    field-sizing: content;
    resize: none;
    outline: none;
  }

  :global(.table-grip[data-shown]) {
    opacity: 1;
  }

  :global(.table-grip) {
    position: absolute;
    display: grid;
    place-items: center;
    padding: 2px;
    border: none;
    border-radius: 3px;
    background: var(--background-secondary);
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0;
  }

  :global(.table-grip:hover) {
    background: var(--hover);
  }

  :global(.row-grip) {
    top: 50%;
    left: -20px;
    transform: translateY(-50%);
  }

  :global(.column-grip) {
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
  }
</style>
