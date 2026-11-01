/** Colour space maths for the colour converter. All pure functions. */

export interface Rgba {
  /** 0-255 */
  r: number
  /** 0-255 */
  g: number
  /** 0-255 */
  b: number
  /** 0-1 */
  a: number
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const clamp255 = (n: number) => Math.min(255, Math.max(0, n))

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

function numbersIn(body: string): { values: number[]; percents: boolean[]; alpha: number | null } {
  const [main, alphaPart] = body.split('/')
  const tokens = main
    .replace(/,/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const values: number[] = []
  const percents: boolean[] = []
  for (const token of tokens) {
    const isPercent = token.endsWith('%')
    const n = Number.parseFloat(isPercent ? token.slice(0, -1) : token)
    if (Number.isNaN(n)) return { values: [], percents: [], alpha: null }
    values.push(n)
    percents.push(isPercent)
  }
  let alpha: number | null = null
  if (alphaPart !== undefined) {
    const raw = alphaPart.trim()
    const isPercent = raw.endsWith('%')
    const n = Number.parseFloat(isPercent ? raw.slice(0, -1) : raw)
    if (!Number.isNaN(n)) alpha = clamp01(isPercent ? n / 100 : n)
  }
  return { values, percents, alpha }
}

/** Resolve a CSS colour keyword (or anything else CSS understands) via a canvas. */
function resolveViaCanvas(input: string): Rgba | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  // fillStyle silently ignores values it cannot parse, so probe with two
  // different sentinels: a real colour resolves to the same string from both.
  ctx.fillStyle = '#000000'
  ctx.fillStyle = input
  const first = ctx.fillStyle
  ctx.fillStyle = '#ffffff'
  ctx.fillStyle = input
  if (first !== ctx.fillStyle) return null

  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = input
  ctx.fillRect(0, 0, 1, 1)
  const data = ctx.getImageData(0, 0, 1, 1).data
  return { r: data[0], g: data[1], b: data[2], a: Math.round((data[3] / 255) * 1000) / 1000 }
}

export function parseColor(input: string): Rgba | null {
  const raw = input.trim()
  if (!raw) return null

  // #rgb / #rgba / #rrggbb / #rrggbbaa
  const hex = /^#?([0-9a-f]{3,8})$/i.exec(raw)
  if (hex && [3, 4, 6, 8].includes(hex[1].length)) {
    const h = hex[1]
    const expand = (s: string) => Number.parseInt(s.length === 1 ? s + s : s, 16)
    if (h.length === 3 || h.length === 4) {
      return {
        r: expand(h[0]),
        g: expand(h[1]),
        b: expand(h[2]),
        a: h.length === 4 ? Math.round((expand(h[3]) / 255) * 1000) / 1000 : 1,
      }
    }
    return {
      r: expand(h.slice(0, 2)),
      g: expand(h.slice(2, 4)),
      b: expand(h.slice(4, 6)),
      a: h.length === 8 ? Math.round((expand(h.slice(6, 8)) / 255) * 1000) / 1000 : 1,
    }
  }

  const fn = /^([a-z]+)\s*\(([^)]*)\)$/i.exec(raw)
  if (fn) {
    const name = fn[1].toLowerCase()
    const { values, percents, alpha } = numbersIn(fn[2])

    if ((name === 'rgb' || name === 'rgba') && values.length >= 3) {
      const channel = (i: number) => clamp255(percents[i] ? (values[i] / 100) * 255 : values[i])
      return {
        r: Math.round(channel(0)),
        g: Math.round(channel(1)),
        b: Math.round(channel(2)),
        a: alpha ?? (values.length > 3 ? clamp01(percents[3] ? values[3] / 100 : values[3]) : 1),
      }
    }

    if ((name === 'hsl' || name === 'hsla') && values.length >= 3) {
      const rgb = hslToRgb(values[0], values[1] / 100, values[2] / 100)
      return {
        ...rgb,
        a: alpha ?? (values.length > 3 ? clamp01(percents[3] ? values[3] / 100 : values[3]) : 1),
      }
    }

    if ((name === 'hsv' || name === 'hsb') && values.length >= 3) {
      const rgb = hsvToRgb(values[0], values[1] / 100, values[2] / 100)
      return {
        ...rgb,
        a: alpha ?? (values.length > 3 ? clamp01(percents[3] ? values[3] / 100 : values[3]) : 1),
      }
    }

    if (name === 'cmyk' && values.length >= 4) {
      const rgb = cmykToRgb(values[0] / 100, values[1] / 100, values[2] / 100, values[3] / 100)
      return { ...rgb, a: alpha ?? 1 }
    }

    if (name === 'oklch' && values.length >= 3) {
      const l = percents[0] ? values[0] / 100 : values[0]
      const rgb = oklchToRgb(l, values[1], values[2])
      return {
        ...rgb,
        a: alpha ?? (values.length > 3 ? clamp01(percents[3] ? values[3] / 100 : values[3]) : 1),
      }
    }
  }

