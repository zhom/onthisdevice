/**
 * Colour parsing and conversion for the `dev-format` batch's exact-match pair
 * pages (hex↔rgb, hex↔hsl, rgba→hex, hex→cmyk).
 *
 * All maths is done in plain floating point on 0–255 channels; every public
 * formatter rounds only at the very end so a round trip (hex → hsl → hex)
 * returns the byte you started with.
 */

export interface Rgba {
  r: number
  g: number
  b: number
  /** 0–1. */
  a: number
}

export interface Hsla {
  h: number
  s: number
  l: number
  a: number
}

export interface Cmyk {
  c: number
  m: number
  y: number
  k: number
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)
const clamp255 = (n: number): number => (n < 0 ? 0 : n > 255 ? 255 : n)

/* ------------------------------------------------------------------ */
/* Named CSS colours                                                   */
/* ------------------------------------------------------------------ */

export const CSS_COLORS: Record<string, string> = {
  aliceblue: 'f0f8ff', antiquewhite: 'faebd7', aqua: '00ffff', aquamarine: '7fffd4',
  azure: 'f0ffff', beige: 'f5f5dc', bisque: 'ffe4c4', black: '000000',
  blanchedalmond: 'ffebcd', blue: '0000ff', blueviolet: '8a2be2', brown: 'a52a2a',
  burlywood: 'deb887', cadetblue: '5f9ea0', chartreuse: '7fff00', chocolate: 'd2691e',
  coral: 'ff7f50', cornflowerblue: '6495ed', cornsilk: 'fff8dc', crimson: 'dc143c',
  cyan: '00ffff', darkblue: '00008b', darkcyan: '008b8b', darkgoldenrod: 'b8860b',
  darkgray: 'a9a9a9', darkgreen: '006400', darkgrey: 'a9a9a9', darkkhaki: 'bdb76b',
  darkmagenta: '8b008b', darkolivegreen: '556b2f', darkorange: 'ff8c00', darkorchid: '9932cc',
  darkred: '8b0000', darksalmon: 'e9967a', darkseagreen: '8fbc8f', darkslateblue: '483d8b',
  darkslategray: '2f4f4f', darkturquoise: '00ced1', darkviolet: '9400d3', deeppink: 'ff1493',
  deepskyblue: '00bfff', dimgray: '696969', dodgerblue: '1e90ff', firebrick: 'b22222',
  floralwhite: 'fffaf0', forestgreen: '228b22', fuchsia: 'ff00ff', gainsboro: 'dcdcdc',
  ghostwhite: 'f8f8ff', gold: 'ffd700', goldenrod: 'daa520', gray: '808080',
  green: '008000', greenyellow: 'adff2f', grey: '808080', honeydew: 'f0fff0',
  hotpink: 'ff69b4', indianred: 'cd5c5c', indigo: '4b0082', ivory: 'fffff0',
  khaki: 'f0e68c', lavender: 'e6e6fa', lavenderblush: 'fff0f5', lawngreen: '7cfc00',
  lemonchiffon: 'fffacd', lightblue: 'add8e6', lightcoral: 'f08080', lightcyan: 'e0ffff',
  lightgoldenrodyellow: 'fafad2', lightgray: 'd3d3d3', lightgreen: '90ee90', lightpink: 'ffb6c1',
  lightsalmon: 'ffa07a', lightseagreen: '20b2aa', lightskyblue: '87cefa', lightslategray: '778899',
  lightsteelblue: 'b0c4de', lightyellow: 'ffffe0', lime: '00ff00', limegreen: '32cd32',
  linen: 'faf0e6', magenta: 'ff00ff', maroon: '800000', mediumaquamarine: '66cdaa',
  mediumblue: '0000cd', mediumorchid: 'ba55d3', mediumpurple: '9370db', mediumseagreen: '3cb371',
  mediumslateblue: '7b68ee', mediumspringgreen: '00fa9a', mediumturquoise: '48d1cc',
  mediumvioletred: 'c71585', midnightblue: '191970', mintcream: 'f5fffa', mistyrose: 'ffe4e1',
  moccasin: 'ffe4b5', navajowhite: 'ffdead', navy: '000080', oldlace: 'fdf5e6',
  olive: '808000', olivedrab: '6b8e23', orange: 'ffa500', orangered: 'ff4500',
  orchid: 'da70d6', palegoldenrod: 'eee8aa', palegreen: '98fb98', paleturquoise: 'afeeee',
  palevioletred: 'db7093', papayawhip: 'ffefd5', peachpuff: 'ffdab9', peru: 'cd853f',
  pink: 'ffc0cb', plum: 'dda0dd', powderblue: 'b0e0e6', purple: '800080',
  rebeccapurple: '663399', red: 'ff0000', rosybrown: 'bc8f8f', royalblue: '4169e1',
  saddlebrown: '8b4513', salmon: 'fa8072', sandybrown: 'f4a460', seagreen: '2e8b57',
  seashell: 'fff5ee', sienna: 'a0522d', silver: 'c0c0c0', skyblue: '87ceeb',
  slateblue: '6a5acd', slategray: '708090', snow: 'fffafa', springgreen: '00ff7f',
  steelblue: '4682b4', tan: 'd2b48c', teal: '008080', thistle: 'd8bfd8',
  tomato: 'ff6347', turquoise: '40e0d0', violet: 'ee82ee', wheat: 'f5deb3',
  white: 'ffffff', whitesmoke: 'f5f5f5', yellow: 'ffff00', yellowgreen: '9acd32',
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

export type ColorParse =
  | { ok: true; rgba: Rgba; format: string }
  | { ok: false; message: string }

function numbersIn(text: string): number[] {
  const matches = text.match(/-?\d*\.?\d+/g)
  return matches ? matches.map(Number) : []
}

/** Accepts every CSS colour syntax a person is likely to paste, plus bare digits. */
export function parseColor(input: string): ColorParse {
  const raw = input.trim()
  if (raw === '') return { ok: false, message: 'Enter a colour to convert.' }
  const lower = raw.toLowerCase()

  if (lower === 'transparent') {
    return { ok: true, rgba: { r: 0, g: 0, b: 0, a: 0 }, format: 'keyword' }
  }
  if (CSS_COLORS[lower]) {
    return { ok: true, rgba: hexToRgba(CSS_COLORS[lower]), format: 'named colour' }
  }

  // hex, with or without #
  const hex = lower.replace(/^#/, '')
  if (/^[0-9a-f]{3,8}$/.test(hex) && [3, 4, 6, 8].includes(hex.length)) {
    return { ok: true, rgba: hexToRgba(hex), format: `hex (${hex.length} digits)` }
  }
  if (lower.startsWith('#')) {
    return {
      ok: false,
      message: `“${raw}” is not a valid hex colour. A hex colour has 3, 4, 6 or 8 digits after the #, using 0-9 and a-f only.`,
    }
  }

  const fn = /^([a-z]+)\s*\(([^)]*)\)$/.exec(lower)
  if (fn) {
    const [, name, body] = fn
    const hasPercentAlpha = /\/\s*\d+(\.\d+)?%/.test(body) || /,\s*\d+(\.\d+)?%\s*$/.test(body)
    const parts = numbersIn(body)
    if (name === 'rgb' || name === 'rgba') {
      if (parts.length < 3) {
        return { ok: false, message: 'rgb() needs three channel values, e.g. rgb(37, 99, 235).' }
      }
      const percent = /%/.test(body.split(/[,/ ]/).slice(0, 3).join(' '))
      const scale = percent ? 2.55 : 1
      let alpha = parts.length > 3 ? parts[3] : 1
      if (hasPercentAlpha && alpha > 1) alpha /= 100
      return {
        ok: true,
        rgba: {
          r: clamp255(parts[0] * scale),
          g: clamp255(parts[1] * scale),
          b: clamp255(parts[2] * scale),
          a: clamp01(alpha),
        },
        format: name === 'rgba' ? 'rgba()' : 'rgb()',
      }
    }
    if (name === 'hsl' || name === 'hsla') {
      if (parts.length < 3) {
        return { ok: false, message: 'hsl() needs a hue and two percentages, e.g. hsl(221, 83%, 53%).' }
      }
      let alpha = parts.length > 3 ? parts[3] : 1
      if (hasPercentAlpha && alpha > 1) alpha /= 100
      return {
        ok: true,
        rgba: hslToRgba({ h: parts[0], s: parts[1], l: parts[2], a: clamp01(alpha) }),
        format: name === 'hsla' ? 'hsla()' : 'hsl()',
      }
    }
    if (name === 'hsb' || name === 'hsv') {
      if (parts.length < 3) return { ok: false, message: 'hsv() needs three values.' }
      return { ok: true, rgba: hsvToRgba(parts[0], parts[1], parts[2]), format: 'hsv()' }
    }
    if (name === 'cmyk') {
      if (parts.length < 4) {
        return { ok: false, message: 'cmyk() needs four values, e.g. cmyk(84%, 58%, 0%, 8%).' }
      }
      return {
        ok: true,
        rgba: cmykToRgba({ c: parts[0], m: parts[1], y: parts[2], k: parts[3] }),
        format: 'cmyk()',
      }
    }
    return { ok: false, message: `“${name}()” is not a colour function this converter understands.` }
  }

  // bare numbers: "37 99 235", "37, 99, 235", "221 83% 53%"
  const bare = numbersIn(lower)
  if (bare.length >= 3) {
    if (/%/.test(lower)) {
      return {
        ok: true,
        rgba: hslToRgba({ h: bare[0], s: bare[1], l: bare[2], a: bare.length > 3 ? clamp01(bare[3]) : 1 }),
        format: 'bare HSL triple',
      }
    }
    if (bare.slice(0, 3).every((n) => n >= 0 && n <= 255)) {
      return {
        ok: true,
        rgba: {
          r: clamp255(bare[0]),
          g: clamp255(bare[1]),
          b: clamp255(bare[2]),
          a: bare.length > 3 ? clamp01(bare[3] > 1 ? bare[3] / 100 : bare[3]) : 1,
        },
        format: 'bare RGB triple',
      }
    }
  }

  return {
    ok: false,
    message: `“${raw}” is not a colour this converter recognises. Try #2563eb, rgb(37 99 235), hsl(221 83% 53%) or a CSS colour name.`,
  }
}

/* ------------------------------------------------------------------ */
/* Conversions                                                         */
/* ------------------------------------------------------------------ */

export function hexToRgba(hexInput: string): Rgba {
  const hex = hexInput.replace(/^#/, '').toLowerCase()
  const expand = (s: string): number => parseInt(s.length === 1 ? s + s : s, 16)
  if (hex.length === 3 || hex.length === 4) {
    return {
      r: expand(hex[0]),
      g: expand(hex[1]),
      b: expand(hex[2]),
      a: hex.length === 4 ? expand(hex[3]) / 255 : 1,
    }
  }
  return {
    r: expand(hex.slice(0, 2)),
    g: expand(hex.slice(2, 4)),
    b: expand(hex.slice(4, 6)),
    a: hex.length === 8 ? expand(hex.slice(6, 8)) / 255 : 1,
  }
}

const byteHex = (n: number): string =>
  Math.round(clamp255(n)).toString(16).padStart(2, '0')

export function rgbaToHex(rgba: Rgba, options: { alpha?: boolean; uppercase?: boolean; short?: boolean } = {}): string {
  const { alpha = false, uppercase = false, short = false } = options
  let out = `${byteHex(rgba.r)}${byteHex(rgba.g)}${byteHex(rgba.b)}`
  if (alpha) out += byteHex(rgba.a * 255)
  if (short) {
    const pairs = out.match(/../g) ?? []
    if (pairs.length > 0 && pairs.every((pair) => pair[0] === pair[1])) {
      out = pairs.map((pair) => pair[0]).join('')
    }
  }
  return `#${uppercase ? out.toUpperCase() : out}`
}

export function rgbaToHsla(rgba: Rgba): Hsla {
  const r = clamp255(rgba.r) / 255
  const g = clamp255(rgba.g) / 255
  const b = clamp255(rgba.b) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6
        break
      case g:
        h = (b - r) / delta + 2
        break
      default:
        h = (r - g) / delta + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: s * 100, l: l * 100, a: rgba.a }
}

export function hslToRgba(hsla: Hsla): Rgba {
  const h = ((hsla.h % 360) + 360) % 360
  const s = clamp01(hsla.s / 100)
  const l = clamp01(hsla.l / 100)
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let rgb: [number, number, number]
  if (h < 60) rgb = [c, x, 0]
  else if (h < 120) rgb = [x, c, 0]
  else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]
  else if (h < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return {
    r: (rgb[0] + m) * 255,
    g: (rgb[1] + m) * 255,
    b: (rgb[2] + m) * 255,
    a: clamp01(hsla.a),
  }
}

export function rgbaToHsv(rgba: Rgba): { h: number; s: number; v: number } {
  const r = clamp255(rgba.r) / 255
  const g = clamp255(rgba.g) / 255
  const b = clamp255(rgba.b) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : (delta / max) * 100, v: max * 100 }
}

