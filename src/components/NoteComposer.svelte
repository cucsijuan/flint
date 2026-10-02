<script lang="ts">
  import { isMac } from '../lib/commands.svelte'
  import { noteTitle, parentOf } from '../lib/paths'
  import type { LinkTarget } from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'
  import FuzzyPicker from './FuzzyPicker.svelte'

  const isOpen = {
    get value() {
      return workspace.composer !== null
    },
    set value(open: boolean) {
      if (!open) workspace.composer = null
    },
  }
  const notes = $derived(
    workspace.linkTargets.filter(
      (target) =>
        !target.alias && target.path.endsWith('.md') && target.path !== workspace.notePath,
    ),
  )
  // The picker closes before it calls back, which clears `workspace.composer`; keep the mode.
  let mode = $state<'extract' | 'merge'>('extract')
  $effect.pre(() => {
    if (workspace.composer) mode = workspace.composer
  })
</script>

<FuzzyPicker
  bind:open={isOpen.value}
  items={notes}
  label={(target: LinkTarget) => noteTitle(target.path)}
  detail={(target: LinkTarget) => parentOf(target.path)}
  placeholder={mode === 'merge' ? 'Merge this note into…' : 'Extract the selection into…'}
  hint={mode === 'merge'
    ? '↵ merge into the chosen note, then delete this one'
    : `↵ append to the chosen note · ${isMac ? '⇧' : 'Shift+'}↵ create a note with the typed name`}
  onChoose={(target: LinkTarget) =>
    mode === 'merge'
      ? workspace.mergeInto(target.path)
      : workspace.extractSelection(target.path, false)}
  onSubmitQuery={mode === 'extract'
    ? (query) => workspace.extractSelection(query, true)
    : undefined}
/>
