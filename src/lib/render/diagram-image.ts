import type { Size } from '../pan-zoom'

const SVG_NS = 'http://www.w3.org/2000/svg'
const PIXEL_RATIO = 2
/** Some webviews fail to draw canvases wider or taller than this. */
const MAX_SIDE = 8192

function viewBoxOf(svg: SVGSVGElement) {
  const [x = 0, y = 0, width = 0, height = 0] = (svg.getAttribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  return { x, y, width, height }
}

/** A diagram's own size: Mermaid only scales its SVG down to fit the page. */
export function diagramSize(svg: SVGSVGElement): Size {
  const { width, height } = viewBoxOf(svg)
  if (width > 0 && height > 0) return { width, height }
  const box = svg.getBoundingClientRect()
  return { width: box.width, height: box.height }
}

/** The diagram as an SVG file of its own, `scale` times its size, on the background it's shown on. */
export function standaloneSvg(svg: SVGSVGElement, background: string, scale = 1) {
  const { width, height } = diagramSize(svg)
  const box = viewBoxOf(svg)
  const copy = svg.cloneNode(true) as SVGSVGElement
  // Mermaid writes `xmlns` on its HTML labels too, which the serializer would then declare twice;
  // it declares every namespace it needs by itself.
  for (const element of [copy, ...copy.querySelectorAll('*')]) element.removeAttribute('xmlns')
  if (!(box.width > 0 && box.height > 0)) copy.setAttribute('viewBox', `0 0 ${width} ${height}`)
  copy.setAttribute('width', String(width * scale))
  copy.setAttribute('height', String(height * scale))
  copy.style.removeProperty('max-width')
  if (!copy.getAttribute('style')) copy.removeAttribute('style')
  if (background) {
    const rect = document.createElementNS(SVG_NS, 'rect')
    rect.setAttribute('x', String(box.x))
    rect.setAttribute('y', String(box.y))
    rect.setAttribute('width', String(width))
    rect.setAttribute('height', String(height))
    rect.setAttribute('style', `fill: ${background}`)
    copy.prepend(rect)
  }
  return new XMLSerializer().serializeToString(copy)
}

/** The diagram drawn as a PNG, at twice its size when that isn't too big to draw. */
export async function diagramPng(svg: SVGSVGElement, background: string): Promise<Blob> {
  const { width, height } = diagramSize(svg)
  const scale = Math.min(PIXEL_RATIO, MAX_SIDE / Math.max(width, height, 1))
  const image = new Image()
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = () => reject(new Error("the diagram couldn't be drawn"))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(standaloneSvg(svg, background, scale))}`
  })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("the diagram couldn't be drawn"))),
      'image/png',
    ),
  )
}
