<script lang="ts">
  import { workspace } from '../../lib/workspace.svelte'
  import FuzzyPicker from '../FuzzyPicker.svelte'

  const isOpen = {
    get value() {
      return workspace.iosVaults !== null
    },
    set value(open: boolean) {
      if (!open) workspace.iosVaults = null
    },
  }
</script>

<FuzzyPicker
  bind:open={isOpen.value}
  items={workspace.iosVaults?.vaults ?? []}
  label={(name: string) => name}
  placeholder="Choose a vault, or type a name for a new one…"
  hint="Vaults are folders in Flint's folder of the Files app. Type a new name and tap Shift+Enter to create one."
  onChoose={(name: string) => workspace.openIosVault(name)}
  onSubmitQuery={(name) => workspace.openIosVault(name)}
/>
