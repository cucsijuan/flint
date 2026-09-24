<script lang="ts">
  import { EditorView } from '@codemirror/view'
  import { BookOpen, Code, PanelRight } from '@lucide/svelte'
  import { onMount } from 'svelte'
  import { createEditorState, replaceDoc, scrollToHeading, setMode } from '../lib/editor/editor'
  import { refreshLinks } from '../lib/editor/links'
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
      resolveLinks: (targets) => workspace.resolveLinks(targets),
      openLink: (destination) => void workspace.openLink(destination),
      completion: {
        targets: () => workspace.linkTargets,
        headings: (target) => workspace.headingsFor(target),
      },
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

  $effect(() => {
    if (view && workspace.indexVersion) refreshLinks(view)
  })

  $effect(() => {
    const jump = workspace.headingJump
    if (!view || !jump) return
    scrollToHeading(view, jump.heading)
    workspace.headingJump = null
  })
</script>

<section class="note">
  <header>
    <h1>{noteTitle(note.path)}</h1>
    <div class="actions">
      <button
        class="icon"
        title={workspace.mode === 'live' ? 'Source mode (Ctrl+E)' : 'Live preview (Ctrl+E)'}
        onclick={() => workspace.toggleMode()}
      >
        {#if workspace.mode === 'live'}<Code size={16} />{:else}<BookOpen size={16} />{/if}
      </button>
      <button
        class="icon"
        class:on={workspace.showBacklinks}
        title="Backlinks"
        onclick={() => workspace.toggleBacklinks()}
      >
        <PanelRight size={16} />
      </button>
    </div>
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

  .actions {
    display: flex;
    gap: 2px;
  }

  .on {
    color: var(--accent);
  }

  .editor {
    flex: 1;
    min-height: 0;
  }
</style>
