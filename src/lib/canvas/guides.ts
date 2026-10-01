export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** A line where the moving box lines up with another, in flow coordinates. */
export interface Guide {
  vertical: boolean
  /** x for vertical guides, y for horizontal ones. */
  at: number
  from: number
  to: number
}

const lines = (start: number, size: number) => [start, start + size / 2, start + size]

function closest(moving: number[], fixed: number[][], threshold: number) {
  let best: { offset: number; at: number; index: number } | null = null
  fixed.forEach((candidates, index) => {
    for (const target of candidates) {
      for (const line of moving) {
        const offset = target - line
        if (Math.abs(offset) <= threshold && (!best || Math.abs(offset) < Math.abs(best.offset))) {
          best = { offset, at: target, index }
        }
      }
    }
  })
  return best as { offset: number; at: number; index: number } | null
}

/** How far to nudge `box` so an edge or its middle lines up with one of `others`, and the
 * guides to draw for it. */
export function alignmentGuides(box: Box, others: Box[], threshold: number) {
  const x = closest(
    lines(box.x, box.width),
    others.map((other) => lines(other.x, other.width)),
    threshold,
  )
  const y = closest(
    lines(box.y, box.height),
    others.map((other) => lines(other.y, other.height)),
    threshold,
  )
  const dx = x?.offset ?? 0
  const dy = y?.offset ?? 0
  const guides: Guide[] = []
  if (x) {
    const other = others[x.index]
    const top = Math.min(box.y + dy, other.y)
    const bottom = Math.max(box.y + dy + box.height, other.y + other.height)
    guides.push({ vertical: true, at: x.at, from: top, to: bottom })
  }
  if (y) {
    const other = others[y.index]
    const left = Math.min(box.x + dx, other.x)
    const right = Math.max(box.x + dx + box.width, other.x + other.width)
    guides.push({ vertical: false, at: y.at, from: left, to: right })
  }
  return { dx, dy, guides }
}
