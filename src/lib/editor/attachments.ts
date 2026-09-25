import { EditorView } from '@codemirror/view'

export type SaveAttachment = (file: File) => Promise<string>

const imagesIn = (data: DataTransfer | null) =>
  [...(data?.files ?? [])].filter((file) => file.type.startsWith('image/'))

async function insertAttachments(
  view: EditorView,
  files: File[],
  position: number,
  save: SaveAttachment,
) {
  const links = await Promise.all(files.map(async (file) => `![[${await save(file)}]]`))
  const insert = links.join('\n')
  view.dispatch({
    changes: { from: position, insert },
    selection: { anchor: position + insert.length },
  })
}

export const attachmentInput = (save: SaveAttachment) =>
  EditorView.domEventHandlers({
    paste(event, view) {
      const files = imagesIn(event.clipboardData)
      if (!files.length) return false
      event.preventDefault()
      void insertAttachments(view, files, view.state.selection.main.head, save)
      return true
    },
    drop(event, view) {
      const files = imagesIn(event.dataTransfer)
      if (!files.length) return false
      event.preventDefault()
      const position = view.posAtCoords(event) ?? view.state.selection.main.head
      void insertAttachments(view, files, position, save)
      return true
    },
  })
