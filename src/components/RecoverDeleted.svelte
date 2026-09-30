<script lang="ts">
  import { Dialog } from 'bits-ui'
  import * as vault from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'

  let notes = $state<vault.DeletedNote[] | null>(null)
  let selected = $state<vault.DeletedNote | null>(null)
  let text = $state<string | null>(null)

  $effect(() => {
    if (!workspace.isRecoveryOpen) return
    notes = null
    selected = null
    text = null
    void vault.deletedNotes().then((found) => (notes = found))
  })

  function select(note: vault.DeletedNote) {
    selected = note
    text = null
    void vault.historySnapshot(note.path, note.time).then((found) => {
      if (selected === note) text = found
    })
  }

  async function restore() {
    if (!selected || text === null) return
    workspace.isRecoveryOpen = false
    await workspace.restoreDeleted(selected.path, text)
  }

  const when = (time: number) =>
    new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
</script>

<Dialog.Root bind:open={workspace.isRecoveryOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="overlay" />
    <Dialog.Content class="dialog history">
      <Dialog.Title class="dialog-title">Recover deleted notes</Dialog.Title>
      {#if notes?.length === 0}
        <p class="empty">No deleted notes with saved versions.</p>
      {:else if notes}
        <div class="body">
          <ul>
            {#each notes as note (note.path)}
              <li>
                <button class:current={note === selected} onclick={() => select(note)}>
                  {note.path}
                  <small>Last version {when(note.time)}</small>
                </button>
              </li>
            {/each}
          </ul>
          <pre>{text ?? (selected ? 'Loading…' : 'Pick a note to see its last version.')}</pre>
        </div>
        <div class="actions">
          <button class="primary" disabled={text === null} onclick={() => void restore()}>
            Restore note
          </button>
        </div>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  .body {
    display: flex;
    flex: 1;
    gap: 12px;
    min-height: 0;
  }

  ul {
    width: 280px;
    flex-shrink: 0;
    overflow-y: auto;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li button {
    display: grid;
    width: 100%;
    padding: 6px 8px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    text-align: left;
    word-break: break-all;
    cursor: pointer;
  }

  li button:hover {
    background: var(--hover);
  }

  li button.current {
    background: var(--selected);
  }

  small,
  .empty {
    color: var(--text-faint);
    font-size: 12px;
  }

  pre {
    flex: 1;
    margin: 0;
    overflow: auto;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--background-secondary);
    font-family: var(--font-mono);
    font-size: 12px;
    white-space: pre-wrap;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }

  .actions button {
    padding: 6px 12px;
    border: 1px solid var(--accent);
    border-radius: 4px;
    background: var(--accent);
    color: white;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .actions button:disabled {
    cursor: default;
    opacity: 0.5;
  }
</style>
