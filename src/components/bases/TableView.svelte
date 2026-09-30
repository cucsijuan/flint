<script lang="ts">
  import { Check } from '@lucide/svelte'
  import { ContextMenu } from 'bits-ui'
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
  import { workspace } from '../../lib/workspace.svelte'
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

  const DRAG_THRESHOLD = 4
  const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'multitext', label: 'List' },
    { value: 'number', label: 'Number' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'date', label: 'Date' },
    { value: 'datetime', label: 'Date & time' },
  ]

  const headers: HTMLTableCellElement[] = $state([])
  let moving = $state<{ from: number; over: number } | null>(null)
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

  /** A copy of the header that follows the pointer while a column is dragged. */
  function ghostOf(header: HTMLElement) {
    const { width, height } = header.getBoundingClientRect()
    const ghost = document.createElement('div')
    ghost.className = 'column-ghost'
    ghost.textContent = header.textContent
    Object.assign(ghost.style, { width: `${width}px`, height: `${height}px` })
    document.body.append(ghost)
    return ghost
  }

  /** Drags a column header to a new place; a press without movement is left alone. */
  function startMove(event: PointerEvent, from: number) {
    if (event.button !== 0) return
    event.preventDefault()
    const header = headers[from]
    const startX = event.clientX
    const offsetX = event.clientX - header.getBoundingClientRect().left
    const offsetY = event.clientY - header.getBoundingClientRect().top
    let ghost: HTMLElement | null = null
    const move = (moved: PointerEvent) => {
      if (!ghost && Math.abs(moved.clientX - startX) < DRAG_THRESHOLD) return
      if (!ghost) {
        ghost = ghostOf(header)
        document.body.classList.add('is-dragging-column')
        window.getSelection()?.removeAllRanges()
      }
      ghost.style.transform = `translate(${moved.clientX - offsetX}px, ${moved.clientY - offsetY}px)`
      const over = headers.findIndex((candidate) => {
        const { left, right } = candidate.getBoundingClientRect()
        return moved.clientX >= left && moved.clientX < right
      })
      moving = { from, over: over === -1 ? (moving?.over ?? from) : over }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      ghost?.remove()
      document.body.classList.remove('is-dragging-column')
      const done = moving
      moving = null
      if (!done || done.over === done.from) return
      const order = [...columns]
      order.splice(done.over, 0, ...order.splice(done.from, 1))
      edit((view) => (view.order = order))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
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
            bind:this={headers[index]}
            class:dragging={moving?.from === index}
            class:drop-before={moving && moving.over === index && moving.over < moving.from}
            class:drop-after={moving && moving.over === index && moving.over > moving.from}
            onpointerdown={(event) => startMove(event, index)}
          >
            <ContextMenu.Root>
              <ContextMenu.Trigger class="column-name"
                >{propertyName(id, config)}</ContextMenu.Trigger
              >
              <ContextMenu.Portal>
                <ContextMenu.Content class="menu">
                  <ContextMenu.Item class="menu-item" onSelect={() => sortBy(id, 'ASC')}>
                    Sort ascending
                  </ContextMenu.Item>
                  <ContextMenu.Item class="menu-item" onSelect={() => sortBy(id, 'DESC')}>
                    Sort descending
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    class="menu-item"
                    onSelect={() =>
                      edit((view) => (view.groupBy = { property: id, direction: 'ASC' }))}
                  >
                    Group by this property
                  </ContextMenu.Item>
                  {#if propertyId(id).startsWith('note.')}
                    {@const name = propertyId(id).slice('note.'.length)}
                    <ContextMenu.Sub>
                      <ContextMenu.SubTrigger class="menu-item"
                        >Property type</ContextMenu.SubTrigger
                      >
                      <ContextMenu.SubContent class="menu">
                        {#each PROPERTY_TYPES as type (type.value)}
                          <ContextMenu.Item
                            class="menu-item type-item"
                            onSelect={() => workspace.setPropertyType(name, type.value)}
                          >
                            <span class="check">
                              {#if types[name] === type.value}<Check size={14} />{/if}
                            </span>
                            {type.label}
                          </ContextMenu.Item>
                        {/each}
                      </ContextMenu.SubContent>
                    </ContextMenu.Sub>
                  {/if}
                  <ContextMenu.Separator class="menu-separator" />
                  <ContextMenu.Item
                    class="menu-item"
                    onSelect={() =>
                      edit((view) => (view.order = columns.filter((other) => other !== id)))}
                  >
                    Hide column
                  </ContextMenu.Item>
                </ContextMenu.Content>
              </ContextMenu.Portal>
            </ContextMenu.Root>
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
    user-select: none;
  }

  th.dragging {
    opacity: 0.35;
  }

  :global(.type-item) {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .check {
    display: inline-flex;
    width: 14px;
  }

  :global(.column-ghost) {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
    box-sizing: border-box;
    padding: 5px 8px;
    overflow: hidden;
    border: 1px solid var(--accent);
    border-radius: 4px;
    background: var(--background-secondary);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    opacity: 0.9;
    pointer-events: none;
  }

  :global(body.is-dragging-column) {
    cursor: grabbing;
    user-select: none;
  }

  th.drop-before {
    box-shadow: inset 3px 0 0 var(--accent);
  }

  th.drop-after {
    box-shadow: inset -3px 0 0 var(--accent);
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
    cursor: inherit;
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
