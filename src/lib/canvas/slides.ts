import type { CanvasEdge, CanvasNode } from './model'

/** Rows closer than this, in canvas units, read as one row of slides. */
const ROW_TOLERANCE = 100

/** The groups of a canvas in presentation order: following the arrows between groups from the
 * one nothing points to, then any left over by rows, left to right. */
export function slideOrder(nodes: CanvasNode[], edges: CanvasEdge[]): CanvasNode[] {
  const groups = nodes.filter((node) => node.type === 'group')
  const byPosition = [...groups].sort((a, b) =>
    Math.abs(a.y - b.y) > ROW_TOLERANCE ? a.y - b.y : a.x - b.x,
  )
  const ids = new Set(groups.map((group) => group.id))
  const next = new Map<string, string>()
  const pointedTo = new Set<string>()
  for (const edge of edges) {
    if (!ids.has(edge.fromNode) || !ids.has(edge.toNode) || next.has(edge.fromNode)) continue
    next.set(edge.fromNode, edge.toNode)
    pointedTo.add(edge.toNode)
  }
  const ordered: CanvasNode[] = []
  const seen = new Set<string>()
  const byId = new Map(groups.map((group) => [group.id, group]))
  const starts = [
    ...byPosition.filter((group) => next.has(group.id) && !pointedTo.has(group.id)),
    ...byPosition,
  ]
  for (const start of starts) {
    for (let id: string | undefined = start.id; id && !seen.has(id); id = next.get(id)) {
      seen.add(id)
      ordered.push(byId.get(id) as CanvasNode)
    }
  }
  return ordered
}
