/**
 * Registry entries and explainers of the round-3 calculators, one module per family.
 * Each family has one island in src/components/tools/calculators/<family>/ with the specs.
 */
import type { CategoryId, Faq, Tool } from '../types'

export type Family =
  | 'loans'
  | 'invest'
  | 'tax'
  | 'body'
  | 'clinical'
  | 'stats'
  | 'algebra'
  | 'geometry'
  | 'physics'
  | 'electric'
  | 'chem'
  | 'build'
  | 'yard'
  | 'dates'
  | 'everyday'

/** The text under a calculator: method, formula, an optional table and the sources. */
export interface Explain {
  /** Lower-case name in "How the … works". Default the title in lower case. */
  name?: string
  how: string[]
  formula: string
  example?: string
  table?: { title: string; head: string[]; rows: (string | number)[][] }
  notes?: string
  /** A label with a link, or a citation without one (a paper or a book). */
  sources: (readonly [label: string, url?: string])[]
}

export interface CalcDef {
  slug: string
  title: string
  h1?: string
  description: string
  keywords: string[]
  category: CategoryId
  icon: string
  popular?: boolean
  faqs: Faq[]
  related: string[]
  explain: Explain
}

export interface FamilyData {
  family: Family
  defs: CalcDef[]
}

const UPDATED = '2026-11-07'

export function toTool(d: CalcDef): Tool {
  const { explain: _, ...tool } = d
  return { ...tool, updated: UPDATED }
}
