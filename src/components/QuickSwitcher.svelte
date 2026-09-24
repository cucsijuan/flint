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
  hint="↵ open · Ctrl+↵ open in new tab · Shift+↵ create"
  onChoose={(target: LinkTarget, options) => workspace.openNote(target.path, options)}
  onSubmitQuery={(query) => workspace.openOrCreateNote(query)}
/>
