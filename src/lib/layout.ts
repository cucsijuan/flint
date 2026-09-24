import { isWithin, replacePrefix } from './paths'

export type TabView = { kind: 'empty' } | { kind: 'note'; path: string } | { kind: 'graph' }

export interface Tab {
  id: string
  view: TabView
  back: TabView[]
  forward: TabView[]
}

export interface Group {
  type: 'group'
  id: string
  tabs: Tab[]
  activeTabId: string
}

export type Direction = 'horizontal' | 'vertical'

export interface Split {
  type: 'split'
  id: string
  direction: Direction
  children: LayoutNode[]
  sizes?: number[]
}

export type LayoutNode = Group | Split

export interface Layout {
  root: LayoutNode
  activeGroupId: string
}

export type Side = 'left' | 'right' | 'top' | 'bottom'

const EMPTY: TabView = { kind: 'empty' }

let nextId = 0
const newId = () => `${Date.now().toString(36)}-${(nextId++).toString(36)}`

export const newTab = (view: TabView = EMPTY): Tab => ({ id: newId(), view, back: [], forward: [] })

const newGroup = (tab: Tab = newTab()): Group => ({
  type: 'group',
  id: newId(),
  tabs: [tab],
  activeTabId: tab.id,
})

export function createLayout(): Layout {
  const group = newGroup()
  return { root: group, activeGroupId: group.id }
}

export function groups(node: LayoutNode): Group[] {
  return node.type === 'group' ? [node] : node.children.flatMap(groups)
}

export function findGroup(layout: Layout, groupId: string) {
  return groups(layout.root).find((group) => group.id === groupId)
}

export function activeGroup(layout: Layout) {
  return findGroup(layout, layout.activeGroupId) ?? groups(layout.root)[0]
}

export function activeTab(layout: Layout) {
  const group = activeGroup(layout)
  return group.tabs.find((tab) => tab.id === group.activeTabId) ?? group.tabs[0]
}

export const sameView = (a: TabView, b: TabView) =>
  a.kind === b.kind && (a.kind !== 'note' || (b.kind === 'note' && a.path === b.path))

function mapNodes(node: LayoutNode, map: (group: Group) => LayoutNode | null): LayoutNode | null {
  if (node.type === 'group') return map(node)
  const children = node.children
    .map((child) => mapNodes(child, map))
    .filter((child): child is LayoutNode => child !== null)
  if (children.length === 0) return null
  if (children.length === 1) return children[0]
  const sizes = children.length === node.children.length ? node.sizes : undefined
  return { ...node, children, sizes }
}

function updateGroup(
  layout: Layout,
  groupId: string,
  update: (group: Group) => Group | null,
): Layout {
  const root = mapNodes(layout.root, (group) => (group.id === groupId ? update(group) : group))
  if (!root) return createLayout()
  const activeGroupId = findGroup({ root, activeGroupId: '' }, layout.activeGroupId)
    ? layout.activeGroupId
    : groups(root)[0].id
  return { root, activeGroupId }
}

function updateTab(layout: Layout, groupId: string, tabId: string, update: (tab: Tab) => Tab) {
  return updateGroup(layout, groupId, (group) => ({
    ...group,
    tabs: group.tabs.map((tab) => (tab.id === tabId ? update(tab) : tab)),
  }))
}

export function activate(layout: Layout, groupId: string, tabId?: string): Layout {
  const next = tabId
    ? updateGroup(layout, groupId, (group) => ({ ...group, activeTabId: tabId }))
    : layout
  return { ...next, activeGroupId: groupId }
}

export function navigate(layout: Layout, view: TabView): Layout {
  const group = activeGroup(layout)
  const tab = activeTab(layout)
  if (sameView(tab.view, view)) return layout
  const back = tab.view.kind === 'empty' ? tab.back : [...tab.back, tab.view]
  return updateTab(layout, group.id, tab.id, () => ({ ...tab, view, back, forward: [] }))
}

export function goBack(layout: Layout): Layout {
  const group = activeGroup(layout)
  const tab = activeTab(layout)
  const view = tab.back.at(-1)
  if (!view) return layout
  return updateTab(layout, group.id, tab.id, () => ({
    ...tab,
    view,
    back: tab.back.slice(0, -1),
    forward: [tab.view, ...tab.forward],
  }))
}

export function goForward(layout: Layout): Layout {
  const group = activeGroup(layout)
  const tab = activeTab(layout)
  const [view, ...forward] = tab.forward
  if (!view) return layout
  return updateTab(layout, group.id, tab.id, () => ({
    ...tab,
    view,
    back: [...tab.back, tab.view],
    forward,
  }))
}

export function addTab(layout: Layout, view: TabView = EMPTY, groupId = layout.activeGroupId) {
  const tab = newTab(view)
  const next = updateGroup(layout, groupId, (group) => {
    const index = group.tabs.findIndex((candidate) => candidate.id === group.activeTabId)
    return { ...group, tabs: group.tabs.toSpliced(index + 1, 0, tab), activeTabId: tab.id }
  })
  return { ...next, activeGroupId: groupId }
}

export function closeTab(layout: Layout, groupId: string, tabId: string): Layout {
  const isOnlyGroup = groups(layout.root).length === 1
  return updateGroup(layout, groupId, (group) => {
    const index = group.tabs.findIndex((tab) => tab.id === tabId)
    const tabs = group.tabs.filter((tab) => tab.id !== tabId)
    if (tabs.length === 0) return isOnlyGroup ? newGroup() : null
    const activeTabId =
      group.activeTabId === tabId ? tabs[Math.min(index, tabs.length - 1)].id : group.activeTabId
    return { ...group, tabs, activeTabId }
  })
}

