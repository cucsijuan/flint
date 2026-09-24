<script lang="ts">
  import { EditorView } from '@codemirror/view'
  import { BookOpen, Code } from '@lucide/svelte'
  import { onMount } from 'svelte'
  import { createEditorState, replaceDoc, setMode } from '../lib/editor/editor'
  import { noteTitle } from '../lib/paths'
  import { workspace, type OpenNote } from '../lib/workspace.svelte'

  let { note }: { note: OpenNote } = $props()

  let container: HTMLDivElement
  let view: EditorView | undefined
  let shownRevision = -1

  const stateFor = (doc: string) =>
    createEditorState({
      doc,
      mode: workspace.mode,
      onChange: (contents) => workspace.edit(contents),
      onToggleMode: () => workspace.toggleMode(),
    })

  onMount(() => {
    view = new EditorView({ state: stateFor(note.contents), parent: container })
    shownRevision = note.revision
    view.focus()
    return () => view?.destroy()
  })

  $effect(() => {
    const { revision, isNewPath, contents } = note
    if (!view || revision === shownRevision) return
    shownRevision = revision
    if (isNewPath) {
      view.setState(stateFor(contents))
      view.focus()
    } else {
      replaceDoc(view, contents)
    }
  })

  $effect(() => {
    if (view) setMode(view, workspace.mode)
  })
</script>

<section class="note">
  <header>
    <h1>{noteTitle(note.path)}</h1>
    <button
      class="icon"
      title={workspace.mode === 'live' ? 'Source mode (Ctrl+E)' : 'Live preview (Ctrl+E)'}
      onclick={() => workspace.toggleMode()}
    >
      {#if workspace.mode === 'live'}<Code size={16} />{:else}<BookOpen size={16} />{/if}
    </button>
  </header>
  <div class="editor" bind:this={container}></div>
</section>

<style>
  .note {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
  }

  h1 {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .editor {
    flex: 1;
    min-height: 0;
  }
</style>
