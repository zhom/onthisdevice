import { Calculator } from '../engine/Calculator'
import { specs } from './specs'

/** Island of the physics calculators. One per family keeps each page's bundle small. */
export default function PhysicsCalculator({ slug }: { slug: string }) {
  const spec = specs[slug]
  if (!spec) throw new Error(`[calculators] no physics spec for "${slug}"`)
  return <Calculator spec={spec} />
}
