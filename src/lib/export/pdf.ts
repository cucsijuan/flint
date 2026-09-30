import { isMac } from '../commands.svelte'
import * as vault from '../vault'
import { PAGE_SIZES, type PdfSettings } from './pdf-settings'
import { imagesLoaded, renderNote } from './render'

/** Renders the note into the page's print area and prints it to `target`. */
export async function exportPdf(path: string, target: string, settings: PdfSettings) {
  const root = document.createElement('div')
  root.id = 'print-root'
  root.append(await renderNote(path, settings))
  document.body.append(root)
  try {
    await imagesLoaded(root)
    // macOS has no native engine wired in yet; its print dialog offers "Save as PDF".
    if (isMac) {
      window.print()
      return
    }
    const [width, height] = PAGE_SIZES[settings.pageSize] ?? PAGE_SIZES.A4
    await vault.exportPdf(target, {
      widthMm: width,
      heightMm: height,
      landscape: settings.landscape,
      marginMm: settings.margin,
      scale: settings.scale / 100,
    })
  } finally {
    root.remove()
  }
}
