<script lang="ts">
  import { noteTitle, parentOf } from '../lib/paths'
  import { workspace } from '../lib/workspace.svelte'

  let input: HTMLInputElement

  $effect(() => {
    if (workspace.searchFocus) input.focus()
  })
</script>

<section>
  <input
    bind:this={input}
    type="search"
    placeholder="Search…"
    value={workspace.searchQuery}
    oninput={(event) => workspace.search(event.currentTarget.value)}
  />
  {#if workspace.searchError}
    <p class="message error">{workspace.searchError}</p>
  {:else if workspace.searchQuery.trim()}
    <p class="message">
      {workspace.searchResults.length}
      {workspace.searchResults.length === 1 ? 'note' : 'notes'}
    </p>
    <ul>
      {#each workspace.searchResults as result (result.path)}
        <li>
          <button class="note" onclick={() => workspace.openNote(result.path)}>
            {noteTitle(result.path)}
            <small>{parentOf(result.path)}</small>
          </button>
          {#each result.lines as match (match.line)}
            <button
              class="line"
              onclick={() => workspace.openNoteAt(result.path, { line: match.line })}
            >
              {#each match.segments as segment, index (index)}
                <span class:highlight={segment.highlight}>{segment.text}</span>
              {/each}
            </button>
          {/each}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  input {
    margin: 8px;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background);
    color: var(--text);
    font: inherit;
    font-size: 13px;
  }

  .message {
    margin: 0 12px 4px;
    color: var(--text-faint);
    font-size: 12px;
  }

  .error {
    color: #d04545;
  }

  ul {
    flex: 1;
    min-height: 0;
    overflow: auto;
    list-style: none;
    margin: 0;
    padding: 0 4px 8px;
  }

  li + li {
    margin-top: 8px;
  }

  button {
    display: block;
    width: 100%;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  button:hover {
    background: var(--hover);
  }

  .note {
    padding: 4px 8px;
    font-size: 13px;
    font-weight: 600;
  }

  .note small {
    margin-left: 6px;
    color: var(--text-faint);
    font-weight: 400;
  }

  .line {
    padding: 3px 8px 3px 16px;
    overflow: hidden;
    color: var(--text-muted);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .highlight {
    border-radius: 2px;
    background: color-mix(in srgb, var(--accent) 30%, transparent);
    color: var(--text);
  }
</style>