export function hsvToRgba(h: number, s: number, v: number): Rgba {
  const sat = clamp01(s / 100)
  const val = clamp01(v / 100)
  const l = val * (1 - sat / 2)
  const sl = l === 0 || l === 1 ? 0 : (val - l) / Math.min(l, 1 - l)
  return hslToRgba({ h, s: sl * 100, l: l * 100, a: 1 })
}

/**
 * Naive (device-independent) CMYK, the same formula Photoshop's "no colour
 * management" path uses. Printers use ICC profiles, so treat this as a starting
 * point, not a press-ready separation — the pages say so out loud.
 */
export function rgbaToCmyk(rgba: Rgba): Cmyk {
  const r = clamp255(rgba.r) / 255
  const g = clamp255(rgba.g) / 255
  const b = clamp255(rgba.b) / 255
  const k = 1 - Math.max(r, g, b)
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 }
  return {
    c: ((1 - r - k) / (1 - k)) * 100,
    m: ((1 - g - k) / (1 - k)) * 100,
    y: ((1 - b - k) / (1 - k)) * 100,
    k: k * 100,
  }
}

export function cmykToRgba(cmyk: Cmyk): Rgba {
  const c = clamp01(cmyk.c / 100)
  const m = clamp01(cmyk.m / 100)
  const y = clamp01(cmyk.y / 100)
  const k = clamp01(cmyk.k / 100)
  return {
    r: 255 * (1 - c) * (1 - k),
    g: 255 * (1 - m) * (1 - k),
    b: 255 * (1 - y) * (1 - k),
    a: 1,
  }
}

