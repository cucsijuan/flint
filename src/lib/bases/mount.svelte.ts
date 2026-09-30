import { mount, unmount } from 'svelte'
import BaseView from '../../components/bases/BaseView.svelte'

/** Shows a base inside a rendered note; it goes away once its element has been on the page and left it.
 * Notes render into detached elements first, so a base that isn't on the page yet is left alone. */
export function mountBase(
  target: HTMLElement,
  source: string,
  onchange: (source: string) => void,
  currentPath: string,
) {
  const component = mount(BaseView, { target, props: { source, onchange, currentPath } })
  let wasShown = target.isConnected
  const observer = new MutationObserver(() => {
    if (target.isConnected) {
      wasShown = true
      return
    }
    if (!wasShown) return
    observer.disconnect()
    void unmount(component)
  })
  queueMicrotask(() => observer.observe(document.body, { childList: true, subtree: true }))
}
