<script lang="ts">
  import type { PluginSidebarTab } from '../lib/plugins/host.svelte'

  let { tab }: { tab: PluginSidebarTab } = $props()

  function render(element: HTMLElement) {
    try {
      return tab.render(element) ?? undefined
    } catch (error) {
      element.textContent = String(error)
    }
  }
</script>

<div class="plugin-tab" {@attach render}></div>

<style>
  .plugin-tab {
    height: 100%;
    overflow: auto;
  }
</style>
