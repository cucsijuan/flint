<script lang="ts">
  import {
    type BaseConfig,
    type Context,
    propertyId,
    propertyName,
    type QueryResult,
    valueOf,
    type ViewConfig,
  } from '../../lib/bases/base'
  import {
    display,
    ExpressionError,
    FileValue,
    isList,
    Link,
    type Value,
  } from '../../lib/bases/expression'
  import { isExternalUrl } from '../../lib/paths'
  import { workspace } from '../../lib/workspace.svelte'
  import BaseValue from './BaseValue.svelte'

  const DEFAULT_CARD_SIZE = 220

  let {
    result,
    columns,
    config,
    view,
    context,
  }: {
    result: QueryResult
    columns: string[]
    config: BaseConfig
    view: ViewConfig
    context: Context
  } = $props()

  const shown = $derived(columns.filter((id) => propertyId(id) !== 'file.name'))
  const size = $derived(typeof view.cardSize === 'number' ? view.cardSize : DEFAULT_CARD_SIZE)
  const imageProperty = $derived(typeof view.image === 'string' ? view.image : null)

  function imageOf(value: Value | ExpressionError): string | null {
    if (value instanceof ExpressionError || value === null) return null
    const first = isList(value) ? value[0] : value
    if (first === undefined || first === null) return null
    const target =
      first instanceof Link ? first.target : display(first).replace(/^!?\[\[|\]\]$/g, '')
    if (!target) return null
    if (isExternalUrl(target) || target.startsWith('#'))
      return isExternalUrl(target) ? target : null
    const file = context.findFile(target)
    return workspace.assetUrl(file?.path ?? target)
  }
</script>

{#each result.groups as group, index (index)}
  {#if view.groupBy}<h3>{display(group.key) || 'None'} <span>{group.rows.length}</span></h3>{/if}
  <div class="cards" style:grid-template-columns="repeat(auto-fill, minmax({size}px, 1fr))">
    {#each group.rows as row (row.file.path)}
      {@const image = imageProperty ? imageOf(valueOf(row, imageProperty, context)) : null}
      <article>
        {#if image}<img src={image} alt="" />{/if}
        <div class="body">
          <div class="title"><BaseValue value={new FileValue(row.file)} /></div>
          {#each shown as id (id)}
            {@const value = valueOf(row, id, context)}
            {#if value !== null && !(isList(value) && value.length === 0)}
              <div class="property">
                <small>{propertyName(id, config)}</small>
                <BaseValue {value} />
              </div>
            {/if}
          {/each}
        </div>
      </article>
    {/each}
  </div>
{/each}

<style>
  h3 {
    margin: 16px 0 8px;
    font-size: 14px;
  }

  h3 span {
    color: var(--text-faint);
    font-weight: 400;
  }

  .cards {
    display: grid;
    gap: 12px;
  }

  article {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--background-secondary);
    font-size: 13px;
  }

  img {
    display: block;
    width: 100%;
    height: 140px;
    object-fit: cover;
  }

  .body {
    display: grid;
    gap: 6px;
    padding: 10px;
  }

  .title {
    font-weight: 600;
  }

  .property {
    display: grid;
  }

  small {
    color: var(--text-faint);
  }
</style>
