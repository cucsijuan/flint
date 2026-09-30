/** Runs `cleanup` once `element` has been on the page and left it. Rendered notes are built in
 * detached elements first, so an element that isn't on the page yet is left alone. */
export function whenRemoved(element: HTMLElement, cleanup: () => void) {
  let wasShown = element.isConnected
  const observer = new MutationObserver(() => {
    if (element.isConnected) {
      wasShown = true
      return
    }
    if (!wasShown) return
    observer.disconnect()
    cleanup()
  })
  queueMicrotask(() => observer.observe(document.body, { childList: true, subtree: true }))
  return () => observer.disconnect()
}
