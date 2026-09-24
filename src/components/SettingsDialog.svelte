<script lang="ts">
  import { Dialog } from 'bits-ui'
  import type { LinkUpdate } from '../lib/settings'
  import { workspace } from '../lib/workspace.svelte'

  const linkUpdateOptions: { value: LinkUpdate; label: string }[] = [
    { value: 'ask', label: 'Ask' },
    { value: 'always', label: 'Always' },
    { value: 'never', label: 'Never' },
  ]
</script>

<Dialog.Root bind:open={workspace.isSettingsOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="overlay" />
    <Dialog.Content class="dialog">
      <Dialog.Title class="dialog-title">Settings</Dialog.Title>
      <label class="setting">
        <span>
          <strong>Update links on rename</strong>
          <small>What to do with links pointing to a note or folder you rename or move.</small>
        </span>
        <select
          value={workspace.linkUpdate}
          onchange={(event) => workspace.setLinkUpdate(event.currentTarget.value as LinkUpdate)}
        >
          {#each linkUpdateOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.overlay) {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgb(0 0 0 / 0.4);
  }

  :global(.dialog) {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 50;
    width: min(560px, calc(100vw - 32px));
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--background);
    transform: translate(-50%, -50%);
    box-shadow: 0 8px 32px rgb(0 0 0 / 0.3);
  }

  :global(.dialog-title) {
    margin: 0 0 16px;
    font-size: 18px;
  }

  .setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .setting span {
    display: grid;
    gap: 4px;
  }

  small {
    color: var(--text-muted);
  }

  select {
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text);
    font: inherit;
  }
</style>
