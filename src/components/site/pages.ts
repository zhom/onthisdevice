/**
 * Which tools have a page. A tool has a page file in src/pages, or src/pages/[slug].astro
 * renders it: that route takes every tool of the round-3 registry modules that has no page
 * file, and hands it to the page component of its module (OWNERS). Lists and menus link only
 * to tools with a page, so a tool can be registered before its page exists.
 */
import type { Tool } from '@/lib/tools/types'
import { tools as aiTools } from '@/lib/tools/ai'
import { tools as convertTools } from '@/lib/tools/convert'
import { tools as calculatorTools } from '@/lib/tools/calculators'
import { tools as textDevTools } from '@/lib/tools/text-dev'

const files = Object.keys(import.meta.glob('/src/pages/*.astro'))
const FILES = new Set(files.map((f) => f.slice('/src/pages/'.length, -'.astro'.length)))

/** Registry module of a routed tool; [slug].astro maps each to its page component. */
export type Owner = 'ai' | 'convert' | 'calculators' | 'text-dev'

const OWNERS: Record<Owner, Tool[]> = {
  ai: aiTools,
  convert: convertTools,
  calculators: calculatorTools,
  'text-dev': textDevTools,
}

export const ROUTED: { slug: string; owner: Owner }[] = (Object.entries(OWNERS) as [Owner, Tool[]][]).flatMap(
  ([owner, tools]) => tools.filter((t) => !FILES.has(t.slug)).map((t) => ({ slug: t.slug, owner })),
)

const SLUGS = new Set([...FILES, ...ROUTED.map((r) => r.slug)])

export const hasPage = (tool: { slug: string }): boolean => SLUGS.has(tool.slug)
