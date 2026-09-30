<script lang="ts">
  import { save } from '@tauri-apps/plugin-dialog'
  import { Dialog } from 'bits-ui'
  import { exportPdf } from '../lib/export/pdf'
  import { PAGE_SIZES, type PdfSettings } from '../lib/export/pdf-settings'
  import { noteTitle } from '../lib/paths'
  import { workspace } from '../lib/workspace.svelte'

  const MARGINS: { value: number; label: string }[] = [
    { value: 0, label: 'None' },
    { value: 10, label: 'Narrow' },
    { value: 20, label: 'Default' },
    { value: 30, label: 'Wide' },
  ]

  let settings = $state<PdfSettings>({ ...workspace.settings.value.pdfExport })
  let isExporting = $state(false)
  const path = $derived(workspace.pdfNote)

  $effect(() => {
    if (path) settings = { ...workspace.settings.value.pdfExport }
  })

  async function run() {
    if (!path) return
    const target = await save({
      title: 'Export to PDF',
      defaultPath: `${noteTitle(path)}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (!target) return
    isExporting = true
    workspace.setSettings({ pdfExport: { ...settings } })
    try {
      await exportPdf(path, target, settings)
      workspace.pdfNote = null
      workspace.notify(`Exported to ${target}`)
    } catch (error) {
      workspace.notify(String(error))
    } finally {
      isExporting = false
    }
  }
</script>

<Dialog.Root
  open={path !== null}
  onOpenChange={(open) => {
    if (!open) workspace.pdfNote = null
  }}
>
  <Dialog.Portal>
    <Dialog.Overlay class="overlay" />
    <Dialog.Content class="dialog">
      <Dialog.Title class="dialog-title">Export to PDF</Dialog.Title>
      <div class="fields">
        <label>
          Page size
          <select bind:value={settings.pageSize}>
            {#each Object.keys(PAGE_SIZES) as size (size)}<option value={size}>{size}</option
              >{/each}
          </select>
        </label>
        <label>
          Orientation
          <select bind:value={settings.landscape}>
            <option value={false}>Portrait</option>
            <option value={true}>Landscape</option>
          </select>
        </label>
        <label>
          Margins
          <select bind:value={settings.margin}>
            {#each MARGINS as margin (margin.value)}
              <option value={margin.value}>{margin.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Scale · {settings.scale}%
          <input type="range" min="50" max="200" step="5" bind:value={settings.scale} />
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={settings.includeTitle} />
          Include the note's name as a title
        </label>
      </div>
      <div class="actions">
        <button onclick={() => (workspace.pdfNote = null)}>Cancel</button>
        <button class="primary" disabled={isExporting} onclick={() => void run()}>
          {isExporting ? 'Exporting…' : 'Export'}
        </button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  .fields {
    display: grid;
    gap: 12px;
  }

  label {
    display: grid;
    gap: 4px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text);
  }

  select {
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text);
    font: inherit;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }

  .actions button {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .actions .primary {
    border-color: var(--accent);
    background: var(--accent);
    color: white;
  }

  .actions button:disabled {
    cursor: default;
    opacity: 0.6;
  }
</style>
