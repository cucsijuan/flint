<script lang="ts">
  import { ChevronLeft, X } from '@lucide/svelte'
  import { Dialog } from 'bits-ui'
  import { isMobile } from '../lib/platform'
  import type { Component } from 'svelte'
  import { pluginHost } from '../lib/plugins/host.svelte'
  import { workspace } from '../lib/workspace.svelte'
  import PluginView from './PluginView.svelte'
  import AppearanceSettings from './settings/AppearanceSettings.svelte'
  import DailyNotesSettings from './settings/DailyNotesSettings.svelte'
  import EditorSettings from './settings/EditorSettings.svelte'
  import GeneralSettings from './settings/GeneralSettings.svelte'
  import HotkeySettings from './settings/HotkeySettings.svelte'
  import PluginSettings from './settings/PluginSettings.svelte'

  interface Section {
    name: string
    content: Component
    needsVault: boolean
  }

  const sections: Section[] = [
    { name: 'Editor', content: EditorSettings, needsVault: true },
    { name: 'Appearance', content: AppearanceSettings, needsVault: true },
    { name: 'Hotkeys', content: HotkeySettings, needsVault: true },
    { name: 'Daily notes and templates', content: DailyNotesSettings, needsVault: true },
    { name: 'Plugins', content: PluginSettings, needsVault: true },
    // Its only setting is checking for updates, which phones leave to their app store.
    ...(isMobile ? [] : [{ name: 'General', content: GeneralSettings, needsVault: false }]),
  ]

  let current = $state('Editor')
  /** Phones show the section list and a section's page one at a time. */
  let isShowingPage = $state(!isMobile)
  const available = $derived(sections.filter((section) => workspace.info || !section.needsVault))
  const pluginTab = $derived(pluginHost.settingsTabs.find((tab) => tab.pluginId === current))
  const shown = $derived(available.find((section) => section.name === current) ?? available[0])

  function open(name: string) {
    current = name
    isShowingPage = true
  }
</script>

<Dialog.Root bind:open={workspace.isSettingsOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="overlay" />
    <Dialog.Content class="dialog settings">
      <nav class:hidden={isMobile && isShowingPage}>
        <div class="title">
          <Dialog.Title class="dialog-title">Settings</Dialog.Title>
          {#if isMobile}
            <Dialog.Close class="icon-button" aria-label="Close"><X size={22} /></Dialog.Close>
          {/if}
        </div>
        {#each available as section (section.name)}
          <button
            class:current={!pluginTab && section === shown}
            onclick={() => open(section.name)}
          >
            {section.name}
          </button>
        {/each}
        {#if pluginHost.settingsTabs.length}
          <p class="group">Plugin options</p>
          {#each pluginHost.settingsTabs as tab (tab.pluginId)}
            <button class:current={tab === pluginTab} onclick={() => open(tab.pluginId)}>
              {tab.name}
            </button>
          {/each}
        {/if}
      </nav>
      <div class="content" class:hidden={!isShowingPage}>
        {#if isMobile}
          <button class="back" onclick={() => (isShowingPage = false)}>
            <ChevronLeft size={22} /> Settings
          </button>
        {/if}
        {#if pluginTab}
          <h2>{pluginTab.name}</h2>
          {#key pluginTab}<PluginView render={pluginTab.render} />{/key}
        {:else}
          <h2>{shown.name}</h2>
          <shown.content />
        {/if}
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

  .group {
    margin: 12px 10px 4px;
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 16px;
  }

  .title {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .back {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0 0 12px -6px;
    padding: 6px 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
  }

  .hidden {
    display: none;
  }

  :global(.mobile .dialog.settings) {
    inset: 0;
    width: 100%;
    max-height: none;
    height: 100%;
    border: none;
    border-radius: 0;
    transform: none;
  }

  :global(.mobile) nav {
    width: 100%;
    border-right: none;
  }

  :global(.mobile) nav button {
    padding: 12px 10px;
    font-size: 16px;
  }

  :global(.mobile) .content {
    padding: 12px 16px;
    font-size: 15px;
  }

  :global(.mobile) .title :global(.icon-button) {
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    border: none;
    background: none;
    color: var(--text-muted);
  }
</style>
