<script lang="ts">
  import { commands, displayHotkey, type Command } from '../lib/commands.svelte'
  import { workspace } from '../lib/workspace.svelte'
  import FuzzyPicker from './FuzzyPicker.svelte'
</script>

<FuzzyPicker
  bind:open={workspace.isCommandPaletteOpen}
  items={workspace.isCommandPaletteOpen ? commands.available() : []}
  label={(command: Command) => command.name}
  detail={(command: Command) => (command.hotkey ? displayHotkey(command.hotkey) : '')}
  placeholder="Type a command…"
  onChoose={(command: Command) => command.run()}
/>
