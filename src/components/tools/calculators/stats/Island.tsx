import { Calculator } from '../engine/Calculator'
import { specs } from './specs'

/** Island of the statistics calculators. One per family keeps each page's bundle small. */
export default function StatsCalculator({ slug }: { slug: string }) {
  const spec = specs[slug]
  if (!spec) throw new Error(`[calculators] no stats spec for "${slug}"`)
  return <Calculator spec={spec} />
}
