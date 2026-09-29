<script lang="ts">
  import { ChevronRight } from '@lucide/svelte'
  import { noteTitle } from '../lib/paths'
  import type { Mention } from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'

  let {
    load,
    groupBy,
  }: {
    /** Fetches the mentions; runs only while the list is open, since it scans the vault. */
    load: () => Promise<Mention[]>
    /** Which note heads each group: where the mention is, or the note it names. */
    groupBy: 'source' | 'target'
  } = $props()

  let isOpen = $state(false)
  let mentions = $state<Mention[] | null>(null)

  $effect(() => {
    void workspace.indexVersion
    if (!isOpen) return
    let isCurrent = true
    void load().then((found) => {
      if (isCurrent) mentions = found
    })
    return () => (isCurrent = false)
  })

  const groups = $derived(Map.groupBy(mentions ?? [], (mention) => mention[groupBy]))
</script>

<section>
  <button class="toggle" onclick={() => (isOpen = !isOpen)}>
    <span class="chevron" class:open={isOpen}><ChevronRight size={14} /></span>
    Unlinked mentions
    {#if isOpen && mentions}<span class="count">{mentions.length}</span>{/if}
  </button>
  {#if isOpen}
    {#if mentions?.length === 0}
      <p class="empty">No unlinked mentions found.</p>
    {:else}
      <ul>
        {#each groups as [note, found] (note)}
          <li>
            <button
              class="note"
              onclick={(event) =>
                workspace.openNote(note, { newTab: event.ctrlKey || event.metaKey })}
            >
              {noteTitle(note)}
            </button>
            {#each found as mention (`${mention.source}:${mention.line}:${mention.target}`)}
              <div class="mention">
                <button
                  class="context"
                  onclick={() => workspace.openNoteAt(mention.source, { line: mention.line })}
                >
                  {mention.context}
                </button>
                <button class="link" onclick={() => workspace.linkMention(mention)}>Link</button>
              </div>
            {/each}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  section {
    border-top: 1px solid var(--border);
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .chevron {
    display: inline-flex;
    transition: transform 0.1s;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .count {
    color: var(--text-faint);
    font-weight: 400;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0 8px 8px;
  }

  li + li {
    margin-top: 12px;
  }

  .note {
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .mention {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-top: 4px;
  }

  .context {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: none;
    background: none;
    color: var(--text-muted);
    font: inherit;
    font-size: 12px;
    line-height: 1.5;
    text-align: left;
    cursor: pointer;
  }

  .link {
    flex-shrink: 0;
    padding: 1px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background);
    color: var(--text);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
  }

  .link:hover {
    background: var(--hover);
  }

  .empty {
    margin: 0;
    padding: 0 12px 12px;
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
