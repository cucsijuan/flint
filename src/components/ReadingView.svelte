<script lang="ts">
  import { openUrl } from '@tauri-apps/plugin-opener'
  import { onMount } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { documents } from '../lib/documents'
  import { frontmatterOf, type Property, readProperties } from '../lib/properties'
  import { isExternalUrl } from '../lib/paths'
  import type { Tab } from '../lib/layout'
  import { hydrate } from '../lib/render/hydrate'
  import { renderMarkdown } from '../lib/render/markdown'
  import { processors } from '../lib/render/processors.svelte'
  import { noteContent } from '../lib/render/source'
  import * as vault from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'
  import NoteHeader from './NoteHeader.svelte'
  import PropertiesEditor from './PropertiesEditor.svelte'

  const HEADING = 'h1, h2, h3, h4, h5, h6'
  const HEADING_TAGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']

  let { tab, path }: { tab: Tab; path: string } = $props()

  let content: HTMLElement | undefined
  let renderId = 0
  let properties = $state<Property[] | null>(null)
  let frontmatter = $state<string | null>(null)
  const foldedLines = new SvelteSet<string>()

  async function render(text: string) {
    const id = ++renderId
    const body = document.createElement('div')
    properties = readProperties(text)
    frontmatter = frontmatterOf(text)
    const note = noteContent(text)
    body.innerHTML = renderMarkdown(note.text, { firstLine: note.firstLine })
    await hydrate(body, {
      source: path,
      resolve: (targets, source) => workspace.resolveLinks(targets, source),
      assetUrl: (asset) => workspace.assetUrl(asset),
      readNote: vault.readNote,
      editNote: (note, edit) => documents.update(note, edit),
    })
    if (id !== renderId || !content) return
    content.replaceChildren(...body.childNodes)
    addFoldToggles(content)
    applyFolding(content)
  }

  function addFoldToggles(root: HTMLElement) {
    for (const heading of root.querySelectorAll<HTMLElement>(`:scope > :is(${HEADING})`)) {
      const toggle = Object.assign(document.createElement('button'), {
        type: 'button',
        className: 'fold-toggle',
        title: 'Fold',
      })
      toggle.addEventListener('click', () => {
        const line = heading.dataset.line ?? ''
        if (!foldedLines.delete(line)) foldedLines.add(line)
        applyFolding(root)
      })
      heading.prepend(toggle)
    }
  }

  /** Hides everything under a folded heading until the next heading of the same or a higher level. */
  function applyFolding(root: HTMLElement) {
    let foldedLevel = Infinity
    for (const child of root.children as HTMLCollectionOf<HTMLElement>) {
      const level = HEADING_TAGS.indexOf(child.tagName) + 1
      if (level && level <= foldedLevel) foldedLevel = Infinity
      child.hidden = foldedLevel !== Infinity
      const isFolded = level > 0 && foldedLines.has(child.dataset.line ?? '')
      child.classList.toggle('folded', isFolded)
      if (isFolded && !child.hidden) foldedLevel = level
    }
  }

  onMount(() => {
    void documents.load(path).then(render, (error: unknown) => workspace.notify(String(error)))
    return documents.subscribe(path, (text) => void render(text))
  })

  $effect(() => {
    if (workspace.indexVersion + processors.version) void documents.load(path).then(render)
  })

  $effect(() => {
    const jump = workspace.jump
    if (jump?.tabId !== tab.id || !jump.heading) return
    const wanted = jump.heading.trim().toLowerCase()
    const heading = [...(content?.querySelectorAll(HEADING) ?? [])].find(
      (element) => element.textContent?.trim().toLowerCase() === wanted,
    )
    heading?.scrollIntoView({ block: 'start' })
    workspace.jump = null
  })

  function attachContent(element: HTMLElement) {
    content = element
    const onAuxClick = (event: MouseEvent) => event.button === 1 && onClick(event)
    element.addEventListener('click', onClick)
    element.addEventListener('auxclick', onAuxClick)
    return () => {
      element.removeEventListener('click', onClick)
      element.removeEventListener('auxclick', onAuxClick)
    }
  }

  function onClick(event: MouseEvent) {
    const anchor = (event.target as HTMLElement).closest('a')
    if (!anchor) return
    event.preventDefault()
    const newTab = event.ctrlKey || event.metaKey || event.button === 1
    const { link, tag } = anchor.dataset
    const href = anchor.getAttribute('href') ?? ''
    if (link !== undefined) void workspace.openLink(link, path, { newTab })
    else if (tag !== undefined) workspace.openSearch(`tag:#${tag}`)
    else if (isExternalUrl(href)) void openUrl(href)
  }
</script>

<section class="reading">
  <NoteHeader {tab} {path} />
  <div class="scroll">
    {#if workspace.propertiesDisplay === 'source' && frontmatter !== null}
      <pre class="frontmatter">{frontmatter}</pre>
    {:else if workspace.propertiesDisplay === 'visible' && properties}
      <PropertiesEditor {properties} edit={(change) => void documents.update(path, change)} />
    {/if}
    <article class="markdown" {@attach attachContent}></article>
  </div>
</section>

<style>
  .reading {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .frontmatter {
    margin: 0 0 16px;
    padding: 12px 16px;
    border-radius: 6px;
    background: var(--code-background);
    font-family: var(--font-mono);
    font-size: 0.85em;
    white-space: pre-wrap;
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 24px max(32px, calc((100% - 760px) / 2)) 30vh;
  }
</style>
