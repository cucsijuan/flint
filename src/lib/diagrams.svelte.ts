import { basename } from './paths'
import { diagramPng, standaloneSvg } from './render/diagram-image'
import type { DiagramAction } from './render/diagrams'
import * as vault from './vault'
import { workspace } from './workspace.svelte'

export interface ViewedDiagram {
  source: string
  /** The note it's in: images saved from the viewer go beside it. */
  note: string
}

const imageOf = (diagram: HTMLElement) =>
  diagram.querySelector<SVGSVGElement>(':scope > .diagram-image > svg')

/** The color a diagram is shown on: the first background behind it that isn't see-through. */
function backgroundOf(element: Element) {
  for (let current: Element | null = element; current; current = current.parentElement) {
    const color = getComputedStyle(current).backgroundColor
    if (color.startsWith('rgb(')) return color
  }
  return ''
}

/** Rendered Mermaid diagrams: the full-size viewer, and copying and saving them as images. */
class Diagrams {
  viewing = $state<ViewedDiagram | null>(null)

  open(diagram: HTMLElement) {
    this.viewing = { source: diagram.dataset.source ?? '', note: diagram.dataset.note ?? '' }
  }

  close() {
    this.viewing = null
  }

  async copy(diagram: HTMLElement) {
    const svg = imageOf(diagram)
    if (!svg) return
    try {
      // Handing over the image as a promise keeps the copy part of the click, as WebKit wants.
      const png = diagramPng(svg, backgroundOf(diagram))
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      workspace.notify('Copied the diagram as an image.')
    } catch (error) {
      workspace.notify(`Couldn't copy the diagram: ${String(error)}`)
    }
  }

  /** Saves the diagram where attachments go, named after its note. */
  async save(diagram: HTMLElement, format: 'svg' | 'png') {
    const svg = imageOf(diagram)
    if (!svg) return
    const note = diagram.dataset.note || workspace.notePath || ''
    const stem = basename(note).replace(/\.[^.]+$/, '') || 'Untitled'
    try {
      const background = backgroundOf(diagram)
      const bytes =
        format === 'svg'
          ? new TextEncoder().encode(standaloneSvg(svg, background))
          : new Uint8Array(await (await diagramPng(svg, background)).arrayBuffer())
      const saved = await workspace.saveAttachment(
        {
          name: `${stem} diagram.${format}`,
          write: async (path) => {
            await vault.saveAttachment(path, bytes)
            return true
          },
        },
        note,
      )
      if (saved) workspace.notify(`Exported to ${saved}.`)
    } catch (error) {
      workspace.notify(`Couldn't export the diagram: ${String(error)}`)
    }
  }

  /** Runs the toolbar button that was clicked, wherever its diagram is: notes, embeds, canvases. */
  onClick = (event: MouseEvent) => {
    const { target } = event
    const button =
      target instanceof Element ? target.closest<HTMLElement>('[data-diagram-action]') : null
    const diagram = button?.closest<HTMLElement>('.diagram[data-source]')
    if (!button || !diagram) return
    event.preventDefault()
    const action = button.dataset.diagramAction as DiagramAction
    if (action === 'open') this.open(diagram)
    else if (action === 'copy') void this.copy(diagram)
    else void this.save(diagram, action)
  }
}

export const diagrams = new Diagrams()
