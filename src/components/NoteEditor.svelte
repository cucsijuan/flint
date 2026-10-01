<script lang="ts">
  import { EditorView } from '@codemirror/view'
  import { onMount } from 'svelte'
  import { documents } from '../lib/documents'
  import { activeView, setActiveView } from '../lib/editor/active'
  import {
    createEditorState,
    scrollToBlock,
    scrollToHeading,
    scrollToLine,
    setMode,
    setPropertiesDisplay,
    setPluginExtensions,
    setSpellcheck,
    setVimMode,
  } from '../lib/editor/editor'
  import { restoreFolds } from '../lib/editor/folding'
  import { refreshLinks } from '../lib/editor/links'
  import { editorOptions } from '../lib/editor/options'
  import type { Tab } from '../lib/layout'
  import { pluginHost } from '../lib/plugins/host.svelte'
  import { processors } from '../lib/render/processors.svelte'
  import { workspace } from '../lib/workspace.svelte'
  import NoteHeader from './NoteHeader.svelte'

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
          state: createEditorState(
            editorOptions(path, doc, (changes, contents) => {
              if (editor) documents.edit(path, editor, changes, contents)
            }),
          ),
        })
        restoreFolds(editor, workspace.foldsFor(path))
        documents.attach(path, editor)
        view = editor
      })
      .catch((error: unknown) => workspace.notify(String(error)))
    return () => {
      isMounted = false
      if (!editor) return
      documents.detach(path, editor)
      if (activeView() === editor) setActiveView(null)
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
    if (view) setPropertiesDisplay(view, workspace.propertiesDisplay)
  })

  $effect(() => {
    if (view) setVimMode(view, workspace.settings.value.vimMode)
  })

  $effect(() => {
    if (view) setSpellcheck(view, workspace.settings.value.spellcheck)
  })

  $effect(() => {
    if (view) setPluginExtensions(view, pluginHost.editorExtensions)
  })

  $effect(() => {
    if (view && workspace.indexVersion) refreshLinks(view)
  })

  $effect(() => {
    if (view && processors.version) refreshLinks(view)
  })

  $effect(() => {
    const jump = workspace.jump
    if (!view || jump?.tabId !== tab.id) return
    if (jump.heading) scrollToHeading(view, jump.heading)
    else if (jump.block) scrollToBlock(view, jump.block)
    else if (jump.line) scrollToLine(view, jump.line)
    workspace.jump = null
  })
</script>

<section class="note">
  <NoteHeader {tab} {path} />
  <div class="editor" bind:this={container}></div>
</section>

<style>
  .note {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .editor {
    flex: 1;
    min-height: 0;
  }
</style>
