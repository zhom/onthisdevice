/**
 * CSS length conversion (px ↔ rem/em/pt/%) and a string-safe bulk rewriter for
 * the `dev-format` batch.
 *
 * The only genuinely tricky part is the bulk mode: rewriting every `px` in a
 * pasted stylesheet without corrupting `url(sprite-2px.png)`, a `content:"2px"`
 * string, a `@media (min-width: 768px)` query the author wants left alone, or a
 * `1px` border that should stay a hairline. The scanner below is comment- and
 * string-aware and every category is individually switchable.
 */

export type CssUnit = 'px' | 'rem' | 'em' | 'pt' | 'percent'

export interface CssUnitSpec {
  id: CssUnit
  label: string
  suffix: string
  /** Sentence describing what the unit is relative to. */
  basis: string
}

export const CSS_UNITS: Record<CssUnit, CssUnitSpec> = {
  px: {
    id: 'px',
    label: 'Pixels (px)',
    suffix: 'px',
    basis: 'A CSS pixel: an absolute unit in CSS terms, independent of the device pixel ratio.',
  },
  rem: {
    id: 'rem',
    label: 'Root em (rem)',
    suffix: 'rem',
    basis: "Relative to the root element's font size, which the browser defaults to 16 px.",
  },
  em: {
    id: 'em',
    label: 'Em (em)',
    suffix: 'em',
    basis: "Relative to the font size of the element itself (or its parent, for the font-size property).",
  },
  pt: {
    id: 'pt',
    label: 'Points (pt)',
    suffix: 'pt',
    basis: 'A print unit. CSS fixes 1 in = 96 px = 72 pt, so 1 pt = 4/3 px exactly.',
  },
  percent: {
    id: 'percent',
    label: 'Percent (%)',
    suffix: '%',
    basis: 'For font-size, a percentage of the parent font size: 100% = the parent size.',
  },
}

export interface UnitContext {
  /** Root font size in px — the `rem` basis. */
  rootPx: number
  /** Parent/element font size in px — the `em` and `%` basis. */
  parentPx: number
}

export const DEFAULT_CONTEXT: UnitContext = { rootPx: 16, parentPx: 16 }

/** Every unit is defined by how many px one of it is worth in this context. */
export function pxPerUnit(unit: CssUnit, context: UnitContext): number {
  switch (unit) {
    case 'px':
      return 1
    case 'rem':
      return context.rootPx
    case 'em':
      return context.parentPx
    case 'pt':
      return 96 / 72
    case 'percent':
      return context.parentPx / 100
    default:
      return 1
  }
}

export function convertUnit(
  value: number,
  from: CssUnit,
  to: CssUnit,
  context: UnitContext,
): number {
  const px = value * pxPerUnit(from, context)
  return px / pxPerUnit(to, context)
}