/* ------------------------------------------------------------------ */
/* Contrast                                                            */
/* ------------------------------------------------------------------ */

function channelLuminance(channel: number): number {
  const c = clamp255(channel) / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function relativeLuminance(rgba: Rgba): number {
  return (
    0.2126 * channelLuminance(rgba.r) +
    0.7152 * channelLuminance(rgba.g) +
    0.0722 * channelLuminance(rgba.b)
  )
}

export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const round = (n: number, places = 0): number => {
  const factor = 10 ** places
  return Math.round(n * factor) / factor
}

export interface ColorStrings {
  hex: string
  hex8: string
  hexUpper: string
  rgb: string
  rgba: string
  rgbSpace: string
  hsl: string
  hsla: string
  hslSpace: string
  hsv: string
  cmyk: string
  cssVariables: string
  swiftUI: string
  androidHex: string
  nearestName: string
}

export function formatColor(rgba: Rgba, precision = 1): ColorStrings {
  const hsl = rgbaToHsla(rgba)
  const hsv = rgbaToHsv(rgba)
  const cmyk = rgbaToCmyk(rgba)
  const r = Math.round(clamp255(rgba.r))
  const g = Math.round(clamp255(rgba.g))
  const b = Math.round(clamp255(rgba.b))
  const a = round(rgba.a, 3)
  const h = round(hsl.h, precision)
  const s = round(hsl.s, precision)
  const l = round(hsl.l, precision)

  return {
    hex: rgbaToHex(rgba),
    hex8: rgbaToHex(rgba, { alpha: true }),
    hexUpper: rgbaToHex(rgba, { uppercase: true }),
    rgb: `rgb(${r}, ${g}, ${b})`,
    rgba: `rgba(${r}, ${g}, ${b}, ${a})`,
    rgbSpace: `rgb(${r} ${g} ${b}${a < 1 ? ` / ${round(a * 100, 1)}%` : ''})`,
    hsl: `hsl(${h}, ${s}%, ${l}%)`,
    hsla: `hsla(${h}, ${s}%, ${l}%, ${a})`,
    hslSpace: `hsl(${h} ${s}% ${l}%${a < 1 ? ` / ${round(a * 100, 1)}%` : ''})`,
    hsv: `hsv(${round(hsv.h, precision)}, ${round(hsv.s, precision)}%, ${round(hsv.v, precision)}%)`,
    cmyk: `cmyk(${round(cmyk.c, precision)}%, ${round(cmyk.m, precision)}%, ${round(cmyk.y, precision)}%, ${round(cmyk.k, precision)}%)`,
    cssVariables: `--color: ${rgbaToHex(rgba)};\n--color-rgb: ${r} ${g} ${b};\n--color-hsl: ${h} ${s}% ${l}%;`,
    swiftUI: `Color(red: ${round(r / 255, 3)}, green: ${round(g / 255, 3)}, blue: ${round(b / 255, 3)})`,
    androidHex: `#${byteHex(rgba.a * 255)}${byteHex(r)}${byteHex(g)}${byteHex(b)}`.toUpperCase(),
    nearestName: nearestNamedColor(rgba),
  }
}

export function nearestNamedColor(rgba: Rgba): string {
  let best = ''
  let bestDistance = Infinity
  for (const [name, hex] of Object.entries(CSS_COLORS)) {
    const candidate = hexToRgba(hex)
    const distance =
      (candidate.r - rgba.r) ** 2 + (candidate.g - rgba.g) ** 2 + (candidate.b - rgba.b) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = name
    }
  }
  return bestDistance === 0 ? best : `${best} (closest match)`
}

