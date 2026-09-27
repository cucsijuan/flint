<script lang="ts">
  import type { Disposer } from '../../plugin-api'

  /** Content a plugin renders itself: a sidebar tab or a settings section. */
  let { render }: { render: (element: HTMLElement) => Disposer | undefined } = $props()

  function attach(element: HTMLElement) {
    try {
      return render(element) ?? undefined
    } catch (error) {
      element.textContent = String(error)
    }
  }
</script>

<div class="plugin-view" {@attach attach}></div>

<style>
  .plugin-view {
    height: 100%;
    overflow: auto;
  }
</style>
