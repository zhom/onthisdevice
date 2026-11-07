import { Calculator } from '../engine/Calculator'
import { specs } from './specs'

/** Island of the loan and mortgage calculators. One per family keeps each page's bundle small. */
export default function LoansCalculator({ slug }: { slug: string }) {
  const spec = specs[slug]
  if (!spec) throw new Error(`[calculators] no loans spec for "${slug}"`)
  return <Calculator spec={spec} />
}
