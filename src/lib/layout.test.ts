import { describe, expect, it } from 'vitest'
import {
  activeGroup,
  activeTab,
  addTab,
  closeOtherTabs,
  closePaths,
  closeTab,
  createLayout,
  cycleTab,
  goBack,
  goForward,
  groups,
  isLayout,
  type Layout,
  type LayoutNode,
  moveTab,
  navigate,
  openPaths,
  renamePaths,
  split,
  type TabView,
} from './layout'

const note = (path: string): TabView => ({ kind: 'note', path })
const title = (view: TabView) => (view.kind === 'note' ? view.path : view.kind)
const titles = (layout: Layout) =>
  groups(layout.root).map((group) => group.tabs.map((tab) => title(tab.view)))
const shape = (node: LayoutNode): unknown =>
  node.type === 'group' ? node.tabs.length : { [node.direction]: node.children.map(shape) }

function withTabs(...paths: string[]) {
  let layout = navigate(createLayout(), note(paths[0]))
  for (const path of paths.slice(1)) layout = addTab(layout, note(path))
  return layout
}

describe('layout', () => {
  it('navigates within a tab with back and forward history', () => {
    let layout = navigate(createLayout(), note('a'))
    layout = navigate(layout, note('b'))
    layout = navigate(layout, note('c'))
    expect(title(activeTab(layout).view)).toBe('c')

    layout = goBack(goBack(layout))
    expect(title(activeTab(layout).view)).toBe('a')
    expect(activeTab(goBack(layout)).view).toEqual(note('a'))

    layout = goForward(layout)
    expect(title(activeTab(layout).view)).toBe('b')
    layout = navigate(layout, note('d'))
    expect(activeTab(layout).forward).toEqual([])
  })

  it('opens, cycles and closes tabs', () => {
    let layout = withTabs('a', 'b', 'c')
    expect(titles(layout)).toEqual([['a', 'b', 'c']])
    expect(title(activeTab(layout).view)).toBe('c')

    layout = cycleTab(layout, 1)
    expect(title(activeTab(layout).view)).toBe('a')

    const group = activeGroup(layout)
    layout = closeTab(layout, group.id, group.tabs[0].id)
    expect(titles(layout)).toEqual([['b', 'c']])
    expect(title(activeTab(layout).view)).toBe('b')

    layout = closeOtherTabs(layout, group.id, activeGroup(layout).tabs[1].id)
    expect(titles(layout)).toEqual([['c']])

    layout = closeTab(layout, group.id, activeTab(layout).id)
    expect(titles(layout)).toEqual([['empty']])
  })

  it('splits groups and collapses them when they empty', () => {
    let layout = withTabs('a', 'b')
    const first = activeGroup(layout).id
    layout = split(layout, first, 'right')
    expect(shape(layout.root)).toEqual({ horizontal: [2, 1] })
    expect(title(activeTab(layout).view)).toBe('b')

    layout = split(layout, layout.activeGroupId, 'bottom')
    expect(shape(layout.root)).toEqual({ horizontal: [2, { vertical: [1, 1] }] })

    layout = split(layout, first, 'left')
    expect(shape(layout.root)).toEqual({ horizontal: [1, 2, { vertical: [1, 1] }] })

    for (const group of groups(layout.root).slice(2)) {
      layout = closeTab(layout, group.id, group.tabs[0].id)
    }
    expect(shape(layout.root)).toEqual({ horizontal: [1, 2] })
  })

  it('moves tabs within and between groups', () => {
    let layout = withTabs('a', 'b', 'c')
    const first = activeGroup(layout)
    layout = moveTab(
      layout,
      { groupId: first.id, tabId: first.tabs[2].id },
      { groupId: first.id, index: 0 },
    )
    expect(titles(layout)).toEqual([['c', 'a', 'b']])

    layout = split(layout, first.id, 'right', { groupId: first.id, tabId: first.tabs[0].id })
    expect(titles(layout)).toEqual([['c', 'b'], ['a']])

    const [left, right] = groups(layout.root)
    layout = moveTab(
      layout,
      { groupId: right.id, tabId: right.tabs[0].id },
      { groupId: left.id, index: 1 },
    )
    expect(titles(layout)).toEqual([['c', 'a', 'b']])
    expect(shape(layout.root)).toBe(3)
  })

  it('does not split a group by dragging its only tab onto itself', () => {
    const layout = navigate(createLayout(), note('a'))
    const group = activeGroup(layout)
    expect(split(layout, group.id, 'right', { groupId: group.id, tabId: group.tabs[0].id })).toBe(
      layout,
    )
  })

  it('follows renames and closes deleted notes', () => {
    let layout = withTabs('dir/a', 'dir/b', 'c')
    layout = renamePaths(layout, 'dir', 'moved')
    expect(titles(layout)).toEqual([['moved/a', 'moved/b', 'c']])
    expect(openPaths(layout)).toEqual(new Set(['moved/a', 'moved/b', 'c']))

    layout = closePaths(layout, 'moved')
    expect(titles(layout)).toEqual([['empty', 'empty', 'c']])
  })

  it('validates stored layouts', () => {
    expect(isLayout(withTabs('a'))).toBe(true)
    expect(isLayout({ root: { type: 'group', tabs: [] }, activeGroupId: 'x' })).toBe(false)
    expect(isLayout(null)).toBe(false)
  })
})
