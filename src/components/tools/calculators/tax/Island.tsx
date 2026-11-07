import { Calculator } from '../engine/Calculator'
import { specs } from './specs'

/** Island of the tax, real estate and business calculators. One per family keeps each page's bundle small. */
export default function TaxCalculator({ slug }: { slug: string }) {
  const spec = specs[slug]
  if (!spec) throw new Error(`[calculators] no tax spec for "${slug}"`)
  return <Calculator spec={spec} />
}
