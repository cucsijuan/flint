<script lang="ts">
  import { Code, Trash2 } from '@lucide/svelte'
  import {
    buildStatement,
    type FilterGroup,
    OPERATORS,
    parseStatement,
    type Statement,
  } from '../../lib/bases/filters'
  import { SvelteSet } from 'svelte/reactivity'
  import FilterGroupEditor from './FilterGroupEditor.svelte'

  let {
    group,
    properties,
    onchange,
    onremove,
  }: {
    group: FilterGroup
    /** Property ids to pick from. */
    properties: string[]
    onchange: (group: FilterGroup) => void
    onremove?: () => void
  } = $props()

  const rawIndexes = new SvelteSet<number>()

  const setChild = (index: number, child: string | FilterGroup) =>
    onchange({ ...group, children: group.children.with(index, child) })
  const removeChild = (index: number) =>
    onchange({ ...group, children: group.children.toSpliced(index, 1) })

  function updateStatement(index: number, statement: Statement, change: Partial<Statement>) {
    setChild(index, buildStatement({ ...statement, ...change }))
  }

  function toggleRaw(index: number) {
    if (rawIndexes.has(index)) rawIndexes.delete(index)
    else rawIndexes.add(index)
  }
</script>

<div class="group">
  <div class="group-head">
    <select
      value={group.kind}
      onchange={(event) =>
        onchange({ ...group, kind: event.currentTarget.value as FilterGroup['kind'] })}
    >
      <option value="and">All of the following are true</option>
      <option value="or">Any of the following is true</option>
      <option value="not">None of the following are true</option>
    </select>
    {#if onremove}
      <button class="icon" title="Remove group" onclick={onremove}><Trash2 size={14} /></button>
    {/if}
  </div>
  {#each group.children as child, index (index)}
    {#if typeof child === 'string'}
      {@const statement = rawIndexes.has(index) ? null : parseStatement(child)}
      <div class="statement">
        {#if statement}
          <select
            value={statement.property}
            onchange={(event) =>
              updateStatement(index, statement, { property: event.currentTarget.value })}
          >
            {#if !properties.includes(statement.property) && statement.property !== 'file'}
              <option value={statement.property}>{statement.property}</option>
            {/if}
            {#if statement.property === 'file'}<option value="file">file</option>{/if}
            {#each properties as property (property)}
              <option value={property}>{property}</option>
            {/each}
          </select>
          <select
            value={statement.operator}
            onchange={(event) =>
              updateStatement(index, statement, { operator: event.currentTarget.value })}
          >
            {#each OPERATORS as operator (operator.id)}
              <option value={operator.id}>{operator.label}</option>
            {/each}
          </select>
          {#if OPERATORS.find(({ id }) => id === statement.operator)?.hasValue}
            <input
              type="text"
              value={statement.value}
              onchange={(event) =>
                updateStatement(index, statement, { value: event.currentTarget.value })}
            />
          {/if}
        {:else}
          <input
            class="raw"
            type="text"
            placeholder="Expression, like status == &quot;done&quot;"
            value={child}
            onchange={(event) => setChild(index, event.currentTarget.value)}
          />
        {/if}
        <button class="icon" title="Edit as expression" onclick={() => toggleRaw(index)}>
          <Code size={14} />
        </button>
        <button class="icon" title="Remove filter" onclick={() => removeChild(index)}>
          <Trash2 size={14} />
        </button>
      </div>
    {:else}
      <FilterGroupEditor
        group={child}
        {properties}
        onchange={(next) => setChild(index, next)}
        onremove={() => removeChild(index)}
      />
    {/if}
  {/each}
  <div class="actions">
    <button
      onclick={() =>
        onchange({
          ...group,
          children: [...group.children, `${properties[0] ?? 'file.name'} == ""`],
        })}
    >
      + Add filter
    </button>
    <button
      onclick={() =>
        onchange({ ...group, children: [...group.children, { kind: 'and', children: [] }] })}
    >
      + Add group
    </button>
  </div>
</div>

<style>
  .group {
    display: grid;
    gap: 6px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .group-head,
  .statement,
  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  select,
  input {
    min-width: 0;
    padding: 3px 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background);
    color: var(--text);
    font: inherit;
    font-size: 12px;
  }

  input {
    flex: 1;
  }

  .raw {
    font-family: var(--font-mono);
  }

  .actions button {
    padding: 2px 8px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text-muted);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .actions button:hover {
    background: var(--hover);
  }
</style>
