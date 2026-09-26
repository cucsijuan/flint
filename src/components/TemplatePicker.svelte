<script lang="ts">
  import { noteTitle } from '../lib/paths'
  import type { Entry } from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'
  import FuzzyPicker from './FuzzyPicker.svelte'
</script>

<FuzzyPicker
  bind:open={workspace.isTemplatePickerOpen}
  items={workspace.templateNotes}
  label={(entry: Entry) => noteTitle(entry.path)}
  placeholder="Insert a template…"
  onChoose={(entry: Entry) => workspace.insertTemplate(entry.path)}
/>
