import { describe, expect, it } from 'vitest'
import { buildTree, type TreeNode } from './tree'

const shape = (nodes: TreeNode[]): unknown[] =>
  nodes.map((node) => (node.children.length ? { [node.name]: shape(node.children) } : node.name))

describe('buildTree', () => {
  it('nests entries, puts folders first and sorts names naturally', () => {
    const tree = buildTree([
      { path: 'note 10.md', kind: 'file' },
      { path: 'b', kind: 'folder' },
      { path: 'note 2.md', kind: 'file' },
      { path: 'b/inner.md', kind: 'file' },
      { path: 'A', kind: 'folder' },
    ])
    expect(shape(tree)).toEqual(['A', { b: ['inner.md'] }, 'note 2.md', 'note 10.md'])
  })
})
