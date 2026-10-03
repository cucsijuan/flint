<script lang="ts">
  import type { Snippet } from 'svelte'

  let { name, description, children }: { name: string; description?: string; children: Snippet } =
    $props()
</script>

<label class="setting">
  <span class="text">
    <strong>{name}</strong>
    {#if description}<small>{description}</small>{/if}
  </span>
  {@render children()}
</label>

<style>
  .setting {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }

  .text {
    display: grid;
    flex: 1 1 200px;
    gap: 4px;
  }

  small {
    color: var(--text-muted);
  }

  .setting :global(select),
  .setting :global(input:not([type='checkbox'], [type='color'])) {
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text);
    font: inherit;
  }

  .setting :global(input[type='checkbox']) {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
  }
</style>
