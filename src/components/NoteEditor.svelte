<script lang="ts">
  import { EditorView } from '@codemirror/view'
  import { ArrowLeft, ArrowRight, BookOpen, Code, PanelRight } from '@lucide/svelte'
  import { onMount } from 'svelte'
  import { commands } from '../lib/commands.svelte'
  import { documents } from '../lib/documents'
  import { setActiveView } from '../lib/editor/active'
  import {
    createEditorState,
    scrollToHeading,
    scrollToLine,
    setMode,
    setPluginExtensions,
  } from '../lib/editor/editor'
  import { refreshLinks } from '../lib/editor/links'
  import { goBack, goForward, type Tab } from '../lib/layout'
  import { noteTitle } from '../lib/paths'
  import { pluginHost } from '../lib/plugins/host.svelte'
  import { workspace } from '../lib/workspace.svelte'

  let { tab, path, isActive }: { tab: Tab; path: string; isActive: boolean } = $props()

  let container: HTMLDivElement
  let view = $state.raw<EditorView>()

  onMount(() => {
    let isMounted = true
    let editor: EditorView | undefined
    void documents
      .load(path)
      .then((doc) => {
        if (!isMounted) return
        editor = new EditorView({
          parent: container,
          state: createEditorState({
            doc,
            mode: workspace.mode,
            onChange: (changes, contents) =>
              editor && documents.edit(path, editor, changes, contents),
            onKeydown: (event) => commands.handleKeydown(event),
            resolveLinks: (targets) => workspace.resolveLinks(targets, path),
            navigation: {
              openLink: (destination, options) =>
                void workspace.openLink(destination, path, options),
              openTag: (tag) => workspace.openSearch(`tag:#${tag}`),
            },
            completion: {
              targets: () => workspace.linkTargets,
              headings: (target) => workspace.headingsFor(target, path),
              tags: () => workspace.tags,
            },
            plugins: pluginHost.editorExtensions,
          }),
        })
        documents.attach(path, editor)
        view = editor
      })
      .catch((error: unknown) => workspace.notify(String(error)))
    return () => {
      isMounted = false
      if (!editor) return
      documents.detach(path, editor)
      if (isActive) setActiveView(null)
      editor.destroy()
    }
  })

  $effect(() => {
    if (!view || !isActive) return
    setActiveView(view)
    view.requestMeasure()
    view.focus()
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
    if (!view || jump?.tabId !== tab.id) return
    if (jump.heading) scrollToHeading(view, jump.heading)
    else if (jump.line) scrollToLine(view, jump.line)
    workspace.jump = null
  })
</script>

<section class="note">
  <header>
    <div class="actions">
      <button
        class="icon"
        title="Go back (Alt+←)"
        disabled={tab.back.length === 0}
        onclick={() => workspace.updateLayout(goBack)}
      >
        <ArrowLeft size={16} />
      </button>
      <button
        class="icon"
        title="Go forward (Alt+→)"
        disabled={tab.forward.length === 0}
        onclick={() => workspace.updateLayout(goForward)}
      >
        <ArrowRight size={16} />
      </button>
    </div>
    <h1>{noteTitle(path)}</h1>
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
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
  }

  h1 {
    flex: 1;
    margin: 0;
    overflow: hidden;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    gap: 2px;
  }

  .icon:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .on {
    color: var(--accent);
  }

  .editor {
    flex: 1;
    min-height: 0;
  }
</style>
