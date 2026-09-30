<script lang="ts">
  import { documents } from '../../lib/documents'
  import { hydrate } from '../../lib/render/hydrate'
  import { renderMarkdown } from '../../lib/render/markdown'
  import * as vault from '../../lib/vault'
  import { workspace } from '../../lib/workspace.svelte'

  let {
    text,
    source,
    firstLine = 0,
    onedit,
  }: {
    text: string
    /** Where links resolve from. */
    source: string
    firstLine?: number
    /** Receives edits made through the rendered content (tasks, tables) to `text` itself. */
    onedit?: (text: string) => void
  } = $props()

  function render(element: HTMLElement) {
    void workspace.indexVersion
    let isCurrent = true
    const body = document.createElement('div')
    body.innerHTML = renderMarkdown(text, { firstLine })
    void hydrate(body, {
      source,
      // Cards count as embeds, so canvases inside them don't open another canvas.
      depth: 1,
      resolve: (targets, from) => workspace.resolveLinks(targets, from),
      assetUrl: (asset) => workspace.assetUrl(asset),
      readNote: vault.readNote,
      editNote: async (note, edit) => {
        if (note === source && onedit) onedit(edit(text) ?? text)
        else await documents.update(note, edit)
      },
    }).then(() => {
      if (isCurrent) element.replaceChildren(...body.childNodes)
    })
    return () => (isCurrent = false)
  }
</script>

<div class="markdown" {@attach render}></div>

<style>
  .markdown {
    font-size: 14px;
    line-height: 1.5;
  }

  .markdown :global(> :first-child) {
    margin-top: 0;
  }

  .markdown :global(> :last-child) {
    margin-bottom: 0;
  }
</style>
