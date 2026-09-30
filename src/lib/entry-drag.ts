/** What dragging a file or folder from the file tree carries. */
export type EntryDrag = { type: 'entry'; path: string }

export const isEntryDrag = (data: Record<string | symbol, unknown>): data is EntryDrag =>
  data.type === 'entry'
