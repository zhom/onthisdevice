import { Calculator } from '../engine/Calculator'
import { specs } from './specs'

/** Island of the clinical calculators. One per family keeps each page's bundle small. */
export default function ClinicalCalculator({ slug }: { slug: string }) {
  const spec = specs[slug]
  if (!spec) throw new Error(`[calculators] no clinical spec for "${slug}"`)
  return <Calculator spec={spec} />
}
