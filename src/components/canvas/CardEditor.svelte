<script lang="ts">
  import { EditorView } from '@codemirror/view'
  import { onMount } from 'svelte'
  import { documents } from '../../lib/documents'
  import { activeView, setActiveView } from '../../lib/editor/active'
  import { createEditorState } from '../../lib/editor/editor'
  import { editorOptions } from '../../lib/editor/options'
  import { workspace } from '../../lib/workspace.svelte'

  let {
    source,
    text = '',
    note,
    onchange,
  }: {
    /** Where links resolve from. */
    source: string
    text?: string
    /** Edits this note, in sync with every other editor showing it, instead of `text`. */
    note?: string
    onchange?: (text: string) => void
  } = $props()

  let container: HTMLDivElement

  onMount(() => {
    let isMounted = true
    let editor: EditorView | undefined
    const doc = note ? documents.load(note) : Promise.resolve(text)
    doc
      .then((contents) => {
        if (!isMounted) return
        editor = new EditorView({
          parent: container,
          state: createEditorState(
            editorOptions(source, contents, (changes, next) => {
              if (note && editor) documents.edit(note, editor, changes, next)
              else onchange?.(next)
            }),
          ),
        })
        if (note) documents.attach(note, editor)
        setActiveView(editor)
        editor.focus()
      })
      .catch((error: unknown) => workspace.notify(String(error)))
    return () => {
      isMounted = false
      if (!editor) return
      if (note) documents.detach(note, editor)
      if (activeView() === editor) setActiveView(null)
      editor.destroy()
    }
  })
</script>

<div class="card-editor nodrag nowheel nopan nokey" bind:this={container}></div>

<style>
  .card-editor {
    height: 100%;
    cursor: text;
  }

  .card-editor :global(.cm-editor) {
    height: 100%;
  }

  .card-editor :global(.cm-content) {
    padding: 0;
  }
</style>
