/**
 * Instant answers for the search palette: a query that is entirely a calculation,
 * conversion or date question gets its answer, computed on the device. Every other
 * query returns null quickly, so this can run on each keystroke.
 */
import type { Answer } from './types'
import { uuidAnswer } from './uuid'
import { timeAnswer } from './time'
import { dateAnswer } from './dates'
import { colorAnswer } from './color'
import { baseAnswer } from './bases'
import { unitAnswer } from './units'
import { percentAnswer } from './percent'
import { evaluate } from './expr'
import { grouped, plain } from './format'

export type { Answer, AnswerKind } from './types'

const LEAD = /^(?:what\s*'?s|what is|how much is|calculate|calc|compute|convert|solve)\s+/
const TRAIL = /\s*[?=]+$/

function normalize(query: string): string {
  return query
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(TRAIL, '')
    .replace(LEAD, '')
}

/** "1920x1080" is a size, not a product. */
const DIMENSIONS = /^\d{3,}x\d{3,}$/

function mathAnswer(s: string): Answer | null {
  if (DIMENSIONS.test(s)) return null
  const r = evaluate(s)
  if (!r) return null
  return {
    kind: r.percent ? 'percent' : 'math',
    value: grouped(r.value),
    label: s,
    copy: plain(r.value),
    slug: r.percent ? 'percentage-calculator' : 'scientific-calculator',
  }
}

/** The answer to a query, or null when the whole query is not a question this module answers. */
export function getAnswer(query: string, now: Date = new Date()): Answer | null {
  if (query.length > 100) return null
  const s = normalize(query)
  if (!s) return null
  try {
    return (
      uuidAnswer(s) ??
      timeAnswer(s, now) ??
      dateAnswer(s, now) ??
      colorAnswer(s) ??
      baseAnswer(s) ??
      unitAnswer(s) ??
      percentAnswer(s) ??
      mathAnswer(s)
    )
  } catch {
    return null
  }
}
