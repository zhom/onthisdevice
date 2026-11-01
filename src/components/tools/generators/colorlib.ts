/**
 * Colour maths shared by the generator tools.
 *
 * Everything is plain sRGB with an optional alpha channel. Conversions follow
 * the CSS Color 4 definitions so the values match what a browser computes.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Rgba extends Rgb {
  a: number
}

export interface Hsl {
  h: number
  s: number
  l: number
}

const HEX3 = /^#?([\da-f])([\da-f])([\da-f])$/i
const HEX4 = /^#?([\da-f])([\da-f])([\da-f])([\da-f])$/i
const HEX6 = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i
const HEX8 = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i
const RGB_FN = /^rgba?\(([^)]+)\)$/i
const HSL_FN = /^hsla?\(([^)]+)\)$/i

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  maroon: '#800000',
  olive: '#808000',
  lime: '#00ff00',
  aqua: '#00ffff',
  teal: '#008080',
  navy: '#000080',
  fuchsia: '#ff00ff',
  purple: '#800080',
  orange: '#ffa500',
  pink: '#ffc0cb',
  transparent: '#00000000',
}

function clamp255(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)))
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/** Split the inside of an rgb()/hsl() function on commas or whitespace + slash. */
function splitArgs(body: string): string[] {
  return body
    .replace(/\//g, ' / ')
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== '/')
}

function numberOrPercent(token: string | undefined, scale: number): number | null {
  if (token === undefined) return null
  const trimmed = token.trim()
  if (trimmed.endsWith('%')) {
    const value = Number.parseFloat(trimmed.slice(0, -1))
    return Number.isFinite(value) ? (value / 100) * scale : null
  }
  const value = Number.parseFloat(trimmed)
  return Number.isFinite(value) ? value : null
}

/** Parse `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()`, `hsla()` and a few names. */
export function parseColor(input: string): Rgba | null {
  const raw = input.trim()
  if (raw.length === 0) return null
  const lower = raw.toLowerCase()
  const named = NAMED[lower]
  const value = named ?? raw

  const m8 = HEX8.exec(value)
  if (m8) {
    return {
      r: Number.parseInt(m8[1], 16),
      g: Number.parseInt(m8[2], 16),
      b: Number.parseInt(m8[3], 16),
      a: Number.parseInt(m8[4], 16) / 255,
    }
  }
  const m6 = HEX6.exec(value)
  if (m6) {
    return {
      r: Number.parseInt(m6[1], 16),
      g: Number.parseInt(m6[2], 16),
      b: Number.parseInt(m6[3], 16),
      a: 1,
    }
  }
  const m4 = HEX4.exec(value)
  if (m4) {
    return {
      r: Number.parseInt(m4[1] + m4[1], 16),
      g: Number.parseInt(m4[2] + m4[2], 16),
      b: Number.parseInt(m4[3] + m4[3], 16),
      a: Number.parseInt(m4[4] + m4[4], 16) / 255,
    }
  }
  const m3 = HEX3.exec(value)
  if (m3) {
    return {
      r: Number.parseInt(m3[1] + m3[1], 16),
      g: Number.parseInt(m3[2] + m3[2], 16),
      b: Number.parseInt(m3[3] + m3[3], 16),
      a: 1,
    }
  }

  const rgbFn = RGB_FN.exec(value)
  if (rgbFn) {
    const parts = splitArgs(rgbFn[1])
    const r = numberOrPercent(parts[0], 255)
    const g = numberOrPercent(parts[1], 255)
    const b = numberOrPercent(parts[2], 255)
    if (r === null || g === null || b === null) return null
    const a = parts.length > 3 ? numberOrPercent(parts[3], 1) : 1
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b), a: clamp01(a ?? 1) }
  }

  const hslFn = HSL_FN.exec(value)
  if (hslFn) {
    const parts = splitArgs(hslFn[1])
    const h = numberOrPercent(parts[0], 360)
    const s = numberOrPercent(parts[1], 100)
    const l = numberOrPercent(parts[2], 100)
    if (h === null || s === null || l === null) return null
    const a = parts.length > 3 ? numberOrPercent(parts[3], 1) : 1
    const rgb = hslToRgb({ h, s, l })
    return { ...rgb, a: clamp01(a ?? 1) }
  }

  return null
}

export function toHex({ r, g, b }: Rgb): string {
  const hex = (n: number) => clamp255(n).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

export function toHexAlpha({ r, g, b, a }: Rgba): string {
  const hex = (n: number) => clamp255(n).toString(16).padStart(2, '0')
  const alpha = clamp255(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}${alpha}`
}

export function toRgbString({ r, g, b, a }: Rgba): string {
  if (a >= 1) return `rgb(${clamp255(r)}, ${clamp255(g)}, ${clamp255(b)})`
  return `rgba(${clamp255(r)}, ${clamp255(g)}, ${clamp255(b)}, ${round(a, 3)})`
}

export function toHslString(rgb: Rgba): string {
  const { h, s, l } = rgbToHsl(rgb)
  if (rgb.a >= 1) return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`
  return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${round(rgb.a, 3)})`
}

function round(n: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(n * factor) / factor
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  const l = (max + min) / 2

  let h = 0
  let s = 0
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: s * 100, l: l * 100 }
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp01(s / 100)
  const lig = clamp01(l / 100)
  const c = (1 - Math.abs(2 * lig - 1)) * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lig - c / 2

  let rp = 0
  let gp = 0
  let bp = 0
  if (hue < 60) [rp, gp, bp] = [c, x, 0]
  else if (hue < 120) [rp, gp, bp] = [x, c, 0]
  else if (hue < 180) [rp, gp, bp] = [0, c, x]
  else if (hue < 240) [rp, gp, bp] = [0, x, c]
  else if (hue < 300) [rp, gp, bp] = [x, 0, c]
  else [rp, gp, bp] = [c, 0, x]

  return { r: clamp255((rp + m) * 255), g: clamp255((gp + m) * 255), b: clamp255((bp + m) * 255) }
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two opaque colours, 1…21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Flatten a translucent colour over an opaque background. */
export function composite(fg: Rgba, bg: Rgb): Rgb {
  const a = clamp01(fg.a)
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  }
}

/** Linear blend between two colours; `amount` 0 returns `a`, 1 returns `b`. */
export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = clamp01(amount)
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  }
}

export const WHITE: Rgb = { r: 255, g: 255, b: 255 }
export const BLACK: Rgb = { r: 0, g: 0, b: 0 }

/** Pick black or white text for maximum contrast against `bg`. */
export function readableTextOn(bg: Rgb): string {
  return contrastRatio(bg, WHITE) >= contrastRatio(bg, BLACK) ? '#ffffff' : '#000000'
}

/** Grade a contrast ratio against the WCAG 2.1 thresholds. */
export function wcagGrade(ratio: number): 'AAA' | 'AA' | 'AA Large' | 'Fail' {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA Large'
  return 'Fail'
}

/** A deterministic-looking but cryptographically random hex colour. */
export function randomHex(): string {
  const bytes = new Uint8Array(3)
  crypto.getRandomValues(bytes)
  return toHex({ r: bytes[0], g: bytes[1], b: bytes[2] })
}
