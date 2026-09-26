import {
  basename,
  extensionOf,
  isExternalUrl,
  isImage,
  linkTargetOfUrl,
  NOTE_EXTENSION,
  noteTitle,
} from '../paths'
import { highlightBlock } from './highlight'
import { renderMarkdown } from './markdown'

const MAX_EMBED_DEPTH = 3
const AUDIO = new Set(['mp3', 'wav', 'ogg', 'm4a'])
const VIDEO = new Set(['mp4', 'webm', 'mov'])
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/
const HEADING_LINE = /^(#{1,6})\s+(.*?)\s*#*\s*$/

export interface HydrateContext {
  source: string
  resolve: (targets: string[], source: string) => Promise<(string | null)[]>
  assetUrl: (path: string) => string
  readNote: (path: string) => Promise<string>
  depth?: number
}

export const stripFrontmatter = (text: string) => text.replace(FRONTMATTER, '')

export function extractSection(text: string, heading: string) {
  const lines = text.split('\n')
  const wanted = heading.trim().toLowerCase()
  const start = lines.findIndex((line) => HEADING_LINE.exec(line)?.[2].toLowerCase() === wanted)
  if (start === -1) return ''
  const level = HEADING_LINE.exec(lines[start])?.[1].length ?? 1
  const end = lines.findIndex(
    (line, index) => index > start && (HEADING_LINE.exec(line)?.[1].length ?? 7) <= level,
  )
  return lines.slice(start, end === -1 ? undefined : end).join('\n')
}

const splitDestination = (destination: string) => {
  const hash = destination.indexOf('#')
  return hash === -1
    ? { target: destination, subpath: '' }
    : { target: destination.slice(0, hash), subpath: destination.slice(hash + 1) }
}

function mediaElement(path: string, url: string, embed: HTMLElement) {
  const size = embed.title
  const extension = extensionOf(path)
  if (isImage(path)) {
    const image = Object.assign(document.createElement('img'), { src: url, alt: basename(path) })
    if (/^\d+$/.test(size)) image.width = Number(size)
    return image
  }
  if (AUDIO.has(extension) || VIDEO.has(extension)) {
    const media = document.createElement(AUDIO.has(extension) ? 'audio' : 'video')
    Object.assign(media, { src: url, controls: true })
    return media
  }
  const link = Object.assign(document.createElement('a'), {
    className: 'internal-link',
    href: '#',
    textContent: basename(path),
  })
  link.dataset.link = embed.dataset.embed ?? path
  return link
}

async function embedNote(
  element: HTMLElement,
  path: string,
  subpath: string,
  context: HydrateContext,
) {
  const depth = context.depth ?? 0
  const title = Object.assign(document.createElement('a'), {
    className: 'internal-link embed-title',
    href: '#',
    textContent: subpath ? `${noteTitle(path)} › ${subpath}` : noteTitle(path),
  })
  title.dataset.link = element.dataset.embed ?? ''
  if (depth >= MAX_EMBED_DEPTH) {
    element.replaceChildren(title)
    return
  }
  const text = stripFrontmatter(await context.readNote(path))
  const body = document.createElement('div')
  body.className = 'embed-body'
  body.innerHTML = renderMarkdown(subpath ? extractSection(text, subpath) : text)
  element.replaceChildren(title, body)
  element.classList.add('note-embed')
  await hydrate(body, { ...context, source: path, depth: depth + 1 })
}

export async function hydrate(root: HTMLElement, context: HydrateContext) {
  const links = [...root.querySelectorAll<HTMLElement>('a.internal-link[data-link]')]
  const embeds = [...root.querySelectorAll<HTMLElement>('.internal-embed[data-embed]')]
  const images = [...root.querySelectorAll<HTMLImageElement>('img[src]')].filter(
    (image) => !isExternalUrl(image.getAttribute('src') ?? ''),
  )

  const targetOf = (element: HTMLElement) =>
    splitDestination(element.dataset.link ?? element.dataset.embed ?? '').target
  const imageTarget = (image: HTMLImageElement) => linkTargetOfUrl(image.getAttribute('src') ?? '')
  const targets = [
    ...new Set([...links, ...embeds].map(targetOf).concat(images.map(imageTarget)).filter(Boolean)),
  ]
  const paths = await context.resolve(targets, context.source)
  const resolved = new Map(targets.map((target, index) => [target, paths[index]]))

  for (const link of links) {
    const target = targetOf(link)
    if (target && !resolved.get(target)) link.classList.add('unresolved')
  }
  for (const image of images) {
    const path = resolved.get(imageTarget(image))
    if (path) image.src = context.assetUrl(path)
  }
  await Promise.all(
    embeds.map(async (embed) => {
      const { target, subpath } = splitDestination(embed.dataset.embed ?? '')
      const path = target ? resolved.get(target) : context.source
      if (!path) {
        embed.textContent = embed.dataset.embed ?? ''
        embed.classList.add('missing')
      } else if (path.toLowerCase().endsWith(NOTE_EXTENSION)) {
        await embedNote(embed, path, subpath, context)
      } else {
        embed.replaceChildren(mediaElement(path, context.assetUrl(path), embed))
      }
    }),
  )
  await Promise.all([...root.querySelectorAll<HTMLElement>('pre > code')].map(highlightBlock))
}
