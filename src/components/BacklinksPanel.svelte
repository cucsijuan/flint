<script lang="ts">
  import { noteTitle } from '../lib/paths'
  import type { Backlink } from '../lib/vault'
  import * as vault from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'

  let { path }: { path: string } = $props()

  let backlinks = $state<Backlink[]>([])

  $effect(() => {
    void workspace.indexVersion
    let isCurrent = true
    void vault.backlinks(path).then((found) => {
      if (isCurrent) backlinks = found
    })
    return () => (isCurrent = false)
  })

  const bySource = $derived(
    Map.groupBy(
      backlinks.filter(
        (link, i) =>
          i === 0 || link.source !== backlinks[i - 1].source || link.line !== backlinks[i - 1].line,
      ),
      (link) => link.source,
    ),
  )
</script>

<aside>
  <header>Backlinks <span class="count">{backlinks.length}</span></header>
  {#if bySource.size === 0}
    <p class="empty">No backlinks found.</p>
  {:else}
    <ul>
      {#each bySource as [source, links] (source)}
        <li>
          <button
            class="source"
            onclick={(event) =>
              workspace.openNote(source, { newTab: event.ctrlKey || event.metaKey })}
          >
            {noteTitle(source)}
          </button>
          {#each links as link (link.line)}
            <p class="context">{link.context}</p>
          {/each}
        </li>
      {/each}
    </ul>
  {/if}
</aside>

<style>
  aside {
    height: 100%;
    overflow: auto;
    background: var(--background-secondary);
  }

  header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
    font-weight: 600;
  }

  .count {
    color: var(--text-faint);
    font-weight: 400;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 8px;
  }

  li + li {
    margin-top: 12px;
  }

  .source {
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .context,
  .empty {
    margin: 4px 0 0;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.5;
  }

  .empty {
    padding: 12px;
  }
</style>
