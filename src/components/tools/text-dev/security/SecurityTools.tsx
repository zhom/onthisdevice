import { islandFor } from '../shell/island'
import { SECURITY_SPECS } from './specs'

/** Island of the 'security' family: hashes, password hashing, keys, certificates and validators. */
export default islandFor('security', SECURITY_SPECS)
