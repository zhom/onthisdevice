import { Calculator } from '../engine/Calculator'
import { specs } from './specs'

/** Island of the investing and retirement calculators. One per family keeps each page's bundle small. */
export default function InvestCalculator({ slug }: { slug: string }) {
  const spec = specs[slug]
  if (!spec) throw new Error(`[calculators] no invest spec for "${slug}"`)
  return <Calculator spec={spec} />
}
