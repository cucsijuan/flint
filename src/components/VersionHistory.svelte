<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { diffLines } from 'diff'
  import { documents } from '../lib/documents'
  import { noteTitle } from '../lib/paths'
  import * as vault from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'

  let snapshots = $state<vault.Snapshot[]>([])
  let selected = $state<number | null>(null)
  let selectedText = $state<string | null>(null)
  let currentText = $state('')

  const path = $derived(workspace.historyNote)
  const isOpen = $derived(path !== null)

  $effect(() => {
    if (!path) return
    selected = null
    selectedText = null
    void Promise.all([vault.noteHistory(path), documents.load(path)]).then(([found, text]) => {
      snapshots = found
      currentText = text
      if (found[0]) select(found[0].time)
    })
  })

  function select(time: number) {
    if (!path) return
    selected = time
    void vault.historySnapshot(path, time).then((text) => {
      if (selected === time) selectedText = text
    })
  }

  const changes = $derived(selectedText === null ? [] : diffLines(selectedText, currentText))
  const isSame = $derived(changes.every((part) => !part.added && !part.removed))

  const when = (time: number) =>
    new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

  function restore() {
    if (!path || selectedText === null) return
    workspace.restoreVersion(path, selectedText)
    workspace.historyNote = null
  }
</script>

<Dialog.Root
  open={isOpen}
  onOpenChange={(open) => {
    if (!open) workspace.historyNote = null
  }}
>
  <Dialog.Portal>
    <Dialog.Overlay class="overlay" />
    <Dialog.Content class="dialog history">
      <Dialog.Title class="dialog-title"
        >Version history · {path ? noteTitle(path) : ''}</Dialog.Title
      >
      {#if snapshots.length === 0}
        <p class="empty">
          No earlier versions yet. Flint keeps one every few minutes while you edit a note.
        </p>
      {:else}
        <div class="body">
          <ul>
            {#each snapshots as snapshot (snapshot.time)}
              <li>
                <button
                  class:current={snapshot.time === selected}
                  onclick={() => select(snapshot.time)}
                >
                  {when(snapshot.time)}
                  <small>{snapshot.size} characters</small>
                </button>
              </li>
            {/each}
          </ul>
          <div class="preview">
            {#if selectedText !== null}
              <p class="legend">
                {#if isSame}
                  This version matches the note as it is now.
                {:else}
                  <span class="removed">Only in this version</span>
                  <span class="added">Only in the current note</span>
                {/if}
              </p>
              <pre>{#each changes as part, index (index)}<span
                    class:added={part.added}
                    class:removed={part.removed}>{part.value}</span
                  >{/each}</pre>
            {/if}
          </div>
        </div>
        <div class="actions">
          <button
            disabled={selectedText === null}
            onclick={() =>
              selectedText !== null && void navigator.clipboard.writeText(selectedText)}
          >
            Copy this version
          </button>
          <button class="primary" disabled={selectedText === null || isSame} onclick={restore}>
            Restore this version
          </button>
        </div>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.dialog.history) {
    display: flex;
    flex-direction: column;
    width: min(900px, calc(100vw - 32px));
    height: min(640px, calc(100vh - 32px));
    overflow: hidden;
  }

  .body {
    display: flex;
    flex: 1;
    gap: 12px;
    min-height: 0;
  }

  ul {
    width: 220px;
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
    cursor: pointer;
  }

  li button:hover {
    background: var(--hover);
  }

  li button.current {
    background: var(--selected);
  }

  small,
  .empty,
  .legend {
    color: var(--text-faint);
    font-size: 12px;
  }

  .preview {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .legend {
    display: flex;
    gap: 12px;
    margin: 0 0 6px;
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

  .added {
    background: color-mix(in srgb, #2da44e 25%, transparent);
  }

  .removed {
    background: color-mix(in srgb, #d04545 25%, transparent);
    text-decoration: line-through;
  }

  .legend .removed,
  .legend .added {
    padding: 0 6px;
    border-radius: 3px;
    color: var(--text);
    text-decoration: none;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

  .actions button {
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .actions button:disabled {
    cursor: default;
    opacity: 0.5;
  }

  .actions .primary {
    border-color: var(--accent);
    background: var(--accent);
    color: white;
  }
</style>
