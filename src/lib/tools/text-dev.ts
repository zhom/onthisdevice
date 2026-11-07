import type { Tool } from './types'
import { DEV_DEFS } from './text-dev-pages/dev'
import { GENERATOR_DEFS } from './text-dev-pages/generators'
import { SECURITY_DEFS } from './text-dev-pages/security'
import { TEXT_DEFS } from './text-dev-pages/text'
import type { Def } from './text-dev-pages/types'
import { WORD_DEFS } from './text-dev-pages/words'

/** Round-3 text, developer, security, generator and word tools. Pages: src/components/tools/text-dev/Page.astro. */
const DEFS: Def[] = [...TEXT_DEFS, ...DEV_DEFS, ...SECURITY_DEFS, ...GENERATOR_DEFS, ...WORD_DEFS]

export const tools: Tool[] = DEFS

/** Family and explainer of each tool, for the page component. */
export const TEXT_DEV_PAGES: ReadonlyMap<string, Def> = new Map(DEFS.map((d) => [d.slug, d]))
