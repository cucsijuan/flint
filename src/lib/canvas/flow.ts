import type { Edge, Node } from '@xyflow/svelte'
import { MarkerType } from '@xyflow/svelte'
import {
  type Canvas,
  type CanvasEdge,
  type CanvasNode,
  colorOf,
  facingSide,
  type Side,
} from './model'

/** A Svelte Flow node that carries its whole JSON Canvas node, so saving keeps unknown fields. */
export type FlowNode = Node<{ node: CanvasNode }, CanvasNode['type']>
export type FlowEdge = Edge<{ edge: CanvasEdge }>

export function toFlowNode(node: CanvasNode): FlowNode {
  return {
    id: node.id,
    type: node.type,
    position: { x: node.x, y: node.y },
    width: node.width,
    height: node.height,
    // Groups sit behind the cards they hold.
    zIndex: node.type === 'group' ? -1 : 0,
    data: { node },
  }
}

export function toFlowEdge(edge: CanvasEdge, nodes: Map<string, CanvasNode>): FlowEdge {
  const from = nodes.get(edge.fromNode)
  const to = nodes.get(edge.toNode)
  const fromSide: Side = edge.fromSide ?? (from && to ? facingSide(from, to) : 'right')
  const toSide: Side = edge.toSide ?? (from && to ? facingSide(to, from) : 'left')
  const color = colorOf(edge.color)
  const marker = {
    type: MarkerType.ArrowClosed,
    width: 18,
    height: 18,
    ...(color ? { color } : {}),
  }
  return {
    id: edge.id,
    type: 'canvas',
    source: edge.fromNode,
    target: edge.toNode,
    sourceHandle: fromSide,
    targetHandle: toSide,
    markerEnd: (edge.toEnd ?? 'arrow') === 'arrow' ? marker : undefined,
    markerStart: edge.fromEnd === 'arrow' ? marker : undefined,
    label: edge.label,
    data: { edge },
  }
}

export function toFlow(canvas: Canvas) {
  const byId = new Map(canvas.nodes.map((node) => [node.id, node]))
  return {
    nodes: canvas.nodes.map(toFlowNode),
    edges: canvas.edges
      .filter((edge) => byId.has(edge.fromNode) && byId.has(edge.toNode))
      .map((edge) => toFlowEdge(edge, byId)),
  }
}

const round = (value: number) => Math.round(value)

/** The canvas as it stands in Svelte Flow, merged over what the file held so unknown fields survive. */
export function fromFlow(nodes: FlowNode[], edges: FlowEdge[], canvas: Canvas): Canvas {
  return {
    ...canvas,
    nodes: nodes.map((flowNode) => ({
      ...flowNode.data.node,
      x: round(flowNode.position.x),
      y: round(flowNode.position.y),
      width: round(flowNode.width ?? flowNode.measured?.width ?? flowNode.data.node.width),
      height: round(flowNode.height ?? flowNode.measured?.height ?? flowNode.data.node.height),
    })),
    // Sides come from the edge itself: ones the file leaves out stay picked by position.
    edges: edges.map((flowEdge) => ({
      ...flowEdge.data?.edge,
      id: flowEdge.id,
      fromNode: flowEdge.source,
      toNode: flowEdge.target,
    })),
  }
}
