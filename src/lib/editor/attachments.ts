import { Facet } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { basename, isImage } from '../paths'
import * as vault from '../vault'

export interface AttachmentSource {
  name: string
  write: (path: string) => Promise<boolean>
}

export type SaveAttachment = (source: AttachmentSource) => Promise<string | null>

const fromFile = (file: File): AttachmentSource => ({
  name: file.name || `image.${file.type.split('/')[1] ?? 'png'}`,
  write: async (path) => {
    await vault.saveAttachment(path, new Uint8Array(await file.arrayBuffer()))
    return true
  },
})

const fromDisk = (source: string): AttachmentSource => ({
  name: basename(source),
  write: async (path) => {
    await vault.importAttachment(source, path)
    return true
  },
})

const fromClipboard: AttachmentSource = {
  name: 'image.png',
  write: (path) => vault.saveClipboardImage(path),
}

function imageSources(data: DataTransfer | null): AttachmentSource[] {
  return [...(data?.files ?? [])]
    .filter((file) => file.type.startsWith('image/') || isImage(file.name))
    .map(fromFile)
}

const mayHoldAttachment = (types: readonly string[]) =>
  types.includes('text/uri-list') ||
  !types.includes('text/plain') ||
  types.some((type) => type.startsWith('image/'))

async function insertAttachments(
  view: EditorView,
  sources: AttachmentSource[],
  position: number,
  save: SaveAttachment,
) {
  const links: string[] = []
  for (const source of sources) {
    const target = await save(source)
    if (target) links.push(`![[${target}]]`)
  }
  if (!links.length) return false
  const insert = links.join('\n')
  view.dispatch({
    changes: { from: position, insert },
    selection: { anchor: position + insert.length },
  })
  return true
}

async function pasteFromSystemClipboard(view: EditorView, text: string, save: SaveAttachment) {
  const paths = (await vault.clipboardFiles()).filter(isImage)
  const sources = paths.length ? paths.map(fromDisk) : [fromClipboard]
  const position = view.state.selection.main.head
  if (!(await insertAttachments(view, sources, position, save)) && text) {
    view.dispatch(view.state.replaceSelection(text))
  }
}

const attachmentSaver = Facet.define<SaveAttachment, SaveAttachment | null>({
  combine: (values) => values[0] ?? null,
})

export function dropFiles(paths: string[], x: number, y: number) {
  const editor = document.elementFromPoint(x, y)?.closest<HTMLElement>('.cm-editor')
  const view = editor && EditorView.findFromDOM(editor)
  const save = view?.state.facet(attachmentSaver)
  const sources = paths.filter(isImage).map(fromDisk)
  if (!view || !save || !sources.length) return
  const position = view.posAtCoords({ x, y }) ?? view.state.selection.main.head
  void insertAttachments(view, sources, position, save)
}

export const attachmentInput = (save: SaveAttachment) => [
  attachmentSaver.of(save),
  EditorView.domEventHandlers({
    paste(event, view) {
      const data = event.clipboardData
      if (!data) return false
      const sources = imageSources(data)
      if (sources.length) {
        event.preventDefault()
        void insertAttachments(view, sources, view.state.selection.main.head, save)
        return true
      }
      if (!mayHoldAttachment(data.types)) return false
      event.preventDefault()
      void pasteFromSystemClipboard(view, data.getData('text/plain'), save)
      return true
    },
    drop(event, view) {
      const sources = imageSources(event.dataTransfer)
      if (!sources.length) return false
      event.preventDefault()
      const position = view.posAtCoords(event) ?? view.state.selection.main.head
      void insertAttachments(view, sources, position, save)
      return true
    },
  }),
]
