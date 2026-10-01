<script lang="ts">
  import { Combobox } from 'bits-ui'
  import { untrack } from 'svelte'

  const SEARCH_DELAY_MS = 250
  /** Stands for the empty choice, which Combobox can't use as a value. */
  const NONE = '\u0000'

  let {
    value,
    choices,
    load,
    onpick,
    oncancel,
  }: {
    value: string
    choices: string[]
    /** Asks for the choices matching what's typed, for lists too long to send at once. */
    load: (query: string) => Promise<string[] | null>
    onpick: (value: string) => void
    oncancel: () => void
  } = $props()

  let options = $state(untrack(() => choices))
  let query = $state('')
  let open = $state(true)
  let searchTimer: ReturnType<typeof setTimeout> | undefined

  const visible = $derived(
    options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase())),
  )

  function search(text: string) {
    query = text
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      void load(text).then((found) => {
        if (found && text === query) options = found
      })
    }, SEARCH_DELAY_MS)
  }

  const focus = (element: HTMLInputElement) => {
    element.focus()
    element.select()
  }
</script>

<Combobox.Root
  type="single"
  bind:open
  value={value || NONE}
  onValueChange={(picked) => onpick(picked === NONE ? '' : picked)}
  onOpenChange={(isOpen) => !isOpen && oncancel()}
>
  <Combobox.Input
    class="editor"
    defaultValue={value}
    oninput={(event) => search(event.currentTarget.value)}
    onkeydown={(event) => event.key === 'Escape' && oncancel()}
    {@attach focus}
  />
  <Combobox.Portal>
    <Combobox.Content class="menu choices" sideOffset={4}>
      {#each visible as option (option)}
        <Combobox.Item class="menu-item" value={option || NONE} label={option || 'None'}>
          {option || 'None'}
        </Combobox.Item>
      {:else}
        <p class="empty">No matches</p>
      {/each}
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>

<style>
  :global(.menu.choices) {
    max-height: 280px;
    overflow-y: auto;
  }

  .empty {
    margin: 0;
    padding: 6px 10px;
    color: var(--text-faint);
    font-size: 13px;
  }
</style>