  return resolveViaCanvas(raw)
}

/* ------------------------------------------------------------------ */
/* HSL / HSV / CMYK                                                    */
/* ------------------------------------------------------------------ */

export function rgbToHsl(c: Rgba): { h: number; s: number; l: number } {
  const r = c.r / 255
  const g = c.g / 255
  const b = c.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360
  return { h, s, l }
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp01(s)
  const lum = clamp01(l)
  const c = (1 - Math.abs(2 * lum - 1)) * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lum - c / 2
  let rp = 0
  let gp = 0
  let bp = 0
  if (hue < 60) [rp, gp, bp] = [c, x, 0]
  else if (hue < 120) [rp, gp, bp] = [x, c, 0]
  else if (hue < 180) [rp, gp, bp] = [0, c, x]
  else if (hue < 240) [rp, gp, bp] = [0, x, c]
  else if (hue < 300) [rp, gp, bp] = [x, 0, c]
  else [rp, gp, bp] = [c, 0, x]
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  }
}

export function rgbToHsv(c: Rgba): { h: number; s: number; v: number } {
  const r = c.r / 255
  const g = c.g / 255
  const b = c.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp01(s)
  const val = clamp01(v)
  const c = val * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = val - c
  let rp = 0
  let gp = 0
  let bp = 0
  if (hue < 60) [rp, gp, bp] = [c, x, 0]
  else if (hue < 120) [rp, gp, bp] = [x, c, 0]
  else if (hue < 180) [rp, gp, bp] = [0, c, x]
  else if (hue < 240) [rp, gp, bp] = [0, x, c]
  else if (hue < 300) [rp, gp, bp] = [x, 0, c]
  else [rp, gp, bp] = [c, 0, x]
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  }
}

export function rgbToCmyk(c: Rgba): { c: number; m: number; y: number; k: number } {
  const r = c.r / 255
  const g = c.g / 255
  const b = c.b / 255
  const k = 1 - Math.max(r, g, b)
  if (k === 1) return { c: 0, m: 0, y: 0, k: 1 }
  return {
    c: (1 - r - k) / (1 - k),
    m: (1 - g - k) / (1 - k),
    y: (1 - b - k) / (1 - k),
    k,
  }
}

export function cmykToRgb(c: number, m: number, y: number, k: number): { r: number; g: number; b: number } {
  return {
    r: Math.round(255 * (1 - clamp01(c)) * (1 - clamp01(k))),
    g: Math.round(255 * (1 - clamp01(m)) * (1 - clamp01(k))),
    b: Math.round(255 * (1 - clamp01(y)) * (1 - clamp01(k))),
  }
}

/* ------------------------------------------------------------------ */
/* OKLCH — Björn Ottosson's Oklab, the space CSS Color 4 adopted        */
/* ------------------------------------------------------------------ */

