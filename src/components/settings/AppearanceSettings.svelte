<script lang="ts">
  import { FolderOpen, RefreshCw, RotateCcw } from '@lucide/svelte'
  import { DEFAULT_APPEARANCE } from '../../lib/appearance'
  import { workspace } from '../../lib/workspace.svelte'
  import Choice from './Choice.svelte'
  import Setting from './Setting.svelte'

  const MIN_FONT_SIZE = 10
  const MAX_FONT_SIZE = 30

  const appearance = $derived(workspace.appearance.value)
</script>

<Setting name="Theme" description="Follow the system, or always use light or dark.">
  <Choice
    value={appearance.theme}
    options={[
      { value: 'system', label: 'System' },
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
    ]}
    onchange={(theme) => workspace.setAppearance({ theme })}
  />
</Setting>
<Setting name="Accent color" description="Links, selections and highlights.">
  <span class="row">
    <input
      type="color"
      value={appearance.accentColor || '#6d5dd3'}
      onchange={(event) => workspace.setAppearance({ accentColor: event.currentTarget.value })}
    />
    {#if appearance.accentColor}
      <button
        class="icon"
        title="Use the theme's accent"
        onclick={() => workspace.setAppearance({ accentColor: '' })}
      >
        <RotateCcw size={14} />
      </button>
    {/if}
  </span>
</Setting>
<Setting name="Font size" description="Text size in notes, in pixels.">
  <input
    type="number"
    min={MIN_FONT_SIZE}
    max={MAX_FONT_SIZE}
    value={appearance.baseFontSize}
    onchange={(event) => {
      const size = Number(event.currentTarget.value)
      const clamped = Math.min(
        Math.max(size || DEFAULT_APPEARANCE.baseFontSize, MIN_FONT_SIZE),
        MAX_FONT_SIZE,
      )
      workspace.setAppearance({ baseFontSize: clamped })
    }}
  />
</Setting>
<Setting
  name="Text font"
  description="A font installed on this computer. Empty uses the system font."
>
  <input
    value={appearance.textFontFamily}
    placeholder="System font"
    onchange={(event) =>
      workspace.setAppearance({ textFontFamily: event.currentTarget.value.trim() })}
  />
</Setting>
<Setting name="Code font" description="For code blocks and inline code.">
  <input
    value={appearance.monospaceFontFamily}
    placeholder="System monospace"
    onchange={(event) =>
      workspace.setAppearance({ monospaceFontFamily: event.currentTarget.value.trim() })}
  />
</Setting>

<header>
  <span>
    <strong>CSS snippets</strong>
    <small>CSS files in this vault's <code>.flint/snippets</code> folder.</small>
  </span>
  <span class="row">
    <button class="icon" title="Reload snippets" onclick={() => workspace.reloadSnippets()}>
      <RefreshCw size={16} />
    </button>
    <button
      class="icon"
      title="Open snippets folder"
      onclick={() => workspace.openSnippetsFolder()}
    >
      <FolderOpen size={16} />
    </button>
  </span>
</header>
{#if workspace.snippets.length === 0}
  <p class="empty">No snippets yet. Add a <code>.css</code> file to the folder and reload.</p>
{/if}
{#each workspace.snippets as name (name)}
  <Setting {name}>
    <input
      type="checkbox"
      checked={appearance.enabledCssSnippets.includes(name)}
      onchange={(event) => workspace.toggleSnippet(name, event.currentTarget.checked)}
    />
  </Setting>
{/each}

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  input[type='color'] {
    width: 36px;
    height: 26px;
    padding: 0;
    border: none;
    background: none;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: 20px;
  }

  header span:first-child {
    display: grid;
    gap: 4px;
  }

  small,
  .empty {
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
