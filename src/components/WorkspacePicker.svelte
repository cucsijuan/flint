<script lang="ts">
  import { isMac } from '../lib/commands.svelte'
  import { workspace } from '../lib/workspace.svelte'
  import FuzzyPicker from './FuzzyPicker.svelte'

  // The picker closes before it calls back, which clears `workspace.workspacePicker`.
  let mode = $state<'load' | 'delete'>('load')
  $effect.pre(() => {
    if (workspace.workspacePicker) mode = workspace.workspacePicker
  })
  const isOpen = {
    get value() {
      return workspace.workspacePicker !== null
    },
    set value(open: boolean) {
      if (!open) workspace.workspacePicker = null
    },
  }
  const active = $derived(workspace.workspacesConfig.value.active)
</script>

<FuzzyPicker
  bind:open={isOpen.value}
  items={workspace.workspaceNames}
  label={(name: string) => name}
  detail={(name: string) => (name === active ? 'current' : '')}
  placeholder={mode === 'delete' ? 'Delete a workspace…' : 'Load a workspace, or name a new one…'}
  hint={mode === 'delete'
    ? '↵ delete'
    : `↵ load · ${isMac ? '⇧' : 'Shift+'}↵ save the current layout under the typed name`}
  onChoose={(name: string) =>
    mode === 'delete' ? workspace.deleteWorkspace(name) : workspace.loadWorkspace(name)}
  onSubmitQuery={mode === 'load' ? (name) => workspace.saveWorkspace(name) : undefined}
/>
