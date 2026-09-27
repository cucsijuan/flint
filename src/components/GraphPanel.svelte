<script lang="ts">
  import { Settings2 } from '@lucide/svelte'
  import { activeColorGroups, filterGraph, rgbToHex } from '../lib/graph'
  import * as vault from '../lib/vault'
  import type { GraphNode } from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'
  import GraphSettingsPanel from './GraphSettingsPanel.svelte'
  import GraphView from './GraphView.svelte'

  let { scope }: { scope?: { center: string; depth: number } } = $props()

  let isPanelOpen = $state(false)
  let nodeColors = $state(new Map<string, string>())

  const settings = $derived(workspace.graphConfig.value)
  const graph = $derived(filterGraph(workspace.graph, settings, scope))

  $effect(() => {
    const groups = activeColorGroups(settings.colorGroups)
    void workspace.indexVersion
    void vault.matchingNotes(groups.map((group) => group.query)).then((matches) => {
      const entries = groups.flatMap((group, index) =>
        matches[index].map((path) => [path, rgbToHex(group.color.rgb)] as const),
      )
      // Reversed so a note keeps the color of the first group it matches.
      nodeColors = new Map(entries.reverse())
    })
  })

  function open(node: GraphNode) {
    if (node.kind === 'note') workspace.openNote(node.id)
    else if (node.kind === 'tag') workspace.openSearch(`tag:${node.label}`)
    else void workspace.openLink(node.label)
  }
</script>

<section>
  <GraphView
    {graph}
    focus={scope?.center ?? workspace.notePath ?? undefined}
    forces={settings}
    {nodeColors}
    onOpen={open}
  />
  <div class="overlay">
    <button
      class="icon toggle"
      class:on={isPanelOpen}
      title="Graph settings"
      onclick={() => (isPanelOpen = !isPanelOpen)}
    >
      <Settings2 size={16} />
    </button>
    {#if isPanelOpen}<GraphSettingsPanel isLocal={scope !== undefined} />{/if}
  </div>
</section>

<style>
  section {
    position: relative;
    height: 100%;
  }

  .overlay {
    position: absolute;
    top: 8px;
    right: 8px;
    bottom: 8px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    pointer-events: none;
  }

  .overlay > :global(*) {
    pointer-events: auto;
  }

  .toggle {
    background: var(--background);
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
  }

  .on {
    color: var(--accent);
  }
</style>
