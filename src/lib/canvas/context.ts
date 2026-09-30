import { createContext } from 'svelte'
import type { CanvasEdge, CanvasNode } from './model'

export interface CanvasContext {
  /** The canvas file; links in text cards resolve from it. */
  readonly path: string
  /** The card or edge label being edited, if any. */
  readonly editing: string | null
  edit(id: string | null): void
  updateNode(id: string, patch: Partial<CanvasNode>): void
  updateEdge(id: string, patch: Partial<CanvasEdge>): void
}

export const [canvasContext, setCanvasContext] = createContext<CanvasContext>()
