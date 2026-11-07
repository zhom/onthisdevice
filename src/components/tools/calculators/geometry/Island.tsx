import { Calculator } from '../engine/Calculator'
import { specs } from './specs'

/** Island of the geometry calculators. One per family keeps each page's bundle small. */
export default function GeometryCalculator({ slug }: { slug: string }) {
  const spec = specs[slug]
  if (!spec) throw new Error(`[calculators] no geometry spec for "${slug}"`)
  return <Calculator spec={spec} />
}
