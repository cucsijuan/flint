<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import { commands } from '../lib/commands.svelte'
  import { editMenu } from '../lib/edit-menu.svelte'
  import { spelling } from '../lib/spelling.svelte'
  import * as vault from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'

  const FORMATS = [
    ['toggle-bold', 'Bold'],
    ['toggle-italic', 'Italic'],
    ['toggle-strikethrough', 'Strikethrough'],
    ['toggle-inline-code', 'Code'],
    ['insert-link', 'Insert link'],
    ['insert-template', 'Insert template'],
  ] as const

  let suggestions = $state<string[] | null>(null)
  const menu = $derived(editMenu.state)
  const anchor = $derived(
    menu && {
      getBoundingClientRect: () => DOMRect.fromRect({ x: menu.x, y: menu.y, width: 0, height: 0 }),
    },
  )

  $effect(() => {
    const word = menu?.misspelling?.word
    suggestions = null
    if (!word) return
    let isCurrent = true
    void vault.spellingSuggestions(word).then((found) => {
      if (isCurrent) suggestions = found
    })
    return () => (isCurrent = false)
  })

  const run = (action: () => unknown) => () =>
    void Promise.resolve(action()).catch((error: unknown) => workspace.notify(String(error)))
</script>

<DropdownMenu.Root
  open={menu !== null}
  onOpenChange={(isOpen) => {
    if (isOpen) return
    editMenu.close()
  }}
>
  <DropdownMenu.Portal>
    <!-- The note or field keeps the focus, so its selection is still there for the action. -->
    <DropdownMenu.Content
      class="menu"
      customAnchor={anchor}
      align="start"
      side="bottom"
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => event.preventDefault()}
      onpointerdown={(event) => event.preventDefault()}
    >
      {#if menu}
        {#if menu.misspelling}
          {@const misspelling = menu.misspelling}
          {#if suggestions === null}
            <p class="note">Looking for suggestions…</p>
          {:else if suggestions.length === 0}
            <p class="note">No suggestions</p>
          {:else}
            {#each suggestions as suggestion (suggestion)}
              <DropdownMenu.Item
                class="menu-item suggestion"
                onSelect={() => misspelling.replace(suggestion)}
              >
                {suggestion}
              </DropdownMenu.Item>
            {/each}
          {/if}
          <DropdownMenu.Item
            class="menu-item"
            onSelect={run(() => spelling.addToDictionary(misspelling.word))}
          >
            Add “{misspelling.word}” to the dictionary
          </DropdownMenu.Item>
          <DropdownMenu.Separator class="menu-separator" />
        {/if}
        {#if menu.isLink}
          <DropdownMenu.Item
            class="menu-item"
            onSelect={() => commands.run('open-link-in-new-tab')}
          >
            Open link in new tab
          </DropdownMenu.Item>
          <DropdownMenu.Separator class="menu-separator" />
        {/if}
        {#if menu.isEditable}
          <DropdownMenu.Item
            class="menu-item"
            disabled={!menu.selection}
            onSelect={run(() => editMenu.cut())}
          >
            Cut
          </DropdownMenu.Item>
        {/if}
        <DropdownMenu.Item
          class="menu-item"
          disabled={!menu.selection}
          onSelect={run(() => editMenu.copy())}
        >
          Copy
        </DropdownMenu.Item>
        {#if menu.isEditable}
          <DropdownMenu.Item class="menu-item" onSelect={run(() => editMenu.paste())}>
            Paste
          </DropdownMenu.Item>
          {#if menu.editor || menu.field?.dataset.tableCell !== undefined}
            <DropdownMenu.Separator class="menu-separator" />
            {#each FORMATS as [id, label] (id)}
              {#if menu.editor || id !== 'insert-template'}
                <DropdownMenu.Item class="menu-item" onSelect={() => commands.run(id)}>
                  {label}
                </DropdownMenu.Item>
              {/if}
            {/each}
          {/if}
        {/if}
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

  :global(.menu-item[data-disabled]) {
    color: var(--text-faint);
    pointer-events: none;
  }
</style>
