<script lang="ts">
  import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
  import {
    Background,
    BackgroundVariant,
    ConnectionMode,
    MiniMap,
    Panel,
    SvelteFlow,
    useSvelteFlow,
  } from '@xyflow/svelte'
  import '@xyflow/svelte/dist/base.css'
  import {
    Download,
    FilePlus,
    Group,
    Link,
    Maximize,
    Redo2,
    Search,
    StickyNote,
    Undo2,
    ZoomIn,
    X,
    ZoomOut,
  } from '@lucide/svelte'
  import { ContextMenu } from 'bits-ui'
  import { untrack } from 'svelte'
  import { hotkeyOf } from '../../lib/commands.svelte'
  import { setCanvasContext } from '../../lib/canvas/context'
  import { exportImage } from '../../lib/canvas/export'
  import { type FlowEdge, type FlowNode, fromFlow, toFlow, toFlowEdge } from '../../lib/canvas/flow'
  import { CanvasHistory } from '../../lib/canvas/history'
  import {
    type Canvas,
    type CanvasEdge,
    type CanvasNode,
    type FileNode,
    newId,
    nodesInside,
    nodeText,
    parseCanvas,
    PRESET_COLORS,
    serializeCanvas,
  } from '../../lib/canvas/model'
  import { isEntryDrag } from '../../lib/entry-drag'
  import { basename, isExternalUrl, NOTE_EXTENSION, parentOf } from '../../lib/paths'
  import * as vault from '../../lib/vault'
  import { workspace } from '../../lib/workspace.svelte'
  import FuzzyPicker from '../FuzzyPicker.svelte'
  import CanvasEdgeView from './CanvasEdge.svelte'
  import FileCard from './FileCard.svelte'
  import GroupCard from './GroupCard.svelte'
  import LinkCard from './LinkCard.svelte'
  import TextCard from './TextCard.svelte'

  let {
    path,
    source,
    onchange,
    embedded = false,
  }: {
    path: string
    source: string
    onchange: (source: string) => void
    embedded?: boolean
  } = $props()

  const GRID = 20
  const MIN_ZOOM = 0.1
  const MAX_ZOOM = 4
  const ZOOM_STEP = 1.2
  const CARD = { width: 260, height: 140 }
  const FILE_CARD = { width: 400, height: 400 }
  /** Changes closer together than this undo as one step, like a drag. */
  const UNDO_GROUPING_MS = 600
  const nodeTypes = { text: TextCard, file: FileCard, link: LinkCard, group: GroupCard }
  const edgeTypes = { canvas: CanvasEdgeView }

  const flow = useSvelteFlow<FlowNode, FlowEdge>()
  const history = new CanvasHistory()

  let canvas: Canvas = { nodes: [], edges: [] }
  let nodes = $state.raw<FlowNode[]>([])
  let edges = $state.raw<FlowEdge[]>([])
  let current = ''
  let lastChange = 0
  let error = $state<string | null>(null)
  let editing = $state<string | null>(null)
  // svelte-ignore non_reactive_update
  let container: HTMLDivElement
  let pointer = { x: 0, y: 0 }
  let menuTarget = $state<{ kind: 'pane' | 'node' | 'edge'; id?: string }>({ kind: 'pane' })
  let isPickingFile = $state(false)
  let searchQuery = $state('')
  let isSearching = $state(false)
  let matchIndex = 0

  const serialize = () => serializeCanvas(fromFlow(nodes, edges, canvas))

  function load(text: string) {
    try {
      canvas = parseCanvas(text)
      error = null
    } catch (reason) {
      error = `This canvas can't be read: ${String(reason)}`
      return
    }
    const next = toFlow(canvas)
    const selected = new Set(nodes.filter((node) => node.selected).map((node) => node.id))
    nodes = next.nodes.map((node) => (selected.has(node.id) ? { ...node, selected: true } : node))
    edges = next.edges
    current = serialize()
  }

  untrack(() => load(source))

  $effect.pre(() => {
    if (source !== current) untrack(() => load(source))
  })

  $effect(() => {
    const next = serializeCanvas(fromFlow(nodes, edges, canvas))
    if (next === current || error) return
    const now = Date.now()
    if (now - lastChange > UNDO_GROUPING_MS) history.record(current)
    lastChange = now
    current = next
    onchange(next)
  })

  function restore(snapshot: string | undefined) {
    if (snapshot === undefined) return
    editing = null
    load(snapshot)
    onchange(current)
  }

  const undo = () => restore(history.undo(current))
  const redo = () => restore(history.redo(current))

  const byId = () => new Map(nodes.map((node) => [node.id, fromFlow([node], [], canvas).nodes[0]]))

  /** Edges whose file leaves out their sides face each other again once cards move. */
  function refreshEdgeSides() {
    const known = byId()
    edges = edges.map((edge) => {
      const data = edge.data?.edge
      if (!data || (data.fromSide && data.toSide)) return edge
      return { ...toFlowEdge(data, known), selected: edge.selected }
    })
  }

  function updateNode(id: string, patch: Partial<CanvasNode>) {
    nodes = nodes.map((node) =>
      node.id === id
        ? { ...node, data: { node: { ...node.data.node, ...patch } as CanvasNode } }
        : node,
    )
  }

  function updateEdge(id: string, patch: Partial<CanvasEdge>) {
    const known = byId()
    edges = edges.map((edge) =>
      edge.id === id && edge.data
        ? { ...toFlowEdge({ ...edge.data.edge, ...patch }, known), selected: edge.selected }
        : edge,
    )
  }

  setCanvasContext({
    get path() {
      return path
    },
    get editing() {
      return editing
    },
    edit: (id) => (editing = id),
    updateNode,
    updateEdge,
  })

  /** Zooms around the middle of the view; Svelte Flow's own zoomIn doesn't move the view here. */
  function zoomBy(factor: number) {
    const { x, y, zoom } = flow.getViewport()
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor))
    const { width, height } = container.getBoundingClientRect()
    const scale = next / zoom
    void flow.setViewport({
      zoom: next,
      x: width / 2 - (width / 2 - x) * scale,
      y: height / 2 - (height / 2 - y) * scale,
    })
  }

  const snap = (value: number) => Math.round(value / GRID) * GRID

  type NewNode = Record<string, unknown> & {
    type: CanvasNode['type']
    x: number
    y: number
    width: number
    height: number
  }

  function addNode(node: NewNode, select = true) {
    const created = { ...node, id: newId(), x: snap(node.x), y: snap(node.y) } as CanvasNode
    const flowNode = toFlow({ nodes: [created], edges: [] }).nodes[0]
    nodes = [
      ...nodes.map((known) => (select && known.selected ? { ...known, selected: false } : known)),
      { ...flowNode, selected: select },
    ]
    return created
  }

  /** Where new cards go: under the pointer when it's over the canvas, else the middle of the view. */
  function placement(size: { width: number; height: number }) {
    const box = container.getBoundingClientRect()
    const isInside =
      pointer.x >= box.left &&
      pointer.x <= box.right &&
      pointer.y >= box.top &&
      pointer.y <= box.bottom
    const at = flow.screenToFlowPosition(
      isInside ? pointer : { x: box.left + box.width / 2, y: box.top + box.height / 2 },
    )
    return { x: at.x - size.width / 2, y: at.y - size.height / 2, ...size }
  }

  function addText(text = '') {
    const node = addNode({ type: 'text', text, ...placement(CARD) })
    if (!text) editing = node.id
  }

  function addFile(file: string, at?: { x: number; y: number }) {
    const size = file.toLowerCase().endsWith(NOTE_EXTENSION) ? FILE_CARD : CARD
    const box = at ? { ...at, ...size } : placement(size)
    addNode({ type: 'file', file, ...box })
  }

  function addLink(url: string) {
    return addNode({ type: 'link', url, ...placement({ width: 400, height: 260 }) })
  }

  function addGroup() {
    const selected = nodes.filter((node) => node.selected)
    if (!selected.length) {
      addNode({ type: 'group', label: 'Group', ...placement({ width: 600, height: 400 }) })
      return
    }
    const bounds = flow.getNodesBounds(selected)
    addNode({
      type: 'group',
      label: 'Group',
      x: bounds.x - GRID * 2,
      y: bounds.y - GRID * 2,
      width: bounds.width + GRID * 4,
      height: bounds.height + GRID * 4,
    })
  }

  async function convertToNote(id: string) {
    const node = nodes.find((known) => known.id === id)?.data.node
    if (node?.type !== 'text') return
    const firstLine = node.text.trim().split('\n')[0] ?? ''
    const title = firstLine.replace(/^#+\s*/, '').slice(0, 60)
    try {
      const file = await workspace.createNoteWith(parentOf(path), title, node.text)
      const fileNode: FileNode = { ...node, type: 'file', file }
      delete (fileNode as { text?: string }).text
      nodes = nodes.map((known) =>
        known.id === id ? { ...known, type: 'file', data: { node: fileNode } } : known,
      )
    } catch (reason) {
      workspace.notify(String(reason))
    }
  }

  const selectedIds = () => new Set(nodes.filter((node) => node.selected).map((node) => node.id))

  function setColor(color: string | undefined) {
    if (menuTarget.kind === 'edge' && menuTarget.id) {
      updateEdge(menuTarget.id, { color })
      return
    }
    const ids = selectedIds()
    nodes = nodes.map((node) =>
      ids.has(node.id)
        ? { ...node, data: { node: { ...node.data.node, color } as CanvasNode } }
        : node,
    )
  }

  function setArrows(fromEnd: 'none' | 'arrow', toEnd: 'none' | 'arrow') {
    if (menuTarget.id) updateEdge(menuTarget.id, { fromEnd, toEnd })
  }

  function deleteSelection() {
    const ids = selectedIds()
    void flow.deleteElements({
      nodes: [...ids].map((id) => ({ id })),
      edges: edges.filter((edge) => edge.selected).map((edge) => ({ id: edge.id })),
    })
  }

  // Groups carry the cards inside them, like in Obsidian.
  let carried: { id: string; x: number; y: number }[] = []
  let dragOrigin = { x: 0, y: 0 }

  function onDragStart({ targetNode }: { targetNode: FlowNode | null }) {
    carried = []
    if (targetNode?.type !== 'group') return
    const all = fromFlow(nodes, [], canvas).nodes
    const group = all.find((node) => node.id === targetNode.id)
    if (!group) return
    const dragged = selectedIds()
    carried = nodesInside(group, all)
      .filter((node) => !dragged.has(node.id))
      .map((node) => ({ id: node.id, x: node.x, y: node.y }))
    dragOrigin = { ...targetNode.position }
  }

  function onDrag({ targetNode }: { targetNode: FlowNode | null }) {
    if (!targetNode || !carried.length) return
    const dx = targetNode.position.x - dragOrigin.x
    const dy = targetNode.position.y - dragOrigin.y
    const origins = new Map(carried.map((node) => [node.id, node]))
    nodes = nodes.map((node) => {
      const origin = origins.get(node.id)
      return origin ? { ...node, position: { x: origin.x + dx, y: origin.y + dy } } : node
    })
  }

  function onDragStop() {
    carried = []
    refreshEdgeSides()
  }

  function onBeforeConnect(connection: {
    source: string
    target: string
    sourceHandle?: string | null
    targetHandle?: string | null
  }) {
    const edge: CanvasEdge = {
      id: newId(),
      fromNode: connection.source,
      fromSide: (connection.sourceHandle ?? 'right') as CanvasEdge['fromSide'],
      toNode: connection.target,
      toSide: (connection.targetHandle ?? 'left') as CanvasEdge['toSide'],
    }
    return toFlowEdge(edge, byId())
  }

  const isTyping = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, .cm-editor') !== null)

  function onKeydown(event: KeyboardEvent) {
    if (isTyping(event.target)) {
      if (event.key === 'Escape') {
        editing = null
        container.focus()
      }
      return
    }
    const hotkey = hotkeyOf(event)
    const actions: Record<string, () => void> = {
      'Mod+Z': undo,
      'Mod+Shift+Z': redo,
      'Mod+Y': redo,
      'Mod+F': openSearch,
      'Mod+A': () => (nodes = nodes.map((node) => ({ ...node, selected: true }))),
      Enter: () => {
        const selected = nodes.filter((node) => node.selected)
        if (selected.length === 1) editing = selected[0].id
      },
      Escape: () => {
        nodes = nodes.map((node) => (node.selected ? { ...node, selected: false } : node))
        isSearching = false
      },
    }
    const action = actions[hotkey]
    if (!action) return
    event.preventDefault()
    event.stopPropagation()
    action()
  }

  function copySelection(event: ClipboardEvent, cut = false) {
    if (isTyping(event.target) || !container.contains(document.activeElement)) return
    const ids = withGroupContents(selectedIds())
    if (!ids.size || !event.clipboardData) return
    const copied = fromFlow(
      nodes.filter((node) => ids.has(node.id)),
      edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
      { nodes: [], edges: [] },
    )
    event.clipboardData.setData('text/plain', serializeCanvas(copied))
    event.preventDefault()
    if (cut) deleteSelection()
  }

  /** The ids plus every card inside the groups among them, which travel with their group. */
  function withGroupContents(ids: Set<string>) {
    const all = fromFlow(nodes, [], canvas).nodes
    const inside = all
      .filter((node) => node.type === 'group' && ids.has(node.id))
      .flatMap((group) => nodesInside(group, all))
    return new Set([...ids, ...inside.map((node) => node.id)])
  }

  function asCanvas(text: string): Canvas | null {
    try {
      const parsed = parseCanvas(text)
      return parsed.nodes.length && parsed.nodes.every((node) => node.id && node.type)
        ? parsed
        : null
    } catch {
      return null
    }
  }

  function paste(event: ClipboardEvent) {
    if (isTyping(event.target) || !container.contains(document.activeElement)) return
    const text = event.clipboardData?.getData('text/plain') ?? ''
    if (!text) return
    event.preventDefault()
    const pasted = asCanvas(text)
    if (!pasted) {
      if (isExternalUrl(text.trim()) && !/\s/.test(text.trim())) addLink(text.trim())
      else addText(text)
      return
    }
    const ids = new Map(pasted.nodes.map((node) => [node.id, newId()]))
    const left = Math.min(...pasted.nodes.map((node) => node.x))
    const top = Math.min(...pasted.nodes.map((node) => node.y))
    const right = Math.max(...pasted.nodes.map((node) => node.x + node.width))
    const bottom = Math.max(...pasted.nodes.map((node) => node.y + node.height))
    const target = placement({ width: right - left, height: bottom - top })
    const dx = snap(target.x - left)
    const dy = snap(target.y - top)
    const pastedNodes = pasted.nodes.map((node) => ({
      ...node,
      id: ids.get(node.id) as string,
      x: node.x + dx,
      y: node.y + dy,
    }))
    const pastedEdges = pasted.edges
      .filter((edge) => ids.has(edge.fromNode) && ids.has(edge.toNode))
      .map((edge) => ({
        ...edge,
        id: newId(),
        fromNode: ids.get(edge.fromNode) as string,
        toNode: ids.get(edge.toNode) as string,
      }))
    const added = toFlow({ nodes: pastedNodes, edges: pastedEdges })
    nodes = [
      ...nodes.map((node) => (node.selected ? { ...node, selected: false } : node)),
      ...added.nodes.map((node) => ({ ...node, selected: true })),
    ]
    edges = [...edges, ...added.edges]
  }

  function onDoubleClick(event: MouseEvent) {
    const target = event.target as HTMLElement
    if (!target.classList.contains('svelte-flow__pane')) return
    const at = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const node = addNode({
      type: 'text',
      text: '',
      x: at.x - CARD.width / 2,
      y: at.y - CARD.height / 2,
      ...CARD,
    })
    editing = node.id
  }

  let noteTexts = $state.raw(new Map<string, string>())

  const searchableText = (node: CanvasNode) =>
    node.type === 'file' ? `${node.file}\n${noteTexts.get(node.file) ?? ''}` : nodeText(node)

  const matches = $derived(
    searchQuery.trim()
      ? nodes.filter((node) =>
          searchableText(node.data.node).toLowerCase().includes(searchQuery.trim().toLowerCase()),
        )
      : [],
  )

  function openSearch() {
    isSearching = true
    void loadNoteTexts()
    requestAnimationFrame(() => container.querySelector<HTMLInputElement>('.search input')?.focus())
  }

  function closeSearch() {
    isSearching = false
    searchQuery = ''
    container.focus()
  }

  /** The text of the notes on note cards, so search finds what they show. */
  async function loadNoteTexts() {
    const files = nodes
      .map((node) => node.data.node)
      .filter((node): node is FileNode => node.type === 'file')
      .map((node) => node.file)
      .filter((file) => file.toLowerCase().endsWith(NOTE_EXTENSION))
    const texts = await Promise.all(
      files.map((file) =>
        vault.readNote(file).then(
          (text) => [file, text] as const,
          () => null,
        ),
      ),
    )
    noteTexts = new Map(texts.filter((entry) => entry !== null))
  }

  function showMatch(step: number) {
    if (!matches.length) return
    matchIndex = (matchIndex + step + matches.length) % matches.length
    const match = matches[matchIndex]
    nodes = nodes.map((node) => ({ ...node, selected: node.id === match.id }))
    void flow.fitView({ nodes: [{ id: match.id }], maxZoom: 1, padding: 0.3 })
  }

  async function exportAs(format: 'png' | 'svg') {
    const viewport = container.querySelector<HTMLElement>('.svelte-flow__viewport')
    if (!viewport || !nodes.length) return
    const background = getComputedStyle(container).backgroundColor
    try {
      const bytes = await exportImage(viewport, nodes, format, background)
      const name = `${basename(path).replace(/\.canvas$/i, '')}.${format}`
      const saved = await workspace.saveAttachment(
        {
          name,
          write: async (target) => {
            await vault.saveAttachment(target, bytes)
            return true
          },
        },
        path,
      )
      if (saved) workspace.notify(`Exported to ${saved}.`)
    } catch (reason) {
      workspace.notify(`Couldn't export the canvas: ${String(reason)}`)
    }
  }

  function dropFromTree(element: HTMLElement) {
    return dropTargetForElements({
      element,
      canDrop: ({ source: drag }) => isEntryDrag(drag.data),
      onDrop: ({ source: drag, location }) => {
        if (!isEntryDrag(drag.data)) return
        const { clientX, clientY } = location.current.input
        const at = flow.screenToFlowPosition({ x: clientX, y: clientY })
        const file = drag.data.path
        const size = file.toLowerCase().endsWith(NOTE_EXTENSION) ? FILE_CARD : CARD
        addFile(file, { x: at.x - size.width / 2, y: at.y - size.height / 2 })
      },
    })
  }

  const fileTargets = $derived(workspace.linkTargets.filter((target) => !target.alias))

  const menuNode = $derived(
    menuTarget.kind === 'node'
      ? nodes.find((node) => node.id === menuTarget.id)?.data.node
      : undefined,
  )
  const menuEdge = $derived(
    menuTarget.kind === 'edge'
      ? edges.find((edge) => edge.id === menuTarget.id)?.data?.edge
      : undefined,
  )
</script>

<svelte:document
  oncopy={copySelection}
  oncut={(event) => copySelection(event, true)}
  onpaste={paste}
/>

{#if error}
  <p class="error">{error}</p>
{:else}
  <ContextMenu.Root onOpenChange={(open) => !open && (menuTarget = { kind: 'pane' })}>
    <ContextMenu.Trigger>
      {#snippet child({ props })}
        <div
          {...props}
          class="canvas"
          class:embedded
          tabindex="-1"
          role="application"
          bind:this={container}
          onkeydown={onKeydown}
          onkeydowncapture={(event) => {
            if (event.key === 'Escape' && isSearching) {
              event.preventDefault()
              closeSearch()
            }
          }}
          ondblclick={onDoubleClick}
          onpointermove={(event) => (pointer = { x: event.clientX, y: event.clientY })}
          onpointerdown={(event) => {
            if (!isTyping(event.target)) container.focus()
          }}
          {@attach dropFromTree}
        >
          <SvelteFlow
            bind:nodes
            bind:edges
            {nodeTypes}
            {edgeTypes}
            fitView
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            snapGrid={[GRID, GRID]}
            connectionMode={ConnectionMode.Loose}
            zoomOnDoubleClick={false}
            elevateNodesOnSelect={false}
            deleteKey={['Delete', 'Backspace']}
            selectionKey="Shift"
            multiSelectionKey={['Meta', 'Control', 'Shift']}
            panOnDrag={[1, 2]}
            selectionOnDrag
            panOnScroll
            proOptions={{ hideAttribution: true }}
            onbeforeconnect={onBeforeConnect}
            onnodedragstart={onDragStart}
            onnodedrag={onDrag}
            onnodedragstop={onDragStop}
            onpaneclick={() => (editing = null)}
            onnodeclick={({ node }) => {
              if (editing !== node.id) editing = null
            }}
            onnodecontextmenu={({ node }) => {
              if (!node.selected) {
                nodes = nodes.map((known) => ({ ...known, selected: known.id === node.id }))
              }
              menuTarget = { kind: 'node', id: node.id }
            }}
            onedgecontextmenu={({ edge }) => (menuTarget = { kind: 'edge', id: edge.id })}
            onpanecontextmenu={() => (menuTarget = { kind: 'pane' })}
          >
            <Background variant={BackgroundVariant.Dots} gap={GRID} />
            {#if !embedded}
              <MiniMap pannable zoomable position="bottom-right" />
            {/if}
            <Panel position="top-left" class="toolbar">
              <button title="Add card" onclick={() => addText()}><StickyNote size={16} /></button>
              <button title="Add note or file" onclick={() => (isPickingFile = true)}>
                <FilePlus size={16} />
              </button>
              <button title="Add web page" onclick={() => (editing = addLink('https://').id)}>
                <Link size={16} />
              </button>
              <button title="Group" onclick={addGroup}><Group size={16} /></button>
              <span class="separator"></span>
              <button title="Undo" onclick={undo}><Undo2 size={16} /></button>
              <button title="Redo" onclick={redo}><Redo2 size={16} /></button>
              <span class="separator"></span>
              <button title="Zoom in" onclick={() => zoomBy(ZOOM_STEP)}>
                <ZoomIn size={16} />
              </button>
              <button title="Zoom out" onclick={() => zoomBy(1 / ZOOM_STEP)}>
                <ZoomOut size={16} />
              </button>
              <button title="Zoom to fit" onclick={() => flow.fitView()}>
                <Maximize size={16} />
              </button>
              <button title="Search" onclick={() => (isSearching ? closeSearch() : openSearch())}>
                <Search size={16} />
              </button>
              <button title="Export as PNG" onclick={() => exportAs('png')}>
                <Download size={16} />
              </button>
            </Panel>
            {#if isSearching}
              <Panel position="top-right" class="search">
                <input
                  class="nokey"
                  placeholder="Search the canvas"
                  bind:value={searchQuery}
                  oninput={() => (matchIndex = -1)}
                  onkeydown={(event) => {
                    if (event.key === 'Enter') showMatch(event.shiftKey ? -1 : 1)
                    else if (event.key === 'Escape') closeSearch()
                    event.stopPropagation()
                  }}
                />
                <span class="count">{searchQuery ? `${matches.length} found` : ''}</span>
                <button class="close" title="Close search" onclick={closeSearch}>
                  <X size={14} />
                </button>
              </Panel>
            {/if}
          </SvelteFlow>
        </div>
      {/snippet}
    </ContextMenu.Trigger>
    <ContextMenu.Portal>
      <ContextMenu.Content class="menu">
        {#if menuTarget.kind === 'pane'}
          <ContextMenu.Item class="menu-item" onSelect={() => addText()}>Add card</ContextMenu.Item>
          <ContextMenu.Item class="menu-item" onSelect={() => (isPickingFile = true)}>
            Add note or file
          </ContextMenu.Item>
          <ContextMenu.Item class="menu-item" onSelect={addGroup}>Add group</ContextMenu.Item>
          <ContextMenu.Separator class="menu-separator" />
          <ContextMenu.Item class="menu-item" onSelect={() => exportAs('png')}>
            Export as PNG
          </ContextMenu.Item>
          <ContextMenu.Item class="menu-item" onSelect={() => exportAs('svg')}>
            Export as SVG
          </ContextMenu.Item>
        {:else}
          <div class="swatches">
            <ContextMenu.Item
              class="swatch none"
              title="No color"
              onSelect={() => setColor(undefined)}
            />
            {#each Object.entries(PRESET_COLORS) as [preset, color] (preset)}
              <ContextMenu.Item
                class="swatch"
                style="background: {color}"
                onSelect={() => setColor(preset)}
              />
            {/each}
          </div>
          <ContextMenu.Separator class="menu-separator" />
          {#if menuNode?.type === 'text' || menuNode?.type === 'group' || menuNode?.type === 'link' || menuEdge}
            <ContextMenu.Item class="menu-item" onSelect={() => (editing = menuTarget.id ?? null)}>
              {menuNode?.type === 'group' || menuEdge ? 'Edit label' : 'Edit'}
            </ContextMenu.Item>
          {/if}
          {#if menuNode?.type === 'text'}
            <ContextMenu.Item class="menu-item" onSelect={() => convertToNote(menuNode.id)}>
              Convert to note
            </ContextMenu.Item>
          {:else if menuNode?.type === 'file'}
            <ContextMenu.Item
              class="menu-item"
              onSelect={() => workspace.openLink(menuNode.file, path, { newTab: true })}
            >
              Open in new tab
            </ContextMenu.Item>
          {:else if menuNode?.type === 'link'}
            <ContextMenu.Item class="menu-item" onSelect={() => workspace.openUrl(menuNode.url)}>
              Open in browser
            </ContextMenu.Item>
          {/if}
          {#if menuEdge}
            <ContextMenu.Item class="menu-item" onSelect={() => setArrows('none', 'arrow')}>
              One arrow
            </ContextMenu.Item>
            <ContextMenu.Item class="menu-item" onSelect={() => setArrows('arrow', 'arrow')}>
              Arrows on both ends
            </ContextMenu.Item>
            <ContextMenu.Item class="menu-item" onSelect={() => setArrows('none', 'none')}>
              No arrows
            </ContextMenu.Item>
          {:else}
            <ContextMenu.Item class="menu-item" onSelect={addGroup}
              >Group selection</ContextMenu.Item
            >
          {/if}
          <ContextMenu.Separator class="menu-separator" />
          <ContextMenu.Item
            class="menu-item danger"
            onSelect={() =>
              menuEdge
                ? void flow.deleteElements({ edges: [{ id: menuEdge.id }] })
                : deleteSelection()}
          >
            Delete
          </ContextMenu.Item>
        {/if}
      </ContextMenu.Content>
    </ContextMenu.Portal>
  </ContextMenu.Root>
{/if}

<FuzzyPicker
  bind:open={isPickingFile}
  items={fileTargets}
  label={(target) => target.path}
  placeholder="Add a note or file to the canvas"
  onChoose={(target) => addFile(target.path)}
/>

<style>
  .canvas {
    --canvas-edge: var(--text-faint);
    width: 100%;
    height: 100%;
    outline: none;
    background: var(--background);
  }

  .canvas.embedded {
    height: 400px;
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .canvas :global(.svelte-flow) {
    --xy-background-color: var(--background);
    --xy-background-pattern-color: var(--border);
    --xy-node-background-color: transparent;
    --xy-node-border: none;
    --xy-node-boxshadow-selected: none;
    --xy-handle-background-color: var(--accent);
    --xy-handle-border-color: var(--background);
    --xy-selection-background-color: color-mix(in srgb, var(--accent) 10%, transparent);
    --xy-selection-border: 1px solid var(--accent);
    --xy-resize-line-color: var(--accent);
    --xy-resize-background-color: var(--accent);
    --xy-minimap-background-color: var(--background-secondary);
    --xy-minimap-mask-background-color: color-mix(in srgb, var(--background) 60%, transparent);
    --xy-minimap-node-background-color: var(--text-faint);
    --xy-edge-stroke: var(--canvas-edge);
    background: var(--background);
  }

  .canvas :global(.svelte-flow__handle) {
    width: 10px;
    height: 10px;
    opacity: 0;
  }

  .canvas :global(.svelte-flow__node:hover .svelte-flow__handle),
  .canvas :global(.svelte-flow__node.selected .svelte-flow__handle) {
    opacity: 1;
  }

  .canvas :global(.toolbar),
  .canvas :global(.search) {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--background-secondary);
  }

  .canvas :global(.toolbar button),
  .canvas :global(.search .close) {
    display: grid;
    width: 28px;
    height: 28px;
    place-items: center;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }

  .canvas :global(.toolbar button:hover),
  .canvas :global(.search .close:hover) {
    background: var(--hover);
    color: var(--text);
  }

  .separator {
    width: 1px;
    height: 18px;
    margin: 0 4px;
    background: var(--border);
  }

  .canvas :global(.search input) {
    width: 200px;
  }

  .count {
    padding: 0 6px;
    color: var(--text-faint);
    font-size: 12px;
  }

  .swatches {
    display: flex;
    gap: 6px;
    padding: 6px 8px;
  }

  :global(.menu .swatch) {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    cursor: pointer;
  }

  :global(.menu .swatch[data-highlighted]) {
    outline: 2px solid var(--text);
  }

  :global(.menu .swatch.none) {
    border: 1px solid var(--border);
    background: linear-gradient(
      135deg,
      transparent 45%,
      var(--text-faint) 45% 55%,
      transparent 55%
    );
  }

  .error {
    padding: 24px;
    color: var(--text-muted);
  }
</style>
