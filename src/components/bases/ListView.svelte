<script lang="ts">
  import {
    type Context,
    propertyId,
    type QueryResult,
    valueOf,
    type ViewConfig,
  } from '../../lib/bases/base'
  import { display, FileValue, isList } from '../../lib/bases/expression'
  import BaseValue from './BaseValue.svelte'

  let {
    result,
    columns,
    view,
    context,
  }: { result: QueryResult; columns: string[]; view: ViewConfig; context: Context } = $props()

  const shown = $derived(columns.filter((id) => propertyId(id) !== 'file.name'))
</script>

{#each result.groups as group, index (index)}
  {#if view.groupBy}<h3>{display(group.key) || 'None'} <span>{group.rows.length}</span></h3>{/if}
  <ul>
    {#each group.rows as row (row.file.path)}
      <li>
        <BaseValue value={new FileValue(row.file)} />
        {#each shown as id (id)}
          {@const value = valueOf(row, id, context)}
          {#if value !== null && !(isList(value) && value.length === 0)}
            <span class="separator">·</span><BaseValue {value} />
          {/if}
        {/each}
      </li>
    {/each}
  </ul>
{/each}

<style>
  h3 {
    margin: 16px 0 4px;
    font-size: 14px;
  }

  h3 span {
    color: var(--text-faint);
    font-weight: 400;
  }

  ul {
    margin: 0;
    padding-left: 20px;
    font-size: 14px;
    line-height: 1.8;
  }

  .separator {
    margin: 0 6px;
    color: var(--text-faint);
  }
</style>
