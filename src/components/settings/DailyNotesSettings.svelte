<script lang="ts">
  import { dayjs } from '../../lib/dates'
  import { NOTE_EXTENSION } from '../../lib/paths'
  import { workspace } from '../../lib/workspace.svelte'
  import Setting from './Setting.svelte'
</script>

<h3>Daily notes</h3>
<Setting name="Folder" description="Where new daily notes go. Empty means the vault root.">
  <input
    value={workspace.dailyNotes.folder}
    placeholder="Vault root"
    onchange={(event) => workspace.setDailyNotes({ folder: event.currentTarget.value.trim() })}
  />
</Setting>
<Setting
  name="Date format"
  description="Today: {dayjs().format(workspace.dailyNotes.format || 'YYYY-MM-DD')}"
>
  <input
    value={workspace.dailyNotes.format}
    placeholder="YYYY-MM-DD"
    oninput={(event) => workspace.setDailyNotes({ format: event.currentTarget.value.trim() })}
  />
</Setting>
<Setting name="Template" description="A note whose contents start every new daily note.">
  <input
    value={workspace.dailyNotes.template}
    placeholder="Templates/Daily"
    list="template-notes"
    onchange={(event) => workspace.setDailyNotes({ template: event.currentTarget.value.trim() })}
  />
</Setting>
<h3>Templates</h3>
<Setting
  name="Folder"
  description={'Notes here can be inserted with "Insert template". Use {{title}}, {{date}}, {{time}} or {{date:YYYY-MM-DD}}.'}
>
  <input
    value={workspace.templates.folder}
    placeholder="Templates"
    onchange={(event) => workspace.setTemplates({ folder: event.currentTarget.value.trim() })}
  />
</Setting>
<datalist id="template-notes">
  {#each workspace.templateNotes as entry (entry.path)}
    <option value={entry.path.slice(0, -NOTE_EXTENSION.length)}></option>
  {/each}
</datalist>

<style>
  h3 {
    margin: 16px 0 4px;
    font-size: 14px;
  }

  h3:first-child {
    margin-top: 0;
  }
</style>
