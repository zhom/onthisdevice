import { islandFor } from '../shell/island'
import { WEB_SPECS } from '../web/specs'
import { ENCODE_SPECS } from './specs'

/** Island of the 'encode' family: encoders, parsers, ID tools and web config generators. */
export default islandFor('encode', { ...ENCODE_SPECS, ...WEB_SPECS })
