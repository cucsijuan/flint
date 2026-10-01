import { mount, unmount } from 'svelte'
import { stringify } from 'yaml'
import BaseView from '../../components/bases/BaseView.svelte'
import { rowFor, type ViewType } from './base'
import type { Row } from './expression'
import { externalPath, registerExternalView } from './external'
import { whenRemoved } from './lifetime'

/** A row a plugin shows, as `flint.ui.renderDataView` takes it. */
export interface DataRow {
  id: string
  title: string
  values: Record<string, unknown>
}

export interface DataViewOptions {
  rows: DataRow[]
  columns?: string[]
  layout?: ViewType
  config?: string
  onConfigChange?: (config: string) => void
  onOpen?: (id: string) => void
  onEdit?: (id: string, property: string, value: unknown) => void
  choices?: (
    id: string,
    property: string,
    query: string,
  ) => string[] | null | undefined | Promise<string[] | null | undefined>
  onNew?: () => void
}

const LAYOUT_NAMES: Record<ViewType, string> = {
  table: 'Table',
  cards: 'Cards',
  list: 'List',
  map: 'Map',
}

function initialConfig({ layout = 'table', columns = [] }: DataViewOptions) {
  const order = ['file.name', ...columns.map((column) => `note.${column}`)]
  return stringify({ views: [{ type: layout, name: LAYOUT_NAMES[layout], order }] })
}

function toRows(viewId: string, rows: DataRow[]): Row[] {
  return rows.map(({ id, title, values }) =>
    rowFor(
      {
        path: externalPath(viewId, id),
        name: title,
        basename: title,
        folder: '',
        ext: '',
        size: 0,
        ctime: 0,
        mtime: 0,
        tags: [],
        links: [],
        backlinks: [],
        embeds: [],
        properties: values,
      },
      {},
    ),
  )
}

/** Shows a plugin's own rows with Bases' views, filters, sorting and summaries. */
export function renderDataView(target: HTMLElement, initial: DataViewOptions) {
  const viewId = crypto.randomUUID()
  let options = initial
  let unregister = () => {}
  const register = () => {
    unregister()
    unregister = registerExternalView(viewId, {
      open: (id) => options.onOpen?.(id),
      edit: options.onEdit
        ? (id, property, value) => options.onEdit?.(id, property, value)
        : undefined,
      choices: async (id, property, query) =>
        (await options.choices?.(id, property, query)) ?? null,
    })
  }
  register()
  const props = $state({
    source: initial.config ?? initialConfig(initial),
    rows: toRows(viewId, initial.rows),
    onchange: (source: string) => {
      props.source = source
      options.onConfigChange?.(source)
    },
    onNew: initial.onNew ? () => options.onNew?.() : undefined,
  })
  const component = mount(BaseView, { target, props })
  let isDestroyed = false
  const destroy = () => {
    if (isDestroyed) return
    isDestroyed = true
    stopWatching()
    unregister()
    void unmount(component)
  }
  const stopWatching = whenRemoved(target, destroy)
  return {
    update(changes: Partial<DataViewOptions>) {
      options = { ...options, ...changes }
      if ('onEdit' in changes) register()
      if ('onNew' in changes) props.onNew = options.onNew ? () => options.onNew?.() : undefined
      if (changes.rows || 'onEdit' in changes)
        props.rows = toRows(viewId, changes.rows ?? options.rows)
      if (changes.config !== undefined) props.source = changes.config
    },
    destroy,
  }
}
