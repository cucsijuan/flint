<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import { spelling } from '../lib/spelling.svelte'
  import * as vault from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'

  let suggestions = $state<string[] | null>(null)
  const menu = $derived(spelling.menu)
  const anchor = $derived(
    menu && {
      getBoundingClientRect: () => DOMRect.fromRect({ x: menu.x, y: menu.y, width: 0, height: 0 }),
    },
  )

  $effect(() => {
    const word = menu?.word
    suggestions = null
    if (!word) return
    let isCurrent = true
    void vault.spellingSuggestions(word).then((found) => {
      if (isCurrent) suggestions = found
    })
    return () => (isCurrent = false)
  })

  function addToDictionary(word: string) {
    spelling.addToDictionary(word).catch((error: unknown) => workspace.notify(String(error)))
  }
</script>

<DropdownMenu.Root
  open={menu !== null}
  onOpenChange={(isOpen) => {
    if (!isOpen) spelling.menu = null
  }}
>
  <DropdownMenu.Portal>
    <DropdownMenu.Content class="menu" customAnchor={anchor} align="start" side="bottom">
      {#if menu}
        {#if suggestions === null}
          <p class="note">Looking for suggestions…</p>
        {:else if suggestions.length === 0}
          <p class="note">No suggestions</p>
        {:else}
          {#each suggestions as suggestion (suggestion)}
            <DropdownMenu.Item
              class="menu-item suggestion"
              onSelect={() => menu.replace(suggestion)}
            >
              {suggestion}
            </DropdownMenu.Item>
          {/each}
        {/if}
        <DropdownMenu.Separator class="menu-separator" />
        <DropdownMenu.Item class="menu-item" onSelect={() => addToDictionary(menu.word)}>
          Add “{menu.word}” to the dictionary
        </DropdownMenu.Item>
      {/if}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>

<style>
  .note {
    margin: 0;
    padding: 6px 10px;
    color: var(--text-faint);
    font-size: 13px;
  }

  :global(.menu-item.suggestion) {
    font-weight: 600;
  }
</style>
