<script lang="ts">
  import { workspace } from '../../lib/workspace.svelte'
  import Choice from './Choice.svelte'
  import Setting from './Setting.svelte'
  import SpellingLanguages from './SpellingLanguages.svelte'

  const MIN_LINE_WIDTH = 400
  const MAX_LINE_WIDTH = 3000

  const settings = $derived(workspace.settings.value)
</script>

<Setting
  name="Editing mode"
  description="Live preview hides Markdown syntax outside the cursor; source mode shows it all."
>
  <Choice
    value={settings.editorMode}
    options={[
      { value: 'live', label: 'Live preview' },
      { value: 'source', label: 'Source mode' },
    ]}
    onchange={(editorMode) => workspace.setSettings({ editorMode })}
  />
</Setting>
<Setting
  name="Readable line length"
  description="Keep lines at a comfortable width instead of filling the window."
>
  <input
    type="checkbox"
    checked={settings.readableLineLength}
    onchange={(event) => workspace.setSettings({ readableLineLength: event.currentTarget.checked })}
  />
</Setting>
<Setting
  name="Readable line width"
  description="How wide notes, tables and bases get while readable line length is on, in pixels."
>
  <input
    type="number"
    min={MIN_LINE_WIDTH}
    max={MAX_LINE_WIDTH}
    step="20"
    disabled={!settings.readableLineLength}
    value={settings.readableLineWidth}
    onchange={(event) => {
      const width = Math.round(Number(event.currentTarget.value))
      const readableLineWidth = Math.min(MAX_LINE_WIDTH, Math.max(MIN_LINE_WIDTH, width || 760))
      event.currentTarget.value = String(readableLineWidth)
      workspace.setSettings({ readableLineWidth })
    }}
  />
</Setting>
<Setting name="Vim key bindings" description="Edit notes with Vim's modes and commands.">
  <input
    type="checkbox"
    checked={settings.vimMode}
    onchange={(event) => workspace.setSettings({ vimMode: event.currentTarget.checked })}
  />
</Setting>
<SpellingLanguages />
<Setting
  name="Properties in notes"
  description="How frontmatter shows above a note; the Properties panel always edits it."
>
  <Choice
    value={settings.propertiesDisplay}
    options={[
      { value: 'visible', label: 'Visible' },
      { value: 'hidden', label: 'Hidden' },
      { value: 'source', label: 'Source' },
    ]}
    onchange={(propertiesDisplay) => workspace.setSettings({ propertiesDisplay })}
  />
</Setting>
<Setting
  name="Update links on rename"
  description="What to do with links pointing to a note or folder you rename or move."
>
  <Choice
    value={settings.linkUpdate}
    options={[
      { value: 'ask', label: 'Ask' },
      { value: 'always', label: 'Always' },
      { value: 'never', label: 'Never' },
    ]}
    onchange={(linkUpdate) => workspace.setSettings({ linkUpdate })}
  />
</Setting>
<Setting name="Attachment location" description="Where pasted or dropped images are saved.">
  <Choice
    value={settings.attachmentFolder}
    options={[
      { value: 'root', label: 'Vault root' },
      { value: 'same', label: 'Same folder as the note' },
      { value: 'attachments', label: '"attachments" folder' },
    ]}
    onchange={(attachmentFolder) => workspace.setSettings({ attachmentFolder })}
  />
</Setting>
