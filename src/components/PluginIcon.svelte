<script lang="ts">
  import type { Component } from 'svelte'

  const ICON_SIZE = 16

  /** Every Lucide icon as its own chunk, loaded only when a plugin asks for it by name. */
  const icons = import.meta.glob<{ default: Component<{ size: number }> }>(
    '/node_modules/@lucide/svelte/dist/icons/*.js',
  )

  let { name, fallback }: { name?: string; fallback: string } = $props()
  let Icon = $state<Component<{ size: number }> | null>(null)

  $effect(() => {
    Icon = null
    const load = name ? icons[`/node_modules/@lucide/svelte/dist/icons/${name}.js`] : undefined
    void load?.().then((module) => (Icon = module.default))
  })
</script>

{#if Icon}<Icon size={ICON_SIZE} />{:else}{fallback}{/if}
