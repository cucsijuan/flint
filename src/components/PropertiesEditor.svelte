<script lang="ts">
  import { Calendar, CheckSquare, Hash, List, Plus, Text, X } from '@lucide/svelte'
  import {
    convertValue,
    type Property,
    PROPERTY_TYPES,
    type PropertyType,
    removeProperty,
    renameProperty,
    setProperty,
    VAULT_TYPES,
  } from '../lib/properties'
  import { workspace } from '../lib/workspace.svelte'

  interface Props {
    properties: Property[]
    edit: (change: (note: string) => string) => void
  }

  let { properties, edit }: Props = $props()
  let isAdding = $state(false)

  const ICONS: Record<PropertyType, typeof Text> = {
    text: Text,
    list: List,
    number: Hash,
    checkbox: CheckSquare,
    date: Calendar,
    other: Text,
  }

  const set = (key: string, value: unknown) => edit((note) => setProperty(note, key, value))
  const items = (property: Property) => (property.value as unknown[]).map(String)

  function rename(property: Property, input: HTMLInputElement) {
    const key = input.value.trim()
    if (key && key !== property.key) edit((note) => renameProperty(note, property.key, key))
    else input.value = property.key
  }

  function onListKey(event: KeyboardEvent, property: Property) {
    const input = event.currentTarget as HTMLInputElement
    const value = input.value.trim()
    if (event.key === 'Enter' && value) {
      set(property.key, [...items(property), value])
      input.value = ''
    } else if (event.key === 'Backspace' && !input.value && items(property).length) {
      set(property.key, items(property).slice(0, -1))
    }
  }

  function add(input: HTMLInputElement) {
    const key = input.value.trim()
    isAdding = false
    if (key && !properties.some((property) => property.key === key)) set(key, null)
  }

  function focusOnMount(input: HTMLInputElement) {
    input.focus()
  }
</script>

<section class="properties">
  <header>Properties</header>
  {#each properties as property (property.key)}
    {@const Icon = ICONS[property.type]}
    <div class="property" data-interactive>
      <label class="type" title="Property type">
        <Icon size={14} />
        <select
          value={property.type}
          onchange={(event) => {
            const type = event.currentTarget.value as PropertyType
            set(property.key, convertValue(property.value, type))
            if (type !== 'other') workspace.setPropertyType(property.key, VAULT_TYPES[type])
          }}
        >
          {#each PROPERTY_TYPES as type (type)}<option value={type}>{type}</option>{/each}
        </select>
      </label>
      <input
        class="key"
        value={property.key}
        onchange={(event) => rename(property, event.currentTarget)}
      />
      <div class="value">
        {#if property.type === 'list'}
          {#each items(property) as item, index (index)}
            <span class="chip">
              {item}
              <button
                class="chip-remove"
                title="Remove"
                onclick={() =>
                  set(
                    property.key,
                    items(property).filter((_, other) => other !== index),
                  )}
              >
                <X size={11} />
              </button>
            </span>
          {/each}
          <input
            class="chip-input"
            placeholder="Add…"
            onkeydown={(event) => onListKey(event, property)}
          />
        {:else if property.type === 'checkbox'}
          <input
            type="checkbox"
            checked={property.value === true}
            onchange={(event) => set(property.key, event.currentTarget.checked)}
          />
        {:else if property.type === 'number'}
          <input
            type="number"
            value={property.value ?? ''}
            onchange={(event) =>
              set(
                property.key,
                event.currentTarget.value ? Number(event.currentTarget.value) : null,
              )}
          />
        {:else if property.type === 'date'}
          <input
            type="date"
            value={property.value ?? ''}
            onchange={(event) => set(property.key, event.currentTarget.value || null)}
          />
        {:else if property.type === 'other'}
          <code>{JSON.stringify(property.value)}</code>
        {:else}
          <input
            value={property.value ?? ''}
            onchange={(event) => set(property.key, event.currentTarget.value)}
          />
        {/if}
      </div>
      <button
        class="icon remove"
        title="Remove property"
        onclick={() => edit((note) => removeProperty(note, property.key))}
      >
        <X size={14} />
      </button>
    </div>
  {/each}
  <div class="add" data-interactive>
    {#if isAdding}
      <input
        class="key"
        placeholder="Property name"
        onkeydown={(event) => {
          if (event.key === 'Enter') add(event.currentTarget)
          if (event.key === 'Escape') isAdding = false
        }}
        onblur={(event) => add(event.currentTarget)}
        {@attach focusOnMount}
      />
    {:else}
      <button class="add-button" onclick={() => (isAdding = true)}>
        <Plus size={14} /> Add property
      </button>
    {/if}
  </div>
</section>

<style>
  .properties {
    margin: 0 0 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    font-family: var(--font-text);
    font-size: 13px;
  }

  header {
    margin-bottom: 6px;
    color: var(--text-muted);
    font-weight: 600;
    cursor: text;
  }

  .property,
  .add {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
  }

  .type {
    position: relative;
    display: grid;
    width: 20px;
    color: var(--text-faint);
    place-items: center;
  }

  .type select {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  input {
    min-width: 0;
    padding: 3px 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: none;
    color: var(--text);
    font: inherit;
  }

  input:hover,
  input:focus {
    border-color: var(--border);
    background: var(--background);
    outline: none;
  }

  .key {
    width: 140px;
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .value {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  .value > input:not([type='checkbox']) {
    flex: 1;
  }

  .value input[type='checkbox'] {
    accent-color: var(--accent);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 1px 4px 1px 8px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .chip-remove {
    display: grid;
    padding: 1px;
    border: none;
    border-radius: 50%;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    place-items: center;
  }

  .chip-input {
    width: 80px;
    flex: 1;
  }

  .remove {
    visibility: hidden;
  }

  .property:hover .remove {
    visibility: visible;
  }

  .add-button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text-muted);
    font: inherit;
    cursor: pointer;
  }

  .add-button:hover {
    background: var(--hover);
  }
</style>
