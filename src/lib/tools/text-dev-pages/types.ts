import type { Tool } from '../types'

/** Island that renders a tool. Each family has one island in src/components/tools/text-dev/<family>/. */
export type Family = 'text' | 'fancy' | 'code' | 'encode' | 'security' | 'words'

/** One explainer section: a heading and any of paragraphs, a list, a table and a code sample. Backticks mark code. */
export interface Section {
  h: string
  p?: readonly string[]
  list?: readonly string[]
  table?: { head: readonly string[]; rows: readonly (readonly string[])[] }
  code?: string
}

export interface Def extends Tool {
  family: Family
  explainer: readonly Section[]
}

export const UPDATED = '2026-11-07'

export const def = (d: Omit<Def, 'updated'>): Def => ({ ...d, updated: UPDATED })
