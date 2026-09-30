import { getNodesBounds, type Node } from '@xyflow/svelte'
import { toPng, toSvg } from 'html-to-image'

const PADDING = 40
const PIXEL_RATIO = 2
const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const isEditingChrome = (element: HTMLElement) =>
  element.classList?.contains('svelte-flow__handle') ||
  element.classList?.contains('svelte-flow__resize-control')

/** The whole canvas as a PNG or SVG file, drawn from the viewport element at zoom 1. */
export async function exportImage(
  viewport: HTMLElement,
  nodes: Node[],
  format: 'png' | 'svg',
  background: string,
) {
  const bounds = getNodesBounds(nodes)
  const width = Math.ceil(bounds.width + PADDING * 2)
  const height = Math.ceil(bounds.height + PADDING * 2)
  const options = {
    backgroundColor: background,
    width,
    height,
    pixelRatio: PIXEL_RATIO,
    imagePlaceholder: TRANSPARENT_PIXEL,
    filter: (element: HTMLElement) => !isEditingChrome(element),
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${PADDING - bounds.x}px, ${PADDING - bounds.y}px) scale(1)`,
    },
  }
  if (format === 'svg') {
    const url = await toSvg(viewport, options)
    return new TextEncoder().encode(decodeURIComponent(url.slice(url.indexOf(',') + 1)))
  }
  const url = await toPng(viewport, options)
  return new Uint8Array(await (await fetch(url)).arrayBuffer())
}
