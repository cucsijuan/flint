<script lang="ts">
  import { workspace } from '../lib/workspace.svelte'
</script>

<main>
  <h1>Flint</h1>
  <p>Open a folder of Markdown notes to get started.</p>
  <button class="primary" onclick={() => workspace.chooseVault()}>Open folder</button>
</main>

<style>
  main {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 12px;
    height: 100%;
  }

  h1 {
    margin: 0;
    font-size: 32px;
  }

  p {
    margin: 0;
    color: var(--text-muted);
  }
</style>