export function closeOtherTabs(layout: Layout, groupId: string, tabId: string): Layout {
  return updateGroup(layout, groupId, (group) => ({
    ...group,
    tabs: group.tabs.filter((tab) => tab.id === tabId),
    activeTabId: tabId,
  }))
}

export function cycleTab(layout: Layout, step: 1 | -1): Layout {
  const group = activeGroup(layout)
  const index = group.tabs.findIndex((tab) => tab.id === group.activeTabId)
  const next = group.tabs[(index + step + group.tabs.length) % group.tabs.length]
  return activate(layout, group.id, next.id)
}

function takeTab(layout: Layout, groupId: string, tabId: string): [Layout, Tab | undefined] {
  const tab = findGroup(layout, groupId)?.tabs.find((candidate) => candidate.id === tabId)
  if (!tab) return [layout, undefined]
  const group = findGroup(layout, groupId)
  const isLastTabOfOnlyGroup = groups(layout.root).length === 1 && group?.tabs.length === 1
  return [isLastTabOfOnlyGroup ? layout : closeTab(layout, groupId, tabId), tab]
}

export function moveTab(
  layout: Layout,
  from: { groupId: string; tabId: string },
  to: { groupId: string; index: number },
): Layout {
  if (from.groupId === to.groupId) {
    return updateGroup(layout, to.groupId, (group) => {
      const index = group.tabs.findIndex((tab) => tab.id === from.tabId)
      const tabs = group.tabs.toSpliced(index, 1)
      const target = index < to.index ? to.index - 1 : to.index
      return {
        ...group,
        tabs: tabs.toSpliced(target, 0, group.tabs[index]),
        activeTabId: from.tabId,
      }
    })
  }
  const [without, tab] = takeTab(layout, from.groupId, from.tabId)
  if (!tab || !findGroup(without, to.groupId)) return layout
  const next = updateGroup(without, to.groupId, (group) => ({
    ...group,
    tabs: group.tabs.toSpliced(to.index, 0, tab),
    activeTabId: tab.id,
  }))
  return { ...next, activeGroupId: to.groupId }
}

function insertBeside(node: LayoutNode, targetId: string, side: Side, group: Group): LayoutNode {
  const direction: Direction = side === 'left' || side === 'right' ? 'horizontal' : 'vertical'
  const isAfter = side === 'right' || side === 'bottom'
  if (node.type === 'group') {
    if (node.id !== targetId) return node
    const children = isAfter ? [node, group] : [group, node]
    return { type: 'split', id: newId(), direction, children }
  }
  const index = node.children.findIndex((child) => child.type === 'group' && child.id === targetId)
  if (index !== -1 && node.direction === direction) {
    const children = node.children.toSpliced(isAfter ? index + 1 : index, 0, group)
    return { ...node, children, sizes: undefined }
  }
  return {
    ...node,
    children: node.children.map((child) => insertBeside(child, targetId, side, group)),
  }
}

export function split(
  layout: Layout,
  targetGroupId: string,
  side: Side,
  source?: { groupId: string; tabId: string },
): Layout {
  let base = layout
  let tab: Tab
  if (source) {
    const sourceGroup = findGroup(layout, source.groupId)
    if (source.groupId === targetGroupId && sourceGroup?.tabs.length === 1) return layout
    const [without, taken] = takeTab(layout, source.groupId, source.tabId)
    if (!taken || !findGroup(without, targetGroupId)) return layout
    base = without
    tab = taken
  } else {
    tab = newTab(activeTab(layout).view)
  }
  const group = newGroup(tab)
  return { root: insertBeside(base.root, targetGroupId, side, group), activeGroupId: group.id }
}

function mapViews(layout: Layout, map: (view: TabView) => TabView): Layout {
  const root = mapNodes(layout.root, (group) => ({
    ...group,
    tabs: group.tabs.map((tab) => ({
      ...tab,
      view: map(tab.view),
      back: tab.back.map(map),
      forward: tab.forward.map(map),
    })),
  }))
  return root ? { ...layout, root } : layout
}

export const renamePaths = (layout: Layout, from: string, to: string) =>
  mapViews(layout, (view) =>
    view.kind === 'note' ? { ...view, path: replacePrefix(view.path, from, to) } : view,
  )

export function closePaths(layout: Layout, path: string): Layout {
  const isGone = (view: TabView) => view.kind === 'note' && isWithin(view.path, path)
  return mapViews(layout, (view) => (isGone(view) ? EMPTY : view))
}

export function openPaths(layout: Layout) {
  return new Set(
    groups(layout.root).flatMap((group) =>
      group.tabs.flatMap((tab) => (tab.view.kind === 'note' ? [tab.view.path] : [])),
    ),
  )
}

export function isLayout(value: unknown): value is Layout {
  const isNode = (node: unknown): boolean => {
    const candidate = node as Record<string, unknown> | null
    if (candidate?.type === 'group') {
      return (
        Array.isArray(candidate.tabs) &&
        candidate.tabs.length > 0 &&
        typeof candidate.activeTabId === 'string'
      )
    }
    return (
      candidate?.type === 'split' &&
      Array.isArray(candidate.children) &&
      candidate.children.every(isNode)
    )
  }
  const layout = value as Partial<Layout> | null
  return typeof layout?.activeGroupId === 'string' && isNode(layout.root)
}
