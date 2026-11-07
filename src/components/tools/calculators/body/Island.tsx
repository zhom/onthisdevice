import { Calculator } from '../engine/Calculator'
import { specs } from './specs'

/** Island of the body, fitness and pet calculators. One per family keeps each page's bundle small. */
export default function BodyCalculator({ slug }: { slug: string }) {
  const spec = specs[slug]
  if (!spec) throw new Error(`[calculators] no body spec for "${slug}"`)
  return <Calculator spec={spec} />
}
