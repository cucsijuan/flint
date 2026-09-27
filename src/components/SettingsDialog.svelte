<script lang="ts">
  import { Dialog } from 'bits-ui'
  import type { Component } from 'svelte'
  import { workspace } from '../lib/workspace.svelte'
  import AppearanceSettings from './settings/AppearanceSettings.svelte'
  import DailyNotesSettings from './settings/DailyNotesSettings.svelte'
  import EditorSettings from './settings/EditorSettings.svelte'
  import GeneralSettings from './settings/GeneralSettings.svelte'
  import PluginSettings from './settings/PluginSettings.svelte'

  interface Section {
    name: string
    content: Component
    needsVault: boolean
  }

  const sections: Section[] = [
    { name: 'Editor', content: EditorSettings, needsVault: true },
    { name: 'Appearance', content: AppearanceSettings, needsVault: true },
    { name: 'Daily notes and templates', content: DailyNotesSettings, needsVault: true },
    { name: 'Plugins', content: PluginSettings, needsVault: true },
    { name: 'General', content: GeneralSettings, needsVault: false },
  ]

  let current = $state('Editor')
  const available = $derived(sections.filter((section) => workspace.info || !section.needsVault))
  const shown = $derived(available.find((section) => section.name === current) ?? available[0])
</script>

<Dialog.Root bind:open={workspace.isSettingsOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="overlay" />
    <Dialog.Content class="dialog settings">
      <nav>
        <Dialog.Title class="dialog-title">Settings</Dialog.Title>
        {#each available as section (section.name)}
          <button class:current={section === shown} onclick={() => (current = section.name)}>
            {section.name}
          </button>
        {/each}
      </nav>
      <div class="content">
        <h2>{shown.name}</h2>
        <shown.content />
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.overlay) {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgb(0 0 0 / 0.4);
  }

  :global(.dialog) {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 50;
    width: min(560px, calc(100vw - 32px));
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--background);
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    transform: translate(-50%, -50%);
    box-shadow: 0 8px 32px rgb(0 0 0 / 0.3);
  }

  :global(.dialog.settings) {
    display: flex;
    width: min(860px, calc(100vw - 32px));
    height: min(640px, calc(100vh - 32px));
    padding: 0;
    overflow: hidden;
  }

  :global(.dialog-title) {
    margin: 0 0 16px;
    font-size: 18px;
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 200px;
    flex-shrink: 0;
    padding: 20px 12px;
    border-right: 1px solid var(--border);
    background: var(--background-secondary);
  }

  nav button {
    padding: 6px 10px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  nav button:hover {
    background: var(--hover);
  }

  nav button.current {
    background: var(--selected);
  }

  .content {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: 20px 24px;
    font-size: 13px;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 16px;
  }
</style>
