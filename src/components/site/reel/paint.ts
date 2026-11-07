/**
 * Painters for the home reel (./scenes.ts). A scene is a grid of square pixels in four tones,
 * painted one cell at a time, with optional type on top. Pictures are 1-bit: a darkness from
 * 0 to 1 goes through a 4 x 4 ordered dither. A painter is a function of the cell and the scene
 * time t (0 to 1). Each scene is complete by t = 0.82; t = STILL is its still frame.
 */
import type { SceneId } from './scenes'

export const PAPER = 0
export const INK = 1
export const FILL = 2
export const GREY = 3
export type Tone = typeof PAPER | typeof INK | typeof FILL | typeof GREY

export const STILL = 0.92

export interface Grid {
  cols: number
  rows: number
  /** cols / rows: multiply a horizontal distance in u by this to compare it with one in v. */
  aspect: number
}

/** The canvas in CSS pixels. */
export interface Box {
  w: number
  h: number
}

export interface Colors {
  ink: string
  grey: string
  fill: string
  paper: string
}

export interface Painter {
  /** Called when the grid changes size, before the first cell. */
  prepare?(g: Grid): void
  cell(x: number, y: number, t: number, g: Grid): Tone
  type?(ctx: CanvasRenderingContext2D, t: number, box: Box, c: Colors): void
}

