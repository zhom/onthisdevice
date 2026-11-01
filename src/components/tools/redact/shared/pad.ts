/**
 * How much a detected box grows before it is redacted, per kind of object:
 * a face box from the detector stops at the eyebrows and the chin, so it
 * grows to cover hair, ears and jaw. Worker-safe.
 *
 *   padded(box, kind, { width, height }) -> Box in the same pixels, clamped
 */
import { padBox } from '@/lib/ml/vision/geometry'
import type { Box } from '@/lib/ml/vision/geometry'

export type BoxKind = 'face' | 'plate' | 'text' | 'manual'

/** Fractions of the box size: x margin, y margin, vertical shift. */
const PAD: Record<BoxKind, [number, number, number]> = {
  face: [0.16, 0.24, -0.08],
  plate: [0.1, 0.18, 0],
  text: [0.04, 0.12, 0],
  manual: [0, 0, 0],
}

export function padded(b: Box, kind: BoxKind, bounds: { width: number; height: number }): Box {
  const [px, py, shift] = PAD[kind]
  return padBox(b, px, py, shift, bounds)
}
