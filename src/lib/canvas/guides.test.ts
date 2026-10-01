import { describe, expect, it } from 'vitest'
import { alignmentGuides } from './guides'
import type { CanvasEdge, CanvasNode } from './model'
import { slideOrder } from './slides'

describe('alignmentGuides', () => {
  it('snaps to the nearest edge or middle within the threshold', () => {
    const other = { x: 0, y: 0, width: 100, height: 100 }
    const { dx, dy, guides } = alignmentGuides(
      { x: 103, y: 300, width: 50, height: 50 },
      [other],
      5,
    )
    expect([dx, dy]).toEqual([-3, 0])
    expect(guides).toEqual([{ vertical: true, at: 100, from: 0, to: 350 }])
    expect(alignmentGuides({ x: 400, y: 400, width: 10, height: 10 }, [other], 5).guides).toEqual(
      [],
    )
  })
})

const group = (id: string, x: number, y: number): CanvasNode => ({
  id,
  type: 'group',
  x,
  y,
  width: 100,
  height: 100,
})
const edge = (fromNode: string, toNode: string): CanvasEdge => ({
  id: fromNode + toNode,
  fromNode,
  toNode,
})

describe('slideOrder', () => {
  it('follows arrows between groups, then reads the rest by rows', () => {
    const groups = [group('a', 0, 0), group('b', 500, 0), group('c', 0, 500), group('d', 900, 20)]
    expect(slideOrder(groups, []).map((node) => node.id)).toEqual(['a', 'b', 'd', 'c'])
    expect(slideOrder(groups, [edge('c', 'a'), edge('a', 'd')]).map((node) => node.id)).toEqual([
      'c',
      'a',
      'd',
      'b',
    ])
  })
})
