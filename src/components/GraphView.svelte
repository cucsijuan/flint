<script lang="ts">
  import ForceGraph, { type LinkObject, type NodeObject } from 'force-graph'
  import { onMount } from 'svelte'
  import type { Graph, GraphNode } from '../lib/vault'

  type Node = NodeObject & GraphNode & { degree: number }
  type Link = LinkObject<Node>

  const LABEL_ZOOM = 1.6

  let {
    graph,
    focus,
    onOpen,
  }: { graph: Graph; focus?: string; onOpen: (node: GraphNode) => void } = $props()

  let container: HTMLDivElement
  let renderer: ForceGraph<Node, Link> | undefined
  let hovered: Node | null = null
  let highlighted = new Set<string>()
  let hasFitted = false
  let positions = new Map<string, Node>()
  let shape = ''

  const endpoint = (end: Link['source']) => (typeof end === 'object' ? end?.id : end)

  function palette() {
    const style = getComputedStyle(container)
    const color = (name: string) => style.getPropertyValue(name).trim()
    return {
      note: color('--graph-node'),
      tag: color('--graph-tag'),
      unresolved: color('--graph-unresolved'),
      link: color('--graph-link'),
      accent: color('--accent'),
      text: color('--text'),
    }
  }
  let colors = { note: '', tag: '', unresolved: '', link: '', accent: '', text: '' }

  const radius = (node: Node) => 3 + Math.sqrt(node.degree) * 1.5

  function drawNode(node: Node, context: CanvasRenderingContext2D, scale: number) {
    const isFocus = node.id === focus || node === hovered
    const isDimmed = hovered !== null && !highlighted.has(node.id as string)
    context.globalAlpha = isDimmed ? 0.25 : 1
    context.beginPath()
    context.arc(node.x ?? 0, node.y ?? 0, radius(node), 0, 2 * Math.PI)
    context.fillStyle = isFocus ? colors.accent : colors[node.kind]
    context.fill()
    if (scale > LABEL_ZOOM || isFocus || (hovered && !isDimmed)) {
      context.font = `${12 / scale}px system-ui, sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'top'
      context.fillStyle = colors.text
      context.fillText(node.label, node.x ?? 0, (node.y ?? 0) + radius(node) + 2 / scale)
    }
    context.globalAlpha = 1
  }

  function hover(node: Node | null) {
    hovered = node
    const links = node ? (renderer?.graphData().links ?? []) : []
    const neighbors = links.flatMap((link) => {
      const [source, target] = [endpoint(link.source), endpoint(link.target)]
      if (source === node?.id) return [target as string]
      if (target === node?.id) return [source as string]
      return []
    })
    highlighted = new Set(node ? [node.id as string, ...neighbors] : [])
    container.style.cursor = node ? 'pointer' : ''
  }

  const isHighlighted = (link: Link) =>
    hovered !== null &&
    (endpoint(link.source) === hovered.id || endpoint(link.target) === hovered.id)

  onMount(() => {
    colors = palette()
    renderer = new ForceGraph<Node, Link>(container)
      .backgroundColor('rgba(0,0,0,0)')
      .nodeCanvasObject(drawNode)
      .nodePointerAreaPaint((node, color, context) => {
        context.fillStyle = color
        context.beginPath()
        context.arc(node.x ?? 0, node.y ?? 0, radius(node) + 2, 0, 2 * Math.PI)
        context.fill()
      })
      .linkColor((link) => (isHighlighted(link) ? colors.accent : colors.link))
      .linkWidth((link) => (isHighlighted(link) ? 2 : 1))
      .onNodeHover(hover)
      .onNodeClick((node) => onOpen(node))
      .onEngineStop(() => {
        if (!hasFitted) renderer?.zoomToFit(400, 40)
        hasFitted = true
      })

    const resize = new ResizeObserver(() =>
      renderer?.width(container.clientWidth).height(container.clientHeight),
    )
    resize.observe(container)
    const theme = matchMedia('(prefers-color-scheme: dark)')
    const onThemeChange = () => (colors = palette())
    theme.addEventListener('change', onThemeChange)

    return () => {
      resize.disconnect()
      theme.removeEventListener('change', onThemeChange)
      renderer?._destructor()
    }
  })

  $effect(() => {
    const nextShape = JSON.stringify(graph)
    if (nextShape === shape) return
    shape = nextShape
    const degree: Record<string, number> = {}
    for (const { source, target } of graph.links) {
      degree[source] = (degree[source] ?? 0) + 1
      degree[target] = (degree[target] ?? 0) + 1
    }
    const nodes = graph.nodes.map((node) => {
      const previous = positions.get(node.id)
      return { ...node, degree: degree[node.id] ?? 0, x: previous?.x, y: previous?.y }
    })
    positions = new Map(nodes.map((node) => [node.id, node]))
    renderer?.graphData({ nodes, links: graph.links.map((link) => ({ ...link })) })
  })
</script>

<div class="graph" bind:this={container}></div>

<style>
  .graph {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
