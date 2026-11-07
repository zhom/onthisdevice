import { ANALYZE_SPECS } from '../analyze/specs'
import { islandFor } from '../shell/island'
import { TEXT_SPECS } from './specs'

export default islandFor('text', { ...TEXT_SPECS, ...ANALYZE_SPECS })
