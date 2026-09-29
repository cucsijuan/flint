<script lang="ts">
  import { ArrowUpDown, Bookmark, Check, Replace } from '@lucide/svelte'
  import { DropdownMenu } from 'bits-ui'
  import { noteTitle, parentOf } from '../lib/paths'
  import type { SearchSort } from '../lib/vault'
  import { type ReplaceScope, workspace } from '../lib/workspace.svelte'

  const SORTS: { value: SearchSort; label: string }[] = [
    { value: 'name-ascending', label: 'File name (A to Z)' },
    { value: 'name-descending', label: 'File name (Z to A)' },
    { value: 'modified-newest', label: 'Modified time (new to old)' },
    { value: 'modified-oldest', label: 'Modified time (old to new)' },
    { value: 'created-newest', label: 'Created time (new to old)' },
    { value: 'created-oldest', label: 'Created time (old to new)' },
  ]

  const SCOPES: { value: ReplaceScope; label: string }[] = [
    { value: 'note', label: 'Current note' },
    { value: 'folder', label: "Current note's folder" },
    { value: 'vault', label: 'Whole vault' },
  ]

  let input: HTMLInputElement
  let isReplacing = $state(false)
  let replacement = $state('')
  const targets = $derived(new Set(workspace.replaceTargets.map((result) => result.path)))

  $effect(() => {
    if (workspace.searchFocus) input.focus()
  })
</script>

<section>
  <div class="bar">
    <input
      bind:this={input}
      type="search"
      placeholder="Search…"
      value={workspace.searchQuery}
      oninput={(event) => workspace.search(event.currentTarget.value)}
    />
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="icon" title="Sort results">
        <ArrowUpDown size={15} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="menu" align="end">
          {#each SORTS as sort (sort.value)}
            <DropdownMenu.Item
              class="menu-item sort"
              onSelect={() => workspace.setSearchSort(sort.value)}
            >
              <span class="check">
                {#if workspace.settings.value.searchSort === sort.value}<Check size={14} />{/if}
              </span>
              {sort.label}
            </DropdownMenu.Item>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    <button
      class="icon"
      class:on={isReplacing}
      title="Replace"
      onclick={() => (isReplacing = !isReplacing)}
    >
      <Replace size={15} />
    </button>
    {#if workspace.searchQuery.trim()}
      {@const target = { type: 'search' as const, query: workspace.searchQuery.trim() }}
      {@const isBookmarked = workspace.isBookmarked(target)}
      <button
        class="icon"
        class:on={isBookmarked}
        title={isBookmarked ? 'Remove bookmark' : 'Bookmark this search'}
        onclick={() => workspace.toggleBookmark(target)}
      >
        <Bookmark size={15} fill={isBookmarked ? 'currentColor' : 'none'} />
      </button>
    {/if}
  </div>
  {#if isReplacing}
    <div class="replace">
      <input type="text" placeholder="Replace with…" bind:value={replacement} />
      <div class="replace-actions">
        <select bind:value={workspace.replaceScope} title="Where to replace">
          {#each SCOPES as scope (scope.value)}
            <option value={scope.value}>{scope.label}</option>
          {/each}
        </select>
        <button
          class="replace-all"
          disabled={!workspace.searchQuery.trim() || !targets.size}
          onclick={() => void workspace.replaceAll(replacement)}
        >
          Replace all
        </button>
      </div>
    </div>
  {/if}
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
          <button
            class="note"
            onclick={(event) =>
              workspace.openNote(result.path, { newTab: event.ctrlKey || event.metaKey })}
          >
            {noteTitle(result.path)}
            <small>{parentOf(result.path)}</small>
          </button>
          {#each result.lines as match (match.line)}
            <div class="line-row">
              <button
                class="line"
                onclick={(event) =>
                  workspace.openNoteAt(
                    result.path,
                    { line: match.line },
                    { newTab: event.ctrlKey || event.metaKey },
                  )}
              >
                {#each match.segments as segment, index (index)}
                  <span class:highlight={segment.highlight}>{segment.text}</span>
                {/each}
              </button>
              {#if isReplacing && targets.has(result.path)}
                <button
                  class="replace-line"
                  title="Replace in this line"
                  onclick={() => void workspace.replaceLine(result.path, match.line, replacement)}
                >
                  <Replace size={13} />
                </button>
              {/if}
            </div>
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

  .bar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 2px;
    margin: 8px;
  }

  .on {
    color: var(--accent);
  }

  input {
    flex: 1;
    min-width: 0;
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

  ul button {
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

  ul button:hover {
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

  .replace {
    display: grid;
    flex-shrink: 0;
    gap: 6px;
    margin: 0 8px 8px;
  }

  .replace-actions {
    display: flex;
    gap: 6px;
  }

  .replace select,
  .replace-all {
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text);
    font: inherit;
    font-size: 12px;
  }

  .replace select {
    flex: 1;
    min-width: 0;
  }

  .replace-all {
    cursor: pointer;
  }

  .replace-all:disabled {
    cursor: default;
    opacity: 0.5;
  }

  .line-row {
    display: flex;
    align-items: center;
  }

  .line-row .line {
    flex: 1;
    min-width: 0;
  }

  ul .replace-line {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 24px;
    padding: 3px;
    color: var(--text-muted);
    opacity: 0;
  }

  .line-row:hover .replace-line {
    opacity: 1;
  }

  :global(.sort) {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .check {
    display: inline-flex;
    width: 14px;
  }

  .highlight {
    border-radius: 2px;
    background: color-mix(in srgb, var(--accent) 30%, transparent);
    color: var(--text);
  }
</style>