/* ------------------------------------------------------------------ */
/* Pair page configuration                                             */
/* ------------------------------------------------------------------ */

export type ColorFormatId = 'hex' | 'rgb' | 'rgba' | 'hsl' | 'cmyk'

export interface ColorFormatSpec {
  id: ColorFormatId
  label: string
  placeholder: string
  /** Renders a colour into this format. */
  render: (rgba: Rgba) => string
  /** Short hint under the input. */
  hint: string
}

export const COLOR_FORMATS: Record<ColorFormatId, ColorFormatSpec> = {
  hex: {
    id: 'hex',
    label: 'HEX',
    placeholder: '#2563eb',
    render: (rgba) => (rgba.a < 1 ? rgbaToHex(rgba, { alpha: true }) : rgbaToHex(rgba)),
    hint: 'Three, four, six or eight hex digits, with or without the leading #.',
  },
  rgb: {
    id: 'rgb',
    label: 'RGB',
    placeholder: 'rgb(37, 99, 235)',
    render: (rgba) => formatColor(rgba).rgb,
    hint: 'Three channels, 0–255 each. Commas or spaces both work.',
  },
  rgba: {
    id: 'rgba',
    label: 'RGBA',
    placeholder: 'rgba(37, 99, 235, 0.5)',
    render: (rgba) => formatColor(rgba).rgba,
    hint: 'Three channels plus an alpha between 0 and 1.',
  },
  hsl: {
    id: 'hsl',
    label: 'HSL',
    placeholder: 'hsl(221, 83%, 53%)',
    render: (rgba) => formatColor(rgba).hsl,
    hint: 'Hue in degrees, then saturation and lightness as percentages.',
  },
  cmyk: {
    id: 'cmyk',
    label: 'CMYK',
    placeholder: 'cmyk(84%, 58%, 0%, 8%)',
    render: (rgba) => formatColor(rgba).cmyk,
    hint: 'Four ink percentages. Device-independent, so it is not a press-ready separation.',
  },
}
