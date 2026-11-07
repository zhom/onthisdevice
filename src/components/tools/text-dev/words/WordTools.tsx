import { GENERATE_SPECS } from '../generate/specs'
import { islandFor } from '../shell/island'
import { WORD_SPECS } from './specs'

/** Island of the 'generate' and 'words' families: random data generators and word tools. */
export default islandFor('words', { ...WORD_SPECS, ...GENERATE_SPECS })
