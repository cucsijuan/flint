import { describe, expect, it } from 'vitest'
import { fit, MAX_ZOOM, MIN_ZOOM, zoomAt } from './pan-zoom'

const stage = { width: 1000, height: 600 }

describe('fit', () => {
  it('shrinks big content to the stage, inside the padding, and centers it', () => {
    const view = fit({ width: 2000, height: 500 }, stage, 50)
    expect(view.zoom).toBe(0.45)
    expect(view.x).toBe(50)
    expect(view.y).toBeCloseTo((600 - 500 * 0.45) / 2)
  })

  it('never enlarges small content', () => {
    expect(fit({ width: 200, height: 100 }, stage, 50)).toEqual({ x: 400, y: 250, zoom: 1 })
  })

  it('keeps empty content at its size', () => {
    expect(fit({ width: 0, height: 0 }, stage).zoom).toBe(1)
  })
})

describe('zoomAt', () => {
  it('keeps the content under the pointer in place', () => {
    const view = { x: 100, y: 50, zoom: 1 }
    const at = { x: 300, y: 250 }
    const contentAt = (current: typeof view) => ({
      x: (at.x - current.x) / current.zoom,
      y: (at.y - current.y) / current.zoom,
    })
    const zoomed = zoomAt(view, 2, at)
    expect(zoomed.zoom).toBe(2)
    expect(contentAt(zoomed)).toEqual(contentAt(view))
  })

  it('stays within the zoom limits', () => {
    const at = { x: 0, y: 0 }
    expect(zoomAt({ x: 0, y: 0, zoom: 4 }, 10, at).zoom).toBe(MAX_ZOOM)
    expect(zoomAt({ x: 0, y: 0, zoom: 0.2 }, 0.1, at).zoom).toBe(MIN_ZOOM)
  })
})
