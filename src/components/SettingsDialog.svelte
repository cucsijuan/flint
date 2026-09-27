<script lang="ts">
  import { Dialog } from 'bits-ui'
  import type { AttachmentFolder, EditorMode, LinkUpdate, PropertiesDisplay } from '../lib/settings'
  import { dayjs } from '../lib/dates'
  import { NOTE_EXTENSION } from '../lib/paths'
  import { workspace } from '../lib/workspace.svelte'
  import PluginSettings from './PluginSettings.svelte'

  const editorModeOptions: { value: EditorMode; label: string }[] = [
    { value: 'live', label: 'Live preview' },
    { value: 'source', label: 'Source mode' },
  ]

  const propertiesDisplayOptions: { value: PropertiesDisplay; label: string }[] = [
    { value: 'visible', label: 'Visible' },
    { value: 'hidden', label: 'Hidden' },
    { value: 'source', label: 'Source' },
  ]

  const attachmentFolderOptions: { value: AttachmentFolder; label: string }[] = [
    { value: 'root', label: 'Vault root' },
    { value: 'same', label: 'Same folder as the note' },
    { value: 'attachments', label: '"attachments" folder' },
  ]

  const linkUpdateOptions: { value: LinkUpdate; label: string }[] = [
    { value: 'ask', label: 'Ask' },
    { value: 'always', label: 'Always' },
    { value: 'never', label: 'Never' },
  ]
</script>

<Dialog.Root bind:open={workspace.isSettingsOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="overlay" />
    <Dialog.Content class="dialog">
      <Dialog.Title class="dialog-title">Settings</Dialog.Title>
      <label class="setting">
        <span>
          <strong>Editing mode</strong>
          <small
            >Live preview hides Markdown syntax outside the cursor; source mode shows it all.</small
          >
        </span>
        <select
          value={workspace.mode}
          onchange={(event) => workspace.setMode(event.currentTarget.value as EditorMode)}
        >
          {#each editorModeOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <label class="setting">
        <span>
          <strong>Properties in notes</strong>
          <small>How frontmatter shows above a note; the Properties panel always edits it.</small>
        </span>
        <select
          value={workspace.propertiesDisplay}
          onchange={(event) =>
            workspace.setPropertiesDisplay(event.currentTarget.value as PropertiesDisplay)}
        >
          {#each propertiesDisplayOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <label class="setting">
        <span>
          <strong>Update links on rename</strong>
          <small>What to do with links pointing to a note or folder you rename or move.</small>
        </span>
        <select
          value={workspace.linkUpdate}
          onchange={(event) => workspace.setLinkUpdate(event.currentTarget.value as LinkUpdate)}
        >
          {#each linkUpdateOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <label class="setting">
        <span>
          <strong>Attachment location</strong>
          <small>Where pasted or dropped images are saved.</small>
        </span>
        <select
          value={workspace.attachmentFolder}
          onchange={(event) =>
            workspace.setAttachmentFolder(event.currentTarget.value as AttachmentFolder)}
        >
          {#each attachmentFolderOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <label class="setting">
        <span>
          <strong>Check for updates</strong>
          <small>Look for a new version of Flint when it starts.</small>
        </span>
        <input
          type="checkbox"
          checked={workspace.checkForUpdates}
          onchange={(event) => workspace.setCheckForUpdates(event.currentTarget.checked)}
        />
      </label>
      {#if workspace.info}
        <h3>Daily notes</h3>
        <label class="setting">
          <span>
            <strong>Folder</strong>
            <small>Where new daily notes go. Empty means the vault root.</small>
          </span>
          <input
            value={workspace.dailyNotes.folder}
            placeholder="Vault root"
            onchange={(event) =>
              workspace.setDailyNotes({ folder: event.currentTarget.value.trim() })}
          />
        </label>
        <label class="setting">
          <span>
            <strong>Date format</strong>
            <small>Today: {dayjs().format(workspace.dailyNotes.format || 'YYYY-MM-DD')}</small>
          </span>
          <input
            value={workspace.dailyNotes.format}
            placeholder="YYYY-MM-DD"
            oninput={(event) =>
              workspace.setDailyNotes({ format: event.currentTarget.value.trim() })}
          />
        </label>
        <label class="setting">
          <span>
            <strong>Template</strong>
            <small>A note whose contents start every new daily note.</small>
          </span>
          <input
            value={workspace.dailyNotes.template}
            placeholder="Templates/Daily"
            list="template-notes"
            onchange={(event) =>
              workspace.setDailyNotes({ template: event.currentTarget.value.trim() })}
          />
        </label>
        <h3>Templates</h3>
        <label class="setting">
          <span>
            <strong>Folder</strong>
            <small>
              Notes here can be inserted with "Insert template". Use {'{{title}}'}, {'{{date}}'},
              {'{{time}}'} or {'{{date:YYYY-MM-DD}}'}.
            </small>
          </span>
          <input
            value={workspace.templates.folder}
            placeholder="Templates"
            onchange={(event) =>
              workspace.setTemplates({ folder: event.currentTarget.value.trim() })}
          />
        </label>
        <datalist id="template-notes">
          {#each workspace.templateNotes as entry (entry.path)}
            <option value={entry.path.slice(0, -NOTE_EXTENSION.length)}></option>
          {/each}
        </datalist>
        <PluginSettings />
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.overlay) {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgb(0 0 0 / 0.4);
  }

  :global(.dialog) {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 50;
    width: min(560px, calc(100vw - 32px));
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--background);
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    transform: translate(-50%, -50%);
    box-shadow: 0 8px 32px rgb(0 0 0 / 0.3);
  }

  h3 {
    margin: 24px 0 12px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }

  :global(.dialog-title) {
    margin: 0 0 16px;
    font-size: 18px;
  }

  .setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .setting + .setting {
    margin-top: 16px;
  }

  .setting input[type='checkbox'] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
  }

  .setting span {
    display: grid;
    gap: 4px;
  }

  small {
    color: var(--text-muted);
  }

  select,
  .setting input:not([type='checkbox']) {
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text);
    font: inherit;
  }
</style>
