import { workspace } from './workspace.svelte'

const SHOW_DELAY_MS = 350
const HIDE_DELAY_MS = 300

export interface Preview {
  path: string
  subpath: string
  /** The link's box, to place the popup beside it. */
  anchor: DOMRect
}

/** Areas where previews wait for Ctrl (⌘), so moving the mouse while editing doesn't open them. */
const NEEDS_MODIFIER = '.cm-editor, .tree'

const splitLink = (destination: string) => {
  const hash = destination.indexOf('#')
  return hash === -1
    ? { target: destination, subpath: '' }
    : { target: destination.slice(0, hash), subpath: destination.slice(hash + 1) }
}

/** Page previews: hovering a link (or Ctrl+hovering one in the editor) shows the note it points to. */
class HoverPreview {
  current = $state<Preview | null>(null)
  #showTimer: ReturnType<typeof setTimeout> | undefined
  #hideTimer: ReturnType<typeof setTimeout> | undefined
  #hovered: Element | null = null

  /** The element under the pointer that links to a note, if previews may open for it. */
  #linkAt(target: EventTarget | null, isModifierDown: boolean) {
    if (!(target instanceof Element) || target.closest('.hover-preview')) return null
    const link = target.closest<HTMLElement>('[data-link], [data-preview]')
    if (!link) return null
    if (link.closest(NEEDS_MODIFIER) && !isModifierDown) return null
    return link
  }

  async #open(link: HTMLElement) {
    const exact = link.dataset.preview
    let path = exact ?? null
    let subpath = ''
    if (!path) {
      const parts = splitLink(link.dataset.link ?? '')
      subpath = parts.subpath
      const source =
        link.closest<HTMLElement>('[data-reading-note]')?.dataset.readingNote ??
        workspace.notePath ??
        ''
      ;[path] = parts.target ? await workspace.resolveLinks([parts.target], source) : [source]
    }
    if (!path?.toLowerCase().endsWith('.md') || this.#hovered !== link) return
    this.current = { path, subpath, anchor: link.getBoundingClientRect() }
  }

  onPointerOver = (event: PointerEvent) => {
    if (!workspace.settings.value.pagePreview) return
    const link = this.#linkAt(event.target, event.ctrlKey || event.metaKey)
    if (!link || link === this.#hovered) return
    this.#hovered = link
    clearTimeout(this.#showTimer)
    this.#showTimer = setTimeout(() => void this.#open(link), SHOW_DELAY_MS)
  }

  onPointerOut = (event: PointerEvent) => {
    const to = event.relatedTarget instanceof Element ? event.relatedTarget : null
    if (this.#hovered && to && this.#hovered.contains(to)) return
    this.#hovered = null
    clearTimeout(this.#showTimer)
    if (to?.closest('.hover-preview')) return
    this.scheduleHide()
  }

  /** Ctrl pressed over a link in the editor opens its preview without moving the mouse. */
  onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Control' && event.key !== 'Meta') return
    const hovered = document.querySelectorAll(':hover')
    const target = hovered[hovered.length - 1] ?? null
    const link = this.#linkAt(target, true)
    if (!link || !workspace.settings.value.pagePreview) return
    this.#hovered = link
    void this.#open(link)
  }

  keepOpen() {
    clearTimeout(this.#hideTimer)
  }

  scheduleHide() {
    clearTimeout(this.#hideTimer)
    this.#hideTimer = setTimeout(() => (this.current = null), HIDE_DELAY_MS)
  }

  close() {
    clearTimeout(this.#hideTimer)
    this.current = null
  }
}

export const hoverPreview = new HoverPreview()
