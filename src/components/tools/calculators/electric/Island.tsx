import { Calculator } from '../engine/Calculator'
import { specs } from './specs'

/** Island of the electrical calculators. One per family keeps each page's bundle small. */
export default function ElectricCalculator({ slug }: { slug: string }) {
  const spec = specs[slug]
  if (!spec) throw new Error(`[calculators] no electric spec for "${slug}"`)
  return <Calculator spec={spec} />
}
