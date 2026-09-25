<script lang="ts">
  import { EditorView } from '@codemirror/view'
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
  import type { Tab } from '../lib/layout'
  import { pluginHost } from '../lib/plugins/host.svelte'
  import * as vault from '../lib/vault'
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
            preview: {
              source: path,
              resolve: (targets, source) => workspace.resolveLinks(targets, source),
              assetUrl: (asset) => workspace.assetUrl(asset),
              readNote: vault.readNote,
            },
            saveAttachment: (source) => workspace.saveAttachment(source, path),
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
