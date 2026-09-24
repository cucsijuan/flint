import { describe, expect, it } from 'vitest'
import { filterGraph, type GraphFilters } from './graph'
import type { Graph, NodeKind } from './vault'

const node = (id: string, kind: NodeKind = 'note') => ({ id, label: id, kind })
const graph: Graph = {
  nodes: [
    node('a'),
    node('b'),
    node('c'),
    node('d'),
    node('lonely'),
    node('#tag', 'tag'),
    node('?x', 'unresolved'),
  ],
  links: [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'c', target: 'd' },
    { source: 'a', target: '#tag' },
    { source: 'a', target: '?x' },
  ],
}
const everything: GraphFilters = {
  showTags: true,
  showUnresolved: true,
  showOrphans: true,
  query: '',
}
const ids = (result: Graph) => result.nodes.map((n) => n.id)

describe('filterGraph', () => {
  it('hides node kinds and drops their links', () => {
    const result = filterGraph(graph, { ...everything, showTags: false, showUnresolved: false })
    expect(ids(result)).toEqual(['a', 'b', 'c', 'd', 'lonely'])
    expect(result.links).toHaveLength(3)
  })

  it('hides orphans and filters notes by path', () => {
    expect(ids(filterGraph(graph, { ...everything, showOrphans: false }))).not.toContain('lonely')
    expect(ids(filterGraph(graph, { ...everything, query: 'LONE' }))).toEqual([
      'lonely',
      '#tag',
      '?x',
    ])
  })

  it('keeps the neighborhood of the center note up to the given depth', () => {
    expect(ids(filterGraph(graph, everything, { center: 'b', depth: 1 }))).toEqual(['a', 'b', 'c'])
    expect(ids(filterGraph(graph, everything, { center: 'b', depth: 2 }))).toEqual([
      'a',
      'b',
      'c',
      'd',
      '#tag',
      '?x',
    ])
    expect(
      ids(
        filterGraph(graph, { ...everything, showOrphans: false }, { center: 'lonely', depth: 2 }),
      ),
    ).toEqual(['lonely'])
  })
})
