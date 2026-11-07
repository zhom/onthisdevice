/**
 * Splits an image into overlapping tiles for a model with a fixed scale and puts the results
 * back: each tile is cut with PAD extra pixels on every side (clamped to the image), and only
 * the middle part of its result is kept, so no seam shows.
 */

export interface Tile {
  /** The part of the input this tile is responsible for. */
  x: number
  y: number
  w: number
  h: number
  /** The padded region read from the input. */
  px: number
  py: number
  pw: number
  ph: number
}

export function tilesFor(width: number, height: number, size: number, pad: number): Tile[] {
  const tiles: Tile[] = []
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      const w = Math.min(size, width - x)
      const h = Math.min(size, height - y)
      const px = Math.max(0, x - pad)
      const py = Math.max(0, y - pad)
      const pw = Math.min(width, x + w + pad) - px
      const ph = Math.min(height, y + h + pad) - py
      tiles.push({ x, y, w, h, px, py, pw, ph })
    }
  }
  return tiles
}

/** Planar RGB 0..1 of a padded tile from RGBA pixels of the whole image. */
export function tileInput(rgba: Uint8ClampedArray, width: number, t: Tile): Float32Array {
  const n = t.pw * t.ph
  const out = new Float32Array(3 * n)
  for (let y = 0; y < t.ph; y++) {
    for (let x = 0; x < t.pw; x++) {
      const src = ((t.py + y) * width + t.px + x) * 4
      const dst = y * t.pw + x
      out[dst] = rgba[src] / 255
      out[n + dst] = rgba[src + 1] / 255
      out[2 * n + dst] = rgba[src + 2] / 255
    }
  }
  return out
}

/** Copies the kept part of a tile result (planar RGB, scale x the padded tile) into RGBA output. */
export function placeTile(out: Uint8ClampedArray, outWidth: number, result: Float32Array, t: Tile, scale: number) {
  const rw = t.pw * scale
  const rn = rw * t.ph * scale
  const ox = (t.x - t.px) * scale
  const oy = (t.y - t.py) * scale
  for (let y = 0; y < t.h * scale; y++) {
    for (let x = 0; x < t.w * scale; x++) {
      const src = (oy + y) * rw + ox + x
      const dst = ((t.y * scale + y) * outWidth + t.x * scale + x) * 4
      out[dst] = result[src] * 255
      out[dst + 1] = result[rn + src] * 255
      out[dst + 2] = result[2 * rn + src] * 255
      out[dst + 3] = 255
    }
  }
}

/** Halves an RGBA image by averaging each 2 x 2 block. */
export function halve(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const ow = w >> 1
  const oh = h >> 1
  const out = new Uint8ClampedArray(ow * oh * 4)
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const a = (2 * y * w + 2 * x) * 4
      const b = a + w * 4
      const d = (y * ow + x) * 4
      for (let c = 0; c < 4; c++) out[d + c] = (src[a + c] + src[a + 4 + c] + src[b + c] + src[b + 4 + c] + 2) >> 2
    }
  }
  return out
}
