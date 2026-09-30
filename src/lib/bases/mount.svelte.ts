import { mount, unmount } from 'svelte'
import BaseView from '../../components/bases/BaseView.svelte'
import { whenRemoved } from './lifetime'

/** Shows a base inside a rendered note, until the note stops showing it. */
export function mountBase(
  target: HTMLElement,
  source: string,
  onchange: (source: string) => void,
  currentPath: string,
  viewKey: string,
) {
  const component = mount(BaseView, { target, props: { source, onchange, currentPath, viewKey } })
  whenRemoved(target, () => void unmount(component))
}
