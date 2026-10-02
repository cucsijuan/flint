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
    <ul class="root">{@render list(workspace.bookmarks, [])}</ul>
  {/if}
</section>

{#snippet list(items: BookmarkItem[], parent: BookmarkPath)}
  {#each items as item, index (item.type === 'other' ? `other-${index}` : `${item.ctime}-${index}`)}
    {@const path = [...parent, index]}
    {@const key = keyOf(path)}
    {@const zone = indicator?.key === key ? indicator.zone : null}
    {@const isOpen = item.type === 'group' && !collapsed.has(item.ctime)}
    <li>
      {#if item.type === 'group' && renaming === key}
        <input
          class="rename"
          style:padding-left="{parent.length * 12 + 22}px"
          value={item.title}
          onblur={(event) => finishRename(path, event.currentTarget, true)}
          onkeydown={(event) => {
            if (event.key === 'Enter') finishRename(path, event.currentTarget, true)
            else if (event.key === 'Escape') finishRename(path, event.currentTarget, false)
          }}
          {@attach focus}
        />
      {:else}
        <button
          class="row"
          class:drop-before={zone === 'before'}
          class:drop-after={zone === 'after'}
          class:drop-into={zone === 'into'}
          class:missing={'path' in item && !existing.has(item.path)}
          style:padding-left="{parent.length * 12 + 6}px"
          title={item.type === 'group' || item.type === 'other'
            ? undefined
            : 'path' in item
              ? item.path
              : item.query}
          disabled={item.type === 'other'}
          {@attach dragAndDrop(path, item.type === 'group')}
          onclick={(event) => {
            if (item.type === 'group') {
              if (collapsed.has(item.ctime)) collapsed.delete(item.ctime)
              else collapsed.add(item.ctime)
            } else if (item.type !== 'other') {
              workspace.openBookmark(item, { newTab: event.ctrlKey || event.metaKey })
            }
          }}
          ondblclick={() => item.type === 'group' && (renaming = key)}
        >
          {#if item.type === 'group'}
            <span class="chevron" class:open={isOpen}><ChevronRight size={14} /></span>
          {:else if item.type === 'search'}
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
          title={item.type === 'group' ? 'Remove group (keeps its bookmarks)' : 'Remove bookmark'}
          onclick={() =>
            item.type === 'group'
              ? workspace.ungroupBookmarks(path)
              : workspace.removeBookmark(path)}
        >
          <X size={14} />
        </button>
      {/if}
      {#if item.type === 'group' && isOpen && item.items.length}
        <ul>{@render list(item.items, path)}</ul>
      {/if}
    </li>
  {/each}
{/snippet}

<style>
  section {
    height: 100%;
    overflow: auto;
    padding: 4px;
  }

  header {
    display: flex;
    justify-content: flex-end;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    position: relative;
  }

  .row,
  .rename {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: 26px;
    padding-right: 26px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  .row:hover {
    background: var(--hover);
  }

  .row:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  .row.missing .name {
    color: var(--text-faint);
    text-decoration: line-through;
  }

  .row.drop-before {
    box-shadow: inset 0 2px 0 var(--accent);
  }

  .row.drop-after {
    box-shadow: inset 0 -2px 0 var(--accent);
  }

  .row.drop-into {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
  }

  .rename {
    outline: 1px solid var(--accent);
    background: var(--background);
    cursor: text;
  }

  .chevron {
    display: flex;
    transition: transform 0.1s;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove {
    position: absolute;
    top: 3px;
    right: 4px;
    visibility: hidden;
  }

  li:hover > .remove {
    visibility: visible;
  }

  .empty {
    margin: 0;
    padding: 8px;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.5;
  }
</style>
