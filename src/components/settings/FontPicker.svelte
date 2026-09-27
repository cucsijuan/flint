<script lang="ts">
  import { Combobox } from 'bits-ui'
  import type { FontFamily } from '../../lib/vault'

  const MAX_SHOWN = 200

  interface Props {
    value: string
    fonts: FontFamily[]
    placeholder: string
    /** Lists monospaced fonts first, for code. */
    preferMonospaced?: boolean
    onchange: (font: string) => void
  }

  let { value, fonts, placeholder, preferMonospaced = false, onchange }: Props = $props()
  let search = $state('')

  const ordered = $derived(
    preferMonospaced
      ? [...fonts.filter((font) => font.monospaced), ...fonts.filter((font) => !font.monospaced)]
      : fonts,
  )
  const shown = $derived(
    ordered
      .filter((font) => font.name.toLowerCase().includes(search.trim().toLowerCase()))
      .slice(0, MAX_SHOWN),
  )
</script>

<Combobox.Root
  type="single"
  {value}
  inputValue={value}
  onValueChange={onchange}
  onOpenChange={(isOpen) => !isOpen && (search = '')}
>
  <Combobox.Input
    class="font-input"
    {placeholder}
    style="font-family: {value ? `'${value}'` : 'inherit'}"
    oninput={(event) => (search = event.currentTarget.value)}
  />
  <Combobox.Portal>
    <Combobox.Content class="font-list" sideOffset={4}>
      <Combobox.Viewport>
        <Combobox.Item class="font-item" value="" label="">{placeholder}</Combobox.Item>
        {#each shown as font (font.name)}
          <Combobox.Item class="font-item" value={font.name} label={font.name}>
            <span style:font-family="'{font.name}'">{font.name}</span>
          </Combobox.Item>
        {/each}
        {#if shown.length === 0}<p class="none">No font matches.</p>{/if}
      </Combobox.Viewport>
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>

<style>
  :global(.font-input) {
    width: 220px;
  }

  :global(.font-list) {
    z-index: 60;
    width: var(--bits-combobox-anchor-width);
    max-height: 320px;
    overflow-y: auto;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--background);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.25);
  }

  :global(.font-item) {
    padding: 5px 8px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
  }

  :global(.font-item[data-highlighted]) {
    background: var(--hover);
  }

  :global(.font-item[data-selected]) {
    color: var(--accent);
  }

  .none {
    margin: 0;
    padding: 6px 8px;
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
