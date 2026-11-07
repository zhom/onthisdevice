import type { Tool } from './types'
import type { CalcDef, Family, FamilyData } from './calc-families/types'
import { toTool } from './calc-families/types'
import { loans } from './calc-families/loans'
import { invest } from './calc-families/invest'
import { tax } from './calc-families/tax'
import { body } from './calc-families/body'
import { clinical } from './calc-families/clinical'
import { stats } from './calc-families/stats'
import { algebra } from './calc-families/algebra'
import { geometry } from './calc-families/geometry'
import { physics } from './calc-families/physics'
import { electric } from './calc-families/electric'

/** Round-3 calculators. Pages: src/components/tools/calculators/Page.astro via src/pages/[slug].astro. */
const FAMILIES: FamilyData[] = [loans, invest, tax, body, clinical, stats, algebra, geometry, physics, electric]

export const tools: Tool[] = FAMILIES.flatMap((f) => f.defs.map(toTool))

/** Family and explainer of each calculator, for the page component. */
export const CALCULATOR_PAGES: ReadonlyMap<string, { family: Family; def: CalcDef }> = new Map(
  FAMILIES.flatMap((f) => f.defs.map((def) => [def.slug, { family: f.family, def }] as const)),
)
