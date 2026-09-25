import { basename, parentOf } from './paths'
import type { Entry, EntryKind } from './vault'

export interface TreeNode {
  path: string
  name: string
  kind: EntryKind
  children: TreeNode[]
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

const rank = (node: TreeNode) => (node.kind === 'folder' ? 0 : 1)

const compareNodes = (a: TreeNode, b: TreeNode) =>
  rank(a) - rank(b) || collator.compare(a.name, b.name)

export function buildTree(entries: Entry[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>(
    entries.map(({ path, kind }) => [path, { path, kind, name: basename(path), children: [] }]),
  )
  const roots: TreeNode[] = []
  for (const node of nodes.values()) {
    const parent = nodes.get(parentOf(node.path))
    ;(parent ? parent.children : roots).push(node)
  }
  const sort = (list: TreeNode[]) => {
    list.sort(compareNodes)
    list.forEach((node) => sort(node.children))
  }
  sort(roots)
  return roots
}
