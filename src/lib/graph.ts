import type { Graph } from './vault'

export interface GraphFilters {
  showTags: boolean
  showUnresolved: boolean
  showOrphans: boolean
  query: string
}

export interface LocalScope {
  center: string
  depth: number
}

export function filterGraph(graph: Graph, filters: GraphFilters, scope?: LocalScope): Graph {
  const query = filters.query.trim().toLowerCase()
  let nodes = graph.nodes.filter(
    (node) =>
      (node.kind !== 'tag' || filters.showTags) &&
      (node.kind !== 'unresolved' || filters.showUnresolved) &&
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
