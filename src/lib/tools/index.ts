import type { Category, CategoryId, GroupId, Tool } from './types'
import { CATEGORIES, CATEGORY_BY_ID, GROUPS } from './types'

// One module per category. Each exports `export const tools: Tool[]`.
import { tools as pdfTools } from './pdf'
import { tools as pdfConvertTools } from './pdf-convert'
import { tools as imageConvertTools } from './image-convert'
import { tools as imageEditTools } from './image-edit'
import { tools as mediaTools } from './media'
import { tools as dataTools } from './data'
import { tools as financeTools } from './finance'
import { tools as healthTools } from './health'
import { tools as mathTools } from './math'
import { tools as unitsTools } from './units'
import { tools as datetimeTools } from './datetime'
import { tools as textTools } from './text'
import { tools as devTools } from './dev'
import { tools as securityTools } from './security'
import { tools as generatorTools } from './generators'
import { tools as everydayTools } from './everyday'
import { tools as redactTools } from './redact'
import { tools as calcMoneyBodyTools } from './calc-money-body'
import { tools as calcMathScienceHomeTools } from './calc-math-science-home'
import { tools as referenceDataTools } from './reference-data'

// Round-2 batch modules. Each batch was built by its own agent and registers
// here rather than in the round-1 category modules above, so that the two
// rounds never contend for the same file. The `category` field inside them
// still points at the existing CategoryId set — these are extra tools in the
// established categories, not new categories.
import { tools as pdfEditTools } from './extra-pdf-edit'
import { tools as pdfPagesTools } from './extra-pdf-pages'
import { tools as pdfSecureTools } from './extra-pdf-secure'
import { tools as videoTools } from './extra-video'
import { tools as gifAudioTools } from './extra-gif-audio'
import { tools as photoTools } from './extra-photo'
import { tools as devFormatTools } from './extra-dev-format'
import { tools as devEncodeTools } from './extra-dev-encode'
import { tools as calcMoneyTools } from './extra-calc-money'
import { tools as unitsLifeTools } from './extra-units-life'

export type { Category, CategoryId, GroupId, Tool, Faq } from './types'
export { CATEGORIES, CATEGORY_BY_ID, GROUPS } from './types'

export const TOOLS: Tool[] = [
  ...pdfTools,
  ...pdfConvertTools,
  ...imageConvertTools,
  ...imageEditTools,
  ...mediaTools,
  ...dataTools,
  ...financeTools,
  ...healthTools,
  ...mathTools,
  ...unitsTools,
  ...datetimeTools,
  ...textTools,
  ...devTools,
  ...securityTools,
  ...generatorTools,
  ...everydayTools,
  ...redactTools,
  ...calcMoneyBodyTools,
  ...calcMathScienceHomeTools,
  ...referenceDataTools,
  ...pdfEditTools,
  ...pdfPagesTools,
  ...pdfSecureTools,
  ...videoTools,
  ...gifAudioTools,
  ...photoTools,
  ...devFormatTools,
  ...devEncodeTools,
  ...calcMoneyTools,
  ...unitsLifeTools,
].sort((a, b) => a.title.localeCompare(b.title))

export const TOOL_BY_SLUG: Map<string, Tool> = new Map(TOOLS.map((t) => [t.slug, t]))

export function getTool(slug: string): Tool | undefined {
  return TOOL_BY_SLUG.get(slug)
}

/** Throws at build time if a page references a slug that isn't registered. */
export function requireTool(slug: string): Tool {
  const tool = TOOL_BY_SLUG.get(slug)
  if (!tool) {
    throw new Error(
      `[tools] No registry entry for "${slug}". Add it to src/lib/tools/<category>.ts.`,
    )
  }
  return tool
}

export function toolHref(tool: Tool | string): string {
  return `/${typeof tool === 'string' ? tool : tool.slug}`
}

export function categoryHref(category: Category | CategoryId): string {
  const c = typeof category === 'string' ? CATEGORY_BY_ID[category] : category
  return `/category/${c.slug}`
}

export function toolsByCategory(id: CategoryId): Tool[] {
  return TOOLS.filter((t) => t.category === id)
}

export function categoriesByGroup(group: GroupId): Category[] {
  return CATEGORIES.filter((c) => c.group === group)
}

export const POPULAR_TOOLS: Tool[] = TOOLS.filter((t) => t.popular)

/**
 * Related tools for the cross-link rail: explicit `related` slugs first, then
 * same-category siblings, then same-group neighbours. Always returns `limit`
 * entries when the registry is large enough.
 */
export function relatedTools(tool: Tool, limit = 6): Tool[] {
  const out: Tool[] = []
  const seen = new Set([tool.slug])
  const push = (t?: Tool) => {
    if (t && !seen.has(t.slug) && out.length < limit) {
      seen.add(t.slug)
      out.push(t)
    }
  }
  for (const slug of tool.related ?? []) push(TOOL_BY_SLUG.get(slug))
  for (const t of toolsByCategory(tool.category)) push(t)
  const group = CATEGORY_BY_ID[tool.category]?.group
  if (group) {
    for (const c of categoriesByGroup(group)) {
      for (const t of toolsByCategory(c.id)) push(t)
    }
  }
  return out
}

export const TOOL_COUNT = TOOLS.length
