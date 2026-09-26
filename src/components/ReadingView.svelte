<script lang="ts">
  import { openUrl } from '@tauri-apps/plugin-opener'
  import { onMount } from 'svelte'
  import { documents } from '../lib/documents'
  import { isExternalUrl } from '../lib/paths'
  import type { Tab } from '../lib/layout'
  import { hydrate, stripFrontmatter } from '../lib/render/hydrate'
  import { renderMarkdown } from '../lib/render/markdown'
  import * as vault from '../lib/vault'
  import { workspace } from '../lib/workspace.svelte'
  import NoteHeader from './NoteHeader.svelte'

  const HEADING = 'h1, h2, h3, h4, h5, h6'

  let { tab, path }: { tab: Tab; path: string } = $props()

  let content: HTMLElement | undefined
  let renderId = 0

  async function render(text: string) {
    const id = ++renderId
    const body = document.createElement('div')
    body.innerHTML = renderMarkdown(stripFrontmatter(text))
    await hydrate(body, {
      source: path,
      resolve: (targets, source) => workspace.resolveLinks(targets, source),
      assetUrl: (asset) => workspace.assetUrl(asset),
      readNote: vault.readNote,
    })
    if (id === renderId) content?.replaceChildren(...body.childNodes)
  }

  onMount(() => {
    void documents.load(path).then(render, (error: unknown) => workspace.notify(String(error)))
    return documents.subscribe(path, (text) => void render(text))
  })

  $effect(() => {
    if (workspace.indexVersion) void documents.load(path).then(render)
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
  <article class="markdown" {@attach attachContent}></article>
</section>

<style>
  .reading {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  article {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 24px max(32px, calc((100% - 760px) / 2)) 30vh;
  }
</style>
