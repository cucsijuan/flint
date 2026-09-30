import { baseData } from '../bases/data.svelte'
import { documents } from '../documents'
import { noteTitle } from '../paths'
import { hydrate } from '../render/hydrate'
import { renderMarkdown } from '../render/markdown'
import { noteContent } from '../render/source'
import * as vault from '../vault'
import { workspace } from '../workspace.svelte'

/** A note rendered like the reading view, with its math, diagrams and embeds ready. */
export async function renderNote(
  path: string,
  {
    includeTitle = true,
    assetUrl = (asset: string) => workspace.assetUrl(asset),
  }: { includeTitle?: boolean; assetUrl?: (asset: string) => string } = {},
) {
  await baseData.load(workspace.indexVersion)
  const { text, firstLine } = noteContent(await documents.load(path))
  const article = document.createElement('article')
  article.className = 'markdown export'
  const body = document.createElement('div')
  body.innerHTML = renderMarkdown(text, { firstLine })
  const title = noteTitle(path)
  const opening = body.firstElementChild
  // Many notes already open with their name as a heading; don't print it twice.
  const hasTitle =
    opening?.tagName === 'H1' && opening.textContent?.trim().toLowerCase() === title.toLowerCase()
  if (includeTitle && !hasTitle) {
    article.append(Object.assign(document.createElement('h1'), { textContent: title }))
  }
  article.append(...body.childNodes)
  await hydrate(article, {
    source: path,
    resolve: (targets, source) => workspace.resolveLinks(targets, source),
    assetUrl,
    readNote: vault.readNote,
    editNote: (note, edit) => documents.update(note, edit),
  })
  return article
}

/** Resolves once every image in `element` has loaded or failed. */
export async function imagesLoaded(element: HTMLElement) {
  await Promise.all(
    [...element.querySelectorAll('img')].map((image) =>
      image.complete ? undefined : image.decode().catch(() => undefined),
    ),
  )
}
