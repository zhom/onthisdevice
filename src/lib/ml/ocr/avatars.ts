/**
 * Round profile pictures in screenshots: a circle Hough transform on the
 * edges of a downscaled image, limited to radii a little larger than the
 * text, then a check that the circle stands out from what is around it.
 * Works for photos, initials and icons in a circle; square avatars are not
 * found (draw a box by hand).
 */

export interface Circle {
  x: number
  y: number
  r: number
  score: number
}

export interface Pixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

/**
 * @param img        RGBA pixels (any size; work happens on a copy at most 640 px wide)
 * @param textHeight median height of text lines in `img` pixels, sets the radius range
 * @param avoid      boxes (in `img` pixels) that are text, so letters do not count
 */
export function findAvatars(img: Pixels, textHeight: number, avoid: { x: number; y: number; w: number; h: number }[] = []): Circle[] {
  const scale = Math.min(1, 640 / img.width)
  const W = Math.max(8, Math.round(img.width * scale))
  const H = Math.max(8, Math.round(img.height * scale))
  // Grayscale with box-filter downscaling.
  const gray = new Float32Array(W * H)
  const step = 1 / scale
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = Math.min(img.width - 1, Math.floor(x * step))
      const sy = Math.min(img.height - 1, Math.floor(y * step))
      const i = (sy * img.width + sx) * 4
      gray[y * W + x] = 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]
    }
  }
  const th = Math.max(4, textHeight * scale)
  const rMin = Math.max(6, Math.round(th * 0.9))
  const rMax = Math.min(Math.round(Math.min(W, H) / 3), Math.round(th * 4))
  if (rMax <= rMin) return []
  const radii: number[] = []
  for (let r = rMin; r <= rMax; r += 2) radii.push(r)

  // Text areas do not vote: letters are full of short curves.
  const blocked = new Uint8Array(W * H)
  for (const b of avoid) {
    const x0 = Math.max(0, Math.floor(b.x * scale))
    const y0 = Math.max(0, Math.floor(b.y * scale))
    const x1 = Math.min(W, Math.ceil((b.x + b.w) * scale))
    const y1 = Math.min(H, Math.ceil((b.y + b.h) * scale))
    for (let y = y0; y < y1; y++) blocked.fill(1, y * W + x0, y * W + x1)
  }

  const acc = new Uint16Array(radii.length * W * H)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (blocked[y * W + x]) continue
      const i = y * W + x
      const gx = gray[i - W + 1] + 2 * gray[i + 1] + gray[i + W + 1] - gray[i - W - 1] - 2 * gray[i - 1] - gray[i + W - 1]
      const gy = gray[i + W - 1] + 2 * gray[i + W] + gray[i + W + 1] - gray[i - W - 1] - 2 * gray[i - W] - gray[i - W + 1]
      const m = Math.hypot(gx, gy)
      if (m < 60) continue
      const ux = gx / m
      const uy = gy / m
      for (let k = 0; k < radii.length; k++) {
        const r = radii[k]
        for (const s of [1, -1]) {
          const cx = Math.round(x + s * r * ux)
          const cy = Math.round(y + s * r * uy)
          if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue
          acc[k * W * H + cy * W + cx]++
        }
      }
    }
  }

  const found: Circle[] = []
  for (let k = 0; k < radii.length; k++) {
    const r = radii[k]
    const need = 2 * Math.PI * r * 0.45
    const base = k * W * H
    for (let y = r; y < H - r; y++) {
      for (let x = r; x < W - r; x++) {
        // 3x3 sum, as votes spread over neighbouring centers.
        let v = 0
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) v += acc[base + (y + dy) * W + x + dx]
        if (v < need) continue
        found.push({ x, y, r, score: v / (2 * Math.PI * r) })
      }
    }
  }
  found.sort((a, b) => b.score - a.score)

  // Keep the strongest circle in each neighbourhood, then check it against its surroundings.
  const kept: Circle[] = []
  for (const c of found) {
    if (kept.some((k) => Math.hypot(k.x - c.x, k.y - c.y) < Math.max(k.r, c.r))) continue
    if (!standsOut(gray, W, H, c)) continue
    kept.push(c)
    if (kept.length > 60) break
  }
  return kept.map((c) => ({ x: c.x / scale, y: c.y / scale, r: c.r / scale, score: c.score }))
}

/** The ring just outside the circle is even, and differs from the disc or the edge inside. */
function standsOut(gray: Float32Array, W: number, H: number, c: Circle): boolean {
  const ring: number[] = []
  const inner: number[] = []
  for (let a = 0; a < 32; a++) {
    const t = (a / 32) * Math.PI * 2
    const ox = Math.round(c.x + Math.cos(t) * (c.r + 3))
    const oy = Math.round(c.y + Math.sin(t) * (c.r + 3))
    const ix = Math.round(c.x + Math.cos(t) * (c.r - 3))
    const iy = Math.round(c.y + Math.sin(t) * (c.r - 3))
    if (ox < 0 || oy < 0 || ox >= W || oy >= H) return false
    ring.push(gray[oy * W + ox])
    inner.push(gray[iy * W + ix])
  }
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
  const sd = (v: number[]) => {
    const m = mean(v)
    return Math.sqrt(mean(v.map((x) => (x - m) ** 2)))
  }
  // Outside a profile picture is mostly plain background (a neighbouring bubble may touch
  // a few samples); inside differs from it.
  const sorted = [...ring].sort((a, b) => a - b)
  const med = sorted[sorted.length >> 1]
  const plain = ring.filter((v) => Math.abs(v - med) < 14).length / ring.length
  return plain > 0.7 && Math.abs(mean(inner) - med) > 18 && sd(inner) >= 0
}
