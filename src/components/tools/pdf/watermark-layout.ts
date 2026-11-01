/** Pure geometry for the watermark tool, shared by the preview and the export. */

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export interface LayoutInput {
  /** Page size as displayed, in points. */
  pageW: number
  pageH: number
  /** Un-rotated size of one watermark, in points. */
  itemW: number
  itemH: number
  /** Counter-clockwise rotation in degrees. */
  angleDeg: number
  position: WatermarkPosition
  margin: number
  tile: boolean
  /** Extra space between tiles, in points. */
  gap: number
}

/** Centre point of one watermark, in display space with y pointing up. */
export interface Placement {
  cx: number
  cy: number
}

const MAX_TILES = 600

/** Bounding box of the watermark once rotated. */
export function rotatedBounds(
  itemW: number,
  itemH: number,
  angleDeg: number,
): { w: number; h: number } {
  const a = (angleDeg * Math.PI) / 180
  const cos = Math.abs(Math.cos(a))
  const sin = Math.abs(Math.sin(a))
  return { w: itemW * cos + itemH * sin, h: itemW * sin + itemH * cos }
}

export function watermarkPlacements(input: LayoutInput): Placement[] {
  const { pageW, pageH, itemW, itemH, angleDeg, position, margin, tile, gap } = input
  const bounds = rotatedBounds(itemW, itemH, angleDeg)

  if (!tile) {
    const [vertical, horizontal] = position.split('-')
    const cx =
      horizontal === 'left'
        ? margin + bounds.w / 2
        : horizontal === 'right'
          ? pageW - margin - bounds.w / 2
          : pageW / 2
    const cy =
      vertical === 'bottom'
        ? margin + bounds.h / 2
        : vertical === 'top'
          ? pageH - margin - bounds.h / 2
          : pageH / 2
    return [{ cx, cy }]
  }

  const stepX = Math.max(bounds.w + gap, 12)
  const stepY = Math.max(bounds.h + gap, 12)
  const out: Placement[] = []
  for (let cy = stepY / 2; cy < pageH + stepY / 2; cy += stepY) {
    for (let cx = stepX / 2; cx < pageW + stepX / 2; cx += stepX) {
      out.push({ cx, cy })
      if (out.length >= MAX_TILES) return out
    }
  }
  return out
}

/**
 * Bottom-left drawing origin for a watermark whose centre sits at (cx, cy) and
 * which is rotated `angleDeg` counter-clockwise about that origin — the anchor
 * convention used by both pdf-lib and our canvas preview.
 */
export function originFromCenter(
  cx: number,
  cy: number,
  itemW: number,
  itemH: number,
  angleDeg: number,
): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const hw = itemW / 2
  const hh = itemH / 2
  return {
    x: cx - hw * cos + hh * sin,
    y: cy - hw * sin - hh * cos,
  }
}
