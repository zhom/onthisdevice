import { ANALYZE_DEFS } from './text-analyze'
import { CASE_DEFS } from './text-case'
import { CIPHER_DEFS } from './text-cipher'
import { CLEAN_DEFS } from './text-clean'
import { EXTRACT_DEFS } from './text-extract'
import { FANCY_DEFS } from './text-fancy'
import { LINES_DEFS } from './text-lines'
import type { Def } from './types'

export const TEXT_DEFS: Def[] = [...CASE_DEFS, ...CLEAN_DEFS, ...LINES_DEFS, ...EXTRACT_DEFS, ...CIPHER_DEFS, ...FANCY_DEFS, ...ANALYZE_DEFS]