function srgbToLinear(v: number): number {
  const x = v / 255
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(v: number): number {
  const x = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
  return clamp255(Math.round(x * 255))
}

export function rgbToOklch(color: Rgba): { l: number; c: number; h: number } {
  const r = srgbToLinear(color.r)
  const g = srgbToLinear(color.g)
  const b = srgbToLinear(color.b)

  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

  const c = Math.sqrt(A * A + B * B)
  let h = (Math.atan2(B, A) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: L, c, h: c < 1e-6 ? 0 : h }
}

export function oklchToRgb(l: number, c: number, h: number): { r: number; g: number; b: number } {
  const hr = (h * Math.PI) / 180
  const A = c * Math.cos(hr)
  const B = c * Math.sin(hr)

  const l_ = l + 0.3963377774 * A + 0.2158037573 * B
  const m_ = l - 0.1055613458 * A - 0.0638541728 * B
  const s_ = l - 0.0894841775 * A - 1.291485548 * B

  const L = l_ ** 3
  const M = m_ ** 3
  const S = s_ ** 3

  return {
    r: linearToSrgb(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S),
    g: linearToSrgb(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S),
    b: linearToSrgb(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S),
  }
}

/* ------------------------------------------------------------------ */
/* Contrast                                                            */
/* ------------------------------------------------------------------ */

export function relativeLuminance(color: Rgba): number {
  const r = srgbToLinear(color.r)
  const g = srgbToLinear(color.g)
  const b = srgbToLinear(color.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Flatten a translucent colour onto an opaque backdrop. */
export function composite(fg: Rgba, bg: Rgba): Rgba {
  if (fg.a >= 1) return fg
  return {
    r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
    g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
    b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
    a: 1,
  }
}

export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

export function mix(a: Rgba, b: Rgba, t: number): Rgba {
  const k = clamp01(t)
  return {
    r: Math.round(a.r + (b.r - a.r) * k),
    g: Math.round(a.g + (b.g - a.g) * k),
    b: Math.round(a.b + (b.b - a.b) * k),
    a: a.a + (b.a - a.a) * k,
  }
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const hex2 = (n: number) => Math.round(clamp255(n)).toString(16).padStart(2, '0')
const round = (n: number, places = 2) => {
  const f = 10 ** places
  return Math.round(n * f) / f
}

export function toHex(color: Rgba, includeAlpha = false): string {
  const base = `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`
  return includeAlpha || color.a < 1 ? `${base}${hex2(color.a * 255)}` : base
}

export function toRgbString(color: Rgba): string {
  return color.a < 1
    ? `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${round(color.a, 3)})`
    : `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`
}

export function toHslString(color: Rgba): string {
  const { h, s, l } = rgbToHsl(color)
  const parts = `${round(h, 1)}, ${round(s * 100, 1)}%, ${round(l * 100, 1)}%`
  return color.a < 1 ? `hsla(${parts}, ${round(color.a, 3)})` : `hsl(${parts})`
}

export function toHsvString(color: Rgba): string {
  const { h, s, v } = rgbToHsv(color)
  return `hsv(${round(h, 1)}, ${round(s * 100, 1)}%, ${round(v * 100, 1)}%)`
}

export function toOklchString(color: Rgba): string {
  const { l, c, h } = rgbToOklch(color)
  const parts = `${round(l * 100, 2)}% ${round(c, 4)} ${round(h, 2)}`
  return color.a < 1 ? `oklch(${parts} / ${round(color.a, 3)})` : `oklch(${parts})`
}

export function toCmykString(color: Rgba): string {
  const { c, m, y, k } = rgbToCmyk(color)
  return `cmyk(${round(c * 100, 1)}%, ${round(m * 100, 1)}%, ${round(y * 100, 1)}%, ${round(k * 100, 1)}%)`
}

export { round as roundTo }
