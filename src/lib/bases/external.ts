/** Rows a plugin feeds to a data view: they look like notes to Bases, but opening or editing
 * them calls the plugin instead of touching the vault. */
export interface ExternalHandlers {
  open?: (id: string) => void
  edit?: (id: string, property: string, value: unknown) => void
  choices?: (id: string, property: string, query: string) => Promise<string[] | null>
}

const PREFIX = 'flint-data:'
const views = new Map<string, ExternalHandlers>()

export function registerExternalView(viewId: string, handlers: ExternalHandlers) {
  views.set(viewId, handlers)
  return () => void views.delete(viewId)
}

export const externalPath = (viewId: string, rowId: string) => `${PREFIX}${viewId}/${rowId}`

/** The plugin row behind a path, or null for a real note. */
export function externalRow(path: string) {
  if (!path.startsWith(PREFIX)) return null
  const rest = path.slice(PREFIX.length)
  const slash = rest.indexOf('/')
  const handlers = views.get(rest.slice(0, slash))
  return handlers ? { id: rest.slice(slash + 1), handlers } : null
}
