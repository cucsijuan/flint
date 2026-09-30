import { isWithin, NOTE_EXTENSION, noteTitle, parentOf, relativePath } from '../paths'
import * as vault from '../vault'
import { workspace } from '../workspace.svelte'
import { renderNote } from './render'

const PAGE_STYLE = `
html, body { height: auto; overflow: auto; margin: 0; }
body { background: var(--background); color: var(--text); }
main.markdown { max-width: 760px; margin: 0 auto; padding: 40px 24px 80px; }
.index li { margin: 4px 0; }
`

/** Every rule of the app's stylesheets, so exported pages look like the reading view. */
function collectCss() {
  return [...document.styleSheets]
    .flatMap((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText)
      } catch {
        return []
      }
    })
    .join('\n')
}

const escape = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char,
  )

function page(title: string, head: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
${head}
</head>
<body>
<main class="markdown export">
${body}
</main>
</body>
</html>
`
}

/** Drops what only makes sense inside Flint: buttons, toolbars, fold toggles. */
function makeStatic(article: HTMLElement) {
  for (const element of article.querySelectorAll(
    '.copy-code, .fold-toggle, .base .toolbar, script',
  )) {
    element.remove()
  }
}

function unlink(anchor: HTMLElement) {
  const span = document.createElement('span')
  span.className = anchor.className
  span.append(...anchor.childNodes)
  anchor.replaceWith(span)
}

async function asDataUrl(url: string) {
  const blob = await (await fetch(url)).blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error(`Couldn't read ${url}`))
    reader.readAsDataURL(blob)
  })
}

const folderOf = (target: string) =>
  target.slice(0, Math.max(target.lastIndexOf('/'), target.lastIndexOf('\\')))
const nameOf = (target: string) =>
  target.slice(Math.max(target.lastIndexOf('/'), target.lastIndexOf('\\')) + 1)

/** The current note as one self-contained HTML file. */
export async function exportNoteHtml(path: string, target: string) {
  const article = await renderNote(path)
  makeStatic(article)
  for (const anchor of article.querySelectorAll<HTMLElement>('a.internal-link, a.tag'))
    unlink(anchor)
  await Promise.all(
    [...article.querySelectorAll('img')].map(async (image) => {
      const source = image.getAttribute('src')
      if (source && !/^data:|^https?:\/\/(?!asset\.localhost)/.test(source)) {
        image.src = await asDataUrl(image.src).catch(() => image.src)
      }
    }),
  )
  const html = page(
    noteTitle(path),
    `<style>${collectCss()}\n${PAGE_STYLE}</style>`,
    article.innerHTML,
  )
  await vault.exportFiles(folderOf(target), [{ path: nameOf(target), contents: html }], [])
}

const pageOf = (path: string, root: string) =>
  (root ? path.slice(root.length + 1) : path).slice(0, -NOTE_EXTENSION.length) + '.html'

/** Every note in `root` (the whole vault when empty) as linked pages, with an index. */
export async function exportSite(
  root: string,
  target: string,
  onProgress: (done: number, total: number) => void,
) {
  const notes = workspace.entries
    .filter((entry) => entry.kind === 'file' && isWithin(entry.path, root || entry.path))
    .map((entry) => entry.path)
    .sort()
  const exported = new Set(notes)
  const files: vault.ExportFile[] = []
  const attachments = new Map<string, string>()

  for (const [index, note] of notes.entries()) {
    const pagePath = pageOf(note, root)
    const pageFolder = parentOf(pagePath)
    const assets = new Map<string, string>()
    const article = await renderNote(note, {
      assetUrl: (asset) => {
        const url = workspace.assetUrl(asset)
        assets.set(url, asset)
        return url
      },
    })
    makeStatic(article)
    const links = [...article.querySelectorAll<HTMLAnchorElement>('a.internal-link[data-link]')]
    const targets = links.map((link) => (link.dataset.link ?? '').split('#')[0])
    const resolved = targets.length ? await workspace.resolveLinks(targets, note) : []
    links.forEach((link, linkIndex) => {
      const found = resolved[linkIndex] ?? (targets[linkIndex] ? null : note)
      if (found && exported.has(found)) link.href = relativePath(pageFolder, pageOf(found, root))
      else unlink(link)
    })
    for (const anchor of article.querySelectorAll<HTMLElement>('a.tag')) unlink(anchor)
    for (const image of article.querySelectorAll('img')) {
      const asset = assets.get(image.getAttribute('src') ?? '')
      if (!asset) continue
      const assetPath = `assets/${asset}`
      attachments.set(asset, assetPath)
      image.setAttribute('src', relativePath(pageFolder, assetPath))
    }
    const stylesheet = `<link rel="stylesheet" href="${relativePath(pageFolder, 'style.css')}">`
    files.push({ path: pagePath, contents: page(noteTitle(note), stylesheet, article.innerHTML) })
    onProgress(index + 1, notes.length)
  }

  const title = root ? noteTitle(root) : (workspace.info?.name ?? 'Notes')
  const list = notes
    .map(
      (note) =>
        `<li><a href="${escape(pageOf(note, root))}">${escape(pageOf(note, root).slice(0, -'.html'.length))}</a></li>`,
    )
    .join('\n')
  files.push({
    path: 'index.html',
    contents: page(
      title,
      '<link rel="stylesheet" href="style.css">',
      `<h1>${escape(title)}</h1>\n<ul class="index">\n${list}\n</ul>`,
    ),
  })
  files.push({ path: 'style.css', contents: `${collectCss()}\n${PAGE_STYLE}` })
  await vault.exportFiles(
    target,
    files,
    [...attachments].map(([source, path]) => ({ source, path })),
  )
  return notes.length
}
