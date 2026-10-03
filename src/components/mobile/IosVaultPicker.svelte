<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { FolderOpen } from '@lucide/svelte'
  import { workspace } from '../../lib/workspace.svelte'

  const folders = $derived(workspace.iosVaults)
  let name = $state('')

  $effect(() => {
    if (folders) name = ''
  })

  const close = () => (workspace.iosVaults = null)
</script>

<Dialog.Root open={folders !== null} onOpenChange={(open) => !open && close()}>
  <Dialog.Portal>
    <Dialog.Overlay class="overlay" />
    <Dialog.Content class="dialog vault-picker">
      <Dialog.Title class="dialog-title">Open a vault</Dialog.Title>
      <Dialog.Description class="hint">
        Vaults are folders in Flint's folder of the Files app.
      </Dialog.Description>
      {#if folders?.vaults.length}
        <ul>
          {#each folders.vaults as vault (vault)}
            <li>
              <button onclick={() => workspace.openIosVault(vault)}>
                <FolderOpen size={20} />
                {vault}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
      <form
        onsubmit={(event) => {
          event.preventDefault()
          void workspace.openIosVault(name)
        }}
      >
        <input bind:value={name} placeholder="New vault name" enterkeyhint="done" />
        <button type="submit" class="primary" disabled={!name.trim()}>Create</button>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.dialog.vault-picker) {
    width: min(92vw, 420px);
  }

  :global(.vault-picker .hint) {
    margin: -8px 0 12px;
    color: var(--text-muted);
  }

  ul {
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
  }

  li button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 8px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
  }

  li button:active {
    background: var(--hover);
  }

  form {
    display: flex;
    gap: 8px;
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 10px 12px;
    font-size: 16px;
  }

  .primary {
    padding: 8px 16px;
    border: 1px solid var(--accent);
    border-radius: 8px;
    background: var(--accent);
    color: white;
    font: inherit;
  }

  .primary:disabled {
    opacity: 0.5;
  }
</style>
