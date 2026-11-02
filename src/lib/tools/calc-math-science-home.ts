import type { Tool } from './types'
import { tools as mathStats } from './calc2-math-stats'
import { tools as mathGeometry } from './calc2-math-geometry'
import { tools as science } from './calc2-science'
import { tools as home } from './calc2-home'
import { tools as everyday } from './calc2-everyday'

/** Math, science, home and everyday calculators with animated visuals (islands in components/tools/calc2). */
export const tools: Tool[] = [...mathStats, ...mathGeometry, ...science, ...home, ...everyday]
