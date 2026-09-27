<script lang="ts">
  import { Keyboard, RotateCcw, X } from '@lucide/svelte'
  import { commands, displayHotkey, hotkeyOf } from '../../lib/commands.svelte'
  import { workspace } from '../../lib/workspace.svelte'

  const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta'])

  let search = $state('')
  let recording = $state<string | null>(null)

  const all = $derived(commands.all().sort((a, b) => a.name.localeCompare(b.name)))
  const shown = $derived(
    all.filter((command) => command.name.toLowerCase().includes(search.trim().toLowerCase())),
  )
  const namesByHotkey = $derived(
    Map.groupBy(
      all.filter((command) => command.hotkey),
      (command) => command.hotkey as string,
    ),
  )

  function conflicts(id: string, hotkey: string | undefined) {
    if (!hotkey) return []
    return (namesByHotkey.get(hotkey) ?? []).filter((other) => other.id !== id)
  }

  /** While recording, the next key press becomes the hotkey instead of running a command. */
  function record(event: KeyboardEvent) {
    if (!recording) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.key === 'Escape') recording = null
    if (!recording || MODIFIER_KEYS.has(event.key)) return
    workspace.setHotkey(recording, hotkeyOf(event))
    recording = null
  }
</script>

<svelte:window onkeydowncapture={record} />

<input class="search" type="search" placeholder="Filter commands…" bind:value={search} />
<ul>
  {#each shown as command (command.id)}
    {@const clashes = conflicts(command.id, command.hotkey)}
    {@const isCustom = command.hotkey !== command.defaultHotkey}
    <li>
      <span class="name">
        {command.name}
        {#if clashes.length}
          <small class="warning">Also used by {clashes.map((other) => other.name).join(', ')}</small
          >
        {/if}
      </span>
      {#if recording === command.id}
        <span class="key recording">Press a shortcut… (Esc cancels)</span>
      {:else if command.hotkey}
        <span class="key" class:clash={clashes.length > 0}>{displayHotkey(command.hotkey)}</span>
      {:else}
        <span class="key none">Blank</span>
      {/if}
      <span class="actions">
        {#if isCustom}
          <button
            class="icon"
            title="Restore default"
            onclick={() => workspace.setHotkey(command.id, undefined)}
          >
            <RotateCcw size={14} />
          </button>
        {/if}
        {#if command.hotkey}
          <button
            class="icon"
            title="Remove hotkey"
            onclick={() => workspace.setHotkey(command.id, null)}
          >
            <X size={14} />
          </button>
        {/if}
        <button class="icon" title="Set hotkey" onclick={() => (recording = command.id)}>
          <Keyboard size={14} />
        </button>
      </span>
    </li>
  {/each}
</ul>

<style>
  .search {
    width: 100%;
    margin-bottom: 8px;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text);
    font: inherit;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }

  .name {
    display: grid;
    flex: 1;
    gap: 2px;
  }

  .warning {
    color: #d9730d;
  }

  .key {
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background-secondary);
    font-family: var(--font-mono);
    font-size: 12px;
    white-space: nowrap;
  }

  .key.none {
    border-style: dashed;
    color: var(--text-faint);
    font-family: inherit;
  }

  .key.clash {
    border-color: #d9730d;
  }

  .key.recording {
    border-color: var(--accent);
    color: var(--accent);
    font-family: inherit;
  }

  .actions {
    display: flex;
    width: 84px;
    justify-content: flex-end;
    gap: 2px;
  }
</style>
