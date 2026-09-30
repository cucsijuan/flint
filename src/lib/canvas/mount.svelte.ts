import { mount, unmount } from 'svelte'
import CanvasFile from '../../components/canvas/CanvasFile.svelte'
import { whenRemoved } from '../bases/lifetime'

/** `![[name.canvas]]`: the canvas itself, editable in place. */
export function mountCanvas(target: HTMLElement, path: string) {
  const component = mount(CanvasFile, { target, props: { path, embedded: true } })
  whenRemoved(target, () => void unmount(component))
}
