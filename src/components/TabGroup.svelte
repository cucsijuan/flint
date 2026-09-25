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
  import { FileText, Image, Plus, Waypoints, X } from '@lucide/svelte'
  import { ContextMenu } from 'bits-ui'
  import * as layouts from '../lib/layout'
  import { basename, noteTitle } from '../lib/paths'
  import { workspace } from '../lib/workspace.svelte'
  import EmptyTab from './EmptyTab.svelte'
  import FileView from './FileView.svelte'
  import GraphPanel from './GraphPanel.svelte'
  import NoteEditor from './NoteEditor.svelte'
  import ReadingView from './ReadingView.svelte'

  type Zone = layouts.Side | 'center'
  type TabDrag = { type: 'tab'; groupId: string; tabId: string }

  const SPLIT_EDGE = 0.25

  let { group }: { group: layouts.Group } = $props()

  const isActiveGroup = $derived(workspace.layout.activeGroupId === group.id)
  let tabIndicator = $state<{ tabId: string; edge: Edge } | null>(null)
  let isOverBar = $state(false)
  let zone = $state<Zone | null>(null)
  let menuTab = $state<layouts.Tab | null>(null)

  const isTabDrag = (data: Record<string | symbol, unknown>): data is TabDrag => data.type === 'tab'

  function title(view: layouts.TabView) {
    if (view.kind === 'note') return noteTitle(view.path)
    if (view.kind === 'file') return basename(view.path)
    return view.kind === 'graph' ? 'Graph view' : 'New tab'
  }

  function activate(tabId?: string) {
    if (isActiveGroup && (!tabId || tabId === group.activeTabId)) return
    workspace.updateLayout((layout) => layouts.activate(layout, group.id, tabId))
  }

  function close(tabId: string) {
    workspace.updateLayout((layout) => layouts.closeTab(layout, group.id, tabId))
  }

  function onTabMouseUp(event: MouseEvent, tab: layouts.Tab) {
    if (event.button === 1) close(tab.id)
  }

  function runOnMenuTab(update: (layout: layouts.Layout, tab: layouts.Tab) => layouts.Layout) {
    const tab = menuTab
    if (!tab) return
    workspace.updateLayout((layout) => update(layouts.activate(layout, group.id, tab.id), tab))
  }

  function tabDragAndDrop(tab: layouts.Tab, index: number) {
    return (element: HTMLElement) =>
      combine(
        draggable({
          element,
          getInitialData: () => ({ type: 'tab', groupId: group.id, tabId: tab.id }),
        }),
        dropTargetForElements({
          element,
          canDrop: ({ source }) => isTabDrag(source.data),
          getData: ({ input }) =>
            attachClosestEdge({}, { element, input, allowedEdges: ['left', 'right'] }),
          onDrag: ({ self }) =>
            (tabIndicator = { tabId: tab.id, edge: extractClosestEdge(self.data) ?? 'left' }),
          onDragLeave: () => (tabIndicator = null),
          onDrop: ({ source, self }) => {
            tabIndicator = null
            if (!isTabDrag(source.data)) return
            const to = {
              groupId: group.id,
              index: extractClosestEdge(self.data) === 'right' ? index + 1 : index,
            }
            const from = source.data
            workspace.updateLayout((layout) => layouts.moveTab(layout, from, to))
          },
        }),
      )
  }

  function barDropTarget(element: HTMLElement) {
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => isTabDrag(source.data),
      onDragEnter: () => (isOverBar = true),
      onDragLeave: () => (isOverBar = false),
      onDrop: ({ source, location }) => {
        isOverBar = false
        if (!isTabDrag(source.data) || location.current.dropTargets[0]?.element !== element) return
        const from = source.data
        const to = { groupId: group.id, index: group.tabs.length }
        workspace.updateLayout((layout) => layouts.moveTab(layout, from, to))
      },
    })
  }

  function zoneAt(element: HTMLElement, x: number, y: number): Zone {
    const rect = element.getBoundingClientRect()
    const relativeX = (x - rect.left) / rect.width
    const relativeY = (y - rect.top) / rect.height
    const distances: [layouts.Side, number][] = [
      ['left', relativeX],
      ['right', 1 - relativeX],
      ['top', relativeY],
      ['bottom', 1 - relativeY],
    ]
    const [side, distance] = distances.sort((a, b) => a[1] - b[1])[0]
    return distance < SPLIT_EDGE ? side : 'center'
  }

  function contentDropTarget(element: HTMLElement) {
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => isTabDrag(source.data),
      onDrag: ({ location }) => {
        const { clientX, clientY } = location.current.input
        zone = zoneAt(element, clientX, clientY)
      },
      onDragLeave: () => (zone = null),
      onDrop: ({ source }) => {
        const target = zone
        zone = null
        if (!isTabDrag(source.data) || !target) return
        const from = source.data
        if (target === 'center') {
          if (from.groupId === group.id) return
          const to = { groupId: group.id, index: group.tabs.length }
          workspace.updateLayout((layout) => layouts.moveTab(layout, from, to))
        } else {
          workspace.updateLayout((layout) => layouts.split(layout, group.id, target, from))
        }
      },
    })
  }
</script>

<section
  class="group"
  class:active={isActiveGroup}
  onpointerdowncapture={() => activate()}
  onfocusin={() => activate()}
