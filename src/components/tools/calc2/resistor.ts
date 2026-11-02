/**
 * Resistor colour code (IEC 60062). Band colours are content: the hex values
 * here are the only colour on the page. Pure; the tests import it.
 */

export type BandColor =
  | 'black'
  | 'brown'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'violet'
  | 'grey'
  | 'white'
  | 'gold'
  | 'silver'
  | 'none'

export interface ColorInfo {
  name: string
  hex: string
  digit?: number
  /** Multiplier as a power of ten. */
  exp?: number
  /** Tolerance in percent. */
  tol?: number
  /** Temperature coefficient in ppm/K. */
  ppm?: number
}

export const COLORS: Record<BandColor, ColorInfo> = {
  black: { name: 'Black', hex: '#1c1c1c', digit: 0, exp: 0, ppm: 250 },
  brown: { name: 'Brown', hex: '#7a4524', digit: 1, exp: 1, tol: 1, ppm: 100 },
  red: { name: 'Red', hex: '#d22b2b', digit: 2, exp: 2, tol: 2, ppm: 50 },
  orange: { name: 'Orange', hex: '#ef7b1a', digit: 3, exp: 3, tol: 0.05, ppm: 15 },
  yellow: { name: 'Yellow', hex: '#f3cf1b', digit: 4, exp: 4, tol: 0.02, ppm: 25 },
  green: { name: 'Green', hex: '#2e9a48', digit: 5, exp: 5, tol: 0.5, ppm: 20 },
  blue: { name: 'Blue', hex: '#2b5fd0', digit: 6, exp: 6, tol: 0.25, ppm: 10 },
  violet: { name: 'Violet', hex: '#7c3fb7', digit: 7, exp: 7, tol: 0.1, ppm: 5 },
  grey: { name: 'Grey', hex: '#8a8a8a', digit: 8, exp: 8, tol: 0.01, ppm: 1 },
  white: { name: 'White', hex: '#f4f4f4', digit: 9, exp: 9 },
  gold: { name: 'Gold', hex: '#c9a227', exp: -1, tol: 5 },
  silver: { name: 'Silver', hex: '#b9b9b9', exp: -2, tol: 10 },
  none: { name: 'None', hex: 'transparent', tol: 20 },
}

export const ORDER: BandColor[] = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white', 'gold', 'silver', 'none']

export type BandCount = 4 | 5 | 6
export type BandRole = 'digit' | 'multiplier' | 'tolerance' | 'tempco'

/** What each band of a resistor means, left to right. */
export function roles(count: BandCount): BandRole[] {
  const digits: BandRole[] = count === 4 ? ['digit', 'digit'] : ['digit', 'digit', 'digit']
  return [...digits, 'multiplier', 'tolerance', ...(count === 6 ? (['tempco'] as BandRole[]) : [])]
}

/** The colours allowed for a band role. */
export function allowed(role: BandRole, first = false): BandColor[] {
  return ORDER.filter((c) => {
    const i = COLORS[c]
    if (role === 'digit') return i.digit !== undefined && !(first && i.digit === 0)
    if (role === 'multiplier') return i.exp !== undefined
    if (role === 'tolerance') return i.tol !== undefined
    return i.ppm !== undefined
  })
}

export interface Decoded {
  ohms: number
  digits: number[]
  exp: number
  tol: number
  ppm?: number
  min: number
  max: number
}

/** Bands to value. Returns null when a band has a colour its position cannot have. */
export function decode(bands: BandColor[]): Decoded | null {
  const count = bands.length as BandCount
  if (count !== 4 && count !== 5 && count !== 6) return null
  const r = roles(count)
  const digits: number[] = []
  let exp = 0
  let tol = 20
  let ppm: number | undefined
  for (let i = 0; i < r.length; i++) {
    const c = COLORS[bands[i]!]
    if (r[i] === 'digit') {
      if (c.digit === undefined) return null
      digits.push(c.digit)
    } else if (r[i] === 'multiplier') {
      if (c.exp === undefined) return null
      exp = c.exp
    } else if (r[i] === 'tolerance') {
      if (c.tol === undefined) return null
      tol = c.tol
    } else {
      if (c.ppm === undefined) return null
      ppm = c.ppm
    }
  }
  const sig = digits.reduce((a, d) => a * 10 + d, 0)
  const ohms = Number((sig * 10 ** exp).toPrecision(12))
  return { ohms, digits, exp, tol, ppm, min: ohms * (1 - tol / 100), max: ohms * (1 + tol / 100) }
}

export interface Encoded {
  bands: BandColor[]
  /** The value the bands give; differs from the input when it had too many digits. */
  ohms: number
  rounded: boolean
}

/** Value to bands. `tol` and `ppm` pick the last bands. Null when out of range. */
export function encode(ohms: number, count: BandCount, tol: BandColor = 'gold', ppm: BandColor = 'brown'): Encoded | null {
  if (!(ohms > 0) || !Number.isFinite(ohms)) return null
  const sig = count === 4 ? 2 : 3
  let exp = Math.floor(Math.log10(ohms) + 1e-9) - (sig - 1)
  let mant = Math.round(ohms / 10 ** exp)
  if (mant >= 10 ** sig) {
    mant = Math.round(mant / 10)
    exp += 1
  }
  if (exp < -2 || exp > 9) return null
  const digits = String(mant).padStart(sig, '0').split('').map(Number)
  if (digits[0] === 0) return null
  const byDigit = (d: number) => ORDER.find((c) => COLORS[c].digit === d)!
  const byExp = (e: number) => ORDER.find((c) => COLORS[c].exp === e)!
  const bands: BandColor[] = [...digits.map(byDigit), byExp(exp), tol]
  if (count === 6) bands.push(ppm)
  const value = Number((mant * 10 ** exp).toPrecision(12))
  return { bands, ohms: value, rounded: Math.abs(value - ohms) > Math.abs(ohms) * 1e-9 }
}

/** 4700 -> "4.7 kΩ". */
export function ohmsText(ohms: number): string {
  const units: [number, string][] = [
    [1e9, 'GΩ'],
    [1e6, 'MΩ'],
    [1e3, 'kΩ'],
  ]
  for (const [f, u] of units) if (ohms >= f) return `${trim(ohms / f)} ${u}`
  return `${trim(ohms)} Ω`
}

function trim(n: number): string {
  return String(Number(n.toPrecision(6)))
}

/** "±5 %" style tolerance text. */
export function tolText(tol: number): string {
  return `±${tol}%`
}
