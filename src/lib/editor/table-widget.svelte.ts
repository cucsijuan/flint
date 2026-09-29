import { mount, unmount } from 'svelte'
import TableEditor, { type TableEdits } from '../../components/TableEditor.svelte'
import type { HydrateContext } from '../render/hydrate'

/** Mounts the table grid into an editor widget, updating it in place so the edited cell keeps focus. */
export function mountTable(
  target: HTMLElement,
  markdown: string,
  context: HydrateContext,
  edits: TableEdits,
) {
  const props = $state({ markdown, context, edits })
  const component = mount(TableEditor, { target, props })
  return {
    get markdown() {
      return props.markdown
    },
    update: (next: string) => (props.markdown = next),
    destroy: () => void unmount(component),
  }
}
