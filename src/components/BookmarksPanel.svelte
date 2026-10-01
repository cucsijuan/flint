<script lang="ts">
  import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
  import {
    draggable,
    dropTargetForElements,
  } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
  import {
    Bookmark as BookmarkIcon,
    ChevronRight,
    FileText,
    Folder,
    FolderPlus,
    Heading,
    Search,
    X,
  } from '@lucide/svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import type { BookmarkItem, BookmarkPath } from '../lib/bookmarks'
  import { basename, noteTitle } from '../lib/paths'
  import { workspace } from '../lib/workspace.svelte'

  type BookmarkDrag = { type: 'bookmark'; path: BookmarkPath }
  type Zone = 'before' | 'after' | 'into'

  const collapsed = new SvelteSet<number>()
  let indicator = $state<{ key: string; zone: Zone } | null>(null)
  let renaming = $state<string | null>(null)
  const existing = $derived(new Set(workspace.entries.map((entry) => entry.path)))

  const isBookmarkDrag = (data: Record<string | symbol, unknown>): data is BookmarkDrag =>
    data.type === 'bookmark'
  const keyOf = (path: BookmarkPath) => path.join('.')

  function label(item: BookmarkItem) {
    if (item.type === 'other') return String(item.raw.title ?? item.raw.type)
    if (item.type === 'group') return item.title || 'Untitled group'
    if (item.title) return item.title
    if (item.type === 'search') return item.query
    if (item.type === 'folder') return basename(item.path)
    const title = noteTitle(item.path)
    return item.type === 'heading' ? `${title} › ${item.subpath.replace(/^#/, '')}` : title
  }

  /** Top and bottom quarters drop beside the row; the middle of a group drops into it. */
  function zoneAt(element: HTMLElement, clientY: number, isGroup: boolean): Zone {
    const { top, height } = element.getBoundingClientRect()
    const ratio = (clientY - top) / height
    if (!isGroup) return ratio < 0.5 ? 'before' : 'after'
    return ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'into'
  }

  function dragAndDrop(path: BookmarkPath, isGroup: boolean) {
    return (element: HTMLElement) =>
      combine(
        draggable({ element, getInitialData: () => ({ type: 'bookmark', path }) }),
        dropTargetForElements({
          element,
          canDrop: ({ source }) => isBookmarkDrag(source.data),
          getIsSticky: () => true,
          onDrag: ({ location }) => {
            const zone = zoneAt(element, location.current.input.clientY, isGroup)
            indicator = { key: keyOf(path), zone }
          },
          onDragLeave: () => (indicator = null),
          onDrop: ({ source, location }) => {
            indicator = null
            if (!isBookmarkDrag(source.data)) return
            const zone = zoneAt(element, location.current.input.clientY, isGroup)
            const index = path[path.length - 1]
            if (zone === 'into') workspace.moveBookmark(source.data.path, path, 0)
            else
              workspace.moveBookmark(
                source.data.path,
                path.slice(0, -1),
                zone === 'after' ? index + 1 : index,
              )
          },
        }),
      )
  }

  function finishRename(path: BookmarkPath, input: HTMLInputElement, save: boolean) {
    renaming = null
    if (save) workspace.renameBookmarkGroup(path, input.value.trim())
  }

  function newGroup() {
    workspace.addBookmarkGroup('New group')
    renaming = keyOf([workspace.bookmarks.length - 1])
  }

  const focus = (input: HTMLInputElement) => {
    input.focus()
    input.select()
  }
</script>

