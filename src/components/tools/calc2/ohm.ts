/** Ohm's law and electrical power from any two of V, I, R and P. Pure; the tests import it. */

export type OhmKey = 'V' | 'I' | 'R' | 'P'

export interface OhmValues {
  V: number
  I: number
  R: number
  P: number
}

export interface OhmSolution {
  values: OhmValues
  /** The formula used for each value that was worked out. */
  rules: Partial<Record<OhmKey, string>>
}

/** Solve from exactly two known, positive values. */
export function solveOhm(a: OhmKey, av: number, b: OhmKey, bv: number): OhmSolution | null {
  if (a === b || !(av > 0) || !(bv > 0)) return null
  const k: Partial<OhmValues> = { [a]: av, [b]: bv }
  const pair = [a, b].sort().join('')
  let v: OhmValues
  const rules: Partial<Record<OhmKey, string>> = {}
  switch (pair) {
    case 'IV': // I, V
      v = { V: k.V!, I: k.I!, R: k.V! / k.I!, P: k.V! * k.I! }
      rules.R = 'R = V ÷ I'
      rules.P = 'P = V × I'
      break
    case 'RV':
      v = { V: k.V!, R: k.R!, I: k.V! / k.R!, P: (k.V! * k.V!) / k.R! }
      rules.I = 'I = V ÷ R'
      rules.P = 'P = V² ÷ R'
      break
    case 'PV':
      v = { V: k.V!, P: k.P!, I: k.P! / k.V!, R: (k.V! * k.V!) / k.P! }
      rules.I = 'I = P ÷ V'
      rules.R = 'R = V² ÷ P'
      break
    case 'IR':
      v = { I: k.I!, R: k.R!, V: k.I! * k.R!, P: k.I! * k.I! * k.R! }
      rules.V = 'V = I × R'
      rules.P = 'P = I² × R'
      break
    case 'IP':
      v = { I: k.I!, P: k.P!, V: k.P! / k.I!, R: k.P! / (k.I! * k.I!) }
      rules.V = 'V = P ÷ I'
      rules.R = 'R = P ÷ I²'
      break
    case 'PR':
      v = { P: k.P!, R: k.R!, V: Math.sqrt(k.P! * k.R!), I: Math.sqrt(k.P! / k.R!) }
      rules.V = 'V = √(P × R)'
      rules.I = 'I = √(P ÷ R)'
      break
    default:
      return null
  }
  return { values: v, rules }
}

const PREFIX: [number, string][] = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
]

/** 4700 -> { value: 4.7, prefix: 'k' } for display with an SI prefix. */
export function siPrefix(n: number): { value: number; prefix: string } {
  const a = Math.abs(n)
  if (a === 0 || !Number.isFinite(a)) return { value: n, prefix: '' }
  for (const [f, p] of PREFIX) if (a >= f * 0.9995) return { value: n / f, prefix: p }
  return { value: n / 1e-9, prefix: 'n' }
}
