import { describe, expect, it } from 'vitest'
import { fromFlow, toFlow } from './flow'
import { colorOf, facingSide, nodesInside, parseCanvas, serializeCanvas } from './model'

const source = JSON.stringify({
  nodes: [
    { id: 'a', type: 'text', text: '# Idea', x: 0, y: 0, width: 200, height: 100, color: '1' },
    {
      id: 'b',
      type: 'file',
      file: 'Notes/Plan.md',
      subpath: '#Goals',
      x: 400,
      y: 0,
      width: 300,
      height: 200,
    },
    {
      id: 'g',
      type: 'group',
      label: 'Area',
      x: -20,
      y: -20,
      width: 800,
      height: 300,
      custom: true,
    },
  ],
  edges: [{ id: 'e', fromNode: 'a', toNode: 'b', label: 'leads to', color: '#123456', extra: 1 }],
  metadata: { app: 'other' },
})

describe('canvas', () => {
  it('converts to Svelte Flow and back, keeping unknown fields', () => {
    const canvas = parseCanvas(source)
    const flow = toFlow(canvas)
    expect(flow.nodes.find((node) => node.id === 'g')?.zIndex).toBe(-1)
    const edge = flow.edges[0]
    expect([edge.sourceHandle, edge.targetHandle]).toEqual(['right', 'left'])
    expect(edge.markerEnd).toBeTruthy()
    expect(edge.markerStart).toBeUndefined()
    flow.nodes[0].position = { x: 10.4, y: 20.6 }
    const saved = fromFlow(flow.nodes, flow.edges, canvas)
    expect(saved.metadata).toEqual({ app: 'other' })
    expect(saved.nodes[0]).toMatchObject({ x: 10, y: 21, color: '1', text: '# Idea' })
    expect(saved.nodes[2]).toMatchObject({ custom: true })
    expect(saved.edges[0]).toEqual({
      id: 'e',
      fromNode: 'a',
      toNode: 'b',
      label: 'leads to',
      color: '#123456',
      extra: 1,
    })
    expect(JSON.parse(serializeCanvas(saved)).nodes).toHaveLength(3)
  })

  it('picks facing sides, group contents and preset colors', () => {
    const canvas = parseCanvas(source)
    const [a, b, g] = canvas.nodes
    expect(facingSide(a, b)).toBe('right')
    expect(facingSide({ ...b, x: 0, y: 500 }, a)).toBe('top')
    expect(nodesInside(g, canvas.nodes).map((node) => node.id)).toEqual(['a', 'b'])
    expect(colorOf('4')).toBe('#2ea86a')
    expect(colorOf('#abcdef')).toBe('#abcdef')
  })

  it('reads empty or partial files', () => {
    expect(parseCanvas('')).toEqual({ nodes: [], edges: [] })
    expect(parseCanvas('{"nodes":[]}').edges).toEqual([])
  })
})
