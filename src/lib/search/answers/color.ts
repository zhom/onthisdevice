import type { Answer } from './types'

interface Rgba {
  r: number
  g: number
  b: number
  a: number
}
type Form = 'hex' | 'rgb' | 'hsl'

const TARGET = '(?: (?:to|in|into|as) (hex|rgba?|hsla?))?$'
const HEX = new RegExp(`^(?:#|(hex|hexadecimal|colou?r) (#)?)([0-9a-f]+)${TARGET}`)
const N = '(-?\\d*\\.?\\d+)(%|deg)?'
const SEP = '\\s*[,\\s]\\s*'
const FUNC = new RegExp(`^(rgba?|hsla?)\\s*\\(?\\s*${N}${SEP}${N}${SEP}${N}(?:\\s*[,/\\s]\\s*${N})?\\s*\\)?${TARGET}`)

const round1 = (n: number) => Math.round(n * 10) / 10
const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0')
const alpha = (a: number) => String(Math.round(a * 100) / 100)

function parseHex(h: string): Rgba {
  const full = h.length <= 4 ? h.replace(/./g, '$&$&') : h
  const v = (i: number) => parseInt(full.slice(i, i + 2), 16)
  return { r: v(0), g: v(2), b: v(4), a: full.length === 8 ? v(6) / 255 : 1 }
}

function hslToRgb(h: number, s: number, l: number, a: number): Rgba {
  const k = (n: number) => (n + h / 30) % 12
  const c = s * Math.min(l, 1 - l)
  const f = (n: number) => 255 * (l - c * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))
  return { r: f(0), g: f(8), b: f(4), a }
}

function toHsl({ r, g, b }: Rgba): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  const d = max - min
  if (!d) return [0, 0, l * 100]
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === R ? ((G - B) / d + 6) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return [h * 60, s * 100, l * 100]
}

function format(c: Rgba, form: Form): string {
  const solid = c.a >= 1
  if (form === 'hex') return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${solid ? '' : hex2(c.a * 255)}`
  if (form === 'rgb') {
    const rgb = [c.r, c.g, c.b].map(Math.round).join(', ')
    return solid ? `rgb(${rgb})` : `rgba(${rgb}, ${alpha(c.a)})`
  }
  const [h, s, l] = toHsl(c).map(round1)
  return solid ? `hsl(${h}, ${s}%, ${l}%)` : `hsla(${h}, ${s}%, ${l}%, ${alpha(c.a)})`
}

function parse(s: string): { color: Rgba; from: Form; to: Form | null } | null {
  const hex = HEX.exec(s)
  if (hex) {
    const [, word, hash, h, to] = hex
    const len = h.length
    // After "hex" without "#", take 6 or 8 digits, or 3 with a letter, so "hex 100" stays a number.
    const ok = !word || hash ? [3, 4, 6, 8].includes(len) : len === 6 || len === 8 || (len === 3 && /[a-f]/.test(h))
    return ok ? { color: parseHex(h), from: 'hex', to: to ? (to.slice(0, 3) as Form) : null } : null
  }
  const fn = FUNC.exec(s)
  if (!fn) return null
  const [, name, v1, u1, v2, u2, v3, u3, v4, u4, to] = fn
  const nums = [v1, v2, v3].map(Number)
  const a = v4 === undefined ? 1 : Number(v4) / (u4 === '%' ? 100 : 1)
  if (nums.some(Number.isNaN) || !(a >= 0 && a <= 1)) return null
  const target = to ? (to.slice(0, 3) as Form) : null
  if (name.startsWith('rgb')) {
    const units = [u1, u2, u3]
    if (units.includes('deg')) return null
    const [r, g, b] = nums.map((n, i) => (units[i] === '%' ? n * 2.55 : n))
    if (![r, g, b].every((n) => n >= 0 && n <= 255)) return null
    return { color: { r, g, b, a }, from: 'rgb', to: target }
  }
  const [h, sat, l] = nums
  if (u1 === '%' || sat > 100 || l > 100 || sat < 0 || l < 0) return null
  return { color: hslToRgb(((h % 360) + 360) % 360, sat / 100, l / 100, a), from: 'hsl', to: target }
}

const NAMES: Record<Form, string> = { hex: 'hex', rgb: 'RGB', hsl: 'HSL' }

/** "#ff0000", "#f00", "hex ff0000", "rgb(255, 0, 0)", "rgb 255 0 0", "rgba(255,0,0,0.5)", "hsl(0, 100%, 50%)". */
export function colorAnswer(s: string): Answer | null {
  if (!/^(?:#|hex|col|rgb|hsl)/.test(s)) return null
  const p = parse(s)
  if (!p) return null
  const { color, from } = p
  const to: Form = p.to && p.to !== from ? p.to : from === 'hex' ? 'rgb' : 'hex'
  const forms: Form[] = ['hex', 'rgb', 'hsl']
  const value = format(color, to)
  const slug =
    from === 'hex'
      ? to === 'hsl' ? 'hex-to-hsl' : 'hex-to-rgb-converter'
      : to !== 'hex' ? 'color-converter'
        : from === 'hsl' ? 'hsl-to-hex' : color.a < 1 ? 'rgba-to-hex' : 'rgb-to-hex'
  return {
    kind: 'color',
    value,
    label: `${format(color, from)} in ${NAMES[to]}`,
    copy: value,
    slug,
    more: forms.filter((f) => f !== to).map((f) => format(color, f)),
    swatch: format(color, 'hex'),
  }
}
