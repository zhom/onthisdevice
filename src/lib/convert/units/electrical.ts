/**
 * Watts, amps and volts: conversions that need a second value (the voltage or the current)
 * and, for AC, a power factor. P = V × I for DC, P = V × I × PF for single-phase AC and
 * P = √3 × V × I × PF for three-phase AC with line-to-line voltage.
 */
import type { Faq, Tool } from '@/lib/tools/types'
import { D, type Dec } from './engine'

export type Circuit = 'dc' | 'ac1' | 'ac3'
export type ElectricQty = 'power' | 'current' | 'voltage'

export interface ElectricPair {
  slug: string
  title: string
  /** What is typed in, what comes out, and the known third value. */
  from: ElectricQty
  to: ElectricQty
  /** Power is shown in kW instead of W. */
  kilo: boolean
  dflt: { value: string; known: string }
  keywords: string[]
  description: string
}

export const ELECTRIC_PAIRS: ElectricPair[] = [
  {
    slug: 'watts-to-amps',
    title: 'Watts to Amps',
    from: 'power',
    to: 'current',
    kilo: false,
    dflt: { value: '1500', known: '120' },
    keywords: ['w to a', 'watts to amperes', 'how many amps is', 'amps from watts and volts'],
    description:
      'Convert watts to amps for a given voltage, for DC, single-phase or three-phase AC with a power factor. Shows the formula and a table of common loads.',
  },
  {
    slug: 'amps-to-watts',
    title: 'Amps to Watts',
    from: 'current',
    to: 'power',
    kilo: false,
    dflt: { value: '15', known: '120' },
    keywords: ['a to w', 'amperes to watts', 'how many watts is', 'watts from amps and volts'],
    description:
      'Convert amps to watts for a given voltage, for DC, single-phase or three-phase AC with a power factor. See the formula and the load a circuit can carry.',
  },
  {
    slug: 'kw-to-amps',
    title: 'kW to Amps',
    from: 'power',
    to: 'current',
    kilo: true,
    dflt: { value: '7.4', known: '230' },
    keywords: ['kilowatts to amps', 'kw to a', 'kw to amps 3 phase', 'kw to amps single phase'],
    description:
      'Convert kilowatts to amps at any voltage, for DC, single-phase or three-phase AC with a power factor. Shows the working and typical loads.',
  },
  {
    slug: 'amps-to-kw',
    title: 'Amps to kW',
    from: 'current',
    to: 'power',
    kilo: true,
    dflt: { value: '32', known: '230' },
    keywords: ['amps to kilowatts', 'a to kw', 'amps to kw 3 phase', 'amps to kw single phase'],
    description:
      'Convert amps to kilowatts at any voltage, for DC, single-phase or three-phase AC with a power factor. Shows the working and common circuits.',
  },
  {
    slug: 'watts-to-volts',
    title: 'Watts to Volts',
    from: 'power',
    to: 'voltage',
    kilo: false,
    dflt: { value: '60', known: '5' },
    keywords: ['w to v', 'watts to voltage', 'volts from watts and amps'],
    description:
      'Find the voltage from watts and amps, for DC, single-phase or three-phase AC with a power factor. Shows the formula, the working and common examples.',
  },
  {
    slug: 'volts-to-watts',
    title: 'Volts to Watts',
    from: 'voltage',
    to: 'power',
    kilo: false,
    dflt: { value: '12', known: '5' },
    keywords: ['v to w', 'voltage to watts', 'watts from volts and amps'],
    description:
      'Convert volts to watts for a known current, for DC, single-phase or three-phase AC with a power factor. Shows the formula with your numbers and examples.',
  },
]

export const ELECTRIC_BY_SLUG: Map<string, ElectricPair> = new Map(ELECTRIC_PAIRS.map((p) => [p.slug, p]))

/** The quantity that is neither typed in nor computed. */
export function knownOf(pair: Pick<ElectricPair, 'from' | 'to'>): ElectricQty {
  return (['power', 'current', 'voltage'] as const).find((q) => q !== pair.from && q !== pair.to) ?? 'voltage'
}

