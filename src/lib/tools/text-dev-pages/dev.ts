import { CODE_DEFS } from './dev-code'
import { DATA_DEFS } from './dev-data'
import { ENCODE_DEFS } from './dev-encode'
import { WEB_DEFS } from './dev-web'
import type { Def } from './types'

export const DEV_DEFS: Def[] = [...CODE_DEFS, ...DATA_DEFS, ...ENCODE_DEFS, ...WEB_DEFS]
