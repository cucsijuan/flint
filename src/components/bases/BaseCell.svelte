<script lang="ts">
  import type { PropertyType } from '../../lib/bases/base'
  import { ExpressionError, isList, type Row, type Value } from '../../lib/bases/expression'
  import { workspace } from '../../lib/workspace.svelte'
  import BaseValue from './BaseValue.svelte'

  let {
    row,
    id,
    value,
    type,
  }: { row: Row; id: string; value: Value | ExpressionError; type: PropertyType | undefined } =
    $props()

  const key = $derived(id.startsWith('note.') ? id.slice('note.'.length) : null)
  const raw = $derived(key ? row.file.properties[key] : undefined)
  const kind = $derived(
    type ??
      (typeof raw === 'boolean'
        ? 'checkbox'
        : typeof raw === 'number'
          ? 'number'
          : Array.isArray(raw)
            ? 'multitext'
            : 'text'),
  )
  let isEditing = $state(false)
  let draft = $state('')

  function start() {
    if (!key || kind === 'checkbox') return
    draft = Array.isArray(raw)
      ? raw.join(', ')
      : raw === undefined || raw === null
        ? ''
        : String(raw)
    isEditing = true
  }

  function commit() {
    if (!isEditing || !key) return
    isEditing = false
    const text = draft.trim()
    const next =
      kind === 'number'
        ? text === ''
          ? null
          : Number(text)
        : kind === 'multitext' || kind === 'tags' || kind === 'aliases'
          ? text
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : text
    workspace.setNoteProperty(row.file.path, key, next)
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') commit()
    else if (event.key === 'Escape') isEditing = false
  }

  const focus = (element: HTMLInputElement) => element.focus()
  const inputType = $derived(
    kind === 'number'
      ? 'number'
      : kind === 'date'
        ? 'date'
        : kind === 'datetime'
          ? 'datetime-local'
          : 'text',
  )
</script>

{#if key && kind === 'checkbox'}
  <input
    type="checkbox"
    checked={raw === true}
    onchange={(event) => workspace.setNoteProperty(row.file.path, key, event.currentTarget.checked)}
  />
{:else if isEditing}
  <input
    class="editor"
    type={inputType}
    bind:value={draft}
    onblur={commit}
    onkeydown={onKeydown}
    {@attach focus}
  />
{:else if key}
  <div
    class="value editable"
    role="button"
    tabindex="0"
    onclick={start}
    onkeydown={(event) => event.key === 'Enter' && start()}
  >
    {#if !(isList(value) && value.length === 0)}<BaseValue {value} />{/if}
  </div>
{:else}
  <div class="value">
    {#if !(isList(value) && value.length === 0)}<BaseValue {value} />{/if}
  </div>
{/if}

<style>
  .value {
    min-height: 1.4em;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .editable {
    cursor: text;
  }

  .editor {
    width: 100%;
    padding: 1px 4px;
    border: 1px solid var(--accent);
    border-radius: 3px;
    background: var(--background);
    color: var(--text);
    font: inherit;
  }
</style>
