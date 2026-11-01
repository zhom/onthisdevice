import type { Answer } from './types'
import { NUM, toNumber } from './types'
import { grouped, plain } from './format'

const P = '(?:%|percent|percentage|pct)'
const IS_WHAT = new RegExp(`^${NUM} is what ?${P} of ${NUM}$`)
const WHAT_IS = new RegExp(`^what ?${P} is ${NUM} (?:of|out of) ${NUM}$`)
const WHAT_OF = new RegExp(`^what ?${P} of ${NUM} is ${NUM}$`)
const CHANGE = [
  new RegExp(`^${P} (?:change|increase|decrease|difference) (?:from )?${NUM} to ${NUM}$`),
  new RegExp(`^(?:from )?${NUM} to ${NUM},? ?${P}(?: change| increase| decrease| difference)?$`),
]
const OFF = new RegExp(`^${NUM} ?${P} off (?:of )?\\$?${NUM}$`)

const pct = (n: number, sign = false) => `${sign && n > 0 ? '+' : ''}${grouped(n, 6)}%`

function answer(value: number, label: string, sign = false, slug = 'percentage-calculator'): Answer | null {
  if (!Number.isFinite(value)) return null
  return { kind: 'percent', value: pct(value, sign), label, copy: `${plain(value, 6)}%`, slug }
}

/** Percent phrases the expression parser cannot read. "15% of 80" and "80 + 15%" go to the parser. */
export function percentAnswer(s: string): Answer | null {
  if (!/\d/.test(s) || !/%|perc|pct/.test(s)) return null
  let m = IS_WHAT.exec(s) ?? WHAT_IS.exec(s)
  if (m) {
    const [a, b] = [toNumber(m[1]), toNumber(m[2])]
    return b ? answer((a / b) * 100, `${m[1]} as a percent of ${m[2]}`) : null
  }
  if ((m = WHAT_OF.exec(s))) {
    const [b, a] = [toNumber(m[1]), toNumber(m[2])]
    return b ? answer((a / b) * 100, `${m[2]} as a percent of ${m[1]}`) : null
  }
  m = CHANGE[0].exec(s) ?? CHANGE[1].exec(s)
  if (m) {
    const [a, b] = [toNumber(m[1]), toNumber(m[2])]
    return a ? answer(((b - a) / Math.abs(a)) * 100, `Percent change from ${m[1]} to ${m[2]}`, true) : null
  }
  if ((m = OFF.exec(s))) {
    const [p, price] = [toNumber(m[1]), toNumber(m[2])]
    const value = price * (1 - p / 100)
    return {
      kind: 'percent',
      value: grouped(value),
      label: `${m[1]}% off ${m[2]}`,
      copy: plain(value),
      slug: 'percentage-off-calculator',
      more: [`You save ${grouped(price - value)}`],
    }
  }
  return null
}
