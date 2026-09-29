<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import {
    type BaseConfig,
    type Context,
    type PropertyType,
    propertyId,
    propertyName,
    type QueryResult,
    SUMMARIES,
    summarize,
    valueOf,
    type ViewConfig,
  } from '../../lib/bases/base'
  import { display, ExpressionError, FileValue } from '../../lib/bases/expression'
  import BaseCell from './BaseCell.svelte'

  const DEFAULT_WIDTH = 180
  const MIN_WIDTH = 60

  let {
    result,
    columns,
    config,
    view,
    context,
    types,
    edit,
  }: {
    result: QueryResult
    columns: string[]
    config: BaseConfig
    view: ViewConfig
    context: Context
    types: Record<string, PropertyType>
    edit: (change: (view: ViewConfig) => void) => void
  } = $props()

  let dragged = $state<number | null>(null)
  let resizing = $state<{ id: string; width: number } | null>(null)

  const widthOf = (id: string) =>
    resizing?.id === id ? resizing.width : (view.columnSize?.[id] ?? DEFAULT_WIDTH)
  const typeOf = (id: string) => {
    const full = propertyId(id)
    return full.startsWith('note.') ? types[full.slice('note.'.length)] : undefined
  }
  const summaryNames = $derived([...Object.keys(SUMMARIES), ...Object.keys(config.summaries ?? {})])

  function sortBy(id: string, direction: 'ASC' | 'DESC') {
    edit((view) => (view.sort = [{ property: id, direction }]))
  }

  function drop(target: number) {
    if (dragged === null || dragged === target) return
    const order = [...columns]
    order.splice(target, 0, ...order.splice(dragged, 1))
    edit((view) => (view.order = order))
    dragged = null
  }

  function startResize(event: PointerEvent, id: string) {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = widthOf(id)
    const move = (moved: PointerEvent) => {
      resizing = { id, width: Math.max(MIN_WIDTH, startWidth + moved.clientX - startX) }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const width = resizing?.width
      resizing = null
      if (width) edit((view) => (view.columnSize = { ...view.columnSize, [id]: width }))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function setSummary(id: string, name: string) {
    edit((view) => {
      const others = Object.entries(view.summaries ?? {}).filter(([column]) => column !== id)
      view.summaries = Object.fromEntries(name ? [...others, [id, name]] : others)
    })
  }

  const values = (id: string) =>
    result.groups
      .flatMap((group) => group.rows)
      .map((row) => valueOf(row, id, context))
      .map((value) => (value instanceof ExpressionError ? null : value))
</script>

<div class="table-scroll">
  <table style:width="{columns.reduce((sum, id) => sum + widthOf(id), 0)}px">
    <colgroup>
      {#each columns as id (id)}<col style:width="{widthOf(id)}px" />{/each}
    </colgroup>
    <thead>
      <tr>
        {#each columns as id, index (id)}
          <th
            draggable="true"
            class:drop-target={dragged !== null && dragged !== index}
            ondragstart={() => (dragged = index)}
            ondragend={() => (dragged = null)}
            ondragover={(event) => event.preventDefault()}
            ondrop={() => drop(index)}
          >
            <DropdownMenu.Root>
              <DropdownMenu.Trigger class="column-name"
                >{propertyName(id, config)}</DropdownMenu.Trigger
              >
              <DropdownMenu.Portal>
                <DropdownMenu.Content class="menu" align="start">
                  <DropdownMenu.Item class="menu-item" onSelect={() => sortBy(id, 'ASC')}>
                    Sort ascending
                  </DropdownMenu.Item>
                  <DropdownMenu.Item class="menu-item" onSelect={() => sortBy(id, 'DESC')}>
                    Sort descending
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    class="menu-item"
                    onSelect={() =>
                      edit((view) => (view.groupBy = { property: id, direction: 'ASC' }))}
                  >
                    Group by this property
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator class="menu-separator" />
                  <DropdownMenu.Item
                    class="menu-item"
                    onSelect={() =>
                      edit((view) => (view.order = columns.filter((other) => other !== id)))}
                  >
                    Hide column
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <span
              class="resizer"
              role="separator"
              aria-orientation="vertical"
              onpointerdown={(event) => startResize(event, id)}
            ></span>
          </th>
        {/each}
      </tr>
    </thead>
    {#each result.groups as group, groupIndex (groupIndex)}
      <tbody>
        {#if view.groupBy}
          <tr class="group">
            <td colspan={columns.length}>
              <strong>{display(group.key) || 'None'}</strong>
              <span class="count">{group.rows.length}</span>
            </td>
          </tr>
        {/if}
        {#each group.rows as row (row.file.path)}
          <tr>
            {#each columns as id (id)}
              <td>
                <BaseCell
                  {row}
                  id={propertyId(id)}
                  value={propertyId(id) === 'file.name'
                    ? new FileValue(row.file)
                    : valueOf(row, id, context)}
                  type={typeOf(id)}
                />
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    {/each}
    <tfoot>
      <tr>
        {#each columns as id (id)}
          {@const name = view.summaries?.[id] ?? view.summaries?.[propertyId(id)] ?? ''}
          <td>
            <select
              class="summary"
              class:set={name}
              value={name}
              onchange={(event) => setSummary(id, event.currentTarget.value)}
            >
              <option value="">{name ? 'None' : 'Summarize'}</option>
              {#each summaryNames as summary (summary)}
                <option value={summary}>{summary}</option>
              {/each}
            </select>
            {#if name}<span class="summary-value"
                >{summarize(name, values(id), config, context)}</span
              >{/if}
          </td>
        {/each}
      </tr>
    </tfoot>
  </table>
</div>

<style>
  .table-scroll {
    overflow: auto;
  }

  table {
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 13px;
  }

  th,
  td {
    position: relative;
    padding: 5px 8px;
    border: 1px solid var(--border);
    overflow: hidden;
    text-align: left;
    vertical-align: top;
  }

  th {
    background: var(--background-secondary);
    font-weight: 600;
    cursor: grab;
  }

  th.drop-target {
    box-shadow: inset 2px 0 0 var(--accent);
  }

  :global(.column-name) {
    width: 100%;
    padding: 0;
    overflow: hidden;
    border: none;
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  .resizer {
    position: absolute;
    top: 0;
    right: 0;
    width: 6px;
    height: 100%;
    cursor: col-resize;
  }

  .resizer:hover {
    background: var(--accent);
  }

  .group td {
    background: var(--background-secondary);
  }

  .count {
    margin-left: 6px;
    color: var(--text-faint);
  }

  tfoot td {
    border-top: 2px solid var(--border);
    color: var(--text-muted);
  }

  .summary {
    max-width: 100%;
    border: none;
    background: none;
    color: var(--text-faint);
    font: inherit;
    font-size: 12px;
  }

  .summary.set {
    color: var(--text-muted);
  }

  .summary-value {
    display: block;
    color: var(--text);
    font-weight: 600;
  }
</style>
