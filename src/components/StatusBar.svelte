<script lang="ts">
  import { documents } from '../lib/documents'
  import { editorStats, reportActive } from '../lib/editor/stats.svelte'
  import * as vault from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'

  let backlinks = $state(0)
  let isUnsaved = $state(false)
  const plural = (count: number, word: string) =>
    `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`

  $effect(() => {
    const path = workspace.notePath
    void workspace.indexVersion
    if (!path) return
    let isCurrent = true
    setTimeout(reportActive)
    void vault.backlinks(path).then((found) => {
      if (isCurrent) backlinks = new Set(found.map((link) => link.source)).size
    })
    return () => (isCurrent = false)
  })

  $effect(() => {
    const path = workspace.notePath
    const update = () => (isUnsaved = path !== null && documents.isUnsaved(path))
    update()
    return documents.saveStateChanged.on(update)
  })
</script>

<footer class="status-bar">
  {#if workspace.notePath}
    <button title="Show backlinks" onclick={() => workspace.showRightTab('backlinks')}>
      {plural(backlinks, 'backlink')}
    </button>
    <span title={editorStats.isSelection ? 'In the selection' : 'In the note'}>
      {plural(editorStats.words, 'word')} · {plural(editorStats.characters, 'character')}
    </span>
    <span class="save" class:unsaved={isUnsaved} title={isUnsaved ? 'Saving…' : 'Saved'}></span>
  {/if}
</footer>

<style>
  .status-bar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: flex-end;
    gap: 14px;
    height: 24px;
    padding: 0 12px;
    border-top: 1px solid var(--border);
    background: var(--background-secondary);
    color: var(--text-muted);
    font-size: 12px;
  }

  button {
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    color: var(--text);
  }

  .save {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-faint);
  }

  .save.unsaved {
    background: var(--accent);
  }
</style>
