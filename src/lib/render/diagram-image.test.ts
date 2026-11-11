// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { diagramSize, standaloneSvg } from './diagram-image'

/** An SVG like Mermaid's: scaled to the page, with HTML labels. */
function mermaidSvg() {
  const holder = document.createElement('div')
  holder.innerHTML = `<svg id="mermaid-0" xmlns="http://www.w3.org/2000/svg" width="100%"
    viewBox="-8 -8 316 120" style="max-width: 316px;">
    <style>#mermaid-0 .node rect { fill: #eee; }</style>
    <g class="node"><rect width="100" height="40"></rect>
      <foreignObject width="100" height="40">
        <div xmlns="http://www.w3.org/1999/xhtml"><span>Two<br>lines</span></div>
      </foreignObject>
    </g>
  </svg>`
  return holder.querySelector('svg') as SVGSVGElement
}

const parse = (markup: string) =>
  new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement

describe('diagram images', () => {
  it('measures diagrams by their view box, not by the page', () => {
    expect(diagramSize(mermaidSvg())).toEqual({ width: 316, height: 120 })
  })

  it('saves diagrams as valid SVG files at their own size', () => {
    const svg = mermaidSvg()
    const file = standaloneSvg(svg, 'rgb(30, 30, 30)', 2)
    const root = parse(file)

    expect(root.querySelector('parsererror')).toBeNull()
    expect(root.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(root.getAttribute('width')).toBe('632')
    expect(root.getAttribute('height')).toBe('240')
    expect(root.getAttribute('viewBox')).toBe('-8 -8 316 120')
    expect(root.getAttribute('style')).toBeNull()
    expect(root.querySelector('foreignObject span')?.textContent).toBe('Twolines')
    // The page's copy is left as it was.
    expect(svg.getAttribute('width')).toBe('100%')
    expect(svg.style.maxWidth).toBe('316px')
  })

  it('paints the background behind the diagram, when there is one', () => {
    const background = parse(standaloneSvg(mermaidSvg(), 'rgb(30, 30, 30)')).firstElementChild
    expect(background?.tagName).toBe('rect')
    expect(background?.getAttribute('x')).toBe('-8')
    expect(background?.getAttribute('width')).toBe('316')
    expect(background?.getAttribute('style')).toBe('fill: rgb(30, 30, 30)')

    const transparent = parse(standaloneSvg(mermaidSvg(), '')).firstElementChild
    expect(transparent?.tagName).toBe('style')
  })
})