>
  <ContextMenu.Root onOpenChange={(open) => !open && (menuTab = null)}>
    <ContextMenu.Trigger>
      <div class="bar" class:drop={isOverBar} role="tablist" {@attach barDropTarget}>
        {#each group.tabs as tab, index (tab.id)}
          {@const isCurrent = tab.id === group.activeTabId}
          <div
            class="tab"
            class:current={isCurrent}
            class:drop-left={tabIndicator?.tabId === tab.id && tabIndicator.edge === 'left'}
            class:drop-right={tabIndicator?.tabId === tab.id && tabIndicator.edge === 'right'}
            role="tab"
            tabindex="0"
            aria-selected={isCurrent}
            title={'path' in tab.view ? tab.view.path : undefined}
            onclick={() => activate(tab.id)}
            onkeydown={(event) => event.key === 'Enter' && activate(tab.id)}
            onmouseup={(event) => onTabMouseUp(event, tab)}
            oncontextmenu={() => (menuTab = tab)}
            {@attach tabDragAndDrop(tab, index)}
          >
            {#if tab.view.kind === 'graph'}
              <Waypoints size={13} />
            {:else if tab.view.kind === 'file'}
              <Image size={13} />
            {:else}
              <FileText size={13} />
            {/if}
            <span class="title">{title(tab.view)}</span>
            <button
              class="close"
              title="Close (Ctrl+W)"
              onclick={(event) => {
                event.stopPropagation()
                close(tab.id)
              }}
            >
              <X size={12} />
            </button>
          </div>
        {/each}
        <button
          class="new"
          title="New tab (Ctrl+T)"
          onclick={() =>
            workspace.updateLayout((layout) => layouts.addTab(layout, undefined, group.id))}
        >
          <Plus size={14} />
        </button>
      </div>
    </ContextMenu.Trigger>
    <ContextMenu.Portal>
      <ContextMenu.Content class="menu">
        {#if menuTab}
          <ContextMenu.Item class="menu-item" onSelect={() => menuTab && close(menuTab.id)}>
            Close
          </ContextMenu.Item>
          <ContextMenu.Item
            class="menu-item"
            onSelect={() =>
              runOnMenuTab((layout, tab) => layouts.closeOtherTabs(layout, group.id, tab.id))}
          >
            Close others
          </ContextMenu.Item>
          <ContextMenu.Separator class="menu-separator" />
          <ContextMenu.Item
            class="menu-item"
            onSelect={() => runOnMenuTab((layout) => layouts.split(layout, group.id, 'right'))}
          >
            Split right
          </ContextMenu.Item>
          <ContextMenu.Item
            class="menu-item"
            onSelect={() => runOnMenuTab((layout) => layouts.split(layout, group.id, 'bottom'))}
          >
            Split down
          </ContextMenu.Item>
        {/if}
      </ContextMenu.Content>
    </ContextMenu.Portal>
  </ContextMenu.Root>

  <div class="content" {@attach contentDropTarget}>
    {#each group.tabs as tab (tab.id)}
      {@const isCurrent = tab.id === group.activeTabId}
      <div class="view" hidden={!isCurrent}>
        {#if tab.view.kind === 'note'}
          {#key tab.view.path}
            {#if tab.isReading}
              <ReadingView {tab} path={tab.view.path} />
            {:else}
              <NoteEditor {tab} path={tab.view.path} isActive={isActiveGroup && isCurrent} />
            {/if}
          {/key}
        {:else if tab.view.kind === 'file'}
          <FileView path={tab.view.path} />
        {:else if tab.view.kind === 'graph'}
          <GraphPanel />
        {:else}
          <EmptyTab />
        {/if}
      </div>
    {/each}
    {#if zone}<div class="zone {zone}"></div>{/if}
  </div>
</section>

<style>
  .group {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .bar {
    display: flex;
    align-items: stretch;
    gap: 1px;
    min-height: 32px;
    padding: 4px 4px 0;
    overflow-x: auto;
    border-bottom: 1px solid var(--border);
    background: var(--background-secondary);
    scrollbar-width: thin;
  }

  .bar.drop {
    background: color-mix(in srgb, var(--accent) 10%, var(--background-secondary));
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 80px;
    max-width: 200px;
    padding: 0 6px 0 10px;
    border-radius: 6px 6px 0 0;
    color: var(--text-muted);
    font-size: 12px;
    cursor: default;
    user-select: none;
  }

  .tab:hover {
    background: var(--hover);
  }

  .tab.current {
    background: var(--background);
    color: var(--text);
  }

  .group.active .tab.current {
    box-shadow: inset 0 2px 0 var(--accent);
  }

  .tab.drop-left {
    box-shadow: inset 2px 0 0 var(--accent);
  }

  .tab.drop-right {
    box-shadow: inset -2px 0 0 var(--accent);
  }

  .title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .close,
  .new {
    display: grid;
    place-items: center;
    padding: 2px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text-faint);
    cursor: pointer;
  }

  .close {
    visibility: hidden;
  }

  .tab:hover .close,
  .tab.current .close {
    visibility: visible;
  }

  .close:hover,
  .new:hover {
    background: var(--hover);
    color: var(--text);
  }

  .new {
    align-self: center;
    margin-left: 4px;
  }

  .content {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .view {
    height: 100%;
  }

  .view[hidden] {
    display: none;
  }

  .zone {
    position: absolute;
    z-index: 10;
    border-radius: 4px;
    background: color-mix(in srgb, var(--accent) 20%, transparent);
    pointer-events: none;
  }

  .zone.center {
    inset: 0;
  }

  .zone.left {
    inset: 0 50% 0 0;
  }

  .zone.right {
    inset: 0 0 0 50%;
  }

  .zone.top {
    inset: 0 0 50% 0;
  }

  .zone.bottom {
    inset: 50% 0 0 0;
  }
</style>
