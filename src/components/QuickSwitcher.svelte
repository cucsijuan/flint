<script lang="ts">
  import { noteTitle, parentOf } from '../lib/paths'
  import type { LinkTarget } from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'
  import FuzzyPicker from './FuzzyPicker.svelte'
</script>

<FuzzyPicker
  bind:open={workspace.isQuickSwitcherOpen}
  items={workspace.linkTargets}
  label={(target: LinkTarget) => target.alias ?? noteTitle(target.path)}
  detail={(target: LinkTarget) =>
    target.alias ? `→ ${noteTitle(target.path)}` : parentOf(target.path)}
  placeholder="Find or create a note…"
  hint="↵ open · Shift+↵ create"
  onChoose={(target: LinkTarget) => workspace.openNote(target.path)}
  onSubmitQuery={(query) => workspace.openOrCreateNote(query)}
/>
