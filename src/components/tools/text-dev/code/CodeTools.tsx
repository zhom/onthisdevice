import { DATA_SPECS } from '../data/specs'
import { islandFor } from '../shell/island'
import { CODE_SPECS } from './specs'

/** Island of the 'code' family: formatters, minifiers and data format conversions. */
export default islandFor('code', { ...CODE_SPECS, ...DATA_SPECS })
