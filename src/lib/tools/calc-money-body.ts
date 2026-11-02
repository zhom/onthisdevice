import type { Tool } from './types'
import { tools as loans } from './money-body/loans'
import { tools as invest } from './money-body/invest'
import { tools as tvm } from './money-body/tvm'
import { tools as pay } from './money-body/pay'
import { tools as bodyA } from './money-body/body-a'
import { tools as bodyB } from './money-body/body-b'

/** Finance and health calculators with animated visuals (islands in src/components/tools/calc). */
export const tools: Tool[] = [...loans, ...invest, ...tvm, ...pay, ...bodyA, ...bodyB]
