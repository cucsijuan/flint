import { mount, unmount } from 'svelte'
import PropertiesEditor from '../../components/PropertiesEditor.svelte'
import type { Property } from '../properties'

type Edit = (change: (note: string) => string) => void

/** Mounts the properties form into an editor widget, updating it in place so inputs keep focus. */
export function mountProperties(target: HTMLElement, properties: Property[], edit: Edit) {
  const props = $state({ properties, edit })
  const component = mount(PropertiesEditor, { target, props })
  return {
    update: (next: Property[]) => (props.properties = next),
    destroy: () => void unmount(component),
  }
}
