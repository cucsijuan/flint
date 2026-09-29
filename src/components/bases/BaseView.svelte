<script lang="ts">
  import { ArrowUpDown, Columns3, Filter, Group, Plus, Settings2, Trash2 } from '@lucide/svelte'
  import { DropdownMenu, Popover } from 'bits-ui'
  import {
    type BaseConfig,
    type Context,
    type Direction,
    parseBase,
    propertyId,
    propertyName,
    query,
    rowFor,
    type ViewConfig,
    type ViewType,
  } from '../../lib/bases/base'
  import { baseData } from '../../lib/bases/data.svelte'
  import { newNoteDefaults, updateBase } from '../../lib/bases/edit'
  import { fromGroup, toGroup } from '../../lib/bases/filters'
  import { workspace } from '../../lib/workspace.svelte'
  import CardsView from './CardsView.svelte'
  import FilterGroupEditor from './FilterGroupEditor.svelte'
  import ListView from './ListView.svelte'
  import MapView from './MapView.svelte'
  import TableView from './TableView.svelte'

  const FILE_PROPERTIES = [
    'file.name',
    'file.basename',
    'file.path',
    'file.folder',
    'file.ext',
    'file.size',
    'file.ctime',
    'file.mtime',
    'file.tags',
    'file.links',
    'file.backlinks',
    'file.embeds',
  ]
  const VIEW_TYPES: { value: ViewType; label: string }[] = [
    { value: 'table', label: 'Table' },
    { value: 'cards', label: 'Cards' },
    { value: 'list', label: 'List' },
    { value: 'map', label: 'Map' },
  ]
  const DEFAULT_COLUMNS = 5

  let {
    source,
    onchange,
    currentPath = null,
  }: {
    source: string
    onchange: (source: string) => void
    /** The base file or the note embedding the base, for `this`. */
    currentPath?: string | null
  } = $props()

  let viewIndex = $state(0)
  let filterScope = $state<'view' | 'all'>('view')
  let newFormula = $state({ name: '', expression: '' })

  const parsed = $derived.by((): { config: BaseConfig; error: string | null } => {
    try {
      return { config: parseBase(source), error: null }
    } catch (error) {
      return { config: parseBase(''), error: String(error) }
    }
  })
  const config = $derived(parsed.config)
  const index = $derived(Math.min(viewIndex, config.views.length - 1))
  const view = $derived(config.views[index])

  $effect(() => {
    void baseData.load(workspace.indexVersion)
  })

  const types = $derived(workspace.typesConfig.value.types)
  const rows = $derived(baseData.rows(types))
  const current = $derived.by(() => {
    const file = currentPath ? baseData.findFile(currentPath) : null
    return file ? rowFor(file, types) : null
  })
  const context = $derived<Context>({
    formulas: config.formulas ?? {},
    current,
    findFile: baseData.findFile,
  })
  const result = $derived(query(rows, config, view, context))

  const noteProperties = $derived.by(() => {
    const counts: Record<string, number> = {}
    for (const file of baseData.files) {
      for (const key of Object.keys(file.properties)) counts[key] = (counts[key] ?? 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => `note.${key}`)
  })
  const formulaProperties = $derived(
    Object.keys(config.formulas ?? {}).map((name) => `formula.${name}`),
  )
  const allProperties = $derived([...noteProperties, ...formulaProperties, ...FILE_PROPERTIES])
  const columns = $derived(
    view.order?.length
      ? view.order.map(propertyId)
      : ['file.name', ...noteProperties.slice(0, DEFAULT_COLUMNS)],
  )

  const edit = (change: (config: BaseConfig) => void) => onchange(updateBase(source, change))
  const editView = (change: (view: ViewConfig) => void) =>
    edit((config) => change(config.views[index]))

  function toggleColumn(id: string, isShown: boolean) {
    editView((view) => {
      view.order = isShown ? [...columns, id] : columns.filter((column) => column !== id)
    })
  }

  function addView() {
    edit((config) => {
      config.views.push({ type: 'table', name: `View ${config.views.length + 1}` })
    })
    viewIndex = config.views.length
  }

  function addFormula() {
    const name = newFormula.name.trim()
    if (!name || !newFormula.expression.trim()) return
    edit((config) => {
      config.formulas = { ...config.formulas, [name]: newFormula.expression.trim() }
      config.views[index].order = [...columns, `formula.${name}`]
    })
    newFormula = { name: '', expression: '' }
  }

  function createNote() {
    void workspace.createNoteFor(newNoteDefaults([config.filters, view.filters]))
  }
</script>

<div class="base">
  <div class="toolbar">
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="view-picker">{view.name}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="menu" align="start">
          {#each config.views as candidate, candidateIndex (candidateIndex)}
            <DropdownMenu.Item class="menu-item" onSelect={() => (viewIndex = candidateIndex)}>
              {candidate.name}
              <small>{candidate.type}</small>
            </DropdownMenu.Item>
          {/each}
          <DropdownMenu.Separator class="menu-separator" />
          <DropdownMenu.Item class="menu-item" onSelect={addView}>Add view</DropdownMenu.Item>
          <DropdownMenu.Item
            class="menu-item"
            onSelect={() =>
              edit((config) =>
                config.views.push({ ...structuredClone(view), name: `${view.name} copy` }),
              )}
          >
            Duplicate view
          </DropdownMenu.Item>
          {#if config.views.length > 1}
            <DropdownMenu.Item
              class="menu-item danger"
              onSelect={() => edit((config) => config.views.splice(index, 1))}
            >
              Delete view
            </DropdownMenu.Item>
          {/if}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>

    <span class="count">{result.total} {result.total === 1 ? 'result' : 'results'}</span>

    <div class="spacer"></div>

    <Popover.Root>
      <Popover.Trigger class="icon" title="Sort"><ArrowUpDown size={15} /></Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class="popover" align="end">
          <strong>Sort</strong>
          {#each view.sort ?? [] as rule, ruleIndex (ruleIndex)}
            <div class="row">
              <select
                value={rule.property}
                onchange={(event) =>
                  editView((view) => {
                    view.sort = view.sort?.with(ruleIndex, {
                      ...rule,
                      property: event.currentTarget.value,
                    })
                  })}
              >
                {#each allProperties as id (id)}
                  <option value={id}>{propertyName(id, config)}</option>
                {/each}
              </select>
              <select
                value={rule.direction}
                onchange={(event) =>
                  editView((view) => {
                    view.sort = view.sort?.with(ruleIndex, {
                      ...rule,
                      direction: event.currentTarget.value as Direction,
                    })
                  })}
              >
                <option value="ASC">Ascending</option>
                <option value="DESC">Descending</option>
              </select>
              <button
                class="icon"
                title="Remove"
                onclick={() => editView((view) => (view.sort = view.sort?.toSpliced(ruleIndex, 1)))}
              >
                <Trash2 size={14} />
              </button>
            </div>
          {/each}
          <button
            class="add"
            onclick={() =>
              editView((view) => {
                view.sort = [...(view.sort ?? []), { property: 'file.name', direction: 'ASC' }]
              })}
          >
            <Plus size={13} /> Add sort
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>

    <Popover.Root>
      <Popover.Trigger class="icon" title="Filter"><Filter size={15} /></Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class="popover wide" align="end">
          <div class="scope">
            <button class:on={filterScope === 'view'} onclick={() => (filterScope = 'view')}>
              This view
            </button>
            <button class:on={filterScope === 'all'} onclick={() => (filterScope = 'all')}>
              All views
            </button>
          </div>
          <FilterGroupEditor
            group={toGroup(filterScope === 'view' ? view.filters : config.filters)}
            properties={allProperties}
            onchange={(group) => {
              const filters = fromGroup(group)
              if (filterScope === 'view') editView((view) => (view.filters = filters))
              else edit((config) => (config.filters = filters))
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>

    <Popover.Root>
      <Popover.Trigger class="icon" title="Properties"><Columns3 size={15} /></Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class="popover" align="end">
          <strong>Properties</strong>
          <div class="checklist">
            {#each allProperties as id (id)}
              <label>
                <input
                  type="checkbox"
                  checked={columns.includes(id)}
                  onchange={(event) => toggleColumn(id, event.currentTarget.checked)}
                />
                {propertyName(id, config)}
                <small>{id.slice(0, id.indexOf('.'))}</small>
              </label>
            {/each}
          </div>
          <strong>Formulas</strong>
          {#each Object.entries(config.formulas ?? {}) as [name, expression] (name)}
            <div class="row">
              <code>{name}</code>
              <input
                type="text"
                value={expression}
                onchange={(event) =>
                  edit((config) => {
                    config.formulas = { ...config.formulas, [name]: event.currentTarget.value }
                  })}
              />
              <button
                class="icon"
                title="Remove formula"
                onclick={() =>
                  edit((config) => {
                    config.formulas = Object.fromEntries(
                      Object.entries(config.formulas ?? {}).filter(([key]) => key !== name),
                    )
                    for (const each of config.views) {
                      each.order = each.order?.filter((id) => id !== `formula.${name}`)
                    }
                  })}
              >
                <Trash2 size={14} />
              </button>
            </div>
          {/each}
          <div class="row">
            <input type="text" placeholder="Name" bind:value={newFormula.name} />
            <input type="text" placeholder="price * quantity" bind:value={newFormula.expression} />
            <button class="icon" title="Add formula" onclick={addFormula}><Plus size={14} /></button
            >
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>

    <Popover.Root>
      <Popover.Trigger class="icon" title="Group"><Group size={15} /></Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class="popover" align="end">
          <strong>Group by</strong>
          <div class="row">
            <select
              value={view.groupBy?.property ?? ''}
              onchange={(event) => {
                const property = event.currentTarget.value
                editView((view) => {
                  view.groupBy = property
                    ? { property, direction: view.groupBy?.direction ?? 'ASC' }
                    : undefined
                })
              }}
            >
              <option value="">None</option>
              {#each allProperties as id (id)}
                <option value={id}>{propertyName(id, config)}</option>
              {/each}
            </select>
            {#if view.groupBy}
              <select
                value={view.groupBy.direction}
                onchange={(event) =>
                  editView((view) => {
                    if (view.groupBy)
                      view.groupBy.direction = event.currentTarget.value as Direction
                  })}
              >
                <option value="ASC">Ascending</option>
                <option value="DESC">Descending</option>
              </select>
            {/if}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>

    <Popover.Root>
      <Popover.Trigger class="icon" title="View settings"><Settings2 size={15} /></Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class="popover" align="end">
          <label class="field">
            Name
            <input
              type="text"
              value={view.name}
              onchange={(event) => editView((view) => (view.name = event.currentTarget.value))}
            />
          </label>
          <label class="field">
            Layout
            <select
              value={view.type}
              onchange={(event) =>
                editView((view) => (view.type = event.currentTarget.value as ViewType))}
            >
              {#each VIEW_TYPES as type (type.value)}
                <option value={type.value}>{type.label}</option>
              {/each}
            </select>
          </label>
          <label class="field">
            Limit
            <input
              type="number"
              min="0"
              placeholder="No limit"
              value={view.limit ?? ''}
              onchange={(event) => {
                const limit = Number(event.currentTarget.value)
                editView((view) => (view.limit = limit > 0 ? limit : undefined))
              }}
            />
          </label>
          {#if view.type === 'cards'}
            <label class="field">
              Image
              <select
                value={typeof view.image === 'string' ? view.image : ''}
                onchange={(event) =>
                  editView((view) => (view.image = event.currentTarget.value || undefined))}
              >
                <option value="">None</option>
                {#each allProperties as id (id)}
                  <option value={id}>{propertyName(id, config)}</option>
                {/each}
              </select>
            </label>
            <label class="field">
              Card size
              <input
                type="range"
                min="140"
                max="400"
                value={typeof view.cardSize === 'number' ? view.cardSize : 220}
                onchange={(event) =>
                  editView((view) => (view.cardSize = Number(event.currentTarget.value)))}
              />
            </label>
          {/if}
          {#if view.type === 'map'}
            <label class="field">
              Coordinates
              <select
                value={typeof view.coordinates === 'string' ? view.coordinates : ''}
                onchange={(event) =>
                  editView((view) => (view.coordinates = event.currentTarget.value || undefined))}
              >
                <option value="">Choose a property</option>
                {#each noteProperties as id (id)}
                  <option value={id}>{propertyName(id, config)}</option>
                {/each}
              </select>
            </label>
          {/if}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>

    <button class="new" onclick={createNote}><Plus size={14} /> New</button>
  </div>

  {#if parsed.error}
    <p class="error">This base can't be read: {parsed.error}</p>
  {:else if view.type === 'cards'}
    <CardsView {result} {columns} {config} {view} {context} />
  {:else if view.type === 'list'}
    <ListView {result} {columns} {view} {context} />
  {:else if view.type === 'map'}
    <MapView {result} {view} {context} />
  {:else}
    <TableView {result} {columns} {config} {view} {context} {types} edit={editView} />
  {/if}
</div>

<style>
  .base {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .spacer {
    flex: 1;
  }

  :global(.view-picker) {
    padding: 3px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .count {
    margin-left: 6px;
    color: var(--text-faint);
    font-size: 12px;
  }

  .new {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border: none;
    border-radius: 4px;
    background: var(--accent);
    color: white;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  :global(.popover) {
    z-index: 50;
    display: grid;
    gap: 8px;
    width: 320px;
    max-height: 70vh;
    overflow: auto;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--background-secondary);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
    color: var(--text);
    font-size: 13px;
  }

  :global(.popover.wide) {
    width: 520px;
  }

  :global(.popover) .row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  :global(.popover) select,
  :global(.popover) input[type='text'],
  :global(.popover) input[type='number'] {
    min-width: 0;
    flex: 1;
    padding: 3px 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background);
    color: var(--text);
    font: inherit;
    font-size: 12px;
  }

  .checklist {
    display: grid;
    max-height: 240px;
    overflow: auto;
  }

  .checklist label {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .checklist small {
    color: var(--text-faint);
  }

  .field {
    display: grid;
    gap: 4px;
    color: var(--text-muted);
    font-size: 12px;
  }

  .add {
    display: flex;
    align-items: center;
    gap: 4px;
    justify-self: start;
    padding: 2px 8px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text-muted);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .add:hover {
    background: var(--hover);
  }

  .scope {
    display: flex;
    gap: 4px;
  }

  .scope button {
    padding: 2px 10px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: none;
    color: var(--text-muted);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .scope button.on {
    border-color: var(--accent);
    color: var(--text);
  }

  code {
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .error {
    color: #d04545;
  }
</style>