/* ── helpers ─────────────────────────────────────────────────────────── */

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const dither = (d: number, x: number, y: number): Tone => (d > (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 ? INK : PAPER)

/** A stable value in [0, 1) for a cell. */
export function hash(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
/** 0 before a, 1 after b, linear between. */
const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
const smooth = (p: number) => p * p * (3 - 2 * p)
const uOf = (x: number, g: Grid) => (x + 0.5) / g.cols
const vOf = (y: number, g: Grid) => (y + 0.5) / g.rows

const SANS = "'Archivo', ui-sans-serif, system-ui, sans-serif"
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace"

/**
 * Cells that a stroke covers, with the stroke position (0 to 1) at which each one is first
 * covered. `at(s)` gives a point in u, v; `radius` is in rows.
 */
function strokeCover(g: Grid, at: (s: number) => [number, number], radius: number, samples: number): Float32Array {
  const cover = new Float32Array(g.cols * g.rows).fill(2)
  const r = Math.max(0.6, radius * g.rows)
  const reach = Math.ceil(r)
  for (let i = 0; i <= samples; i++) {
    const s = i / samples
    const [u, v] = at(s)
    const cx = u * g.cols - 0.5
    const cy = v * g.rows - 0.5
    for (let y = Math.floor(cy - reach); y <= Math.ceil(cy + reach); y++) {
      if (y < 0 || y >= g.rows) continue
      for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x++) {
        if (x < 0 || x >= g.cols) continue
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue
        const k = y * g.cols + x
        if (s < cover[k]) cover[k] = s
      }
    }
  }
  return cover
}

/** Speech-like bar heights: bursts for words, quiet between them. */
function voice(u: number, b: number, words: number): number {
  const w = u * words
  const inWord = Math.abs(Math.sin(Math.PI * w))
  const env = 0.12 + 0.88 * Math.pow(inWord, 0.6)
  return clamp01(env * (0.3 + 0.7 * hash(b, 17)))
}

/** Bars of two cells with a one-cell gap; returns the bar index or -1 in a gap. */
const barAt = (x: number) => (x % 3 === 2 ? -1 : Math.floor(x / 3))

/* ── remove background ───────────────────────────────────────────────── */

const background: Painter = {
  cell(x, y, t, g) {
    const u = uOf(x, g)
    const v = vOf(y, g)
    const subject = portraitSubject(u, v, g.aspect)
    const scan = -0.04 + 1.1 * smooth(ramp(t, 0.14, 0.6))
    if (subject >= 0) return dither(subject, x, y)
    if (u < scan) {
      // A one-cell outline around the cut-out, once the scan is past.
      if (t > 0.66 && touchesSubject(x, y, g)) return INK
      return ((x >> 2) + (y >> 2)) & 1 ? FILL : PAPER
    }
    if (Math.abs(u - scan) < 0.6 / g.cols) return GREY
    return dither(room(u, v), x, y)
  },
}

/** Darkness of the person at (u, v), or -1 outside them. */
function portraitSubject(u: number, v: number, a: number): number {
  const dx = (u - 0.5) * a
  const dy = v - 0.37
  const nx = dx / 0.12
  const ny = dy / 0.155
  const hair = (dx / 0.132) ** 2 + ((dy + 0.008) / 0.168) ** 2 < 1 && (dy < -0.07 || (Math.abs(dx) > 0.1 && dy < 0.03))
  if (hair) return 0.96
  if (nx * nx + ny * ny < 1) {
    if (Math.abs(Math.abs(dx) - 0.043) < 0.013 && Math.abs(dy + 0.004) < 0.011) return 1
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
    const lit = clamp01(-0.55 * nx - 0.3 * ny + 0.78 * nz)
    return 0.8 - 0.55 * lit
  }
  if (Math.abs(dx) < 0.05 && v > 0.48 && v < 0.62) return 0.88
  const sx = dx / 0.35
  const sy = (v - 0.99) / 0.37
  if (sx * sx + sy * sy < 1) {
    // A V-neck and shading toward the sides.
    if (v < 0.7 && Math.abs(dx) < (0.7 - v) * 0.9) return 0.45
    return clamp01(0.64 + 0.32 * sx * sx + (v - 0.7) * 0.25)
  }
  return -1
}

function touchesSubject(x: number, y: number, g: Grid): boolean {
  for (const [ox, oy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    if (portraitSubject(uOf(x + ox, g), vOf(y + oy, g), g.aspect) >= 0) return true
  }
  return false
}

/** The room behind the person: a soft gradient, a window and a lamp. */
function room(u: number, v: number): number {
  let d = 0.03 + 0.11 * (1 - u) + 0.06 * v
  if (u > 0.7 && u < 0.93 && v > 0.1 && v < 0.56) {
    const bar = Math.abs(u - 0.815) < 0.008 || Math.abs(v - 0.33) < 0.012
    const frame = u < 0.712 || u > 0.918 || v < 0.115 || v > 0.545
    d = bar || frame ? 0.5 : 0
  }
  if (Math.abs(u - 0.17) < 0.006 && v > 0.3 && v < 0.9) d = 0.92
  if (v > 0.2 && v < 0.31 && Math.abs(u - 0.17) < 0.03 + (v - 0.2) * 0.45) d = 0.78
  if (v > 0.9 && Math.abs(u - 0.17) < 0.05) d = 0.9
  return d
}

/* ── transcribe audio ────────────────────────────────────────────────── */

const LINES: [string, string][] = [
  ['0:00', 'Thanks for calling about the quote.'],
  ['0:04', 'We can ship twelve units on Friday.'],
  ['0:08', 'I will send the contract today.'],
]
const playhead = (t: number) => ramp(t, 0.1, 0.8)

const transcribe: Painter = {
  cell(x, y, t, g) {
    const u = uOf(x, g)
    const v = vOf(y, g)
    const p = playhead(t)
    if (Math.abs(u - p) < 0.55 / g.cols && Math.abs(v - 0.27) < 0.2) return INK
    const b = barAt(x)
    if (b < 0) return PAPER
    const amp = 0.035 + 0.15 * voice(u, b, 9)
    if (Math.abs(v - 0.27) > amp) return PAPER
    return u <= p ? INK : GREY
  },
  type(ctx, t, box, c) {
    const p = playhead(t)
    const size = Math.max(13, Math.min(19, box.w / 29))
    const left = box.w * 0.06
    const stamp = size * 2.9
    LINES.forEach(([time, text], j) => {
      const y = box.h * 0.6 + j * size * 1.8
      const words = text.split(' ')
      const first = j / LINES.length + 0.5 / LINES.length / words.length
      ctx.globalAlpha = ramp(p, first - 0.02, first)
      ctx.fillStyle = c.grey
      ctx.font = `500 ${size * 0.82}px ${MONO}`
      ctx.fillText(time, left, y)
      ctx.font = `520 ${size}px ${SANS}`
      ctx.fillStyle = c.ink
      let x = left + stamp
      const space = ctx.measureText(' ').width
      words.forEach((word, k) => {
        const at = j / LINES.length + (k + 0.5) / words.length / LINES.length
        const a = ramp(p, at - 0.015, at + 0.01)
        if (a > 0) {
          ctx.globalAlpha = a
          ctx.fillText(word, x, y + (1 - a) * 3)
        }
        x += ctx.measureText(word).width + space
      })
    })
    ctx.globalAlpha = 1
  },
}

/* ── upscale ─────────────────────────────────────────────────────────── */

/** Darkness of a lake landscape with a sun. */
function landscape(u: number, v: number, a: number): number {
  if (v > 0.8) {
    const d = landscape(u, 1.6 - v, a) * 0.6
    return Math.floor(v * 140) % 3 === 0 ? d * 0.35 : d
  }
  let d = 0.42 - 0.38 * Math.min(1, v / 0.6)
  const sun = Math.hypot((u - 0.7) * a, v - 0.3)
  if (sun < 0.085) d = 0
  else if (sun < 0.115) d *= 0.4
  const ridge = 0.5 + 0.05 * Math.sin(u * 8.5 + 1) + 0.025 * Math.sin(u * 21 + 3)
  if (v > ridge) d = 0.5 + 0.5 * (v - ridge)
  const near = 0.63 + 0.06 * Math.sin(u * 5.3 + 2.2) + 0.02 * Math.sin(u * 29)
  if (v > near) d = 0.86 + 0.5 * (v - near)
  return d
}

const upscan = (t: number) => -0.05 + 1.12 * smooth(ramp(t, 0.14, 0.66))

const upscale: Painter = {
  cell(x, y, t, g) {
    const u = uOf(x, g)
    const v = vOf(y, g)
    const s = (u * g.aspect + v) / (g.aspect + 1)
    const scan = upscan(t)
    if (Math.abs(s - scan) < 0.006) return GREY
    if (s < scan) return dither(landscape(u, v, g.aspect), x, y)
    // An odd block has a centre cell, so the squares go 1, 3, 5 cells wide.
    const block = Math.max(3, Math.round(g.cols / 17) | 1)
    const bx = Math.floor(x / block)
    const by = Math.floor(y / block)
    // Low resolution: one halftone square per block, its size set by the block's darkness.
    const d = landscape((bx * block + block / 2) / g.cols, (by * block + block / 2) / g.rows, g.aspect)
    const half = (block / 2) * Math.sqrt(clamp01(d))
    const cx = bx * block + (block - 1) / 2
    const cy = by * block + (block - 1) / 2
    return Math.max(Math.abs(x - cx), Math.abs(y - cy)) < half ? INK : PAPER
  },
  type(ctx, t, box, c) {
    const done = upscan(t) > 1
    const size = Math.max(11, Math.min(14, box.w / 40))
    ctx.font = `600 ${size}px ${MONO}`
    const label = done ? '2560 × 1708' : '640 × 427'
    const pad = size * 0.5
    const w = ctx.measureText(label).width + pad * 2
    const h = size + pad * 1.6
    const x = box.w * 0.04
    const y = box.h - h - box.h * 0.04
    ctx.fillStyle = c.paper
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = c.ink
    ctx.fillText(label, x + pad, y + h - pad * 1.1)
  },
}

/* ── erase an object ─────────────────────────────────────────────────── */

const PERSON_U = 0.64
const brushAt = (a: number) => (s: number): [number, number] => [PERSON_U + (0.075 * Math.sin(s * Math.PI * 8)) / a, 0.33 + 0.5 * s]
const BRUSH = 0.06
let eraseCover: Float32Array = new Float32Array(0)

const erase: Painter = {
  prepare(g) {
    eraseCover = strokeCover(g, brushAt(g.aspect), BRUSH, 400)
  },
  cell(x, y, t, g) {
    const u = uOf(x, g)
    const v = vOf(y, g)
    const painted = ramp(t, 0.1, 0.5)
    const masked = eraseCover[y * g.cols + x] <= painted
    if (t >= 0.55 && (masked || t >= 0.75)) {
      if (t >= 0.75 || hash(x, y) < ramp(t, 0.55, 0.75)) return dither(beach(u, v, x, y, g.aspect), x, y)
      return GREY
    }
    if (painted > 0 && painted < 1) {
      const [bu, bv] = brushAt(g.aspect)(painted)
      const r = Math.hypot((u - bu) * g.aspect, v - bv)
      if (Math.abs(r - BRUSH) < 0.7 / g.rows) return INK
    }
    if (masked) return GREY
    const person = personDark(u, v, g.aspect)
    return dither(person >= 0 ? person : beach(u, v, x, y, g.aspect), x, y)
  },
}

function personDark(u: number, v0: number, a: number): number {
  // Drawn at 1.45 times the base size, standing on the sand at v = 0.8.
  const dx = ((u - PERSON_U) * a) / 1.45
  const v = 0.8 + (v0 - 0.8) / 1.45
  if (Math.hypot(dx, v - 0.5) < 0.03) return 1
  if (Math.abs(dx) < 0.027 && v > 0.53 && v < 0.67) return 1
  if (Math.abs(Math.abs(dx) - 0.036) < 0.007 && v > 0.54 && v < 0.63) return 1
  if (Math.abs(Math.abs(dx) - 0.012) < 0.008 && v >= 0.67 && v < 0.78) return 1
  if (((dx - 0.02) / 0.06) ** 2 + ((v - 0.785) / 0.009) ** 2 < 1) return 0.6
  return -1
}

function beach(u: number, v: number, x: number, y: number, a: number): number {
  // Palm: a curved trunk and five leaves.
  const trunk = 0.1 + 0.07 * (0.86 - v) ** 2 * 2
  if (v > 0.27 && v < 0.86 && Math.abs((u - trunk) * a) < 0.011) return 0.95
  const tx = 0.1 + 0.07 * 0.59 ** 2 * 2
  for (const angle of [-2.7, -2.1, -1.2, -0.4, 0.3]) {
    const cx = tx + (Math.cos(angle) * 0.07) / a
    const cy = 0.27 + Math.sin(angle) * 0.05 + 0.02
    const ex = (u - cx) * a
    const ey = v - cy
    const r1 = ex * Math.cos(angle) + ey * Math.sin(angle)
    const r2 = -ex * Math.sin(angle) + ey * Math.cos(angle)
    if ((r1 / 0.075) ** 2 + (r2 / 0.014) ** 2 < 1) return 0.95
  }
  if (v < 0.46) {
    if (Math.hypot((u - 0.82) * a, v - 0.18) < 0.055) return 0
    return 0.32 - 0.26 * (v / 0.46)
  }
  if (v < 0.475) return 0.85
  const shore = 0.665 + 0.008 * Math.sin(u * 30)
  if (v < shore) return 0.5 + 0.2 * Math.sin(u * 60 + v * 160)
  if (v < shore + 0.012) return 0.04
  return 0.12 + 0.18 * (hash(x, y) - 0.5) + 0.12 * (v - shore)
}

/* ── text to speech ──────────────────────────────────────────────────── */

const SPOKEN = 'Your train leaves at 6:40 from platform 4. Bring the ticket and a photo ID.'.split(' ')
const spoken = (t: number) => ramp(t, 0.1, 0.8)
/** Centre line of the voice under the text. */
const WAVE_V = 0.7

const speech: Painter = {
  cell(x, y, t, g) {
    const u = uOf(x, g)
    const v = vOf(y, g)
    const gen = 0.06 + 0.88 * spoken(t)
    const track = u > 0.06 && u < 0.94
    if (!track) return PAPER
    if (u > gen) return Math.abs(v - WAVE_V) < 0.5 / g.rows ? FILL : PAPER
    const b = barAt(x)
    if (b < 0) return PAPER
    const amp = 0.012 + 0.11 * voice((u - 0.06) / 0.88, b, SPOKEN.length)
    return Math.abs(v - WAVE_V) <= amp ? INK : PAPER
  },
  type(ctx, t, box, c) {
    const size = Math.max(16, Math.min(28, box.w / 19))
    ctx.font = `600 ${size}px ${SANS}`
    const left = box.w * 0.06
    const right = box.w * 0.94
    const lead = size * 1.32
    const space = ctx.measureText(' ').width
    const now = spoken(t) * SPOKEN.length
    let x = left
    let y = box.h * 0.12 + size
    SPOKEN.forEach((word, i) => {
      const w = ctx.measureText(word).width
      if (x + w > right) {
        x = left
        y += lead
      }
      const current = i === Math.floor(now) && now < SPOKEN.length
      if (current) {
        ctx.fillStyle = c.ink
        ctx.fillRect(x - size * 0.14, y - size * 0.86, w + size * 0.28, size * 1.12)
        ctx.fillStyle = c.paper
      } else {
        ctx.fillStyle = i < now ? c.ink : c.grey
      }
      ctx.fillText(word, x, y)
      x += w + space
    })
  },
}

/* ── sign a PDF ──────────────────────────────────────────────────────── */

/** Word spans of the page's text lines, in u. */
const PAGE_LINES: [number, number][][] = Array.from({ length: 8 }, (_, k) => {
  const spans: [number, number][] = []
  const end = k === 7 ? 0.52 : 0.81
  let u = 0.19
  let n = 0
  while (u < end) {
    const len = 0.03 + 0.07 * hash(k, n++)
    spans.push([u, Math.min(end, u + len)])
    u += len + 0.018
  }
  return spans
})

const signAt = (s: number): [number, number] => [
  0.53 + 0.29 * s + 0.03 * Math.cos(2 * Math.PI * 3.5 * s),
  0.77 - 0.075 * Math.sin(2 * Math.PI * 3.5 * s) * (0.35 + 0.65 * Math.sin(Math.PI * s)) - 0.03 * s,
]
let signCover: Float32Array = new Float32Array(0)
const signed = (t: number) => ramp(t, 0.14, 0.6)

const sign: Painter = {
  prepare(g) {
    signCover = strokeCover(g, signAt, 0.85 / g.rows, 1200)
  },
  cell(x, y, t, g) {
    const u = uOf(x, g)
    const v = vOf(y, g)
    if (u < 0.13 || u > 0.87 || v < 0.06) return PAPER
    if (signCover[y * g.cols + x] <= signed(t)) return INK
    const row = 0.5 / g.rows
    if (Math.abs(v - 0.13) < row * 2 && u > 0.19 && u < 0.5) return INK
    for (let k = 0; k < PAGE_LINES.length; k++) {
      if (Math.abs(v - (0.22 + k * 0.05)) < row) {
        return PAGE_LINES[k].some(([a, b]) => u >= a && u <= b) ? INK : FILL
      }
    }
    if (Math.abs(v - 0.87) < row && ((u > 0.52 && u < 0.83) || (u > 0.19 && u < 0.4))) return INK
    if (Math.abs(v - 0.92) < row && ((u > 0.52 && u < 0.6) || (u > 0.19 && u < 0.24))) return GREY
    return FILL
  },
  type(ctx, t, box, c) {
    const a = ramp(t, 0.62, 0.7)
    if (a <= 0) return
    const size = Math.max(12, Math.min(18, box.w / 30))
    ctx.globalAlpha = a
    ctx.fillStyle = c.ink
    ctx.font = `560 ${size}px ${SANS}`
    ctx.fillText('7 Nov 2026', box.w * 0.19, box.h * 0.87 - size * 0.5 + (1 - a) * 3)
    ctx.globalAlpha = 1
  },
}

/* ── compress a video ────────────────────────────────────────────────── */

const squeezed = (t: number) => smooth(ramp(t, 0.1, 0.76))
const FROM_MB = 1240
const TO_MB = 96

const compress: Painter = {
  cell(x, y, t, g) {
    const u = uOf(x, g)
    const v = vOf(y, g)
    if (v > 0.08 && v < 0.62) {
      // Film strip: sprocket holes along both edges, frames of a sunset between them.
      if (v < 0.14 || v > 0.56) {
        const hole = x % 5 < 2 && Math.abs(v - (v < 0.3 ? 0.11 : 0.59)) < 0.014
        return hole ? PAPER : INK
      }
      const period = 0.34
      const f = (u + t * 0.42) / period
      const n = Math.floor(f)
      const local = f - n
      if (local < 0.07) return INK
      const fu = (local - 0.07) / 0.93
      const fv = (v - 0.14) / 0.42
      const wide = (period * 0.93 * g.aspect) / 0.42
      // Peaks, and a sun that sets a little more in each frame.
      const k = ((n % 5) + 5) % 5
      if (fv > 0.6 + 0.5 * Math.abs(((fu * 2.2 + 0.3) % 1) - 0.5)) return INK
      if (Math.hypot((fu - 0.3 - 0.08 * k) * wide, fv - (0.22 + 0.07 * k)) < 0.1) return INK
      return PAPER
    }
    if (Math.abs(v - 0.9) < 1 / g.rows && u > 0.06 && u < 0.94) {
      return (u - 0.06) / 0.88 <= squeezed(t) ? INK : FILL
    }
    return PAPER
  },
  type(ctx, t, box, c) {
    const p = squeezed(t)
    const mb = Math.round(FROM_MB - (FROM_MB - TO_MB) * p)
    const big = Math.max(26, Math.min(48, box.w / 11))
    const left = box.w * 0.06
    ctx.fillStyle = c.ink
    ctx.font = `720 ${big}px ${SANS}`
    const label = `${mb.toLocaleString('en-US')} MB`
    ctx.fillText(label, left, box.h * 0.79)
    if (p >= 1) {
      ctx.font = `500 ${big * 0.36}px ${SANS}`
      ctx.fillStyle = c.grey
      ctx.fillText(`from ${FROM_MB.toLocaleString('en-US')} MB`, left + ctx.measureText(' ').width + measure(ctx, label, `720 ${big}px ${SANS}`), box.h * 0.79)
    }
  },
}

function measure(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  const before = ctx.font
  ctx.font = font
  const w = ctx.measureText(text).width
  ctx.font = before
  return w
}

export const PAINTERS: Record<SceneId, Painter> = {
  background,
  transcribe,
  upscale,
  erase,
  speech,
  sign,
  compress,
}
