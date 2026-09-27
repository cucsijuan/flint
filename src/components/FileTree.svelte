<script lang="ts">
  import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
  import {
    draggable,
    dropTargetForElements,
  } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
  import { ChevronRight, File, FileText, Image } from '@lucide/svelte'
  import { ContextMenu } from 'bits-ui'
  import { isImage, isWithin, noteTitle, parentOf } from '../lib/paths'
  import type { TreeNode } from '../lib/tree'
  import { workspace } from '../lib/workspace.svelte'

  type EntryDrag = { type: 'entry'; path: string }

  const expanded = workspace.expandedFolders
  let dropFolder = $state<string | null>(null)
  let target = $state<TreeNode>()
  let targetFolder = $derived(target?.kind === 'folder' ? target.path : '')

  function expandThen(folder: string, action: () => void) {
    if (folder) expanded.add(folder)
    action()
  }

  function toggle(node: TreeNode, event: MouseEvent) {
    const newTab = event.ctrlKey || event.metaKey || event.button === 1
    if (node.kind === 'file') workspace.openNote(node.path, { newTab })
    else if (node.kind === 'attachment') void workspace.openFile(node.path, { newTab })
    else if (expanded.has(node.path)) expanded.delete(node.path)
    else expanded.add(node.path)
  }

  function onRenameKey(event: KeyboardEvent, node: TreeNode) {
    const input = event.currentTarget as HTMLInputElement
    if (event.key === 'Enter') input.blur()
    if (event.key === 'Escape') {
      input.value = displayName(node)
      input.blur()
    }
  }

  const displayName = (node: TreeNode) => (node.kind === 'file' ? noteTitle(node.path) : node.name)

  const isEntryDrag = (data: Record<string | symbol, unknown>): data is EntryDrag =>
    data.type === 'entry'

  const canMove = (path: string, folder: string) =>
    folder !== parentOf(path) && !isWithin(folder, path)

  /** Dropping on a row moves into that folder, or into the folder of the note under the pointer. */
  function moveTarget(folder: string, element: HTMLElement) {
    const isInnermost = (targets: { element: Element }[]) => targets[0]?.element === element
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => isEntryDrag(source.data),
      onDrag: ({ source, location }) => {
        if (!isInnermost(location.current.dropTargets) || !isEntryDrag(source.data)) return
        dropFolder = canMove(source.data.path, folder) ? folder : null
      },
      onDragLeave: () => {
        if (dropFolder === folder) dropFolder = null
      },
      onDrop: ({ source, location }) => {
        dropFolder = null
        if (!isInnermost(location.current.dropTargets) || !isEntryDrag(source.data)) return
        if (canMove(source.data.path, folder)) void workspace.move(source.data.path, folder)
      },
    })
  }

  function entryDragAndDrop(node: TreeNode) {
    return (element: HTMLElement) =>
      combine(
        draggable({ element, getInitialData: () => ({ type: 'entry', path: node.path }) }),
        moveTarget(node.kind === 'folder' ? node.path : parentOf(node.path), element),
      )
  }

  function selectOnMount(input: HTMLInputElement) {
    input.focus()
    input.select()
  }
</script>

{#snippet branch(nodes: TreeNode[], depth: number)}
  {#each nodes as node (node.path)}
    <li>
      {#if workspace.renaming === node.path}
        <input
          class="rename"
          style:padding-left="{depth * 12 + 22}px"
          value={displayName(node)}
          onkeydown={(event) => onRenameKey(event, node)}
          onblur={(event) => workspace.rename(node.path, event.currentTarget.value)}
          {@attach selectOnMount}
        />
      {:else}
        <button
          class="row"
          class:active={workspace.notePath === node.path}
          class:drop-target={dropFolder !== null &&
            dropFolder === (node.kind === 'folder' ? node.path : parentOf(node.path))}
          {@attach entryDragAndDrop(node)}
          style:padding-left="{depth * 12 + 6}px"
          onclick={(event) => toggle(node, event)}
          onauxclick={(event) => event.button === 1 && toggle(node, event)}
          ondblclick={() => (workspace.renaming = node.path)}
          oncontextmenu={() => (target = node)}
        >
          {#if node.kind === 'folder'}
            <span class="chevron" class:open={expanded.has(node.path)}>
              <ChevronRight size={14} />
            </span>
          {:else if node.kind === 'file'}
            <FileText size={14} />
          {:else if isImage(node.path)}
            <Image size={14} />
          {:else}
            <File size={14} />
          {/if}
          <span class="name">{displayName(node)}</span>
        </button>
      {/if}
      {#if node.kind === 'folder' && expanded.has(node.path)}
        <ul>{@render branch(node.children, depth + 1)}</ul>
      {/if}
    </li>
  {/each}
{/snippet}

<ContextMenu.Root onOpenChange={(open) => !open && (target = undefined)}>
  <ContextMenu.Trigger class="tree">
    <ul class="root" {@attach (element) => moveTarget('', element)}>
      {@render branch(workspace.tree, 0)}
    </ul>
  </ContextMenu.Trigger>
  <ContextMenu.Portal>
    <ContextMenu.Content class="menu">
      {#if !target || target.kind === 'folder'}
        <ContextMenu.Item
          class="menu-item"
          onSelect={() => expandThen(targetFolder, () => workspace.createNote(targetFolder))}
        >
          New note
        </ContextMenu.Item>
        <ContextMenu.Item
          class="menu-item"
          onSelect={() => expandThen(targetFolder, () => workspace.createFolder(targetFolder))}
        >
          New folder
        </ContextMenu.Item>
      {/if}
      {#if target}
        {@const path = target.path}
        {#if target.kind === 'folder'}<ContextMenu.Separator class="menu-separator" />{/if}
        {#if target.kind === 'file'}
          <ContextMenu.Item
            class="menu-item"
            onSelect={() => workspace.toggleBookmark({ type: 'file', path })}
          >
            {workspace.isBookmarked({ type: 'file', path }) ? 'Remove bookmark' : 'Bookmark'}
          </ContextMenu.Item>
        {/if}
        {#if target.kind !== 'folder'}
          <ContextMenu.Item class="menu-item" onSelect={() => workspace.duplicate(path)}>
            Duplicate
          </ContextMenu.Item>
        {/if}
        <ContextMenu.Item class="menu-item" onSelect={() => (workspace.renaming = path)}>
          Rename
        </ContextMenu.Item>
        <ContextMenu.Item class="menu-item danger" onSelect={() => workspace.trash(path)}>
          Delete
        </ContextMenu.Item>
      {/if}
    </ContextMenu.Content>
  </ContextMenu.Portal>
</ContextMenu.Root>

<style>
  :global(.tree) {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 4px;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .root {
    min-height: 100%;
  }

  .row.drop-target {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
  }

  .row,
  .rename {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: 26px;
    padding-right: 6px;
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

  .row.active {
    background: var(--selected);
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
</style>
