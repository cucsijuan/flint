<script lang="ts">
  import { commands, displayHotkey } from '../lib/commands.svelte'

  const actions = [
    { id: 'new-note', label: 'Create new note' },
    { id: 'quick-switcher', label: 'Go to file' },
    { id: 'close-tab', label: 'Close' },
  ]

  function command(id: string) {
    return commands.available().find((candidate) => candidate.id === id)
  }
</script>

<div class="empty">
  <p>No file is open</p>
  {#each actions as action (action.id)}
    {@const found = command(action.id)}
    {#if found}
      <button onclick={() => found.run()}>
        {action.label}
        {#if found.hotkey}<small>({displayHotkey(found.hotkey)})</small>{/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  .empty {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 8px;
    height: 100%;
    color: var(--text-muted);
  }

  p {
    margin: 0 0 8px;
    font-size: 16px;
  }

  button {
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
  }

  small {
    color: var(--text-faint);
  }
</style>
