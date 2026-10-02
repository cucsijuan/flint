<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { workspace } from '../../lib/workspace.svelte'

  const prompt = $derived(workspace.namePrompt)
  let name = $state('')

  $effect(() => {
    if (prompt) name = ''
  })

  const finish = (value: string | null) => prompt?.resolve(value)
  const focus = (input: HTMLInputElement) => input.focus()
</script>

<Dialog.Root open={prompt !== null} onOpenChange={(open) => !open && finish(null)}>
  <Dialog.Portal>
    <Dialog.Overlay class="overlay" />
    <Dialog.Content class="dialog name-prompt">
      <Dialog.Title class="dialog-title">{prompt?.title}</Dialog.Title>
      <form
        onsubmit={(event) => {
          event.preventDefault()
          finish(name)
        }}
      >
        <input bind:value={name} placeholder="Untitled" enterkeyhint="done" {@attach focus} />
        <div class="actions">
          <button type="button" onclick={() => finish(null)}>Cancel</button>
          <button type="submit" class="primary">Create</button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.dialog.name-prompt) {
    width: min(92vw, 420px);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  input {
    padding: 10px 12px;
    font-size: 16px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .actions button {
    padding: 8px 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: none;
    color: var(--text);
    font: inherit;
  }

  .actions .primary {
    border-color: var(--accent);
    background: var(--accent);
    color: white;
  }
</style>
