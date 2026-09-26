<script lang="ts">
  import {
    attachClosestEdge,
    type Edge,
    extractClosestEdge,
  } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
  import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
  import {
    draggable,
    dropTargetForElements,
  } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
  import { FileText, Heading, Search, X } from '@lucide/svelte'
  import type { Bookmark } from '../lib/bookmarks'
  import { noteTitle } from '../lib/paths'
  import { workspace } from '../lib/workspace.svelte'

  type BookmarkDrag = { type: 'bookmark'; index: number }

  let indicator = $state<{ index: number; edge: Edge } | null>(null)
  const existing = $derived(new Set(workspace.entries.map((entry) => entry.path)))

  const isBookmarkDrag = (data: Record<string | symbol, unknown>): data is BookmarkDrag =>
    data.type === 'bookmark'

  function label(bookmark: Bookmark) {
    if (bookmark.type === 'search') return bookmark.query
    const title = noteTitle(bookmark.path)
    return bookmark.type === 'heading' ? `${title} › ${bookmark.subpath.replace(/^#/, '')}` : title
  }

  function reorder(index: number) {
    return (element: HTMLElement) =>
      combine(
        draggable({ element, getInitialData: () => ({ type: 'bookmark', index }) }),
        dropTargetForElements({
          element,
          canDrop: ({ source }) => isBookmarkDrag(source.data),
          getData: ({ input }) =>
            attachClosestEdge({}, { element, input, allowedEdges: ['top', 'bottom'] }),
          onDrag: ({ self }) =>
            (indicator = { index, edge: extractClosestEdge(self.data) ?? 'top' }),
          onDragLeave: () => (indicator = null),
          onDrop: ({ source, self }) => {
            indicator = null
            if (!isBookmarkDrag(source.data)) return
            const from = source.data.index
            let to = extractClosestEdge(self.data) === 'bottom' ? index + 1 : index
            if (from < to) to--
            if (from !== to) workspace.moveBookmark(from, to)
          },
        }),
      )
  }
</script>

<section>
  {#if workspace.bookmarks.length === 0}
    <p class="empty">
      No bookmarks yet. Bookmark a note from its header, a heading from the outline, or a search
      from the search panel.
    </p>
  {:else}
    <ul>
      {#each workspace.bookmarks as bookmark, index (bookmark.ctime)}
        <li
          class:drop-top={indicator?.index === index && indicator.edge === 'top'}
          class:drop-bottom={indicator?.index === index && indicator.edge === 'bottom'}
          {@attach reorder(index)}
        >
          <button
            class="open"
            class:missing={'path' in bookmark && !existing.has(bookmark.path)}
            title={'path' in bookmark ? bookmark.path : bookmark.query}
            onclick={(event) =>
              workspace.openBookmark(bookmark, { newTab: event.ctrlKey || event.metaKey })}
          >
            {#if bookmark.type === 'search'}
              <Search size={14} />
            {:else if bookmark.type === 'heading'}
              <Heading size={14} />
            {:else}
              <FileText size={14} />
            {/if}
            <span>{label(bookmark)}</span>
          </button>
          <button
            class="icon remove"
            title="Remove bookmark"
            onclick={() => workspace.toggleBookmark(bookmark)}
          >
            <X size={14} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section {
    height: 100%;
    overflow: auto;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 6px;
  }

  li {
    display: flex;
    align-items: center;
    border-radius: 4px;
  }

  li:hover {
    background: var(--hover);
  }

  li.drop-top {
    box-shadow: inset 0 2px 0 var(--accent);
  }

  li.drop-bottom {
    box-shadow: inset 0 -2px 0 var(--accent);
  }

  .open {
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    border: none;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  .open span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .open.missing {
    color: var(--text-faint);
    text-decoration: line-through;
  }

  .remove {
    visibility: hidden;
  }

  li:hover .remove {
    visibility: visible;
  }

  .empty {
    margin: 0;
    padding: 12px;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.5;
  }
</style>
