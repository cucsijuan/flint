export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** Where the content's top-left corner sits in the stage, and how much it's scaled. */
export interface View extends Point {
  zoom: number
}

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 8

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

/** The content at `zoom`, centered in the stage. */
export const centered = (content: Size, stage: Size, zoom: number): View => ({
  x: (stage.width - content.width * zoom) / 2,
  y: (stage.height - content.height * zoom) / 2,
  zoom,
})

/** The whole content in view and centered, shrunk to fit but never enlarged past its size. */
export function fit(content: Size, stage: Size, padding = 0): View {
  if (content.width <= 0 || content.height <= 0) return centered(content, stage, 1)
  const zoom = Math.min(
    1,
    (stage.width - padding * 2) / content.width,
    (stage.height - padding * 2) / content.height,
  )
  return centered(content, stage, clampZoom(zoom))
}

/** Zooms by `factor`, keeping the content under `at` (a point in the stage) where it is. */
export function zoomAt(view: View, factor: number, at: Point): View {
  const zoom = clampZoom(view.zoom * factor)
  const ratio = zoom / view.zoom
  return { x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio, zoom }
}
