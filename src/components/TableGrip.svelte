<script lang="ts" module>
  /** A menu entry: its name, what it does and whether it's disabled; `null` is a separator. */
  export type GripItem = [name: string, run: () => void, isDisabled?: boolean] | null
</script>

<script lang="ts">
  import { GripHorizontal, GripVertical } from '@lucide/svelte'
  import { DropdownMenu } from 'bits-ui'

  let {
    label,
    kind,
    items,
    isShown,
  }: { label: string; kind: 'row' | 'column'; items: GripItem[]; isShown: boolean } = $props()

  let isOpen = $state(false)
</script>

<DropdownMenu.Root bind:open={isOpen}>
  <DropdownMenu.Trigger
    class="table-grip {kind}-grip"
    data-shown={isShown || isOpen || undefined}
    title={label}
    oncontextmenu={(event: MouseEvent) => {
      event.preventDefault()
      isOpen = true
    }}
  >
    {#if kind === 'row'}<GripVertical size={12} />{:else}<GripHorizontal size={12} />{/if}
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content class="menu" align="start">
      {#each items as item, index (index)}
        {#if item}
          <DropdownMenu.Item class="menu-item" disabled={item[2]} onSelect={item[1]}>
            {item[0]}
          </DropdownMenu.Item>
        {:else}
          <DropdownMenu.Separator class="menu-separator" />
        {/if}
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
