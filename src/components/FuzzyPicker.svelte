<script lang="ts" generics="T">
  import { Command, Dialog } from 'bits-ui'
  import fuzzysort from 'fuzzysort'

  const MAX_RESULTS = 50

  interface Props {
    open: boolean
    items: T[]
    label: (item: T) => string
    detail?: (item: T) => string
    placeholder: string
    hint?: string
    onChoose: (item: T) => unknown
    onSubmitQuery?: (query: string) => unknown
  }

  let {
    open = $bindable(),
    items,
    label,
    detail,
    placeholder,
    hint,
    onChoose,
    onSubmitQuery,
  }: Props = $props()

  let query = $state('')

  const results = $derived(
    query
      ? fuzzysort
          .go(query, items, { key: label, limit: MAX_RESULTS })
          .map((result) => ({ item: result.obj, parts: highlight(result.target, result.indexes) }))
      : items
          .slice(0, MAX_RESULTS)
          .map((item) => ({ item, parts: [{ text: label(item), isMatch: false }] })),
  )

  function highlight(text: string, indexes: readonly number[]) {
    const matched = new Set(indexes)
    const parts: { text: string; isMatch: boolean }[] = []
    for (let position = 0; position < text.length; position++) {
      const isMatch = matched.has(position)
      const last = parts.at(-1)
      if (last?.isMatch === isMatch) last.text += text[position]
      else parts.push({ text: text[position], isMatch })
    }
    return parts
  }

  function choose(item: T) {
    open = false
    void onChoose(item)
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && event.shiftKey && onSubmitQuery && query.trim()) {
      event.preventDefault()
      open = false
      void onSubmitQuery(query.trim())
    }
  }

  $effect(() => {
    if (open) query = ''
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="overlay" />
    <Dialog.Content class="picker" aria-label={placeholder}>
      <Command.Root shouldFilter={false} loop onkeydown={onKeydown}>
        <Command.Input class="picker-input" {placeholder} bind:value={query} />
        <Command.List class="picker-list">
          <Command.Empty class="picker-empty">No matches.</Command.Empty>
          {#each results as { item, parts }, index (index)}
            <Command.Item class="picker-item" value={String(index)} onSelect={() => choose(item)}>
              <span>
                {#each parts as part, position (position)}
                  <span class:match={part.isMatch}>{part.text}</span>
                {/each}
              </span>
              {#if detail?.(item)}<small>{detail(item)}</small>{/if}
            </Command.Item>
          {/each}
        </Command.List>
      </Command.Root>
      {#if hint}<footer>{hint}</footer>{/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.picker) {
    position: fixed;
    top: 15%;
    left: 50%;
    z-index: 50;
    width: min(600px, calc(100vw - 32px));
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--background);
    transform: translateX(-50%);
    box-shadow: 0 8px 32px rgb(0 0 0 / 0.3);
  }

  :global(.picker-input) {
    width: 100%;
    padding: 12px 16px;
    border: none;
    border-bottom: 1px solid var(--border);
    outline: none;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 15px;
  }

  :global(.picker-list) {
    max-height: 50vh;
    overflow: auto;
    padding: 4px;
  }

  :global(.picker-item) {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
  }

  :global(.picker-item[data-selected]) {
    background: var(--selected);
  }

  :global(.picker-empty) {
    padding: 12px;
    color: var(--text-muted);
  }

  .match {
    color: var(--accent);
    font-weight: 600;
  }

  small {
    flex-shrink: 0;
    color: var(--text-faint);
  }

  footer {
    padding: 6px 12px;
    border-top: 1px solid var(--border);
    color: var(--text-faint);
    font-size: 12px;
  }
</style>
