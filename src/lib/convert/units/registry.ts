/** Registry entries for the unit pair pages, written from the unit data. */
import type { Faq, Tool } from '@/lib/tools/types'
import { UNIT_PAIRS, relatedSlugs, type UnitPair } from './catalog'
import { isSpecial, withUnit } from './engine'
import { article, estimateRule, formulaLine, ratioIsExact, ratioText, workedExample } from './describe'

const UPDATED = '2026-11-07'

/** The first candidate that fits 110 to 155 characters. */
export function fitDescription(candidates: string[]): string {
  const fit = candidates.find((c) => c.length >= 110 && c.length <= 155)
  if (fit) return fit
  const short = candidates.find((c) => c.length <= 155)
  if (short) return short
  return `${(candidates[0] ?? '').slice(0, 152).replace(/\s+\S*$/, '')}.`
}

function description(p: UnitPair): string {
  const a = p.from.plural
  const b = p.to.plural
  const ratio = isSpecial(p.from, p.to) ? formulaLine(p.from, p.to) : `${withUnit('1', p.from)} = ${withUnit(ratioText(p.from, p.to), p.to)}`
  return fitDescription([
    `Convert ${a} to ${b} (${ratio}). Exact decimal arithmetic, the working, a table of common values and a scale that compares both units.`,
    `Convert ${a} to ${b}: ${ratio}. See the working with your number, a table of common values and a scale that compares both units.`,
    `Convert ${a} to ${b} with exact decimal arithmetic. Shows the working, a table of common values and a scale for both units.`,
    `Convert ${a} to ${b} exactly, with the working, a reference table and a scale that compares the two units side by side.`,
    `${p.from.label} to ${p.to.label}: convert ${a} to ${b} exactly. Shows the working, a table of common values and both scales.`,
  ])
}

function faqs(p: UnitPair): Faq[] {
  const { from, to } = p
  const out: Faq[] = []
  if (isSpecial(from, to)) {
    out.push({
      q: `What is the formula for ${from.plural} to ${to.plural}?`,
      a: `${formulaLine(from, to)}. For example, ${workedExample(from, to, from.dflt ?? '1')}.`,
    })
  } else {
    const exact = ratioIsExact(from, to)
    out.push({
      q: `How many ${to.plural} are in ${article(from.name)} ${from.name}?`,
      a: `One ${from.name} is ${exact ? 'exactly ' : ''}${ratioText(from, to)} ${to.plural}${exact ? '' : ', rounded to 10 significant digits'}. The formula is ${formulaLine(from, to)}.`,
    })
    const rule = estimateRule(from, to)
    out.push({
      q: `How do I convert ${from.plural} to ${to.plural}?`,
      a: `Use ${formulaLine(from, to)}. For example, ${workedExample(from, to, from.dflt ?? '1')}.${rule ? ` ${rule}` : ''}`,
    })
  }
  out.push({ q: `What is ${article(to.name)} ${to.name}?`, a: `${to.def} ${to.uses}` })
  out.push({
    q: 'Is the result exact?',
    a: `Yes, to the digits shown. ${from.def} ${to.def.split('. ')[0]?.replace(/\.$/, '')}. The page uses these definitions with 40-digit decimal arithmetic, and the result is rounded only for display.`,
  })
  return out
}

function tool(p: UnitPair): Tool {
  const a = p.from.symbol.toLowerCase()
  const b = p.to.symbol.toLowerCase()
  const keywords = [...new Set([`${a} to ${b}`, `${p.from.plural} to ${p.to.plural}`, `convert ${p.from.plural} to ${p.to.plural}`, ...p.keywords])].filter(
    (k) => k.replace(/-/g, ' ') !== p.slug.replace(/-/g, ' '),
  )
  return {
    slug: p.slug,
    title: p.title,
    h1: `Convert ${p.from.plural} to ${p.to.plural}`,
    description: description(p),
    keywords,
    category: 'units',
    icon: p.quantity.icon,
    faqs: faqs(p),
    related: relatedSlugs(p),
    updated: UPDATED,
  }
}

export const unitTools: Tool[] = UNIT_PAIRS.map(tool)
