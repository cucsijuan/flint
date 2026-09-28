<script lang="ts">
  import { Icon, type IconNode } from '@lucide/svelte'

  const ICON_SIZE = 16

  let { name, fallback }: { name?: string; fallback: string } = $props()
  let iconNode = $state<IconNode | null>(null)

  const exportName = (name: string) =>
    name.replace(/(?:^|-)([a-z0-9])/g, (_, first: string) => first.toUpperCase())

  $effect(() => {
    iconNode = null
    if (!name) return
    const wanted = exportName(name)
    let isCurrent = true
    // Lucide's full icon set, aliases included, is loaded only when a plugin asks for an icon.
    void import('lucide').then((icons: Record<string, unknown>) => {
      const node = icons[wanted]
      if (isCurrent && Array.isArray(node)) iconNode = node as IconNode
    })
    return () => (isCurrent = false)
  })
</script>

{#if iconNode}<Icon {iconNode} size={ICON_SIZE} />{:else}{fallback}{/if}
