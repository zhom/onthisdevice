/** Pixel density of a screen. Pure; the tests import it. */

export interface Screen {
  /** Pixels per inch along the diagonal. */
  ppi: number
  /** Pixel pitch, mm. */
  pitch: number
  /** Physical width and height, inches. */
  width: number
  height: number
  /** Distance (inches) beyond which one pixel is smaller than 1 arcminute. */
  retina: number
  megapixels: number
}

export function screen(px: number, py: number, diagonalIn: number): Screen {
  const diagPx = Math.hypot(px, py)
  const ppi = diagPx / diagonalIn
  return {
    ppi,
    pitch: 25.4 / ppi,
    width: px / ppi,
    height: py / ppi,
    retina: 1 / (ppi * Math.tan(Math.PI / 180 / 60)),
    megapixels: (px * py) / 1e6,
  }
}

/** Width : height reduced, e.g. 16 : 9. */
export function aspect(px: number, py: number): string {
  let a = Math.round(px)
  let b = Math.round(py)
  while (b) [a, b] = [b, a % b]
  return `${Math.round(px) / a} : ${Math.round(py) / a}`
}