const SQRT3 = new D(3).sqrt()

/** The factor k in P = k × V × I. */
export function circuitFactor(circuit: Circuit, pf: Dec): Dec {
  if (circuit === 'dc') return new D(1)
  if (circuit === 'ac1') return pf
  return SQRT3.times(pf)
}

/** Solves P = k × V × I for the missing value. Inputs and output in W, A and V. */
export function solve(
  values: { power?: Dec; current?: Dec; voltage?: Dec },
  want: ElectricQty,
  circuit: Circuit,
  pf: Dec,
): Dec | null {
  const k = circuitFactor(circuit, pf)
  const { power, current, voltage } = values
  if (want === 'power' && current && voltage) return k.times(voltage).times(current)
  if (want === 'current' && power && voltage && !voltage.isZero() && !k.isZero()) return power.div(k.times(voltage))
  if (want === 'voltage' && power && current && !current.isZero() && !k.isZero()) return power.div(k.times(current))
  return null
}

export const QTY_LABEL: Record<ElectricQty, { name: string; symbol: string; letter: string }> = {
  power: { name: 'power', symbol: 'W', letter: 'P' },
  current: { name: 'current', symbol: 'A', letter: 'I' },
  voltage: { name: 'voltage', symbol: 'V', letter: 'V' },
}

/** "I = P ÷ (V × PF)" and so on. */
export function formulaText(want: ElectricQty, circuit: Circuit): string {
  const k = circuit === 'dc' ? '' : circuit === 'ac1' ? ' × PF' : ' × PF × √3'
  if (want === 'power') return `P = V × I${k}`
  if (want === 'current') return circuit === 'dc' ? 'I = P ÷ V' : `I = P ÷ (V${k})`
  return circuit === 'dc' ? 'V = P ÷ I' : `V = P ÷ (I${k})`
}

function faqs(p: ElectricPair): Faq[] {
  const known = knownOf(p)
  const unitP = p.kilo ? 'kW' : 'W'
  const out: Faq[] = [
    {
      q: `What is the formula for ${p.title.toLowerCase()}?`,
      a: `For DC, ${formulaText(p.to, 'dc')}. For single-phase AC, ${formulaText(p.to, 'ac1')}, where PF is the power factor. For three-phase AC with line-to-line voltage, ${formulaText(p.to, 'ac3')}.${p.kilo ? ' Multiply kilowatts by 1,000 to get watts first.' : ''}`,
    },
    {
      q: `Why do I need the ${QTY_LABEL[known].name} as well?`,
      a: `Watts, amps and volts measure different things, so one does not convert to another on its own. Power is voltage times current. With two of the three values the third follows.`,
    },
    {
      q: 'What power factor should I use?',
      a: 'Use 1 for heaters, kettles, incandescent lamps and DC loads. Motors, compressors and pumps run at about 0.8 to 0.9. Modern power supplies with power factor correction are 0.95 or more. The rating plate often states it as cos φ.',
    },
  ]
  if (p.to === 'current' || p.from === 'current') {
    out.push({
      q: 'How many amps can a household circuit carry?',
      a: `A US 15 A circuit at 120 V carries 1,800 W, and the National Electrical Code limits continuous loads to 80% of that, 1,440 W. A UK 13 A plug at 230 V carries about 3,000 W. Check the breaker rating, not only the result here.${unitP === 'kW' ? ' A 32 A circuit at 230 V carries 7.36 kW.' : ''}`,
    })
  }
  return out
}

export const electricTools: Tool[] = ELECTRIC_PAIRS.map((p) => ({
  slug: p.slug,
  title: p.title,
  h1: `Convert ${p.title.toLowerCase().replace('kw', 'kW')}`,
  description: p.description,
  keywords: p.keywords,
  category: 'units',
  icon: 'PlugZap',
  faqs: faqs(p),
  related: [
    ...ELECTRIC_PAIRS.filter((x) => x.slug !== p.slug && (x.from === p.to || x.to === p.from)).map((x) => x.slug),
    'ohms-law-calculator',
    'power-converter',
  ],
  updated: '2026-11-07',
}))
