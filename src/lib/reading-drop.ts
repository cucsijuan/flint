import { documents } from './documents'
import type { AttachmentSource } from './editor/attachments'
import { insertBlockAfter } from './render/source'
import { workspace } from './workspace.svelte'

/** Saves files dropped on a reading view and embeds them after the block under the pointer.
 * False when `target` isn't in a reading view. */
export function dropOnReadingView(sources: AttachmentSource[], target: Element | null) {
  const article = target?.closest<HTMLElement>('[data-reading-note]')
  const path = article?.dataset.readingNote
  if (!article || !path || !sources.length) return false
  let block = target
  while (block && block.parentElement !== article) block = block.parentElement
  const lineEnd = block instanceof HTMLElement ? block.dataset.lineEnd : undefined
  void (async () => {
    const links: string[] = []
    for (const source of sources) {
      const link = await workspace.saveAttachment(source, path)
      if (link) links.push(`![[${link}]]`)
    }
    if (!links.length) return
    await documents.update(path, (text) =>
      insertBlockAfter(text, lineEnd === undefined ? null : Number(lineEnd), links.join('\n')),
    )
  })().catch((error: unknown) => workspace.notify(String(error)))
  return true
}
