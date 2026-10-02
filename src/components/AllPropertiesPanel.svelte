<script lang="ts">
  import { Calendar, CalendarClock, CheckSquare, Hash, List, Tags, Text } from '@lucide/svelte'
  import { ContextMenu } from 'bits-ui'
  import type { PropertyType } from '../lib/bases/base'
  import { propertyType, VAULT_TYPES } from '../lib/properties'
  import * as vault from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'

  interface Row {
    name: string
    count: number
    type: PropertyType
  }

  const TYPES: { value: PropertyType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'multitext', label: 'List' },
    { value: 'number', label: 'Number' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'date', label: 'Date' },
    { value: 'datetime', label: 'Date & time' },
  ]
  const ICONS: Record<PropertyType, typeof Text> = {
    text: Text,
    multitext: List,
    number: Hash,
    checkbox: CheckSquare,
    date: Calendar,
    datetime: CalendarClock,
    aliases: List,
    tags: Tags,
  }

  let found = $state<{ name: string; count: number; sample: unknown }[]>([])
  let target = $state<Row | null>(null)
  let renaming = $state<string | null>(null)

  $effect(() => {
    void workspace.indexVersion
    let isCurrent = true
    void vault.baseFiles().then((files) => {
      if (!isCurrent) return
      const byName: Record<string, { name: string; count: number; sample: unknown }> = {}
      for (const file of files) {
        for (const [name, value] of Object.entries(file.properties)) {
          byName[name] ??= { name, count: 0, sample: value }
          byName[name].count++
        }
      }
      found = Object.values(byName).sort((a, b) => a.name.localeCompare(b.name))
    })
    return () => (isCurrent = false)
  })

  const rows = $derived(
    found.map(({ name, count, sample }): Row => {
      const inferred = propertyType(sample)
      const type =
        workspace.typesConfig.value.types[name] ??
        (name === 'tags' ? 'tags' : name === 'aliases' ? 'aliases' : null) ??
        (inferred === 'other' ? 'text' : VAULT_TYPES[inferred])
      return { name, count, type }
    }),
  )

  function finishRename(row: Row, input: HTMLInputElement, save: boolean) {
    renaming = null
    if (save) void workspace.renamePropertyEverywhere(row.name, input.value)
  }

  const focus = (input: HTMLInputElement) => {
    input.focus()
    input.select()
  }
</script>

<ContextMenu.Root onOpenChange={(open) => !open && (target = null)}>
  <ContextMenu.Trigger class="all-properties">
    {#if rows.length === 0}
      <p class="empty">No note has properties yet.</p>
    {:else}
      <ul>
        {#each rows as row (row.name)}
          {@const Icon = ICONS[row.type] ?? Text}
          <li>
            {#if renaming === row.name}
              <input
                class="rename"
                value={row.name}
                onblur={(event) => finishRename(row, event.currentTarget, true)}
                onkeydown={(event) => {
                  if (event.key === 'Enter') finishRename(row, event.currentTarget, true)
                  else if (event.key === 'Escape') finishRename(row, event.currentTarget, false)
                }}
                {@attach focus}
              />
            {:else}
              <button
                class="row"
                title="Search notes with “{row.name}”"
                onclick={() => workspace.openSearch(`[${row.name}]`)}
                ondblclick={() => (renaming = row.name)}
                oncontextmenu={() => (target = row)}
              >
                <Icon size={14} />
                <span class="name">{row.name}</span>
                <span class="count">{row.count}</span>
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </ContextMenu.Trigger>
  <ContextMenu.Portal>
    <ContextMenu.Content class="menu">
      {#if target}
        {@const row = target}
        <ContextMenu.Item class="menu-item" onSelect={() => (renaming = row.name)}>
          Rename…
        </ContextMenu.Item>
        <ContextMenu.Sub>
          <ContextMenu.SubTrigger class="menu-item">Property type</ContextMenu.SubTrigger>
          <ContextMenu.SubContent class="menu">
            {#each TYPES as type (type.value)}
              <ContextMenu.Item
                class="menu-item"
                onSelect={() => workspace.setPropertyType(row.name, type.value)}
              >
                {type.label}{row.type === type.value ? ' ✓' : ''}
              </ContextMenu.Item>
            {/each}
          </ContextMenu.SubContent>
        </ContextMenu.Sub>
        <ContextMenu.Item class="menu-item" onSelect={() => workspace.openSearch(`[${row.name}]`)}>
          Search notes with it
        </ContextMenu.Item>
      {/if}
    </ContextMenu.Content>
  </ContextMenu.Portal>
</ContextMenu.Root>

<style>
  :global(.all-properties) {
    display: block;
    height: 100%;
    overflow: auto;
    padding: 4px;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row,
  .rename {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: 26px;
    padding: 0 6px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  .row:hover {
    background: var(--hover);
  }

  .rename {
    outline: 1px solid var(--accent);
    background: var(--background);
    cursor: text;
  }

  .row :global(svg) {
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    color: var(--text-faint);
    font-size: 12px;
  }

  .empty {
    margin: 0;
    padding: 8px;
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
