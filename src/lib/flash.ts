const FLASH_CLASS = 'is-flashing'

/** Briefly highlights where a link jumped to, so the jump shows even when nothing scrolls. */
export function flash(element: Element | null | undefined) {
  if (!element) return
  element.classList.remove(FLASH_CLASS)
  void (element as HTMLElement).offsetWidth
  element.classList.add(FLASH_CLASS)
  element.addEventListener('animationend', () => element.classList.remove(FLASH_CLASS), {
    once: true,
  })
}
