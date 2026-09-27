import type { Graph } from './vault'

export interface ColorGroup {
  query: string
  /** As Obsidian stores it: alpha and a 24-bit RGB number. */
  color: { a: number; rgb: number }
}

/** Stored in `.flint/graph.json`, with Obsidian's keys. */
export interface GraphSettings {
  search: string
  showTags: boolean
  hideUnresolved: boolean
  showOrphans: boolean
  colorGroups: ColorGroup[]
  centerStrength: number
  repelStrength: number
  linkStrength: number
  linkDistance: number
}

export const DEFAULT_GRAPH: GraphSettings = {
  search: '',
  showTags: false,
  hideUnresolved: false,
  showOrphans: true,
  colorGroups: [],
  centerStrength: 0.5,
  repelStrength: 10,
  linkStrength: 1,
  linkDistance: 250,
}

export const rgbToHex = (rgb: number) => `#${rgb.toString(16).padStart(6, '0')}`
export const hexToRgb = (hex: string) => Number.parseInt(hex.slice(1), 16)

const isColorGroup = (group: unknown): group is ColorGroup =>
  typeof (group as ColorGroup | null)?.query === 'string' &&
  typeof (group as ColorGroup).color?.rgb === 'number'

/** Valid groups with a query, in order: a note takes the color of the first group it matches. */
export const activeColorGroups = (groups: unknown[]) =>
  groups.filter(isColorGroup).filter((group) => group.query.trim())

export interface LocalScope {
  center: string
  depth: number
}

export function filterGraph(graph: Graph, filters: GraphSettings, scope?: LocalScope): Graph {
  const query = filters.search.trim().toLowerCase()
  let nodes = graph.nodes.filter(
    (node) =>
      (node.kind !== 'tag' || filters.showTags) &&
      (node.kind !== 'unresolved' || !filters.hideUnresolved) &&
      (node.kind !== 'note' || !query || node.id.toLowerCase().includes(query)),
  )
  let ids = new Set(nodes.map((node) => node.id))
  let links = graph.links.filter((link) => ids.has(link.source) && ids.has(link.target))

  if (scope) {
    ids = neighborhood(links, scope.center, scope.depth)
    nodes = nodes.filter((node) => ids.has(node.id))
    links = links.filter((link) => ids.has(link.source) && ids.has(link.target))
  }

  if (!filters.showOrphans) {
    const linked = new Set(links.flatMap((link) => [link.source, link.target]))
    nodes = nodes.filter((node) => linked.has(node.id) || node.id === scope?.center)
  }
  return { nodes, links }
}

function neighborhood(links: Graph['links'], center: string, depth: number) {
  const neighbors = new Map<string, string[]>()
  for (const { source, target } of links) {
    neighbors.set(source, [...(neighbors.get(source) ?? []), target])
    neighbors.set(target, [...(neighbors.get(target) ?? []), source])
  }
  const reached = new Set([center])
  let frontier = [center]
  for (let step = 0; step < depth; step++) {
    frontier = frontier.flatMap((id) => neighbors.get(id) ?? []).filter((id) => !reached.has(id))
    frontier.forEach((id) => reached.add(id))
  }
  return reached
}
