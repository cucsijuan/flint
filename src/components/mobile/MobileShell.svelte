<script lang="ts">
  import { Copy, Menu, PanelRight, Plus, Search, SquareTerminal, X } from '@lucide/svelte'
  import * as layouts from '../../lib/layout'
  import { noteTitle } from '../../lib/paths'
  import { workspace } from '../../lib/workspace.svelte'
  import RightPanel from '../RightPanel.svelte'
  import Sidebar from '../Sidebar.svelte'
  import TabGroup from '../TabGroup.svelte'
  import FormatBar from './FormatBar.svelte'

  let drawer = $state<'left' | 'right' | null>(null)
  let isSwitchingTabs = $state(false)

  const group = $derived(layouts.activeGroup(workspace.layout))
  const tabTitle = (view: layouts.TabView) =>
    'path' in view ? noteTitle(view.path) : view.kind === 'graph' ? 'Graph view' : 'New tab'

  // Opening a note from a drawer or the tab switcher shows it.
  $effect(() => {
    void workspace.notePath
    drawer = null
  })

  function search() {
    workspace.openSearch()
    drawer = 'left'
  }

  function switchTo(tab: layouts.Tab) {
    workspace.updateLayout((layout) => layouts.activate(layout, group.id, tab.id))
    isSwitchingTabs = false
  }

  /** Swiping in from a screen edge opens that side's drawer. */
  let swipeStart: { x: number; y: number } | null = null
  const EDGE = 24
  const SWIPE = 60

  function onTouchStart(event: TouchEvent) {
    const touch = event.touches[0]
    const isAtEdge = touch.clientX < EDGE || touch.clientX > window.innerWidth - EDGE
    swipeStart = drawer === null && isAtEdge ? { x: touch.clientX, y: touch.clientY } : null
  }

  function onTouchMove(event: TouchEvent) {
    if (!swipeStart) return
    const touch = event.touches[0]
    const dx = touch.clientX - swipeStart.x
    if (Math.abs(touch.clientY - swipeStart.y) > Math.abs(dx)) {
      swipeStart = null
      return
    }
    if (dx > SWIPE && swipeStart.x < EDGE) drawer = 'left'
    else if (dx < -SWIPE && swipeStart.x > window.innerWidth - EDGE) drawer = 'right'
    else return
    swipeStart = null
  }
</script>

<svelte:document ontouchstart={onTouchStart} ontouchmove={onTouchMove} />

<div class="shell">
  <header>
    <button title="Files and search" onclick={() => (drawer = 'left')}><Menu size={22} /></button>
    <span class="spacer"></span>
    <button title="Search" onclick={search}><Search size={20} /></button>
    <button title="Tabs" class="tabs" onclick={() => (isSwitchingTabs = true)}>
      <Copy size={20} />
      <span>{group.tabs.length}</span>
    </button>
    <button title="Commands" onclick={() => (workspace.isCommandPaletteOpen = true)}>
      <SquareTerminal size={20} />
    </button>
    <button title="Note panels" onclick={() => (drawer = 'right')}>
      <PanelRight size={20} />
    </button>
  </header>

  <main><TabGroup {group} /></main>
  <FormatBar />

  {#if drawer}
    <button class="backdrop" aria-label="Close" onclick={() => (drawer = null)}></button>
  {/if}
  <aside class="drawer left" class:open={drawer === 'left'}><Sidebar /></aside>
  <aside class="drawer right" class:open={drawer === 'right'}><RightPanel /></aside>

  {#if isSwitchingTabs}
    <button class="backdrop" aria-label="Close" onclick={() => (isSwitchingTabs = false)}></button>
    <div class="sheet" role="dialog" aria-label="Tabs">
      <header>
        <strong>Tabs</strong>
        <button
          title="New tab"
          onclick={() => {
            workspace.updateLayout((layout) => layouts.addTab(layout, undefined, group.id))
            isSwitchingTabs = false
          }}
        >
          <Plus size={20} />
        </button>
      </header>
      <ul>
        {#each group.tabs as tab (tab.id)}
          <li class:current={tab.id === group.activeTabId}>
            <button class="open" onclick={() => switchTo(tab)}>{tabTitle(tab.view)}</button>
            <button
              title="Close"
              onclick={() =>
                workspace.updateLayout((layout) => layouts.closeTab(layout, group.id, tab.id))}
            >
              <X size={18} />
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .shell {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  header {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 2px;
    height: 48px;
    padding: 0 4px;
    border-bottom: 1px solid var(--border);
    background: var(--background-secondary);
  }

  header button {
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--text-muted);
  }

  header button:active {
    background: var(--hover);
  }

  .tabs {
    position: relative;
  }

  .tabs span {
    position: absolute;
    top: 13px;
    left: 0;
    width: 100%;
    font-size: 10px;
    font-weight: 700;
    text-align: center;
  }

  .spacer {
    flex: 1;
  }

  main {
    flex: 1;
    min-height: 0;
  }

  .backdrop {
    position: absolute;
    z-index: 20;
    inset: 0;
    border: none;
    background: rgb(0 0 0 / 35%);
  }

  .drawer {
    position: absolute;
    z-index: 21;
    top: 0;
    bottom: 0;
    width: min(86%, 360px);
    background: var(--background-secondary);
    box-shadow: 0 0 24px rgb(0 0 0 / 30%);
    transition: transform 0.2s ease;
  }

  .drawer.left {
    left: 0;
    transform: translateX(-105%);
  }

  .drawer.right {
    right: 0;
    transform: translateX(105%);
  }

  .drawer.open {
    transform: none;
  }

  .sheet {
    position: absolute;
    z-index: 21;
    right: 0;
    bottom: 0;
    left: 0;
    max-height: 70%;
    overflow: auto;
    border-radius: 14px 14px 0 0;
    background: var(--background);
  }

  .sheet header {
    justify-content: space-between;
    padding: 0 8px 0 16px;
    background: none;
  }

  .sheet ul {
    margin: 0;
    padding: 4px 8px 12px;
    list-style: none;
  }

  .sheet li {
    display: flex;
    align-items: center;
    border-radius: 10px;
  }

  .sheet li.current {
    background: var(--selected);
  }

  .sheet li button {
    height: 48px;
    border: none;
    background: none;
    color: var(--text);
    font: inherit;
  }

  .sheet .open {
    flex: 1;
    min-width: 0;
    padding: 0 12px;
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sheet li button:not(.open) {
    width: 48px;
    color: var(--text-muted);
  }
</style>
