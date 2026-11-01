/**
 * Pattern rules, run in the page for short texts (a few milliseconds) and in
 * a worker for long ones, so typing never stalls.
 */
import { findPii } from './pii-rules'
import { findSecrets } from './secret-rules'
import type { RulesRequest, RulesResponse } from './rules.worker'
import type { Span } from './types'

export interface RuleSet {
  pii?: boolean
  secrets?: boolean
  entropy?: boolean
  hosts?: boolean
}

/** Above this many characters the rules run in a worker. */
const INLINE_LIMIT = 40_000

export function findRuleSpans(text: string, set: RuleSet = {}): Span[] {
  const spans: Span[] = []
  if (set.pii !== false) spans.push(...findPii(text))
  if (set.secrets !== false) spans.push(...findSecrets(text, { entropy: set.entropy !== false, hosts: set.hosts }))
  return spans
}

let worker: Worker | null = null
let nextId = 1
const waiting = new Map<number, (spans: Span[]) => void>()

function ensure(): Worker {
  if (worker) return worker
  const w = new Worker(new URL('./rules.worker.ts', import.meta.url), { type: 'module', name: 'rules' })
  w.onmessage = (event: MessageEvent<RulesResponse>) => {
    waiting.get(event.data.id)?.(event.data.spans)
    waiting.delete(event.data.id)
  }
  worker = w
  return w
}

/** Raw (unmerged) rule spans, from the page or from a worker depending on length. */
export function ruleSpans(text: string, set: RuleSet = {}): Promise<Span[]> {
  if (text.length <= INLINE_LIMIT) return Promise.resolve(findRuleSpans(text, set))
  const id = nextId++
  return new Promise((resolve) => {
    waiting.set(id, resolve)
    const req: RulesRequest = {
      id,
      text,
      pii: set.pii !== false,
      secrets: set.secrets !== false,
      entropy: set.entropy !== false,
      hosts: Boolean(set.hosts),
    }
    ensure().postMessage(req)
  })
}
