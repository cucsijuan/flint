<script lang="ts">
  import { noteTitle } from '../lib/paths'
  import type { OutgoingLink } from '../lib/vault'
  import * as vault from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'
  import MentionList from './MentionList.svelte'

  let { path }: { path: string } = $props()

  let links = $state<OutgoingLink[]>([])

  $effect(() => {
    void workspace.indexVersion
    let isCurrent = true
    void vault.outgoingLinks(path).then((found) => {
      if (isCurrent) links = found
    })
    return () => (isCurrent = false)
  })

  function open(link: OutgoingLink, event: MouseEvent) {
    void workspace.openLink(link.target, path, { newTab: event.ctrlKey || event.metaKey })
  }
</script>

<aside>
  <header>Outgoing links <span class="count">{links.length}</span></header>
  {#if links.length === 0}
    <p class="empty">No outgoing links.</p>
  {:else}
    <ul>
      {#each links as link (link.path ?? link.target)}
        <li>
          <button
            class="link"
            class:unresolved={!link.path}
            title={link.path ?? 'Not created yet'}
            onclick={(event) => open(link, event)}
          >
            {link.path ? noteTitle(link.path) : link.target}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <MentionList load={() => vault.outgoingMentions(path)} groupBy="target" />
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

  .link {
    display: block;
    width: 100%;
    padding: 3px 4px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  .link:hover {
    background: var(--hover);
  }

  .unresolved {
    opacity: 0.6;
  }

  .empty {
    margin: 0;
    padding: 12px;
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
