<script lang="ts">
  import { workspace } from '../lib/workspace.svelte'
</script>

{#if workspace.tags.length === 0}
  <p class="empty">No tags found.</p>
{:else}
  <ul>
    {#each workspace.tags as { tag, count } (tag)}
      {@const depth = tag.split('/').length - 1}
      <li>
        <button
          style:padding-left="{depth * 14 + 8}px"
          onclick={() => workspace.openSearch(`tag:#${tag}`)}
        >
          <span>#{tag.split('/').at(-1)}</span>
          <small>{count}</small>
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 8px 4px;
  }

  button {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  button:hover {
    background: var(--hover);
  }

  small {
    color: var(--text-faint);
  }

  .empty {
    padding: 12px;
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
