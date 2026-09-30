/** JSON Canvas 1.0 (https://jsoncanvas.org), the format of Obsidian's `.canvas` files. */

export type Side = 'top' | 'right' | 'bottom' | 'left'
export type End = 'none' | 'arrow'
/** A preset from "1" to "6" (red, orange, yellow, green, cyan, purple) or a hex color. */
export type CanvasColor = string

interface NodeBase {
  id: string
  x: number
  y: number
  width: number
  height: number
  color?: CanvasColor
  /** Fields other apps add; kept untouched. */
  [key: string]: unknown
}

export interface TextNode extends NodeBase {
  type: 'text'
  text: string
}

export interface FileNode extends NodeBase {
  type: 'file'
  file: string
  subpath?: string
}

export interface LinkNode extends NodeBase {
  type: 'link'
  url: string
}

export interface GroupNode extends NodeBase {
  type: 'group'
  label?: string
  background?: string
  backgroundStyle?: 'cover' | 'ratio' | 'repeat'
}

export type CanvasNode = TextNode | FileNode | LinkNode | GroupNode

export interface CanvasEdge {
  id: string
  fromNode: string
  fromSide?: Side
  fromEnd?: End
  toNode: string
  toSide?: Side
  toEnd?: End
  color?: CanvasColor
  label?: string
  [key: string]: unknown
}

export interface Canvas {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  [key: string]: unknown
}

export const SIDES: Side[] = ['top', 'right', 'bottom', 'left']

/** Obsidian's preset colors. */
export const PRESET_COLORS: Record<string, string> = {
  '1': '#e03e3e',
  '2': '#e0851f',
  '3': '#d9b300',
  '4': '#2ea86a',
  '5': '#1fa2b8',
  '6': '#8b5cf6',
}

export const colorOf = (color: CanvasColor | undefined) =>
  color ? (PRESET_COLORS[color] ?? color) : undefined

export function parseCanvas(source: string): Canvas {
  const parsed: unknown = source.trim() ? JSON.parse(source) : {}
  const canvas = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Partial<Canvas>
  return {
    ...canvas,
    nodes: Array.isArray(canvas.nodes) ? canvas.nodes : [],
    edges: Array.isArray(canvas.edges) ? canvas.edges : [],
  }
}

/** Tab-indented JSON, like Obsidian writes it. */
export const serializeCanvas = (canvas: Canvas) => JSON.stringify(canvas, null, '\t')

const center = (node: CanvasNode) => ({ x: node.x + node.width / 2, y: node.y + node.height / 2 })

/** The side of `from` that faces `to`, for edges that don't say which sides they use. */
export function facingSide(from: CanvasNode, to: CanvasNode): Side {
  const a = center(from)
  const b = center(to)
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) * from.height > Math.abs(dy) * from.width) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'bottom' : 'top'
}

/** The nodes whose box lies inside `group`, which move along with it like in Obsidian. */
export function nodesInside(group: CanvasNode, nodes: CanvasNode[]) {
  return nodes.filter(
    (node) =>
      node.id !== group.id &&
      node.x >= group.x &&
      node.y >= group.y &&
      node.x + node.width <= group.x + group.width &&
      node.y + node.height <= group.y + group.height,
  )
}

/** A fresh id like Obsidian's: 16 hex digits. */
export const newId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

/** Text that search matches in a node: its text, file, link or label. */
export function nodeText(node: CanvasNode) {
  switch (node.type) {
    case 'text':
      return node.text
    case 'file':
      return node.file
    case 'link':
      return node.url
    case 'group':
      return node.label ?? ''
  }
}
