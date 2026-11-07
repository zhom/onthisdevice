import { Calculator } from '../engine/Calculator'
import { specs } from './specs'

/** Island of the algebra calculators. One per family keeps each page's bundle small. */
export default function AlgebraCalculator({ slug }: { slug: string }) {
  const spec = specs[slug]
  if (!spec) throw new Error(`[calculators] no algebra spec for "${slug}"`)
  return <Calculator spec={spec} />
}
