<script lang="ts">
  import { EditorView } from '@codemirror/view'
  import { BookOpen, Code, PanelRight } from '@lucide/svelte'
  import { onMount } from 'svelte'
  import {
    createEditorState,
    replaceDoc,
    scrollToHeading,
    scrollToLine,
    setMode,
    setPluginExtensions,
  } from '../lib/editor/editor'
  import { setActiveView } from '../lib/editor/active'
  import { pluginHost } from '../lib/plugins/host.svelte'
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
      resolveLinks: (targets) => workspace.resolveLinks(targets),
      navigation: {
        openLink: (destination) => void workspace.openLink(destination),
        openTag: (tag) => workspace.openSearch(`tag:#${tag}`),
      },
      completion: {
        targets: () => workspace.linkTargets,
        headings: (target) => workspace.headingsFor(target),
        tags: () => workspace.tags,
      },
      plugins: pluginHost.editorExtensions,
    })

  onMount(() => {
    view = new EditorView({ state: stateFor(note.contents), parent: container })
    setActiveView(view)
    shownRevision = note.revision
    view.focus()
    return () => {
      setActiveView(null)
      view?.destroy()
    }
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
    if (view) setPluginExtensions(view, pluginHost.editorExtensions)
  })

  $effect(() => {
    if (view && workspace.indexVersion) refreshLinks(view)
  })

  $effect(() => {
    const jump = workspace.jump
    if (!view || !jump) return
    if (jump.heading) scrollToHeading(view, jump.heading)
    else if (jump.line) scrollToLine(view, jump.line)
    workspace.jump = null
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
        class:on={workspace.showRightPanel}
        title="Toggle right sidebar"
        onclick={() => workspace.toggleRightPanel()}
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
