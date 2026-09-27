<script lang="ts">
  import { Plus, RotateCcw, X } from '@lucide/svelte'
  import { type ColorGroup, DEFAULT_GRAPH, hexToRgb, rgbToHex } from '../lib/graph'
  import { workspace } from '../lib/workspace.svelte'

  const DEFAULT_GROUP_COLOR = 0x4f9d69

  let { isLocal = false }: { isLocal?: boolean } = $props()

  const settings = $derived(workspace.graphConfig.value)

  const forces = [
    { key: 'centerStrength', label: 'Center force', min: 0, max: 1, step: 0.01 },
    { key: 'repelStrength', label: 'Repel force', min: 0, max: 20, step: 0.1 },
    { key: 'linkStrength', label: 'Link force', min: 0, max: 1, step: 0.01 },
    { key: 'linkDistance', label: 'Link distance', min: 30, max: 500, step: 1 },
  ] as const

  function updateGroup(index: number, changes: Partial<ColorGroup>) {
    const colorGroups = settings.colorGroups.map((group, at) =>
      at === index ? { ...group, ...changes } : group,
    )
    workspace.setGraph({ colorGroups })
  }

  const addGroup = () =>
    workspace.setGraph({
      colorGroups: [
        ...settings.colorGroups,
        { query: '', color: { a: 1, rgb: DEFAULT_GROUP_COLOR } },
      ],
    })

  const removeGroup = (index: number) =>
    workspace.setGraph({ colorGroups: settings.colorGroups.filter((_, at) => at !== index) })

  const resetForces = () =>
    workspace.setGraph({
      centerStrength: DEFAULT_GRAPH.centerStrength,
      repelStrength: DEFAULT_GRAPH.repelStrength,
      linkStrength: DEFAULT_GRAPH.linkStrength,
      linkDistance: DEFAULT_GRAPH.linkDistance,
    })
</script>

<div class="panel">
  <details open>
    <summary>Filters</summary>
    <input
      type="search"
      placeholder="Filter by path…"
      value={settings.search}
      oninput={(event) => workspace.setGraph({ search: event.currentTarget.value })}
    />
    <label>
      <input
        type="checkbox"
        checked={settings.showTags}
        onchange={(event) => workspace.setGraph({ showTags: event.currentTarget.checked })}
      />
      Tags
    </label>
    <label>
      <input
        type="checkbox"
        checked={!settings.hideUnresolved}
        onchange={(event) => workspace.setGraph({ hideUnresolved: !event.currentTarget.checked })}
      />
      Missing notes
    </label>
    <label>
      <input
        type="checkbox"
        checked={settings.showOrphans}
        onchange={(event) => workspace.setGraph({ showOrphans: event.currentTarget.checked })}
      />
      Orphans
    </label>
    {#if isLocal}
      <label class="slider">
        Depth {workspace.localGraphDepth}
        <input type="range" min="1" max="3" bind:value={workspace.localGraphDepth} />
      </label>
    {/if}
  </details>

  <details open>
    <summary>Groups</summary>
    <p class="hint">
      Color notes that match a search, like <code>tag:#project</code> or <code>path:Journal</code>.
    </p>
    {#each settings.colorGroups as group, index (index)}
      <div class="group">
        <input
          type="color"
          value={rgbToHex(group.color.rgb)}
          oninput={(event) =>
            updateGroup(index, { color: { a: 1, rgb: hexToRgb(event.currentTarget.value) } })}
        />
        <input
          type="search"
          placeholder="Search query…"
          value={group.query}
          oninput={(event) => updateGroup(index, { query: event.currentTarget.value })}
        />
        <button class="icon" title="Remove group" onclick={() => removeGroup(index)}>
          <X size={14} />
        </button>
      </div>
    {/each}
    <button class="add" onclick={addGroup}><Plus size={14} /> New group</button>
  </details>

  <details open>
    <summary>
      Forces
      <button class="icon reset" title="Restore defaults" onclick={resetForces}>
        <RotateCcw size={13} />
      </button>
    </summary>
    {#each forces as force (force.key)}
      <label class="slider">
        {force.label}
        <input
          type="range"
          min={force.min}
          max={force.max}
          step={force.step}
          value={settings[force.key]}
          oninput={(event) =>
            workspace.setGraph({ [force.key]: Number(event.currentTarget.value) })}
        />
      </label>
    {/each}
  </details>
</div>

<style>
  .panel {
    display: grid;
    gap: 4px;
    width: 240px;
    max-height: 100%;
    overflow-y: auto;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--background);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.2);
    color: var(--text-muted);
    font-size: 12px;
  }

  details {
    display: grid;
    gap: 6px;
  }

  details[open] {
    padding-bottom: 6px;
  }

  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
    color: var(--text);
    font-weight: 600;
    cursor: pointer;
  }

  details > :not(summary) {
    margin-top: 6px;
  }

  label {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .slider {
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
  }

  input[type='search'] {
    width: 100%;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text);
    font: inherit;
  }

  input[type='checkbox'],
  input[type='range'] {
    accent-color: var(--accent);
  }

  .group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  input[type='color'] {
    width: 26px;
    height: 24px;
    flex-shrink: 0;
    padding: 0;
    border: none;
    background: none;
  }

  .hint {
    margin: 0;
    line-height: 1.4;
  }

  .add {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    border: 1px dashed var(--border);
    border-radius: 4px;
    background: none;
    color: var(--text-muted);
    font: inherit;
    cursor: pointer;
  }

  .reset {
    width: 22px;
    height: 22px;
  }
</style>
