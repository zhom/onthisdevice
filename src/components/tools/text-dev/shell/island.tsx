import { ToolShell } from './ToolShell'
import type { Specs } from './spec'

/** The island component of a family: renders the spec of the slug it is given. */
export function islandFor(family: string, specs: Specs) {
  return function Island({ slug }: { slug: string }) {
    const spec = specs[slug]
    if (!spec) throw new Error(`[text-dev] no ${family} tool "${slug}"`)
    return <ToolShell spec={spec} />
  }
}
