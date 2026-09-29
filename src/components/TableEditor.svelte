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
  import { GripHorizontal, GripVertical } from '@lucide/svelte'
  import { DropdownMenu } from 'bits-ui'
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
  import { hydrate, type HydrateContext } from '../lib/render/hydrate'
  import { renderInlineMarkdown } from '../lib/render/markdown'

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

  function onKeydown(event: KeyboardEvent, row: number, column: number) {
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

{#snippet grip(label: string, vertical: boolean, items: [string, () => void, boolean?][])}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger class="table-grip {vertical ? 'row-grip' : 'column-grip'}" title={label}>
      {#if vertical}<GripVertical size={12} />{:else}<GripHorizontal size={12} />{/if}
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content class="menu" align="start">
        {#each items as [name, run, isDisabled] (name)}
          {#if name === '-'}
            <DropdownMenu.Separator class="menu-separator" />
          {:else}
            <DropdownMenu.Item class="menu-item" disabled={isDisabled} onSelect={run}>
              {name}
            </DropdownMenu.Item>
          {/if}
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
{/snippet}

<table class="table-editor" data-interactive>
  <thead>
    <tr>
      {#each data.rows[0] ?? [] as text, column (column)}
        <th style:text-align={data.alignments[column]}>
          {@render grip('Column', false, [
            ['Add column before', () => edits.replace(insertColumn(data, column))],
            ['Add column after', () => edits.replace(insertColumn(data, column + 1))],
            ['-', () => {}],
            [
              'Move column left',
              () => edits.replace(moveColumn(data, column, column - 1)),
              column === 0,
            ],
            [
              'Move column right',
              () => edits.replace(moveColumn(data, column, column + 1)),
              column === width - 1,
            ],
            ['-', () => {}],
            ['Align left', () => align(column, 'left')],
            ['Align center', () => align(column, 'center')],
            ['Align right', () => align(column, 'right')],
            ['-', () => {}],
            ['Delete column', () => edits.replace(deleteColumn(data, column)), width === 1],
          ])}
          {#if column === 0}
            {@render grip('Row', true, [
              ['Add row below', () => edits.replace(insertRow(data, 1))],
            ])}
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
          <td style:text-align={data.alignments[column]}>
            {#if column === 0}
              {@render grip('Row', true, [
                ['Add row above', () => edits.replace(insertRow(data, row))],
                ['Add row below', () => edits.replace(insertRow(data, row + 1))],
                ['-', () => {}],
                ['Move row up', () => edits.replace(moveRow(data, row, row - 1)), row === 1],
                [
                  'Move row down',
                  () => edits.replace(moveRow(data, row, row + 1)),
                  row === data.rows.length - 1,
                ],
                ['-', () => {}],
                ['Delete row', () => edits.replace(deleteRow(data, row))],
              ])}
            {/if}
            {@render cell(row, column, text)}
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

<style>
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

  tr:hover :global(.row-grip),
  th:hover :global(.column-grip),
  :global(.table-grip[data-state='open']) {
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