/** Trims float noise: 1.0000000000000002 → 1, 0.6875 → 0.6875. */
export function tidy(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '–'
  const fixed = value.toFixed(decimals)
  return fixed.replace(/\.?0+$/, '') === '' ? '0' : fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

/** The human-readable formula with the user's own numbers substituted in. */
export function unitFormula(
  value: number,
  from: CssUnit,
  to: CssUnit,
  context: UnitContext,
  decimals: number,
): string {
  const fromSpec = CSS_UNITS[from]
  const toSpec = CSS_UNITS[to]
  const px = value * pxPerUnit(from, context)
  const result = px / pxPerUnit(to, context)

  const basisLabel = (unit: CssUnit): string => {
    if (unit === 'rem') return `root font size (${tidy(context.rootPx, 4)} px)`
    if (unit === 'em' || unit === 'percent') return `parent font size (${tidy(context.parentPx, 4)} px)`
    if (unit === 'pt') return '96/72'
    return '1'
  }

  const lines: string[] = []
  if (from === 'px' && to !== 'px') {
    lines.push(`${to} = px ÷ ${basisLabel(to)}${to === 'percent' ? ' × 100' : ''}`)
    lines.push(
      to === 'percent'
        ? `${tidy(result, decimals)}% = ${tidy(value, 4)} px ÷ ${tidy(context.parentPx, 4)} px × 100`
        : `${tidy(result, decimals)}${toSpec.suffix} = ${tidy(value, 4)} px ÷ ${tidy(pxPerUnit(to, context), 4)}`,
    )
  } else if (to === 'px' && from !== 'px') {
    lines.push(`px = ${from} × ${basisLabel(from)}${from === 'percent' ? ' ÷ 100' : ''}`)
    lines.push(
      from === 'percent'
        ? `${tidy(result, decimals)} px = ${tidy(value, 4)}% ÷ 100 × ${tidy(context.parentPx, 4)} px`
        : `${tidy(result, decimals)} px = ${tidy(value, 4)}${fromSpec.suffix} × ${tidy(pxPerUnit(from, context), 4)}`,
    )
  } else {
    lines.push(`${to} = ${from} × ${basisLabel(from)} ÷ ${basisLabel(to)}`)
    lines.push(
      `${tidy(result, decimals)}${toSpec.suffix} = ${tidy(value, 4)}${fromSpec.suffix} × ${tidy(pxPerUnit(from, context), 4)} ÷ ${tidy(pxPerUnit(to, context), 4)}`,
    )
  }
  lines.push(`(via ${tidy(px, 6)} px)`)
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* Reference table                                                     */
/* ------------------------------------------------------------------ */

export const REFERENCE_PX = [
  1, 2, 4, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 44, 48,
  56, 64, 72, 80, 96,
]

export interface ReferenceRow {
  px: number
  rem: string
  em: string
  pt: string
  percent: string
}

export function referenceRows(context: UnitContext, decimals = 4): ReferenceRow[] {
  return REFERENCE_PX.map((px) => ({
    px,
    rem: tidy(convertUnit(px, 'px', 'rem', context), decimals),
    em: tidy(convertUnit(px, 'px', 'em', context), decimals),
    pt: tidy(convertUnit(px, 'px', 'pt', context), decimals),
    percent: tidy(convertUnit(px, 'px', 'percent', context), decimals),
  }))
}

/* ------------------------------------------------------------------ */
/* Bulk CSS rewrite                                                    */
/* ------------------------------------------------------------------ */

export interface BulkOptions {
  from: CssUnit
  to: CssUnit
  context: UnitContext
  decimals: number
  /** Leave 0 and 0px alone — `0rem` is noise. */
  skipZero: boolean
  /** Leave 1px/2px hairlines alone (borders, outlines, box-shadow spread). */
  skipHairlines: boolean
  /** Leave values inside @media / @container preludes alone. */
  skipMediaQueries: boolean
  /** Only rewrite these properties (empty = all). */
  propertyFilter: string[]
}

export const DEFAULT_BULK: BulkOptions = {
  from: 'px',
  to: 'rem',
  context: DEFAULT_CONTEXT,
  decimals: 4,
  skipZero: true,
  skipHairlines: true,
  skipMediaQueries: true,
  propertyFilter: [],
}

export interface BulkResult {
  css: string
  converted: number
  skipped: number
  /** Reasons values were left alone, for the summary line. */
  skippedReasons: Record<string, number>
}

/**
 * Rewrites lengths in a stylesheet. Strings, comments and `url(…)` bodies are
 * copied through byte-for-byte; everything else is scanned for `<number><unit>`.
 */
export function rewriteCss(input: string, options: BulkOptions): BulkResult {
  const fromSuffix = CSS_UNITS[options.from].suffix
  const toSuffix = CSS_UNITS[options.to].suffix
  const out: string[] = []
  const skippedReasons: Record<string, number> = {}
  let converted = 0
  let skipped = 0

  const skip = (reason: string) => {
    skipped += 1
    skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1
  }

  const filter = options.propertyFilter.map((p) => p.trim().toLowerCase()).filter(Boolean)

  let i = 0
  const n = input.length
  let inMediaPrelude = false
  /** Text since the last `;`, `{` or `}` — used to read the current property. */
  let declarationStart = 0

  const currentProperty = (): string => {
    const chunk = input.slice(declarationStart, i)
    const colon = chunk.indexOf(':')
    if (colon === -1) return ''
    return chunk.slice(0, colon).trim().toLowerCase()
  }

  while (i < n) {
    const ch = input[i]

    // comments
    if (ch === '/' && input[i + 1] === '*') {
      const end = input.indexOf('*/', i + 2)
      const stop = end === -1 ? n : end + 2
      out.push(input.slice(i, stop))
      i = stop
      continue
    }

    // strings
    if (ch === '"' || ch === "'") {
      let j = i + 1
      while (j < n) {
        if (input[j] === '\\') {
          j += 2
          continue
        }
        if (input[j] === ch) {
          j += 1
          break
        }
        j += 1
      }
      out.push(input.slice(i, j))
      i = j
      continue
    }

    // url(...) — may be unquoted
    if ((ch === 'u' || ch === 'U') && /^url\s*\(/i.test(input.slice(i, i + 6))) {
      const close = input.indexOf(')', i)
      const stop = close === -1 ? n : close + 1
      out.push(input.slice(i, stop))
      i = stop
      continue
    }

    // at-rule preludes
    if (ch === '@') {
      const rule = /^@([a-zA-Z-]+)/.exec(input.slice(i))
      if (rule && /^(media|container|supports)$/i.test(rule[1])) inMediaPrelude = true
      out.push(ch)
      i += 1
      continue
    }
    if (ch === '{' || ch === '}' || ch === ';') {
      inMediaPrelude = false
      declarationStart = i + 1
      out.push(ch)
      i += 1
      continue
    }

    // a number, possibly followed by our unit
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(input[i + 1] ?? ''))) {
      const previous = input[i - 1] ?? ''
      // part of an identifier like `grid-2px`? leave it.
      if (/[A-Za-z_-]/.test(previous) && previous !== '-') {
        out.push(ch)
        i += 1
        continue
      }
      const match = /^-?\d*\.?\d+/.exec(input.slice(i))
      if (!match) {
        out.push(ch)
        i += 1
        continue
      }
      const numberText = match[0]
      const after = input.slice(i + numberText.length)
      const hasUnit =
        fromSuffix === '%'
          ? after.startsWith('%')
          : new RegExp(`^${fromSuffix}(?![a-zA-Z0-9-])`, 'i').test(after)

      if (!hasUnit) {
        out.push(numberText)
        i += numberText.length
        continue
      }

      const value = Number(numberText)
      const property = currentProperty()

      let reason: string | null = null
      if (options.skipZero && value === 0) reason = 'zero values'
      else if (options.skipHairlines && options.from === 'px' && Math.abs(value) <= 2) {
        reason = 'hairlines (1–2 px)'
      } else if (options.skipMediaQueries && inMediaPrelude) reason = 'media query preludes'
      else if (filter.length > 0 && !filter.includes(property)) reason = 'filtered-out properties'

      if (reason) {
        skip(reason)
        out.push(numberText + fromSuffix)
        i += numberText.length + fromSuffix.length
        continue
      }

      const result = convertUnit(value, options.from, options.to, options.context)
      const rendered = tidy(result, options.decimals)
      out.push(rendered === '0' ? '0' : rendered + toSuffix)
      converted += 1
      i += numberText.length + fromSuffix.length
      continue
    }

    out.push(ch)
    i += 1
  }

  return { css: out.join(''), converted, skipped, skippedReasons }
}

export const CSS_BULK_SAMPLE = `.card {
  padding: 24px 32px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  background-image: url("sprite-32px.png");
}

.card__title {
  font-size: 18px;
  margin: 0 0 8px;
  content: "16px";
}

@media (min-width: 768px) {
  .card {
    padding: 40px;
    font-size: 16px;
  }
}`
