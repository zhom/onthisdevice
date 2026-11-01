export type AnswerKind = 'math' | 'percent' | 'unit' | 'base' | 'time' | 'color' | 'uuid' | 'date'

export interface Answer {
  kind: AnswerKind
  /** The result for display: "12", "176.37 lb", "255", "2026-12-25". Plain, short. */
  value: string
  /** The question restated plainly: "15% of 80", "5 kg in pounds". */
  label: string
  /** Plain text for the clipboard (no thousands separators for numbers). */
  copy: string
  /** Registry slug of the full tool that does this. */
  slug: string
  /** Up to 3 extra short lines, e.g. other bases or color notations. */
  more?: string[]
  /** CSS color for one swatch, only for color answers ("#ff0000"). */
  swatch?: string
}

/** A number as typed: "1,000", "-2.5", ".5". Used inside larger patterns. */
export const NUM = '(-?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|-?\\.\\d+)'

export const toNumber = (s: string): number => Number(s.replace(/,/g, ''))