<section>
  <header>
    <button class="icon" title="New group" onclick={newGroup}><FolderPlus size={14} /></button>
  </header>
  {#if workspace.bookmarks.length === 0}
    <p class="empty">
      No bookmarks yet. Bookmark a note from its header or the file tree, a heading from the
      outline, or a search from the search panel.
    </p>
  {:else}
    <ul>{@render list(workspace.bookmarks, [])}</ul>
  {/if}
</section>

{#snippet list(items: BookmarkItem[], parent: BookmarkPath)}
  {#each items as item, index (item.type === 'other' ? `other-${index}` : `${item.ctime}-${index}`)}
    {@const path = [...parent, index]}
    {@const key = keyOf(path)}
    {@const zone = indicator?.key === key ? indicator.zone : null}
    <li>
      <div
        class="row"
        class:drop-before={zone === 'before'}
        class:drop-after={zone === 'after'}
        class:drop-into={zone === 'into'}
        style:padding-left="{parent.length * 14}px"
        {@attach dragAndDrop(path, item.type === 'group')}
      >
        {#if item.type === 'group'}
          <button
            class="open"
            onclick={() =>
              collapsed.has(item.ctime) ? collapsed.delete(item.ctime) : collapsed.add(item.ctime)}
            ondblclick={() => (renaming = key)}
          >
            <span class="chevron" class:open={!collapsed.has(item.ctime)}>
              <ChevronRight size={14} />
            </span>
            {#if renaming === key}
              <input
                value={item.title}
                onclick={(event) => event.stopPropagation()}
                onblur={(event) => finishRename(path, event.currentTarget, true)}
                onkeydown={(event) => {
                  if (event.key === 'Enter') finishRename(path, event.currentTarget, true)
                  else if (event.key === 'Escape') finishRename(path, event.currentTarget, false)
                }}
                {@attach focus}
              />
            {:else}
              <span class="name">{label(item)}</span>
            {/if}
          </button>
          <button
            class="icon remove"
            title="Remove group (keeps its bookmarks)"
            onclick={() => workspace.ungroupBookmarks(path)}
          >
            <X size={14} />
          </button>
        {:else}
          <button
            class="open"
            class:missing={'path' in item && !existing.has(item.path)}
            title={item.type === 'other' ? undefined : 'path' in item ? item.path : item.query}
            disabled={item.type === 'other'}
            onclick={(event) =>
              item.type !== 'other' &&
              workspace.openBookmark(item, { newTab: event.ctrlKey || event.metaKey })}
          >
            {#if item.type === 'search'}
              <Search size={14} />
            {:else if item.type === 'heading'}
              <Heading size={14} />
            {:else if item.type === 'folder'}
              <Folder size={14} />
            {:else if item.type === 'file'}
              <FileText size={14} />
            {:else}
              <BookmarkIcon size={14} />
            {/if}
            <span class="name">{label(item)}</span>
          </button>
          <button
            class="icon remove"
            title="Remove bookmark"
            onclick={() => workspace.removeBookmark(path)}
          >
            <X size={14} />
          </button>
        {/if}
      </div>
      {#if item.type === 'group' && !collapsed.has(item.ctime)}
        {#if item.items.length}
          <ul>{@render list(item.items, path)}</ul>
        {:else}
          <p class="hint" style:padding-left="{(parent.length + 1) * 14 + 26}px">
            Drag bookmarks here
          </p>
        {/if}
      {/if}
    </li>
  {/each}
{/snippet}

<style>
  section {
    height: 100%;
    overflow: auto;
  }

  header {
    display: flex;
    justify-content: flex-end;
    padding: 6px 6px 0;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  section > ul {
    padding: 4px 6px 6px;
  }

  .row {
    display: flex;
    align-items: center;
    border-radius: 4px;
  }

  .row:hover {
    background: var(--hover);
  }

  .row.drop-before {
    box-shadow: inset 0 2px 0 var(--accent);
  }

  .row.drop-after {
    box-shadow: inset 0 -2px 0 var(--accent);
  }

  .row.drop-into {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
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

  .open:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .open input {
    flex: 1;
    min-width: 0;
    font: inherit;
  }

  .chevron {
    display: inline-flex;
    transition: transform 0.1s;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .open.missing {
    color: var(--text-faint);
    text-decoration: line-through;
  }

  .remove {
    visibility: hidden;
  }

  .row:hover .remove {
    visibility: visible;
  }

  .empty,
  .hint {
    margin: 0;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.5;
  }

  .empty {
    padding: 12px;
  }

  .hint {
    padding-top: 2px;
    padding-bottom: 4px;
    color: var(--text-faint);
  }
</style>
