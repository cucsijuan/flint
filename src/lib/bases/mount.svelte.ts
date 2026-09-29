import { mount, unmount } from 'svelte'
import BaseView from '../../components/bases/BaseView.svelte'

/** Shows a base inside a rendered note; it goes away once its element leaves the page. */
export function mountBase(
  target: HTMLElement,
  source: string,
  onchange: (source: string) => void,
  currentPath: string,
) {
  const component = mount(BaseView, { target, props: { source, onchange, currentPath } })
  const observer = new MutationObserver(() => {
    if (target.isConnected) return
    observer.disconnect()
    void unmount(component)
  })
  queueMicrotask(() => observer.observe(document.body, { childList: true, subtree: true }))
}
