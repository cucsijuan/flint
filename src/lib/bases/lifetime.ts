/** How long an element rendered off the page may take to be shown before it counts as dropped. */
const SHOW_DEADLINE_MS = 60_000

interface Watched {
  wasShown: boolean
  renderedAt: number
  cleanup: () => void
}

const watched = new Map<HTMLElement, Watched>()
let observer: MutationObserver | null = null

function check() {
  const now = Date.now()
  for (const [element, entry] of watched) {
    if (element.isConnected) {
      entry.wasShown = true
    } else if (entry.wasShown || now - entry.renderedAt > SHOW_DEADLINE_MS) {
      watched.delete(element)
      entry.cleanup()
    }
  }
  if (!watched.size) {
    observer?.disconnect()
    observer = null
  }
}

/** Runs `cleanup` once `element` has been on the page and left it. Notes render into detached
 * elements first, so one that isn't on the page yet gets a while to show up before it's dropped. */
export function whenRemoved(element: HTMLElement, cleanup: () => void) {
  watched.set(element, { wasShown: element.isConnected, renderedAt: Date.now(), cleanup })
  if (!observer) {
    observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true })
  }
  return () => void watched.delete(element)
}
