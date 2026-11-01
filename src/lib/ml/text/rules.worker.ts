/// <reference lib="webworker" />
/** Runs the pattern rules off the main thread for long texts. See ./rules-client.ts. */
import { findPii } from './pii-rules'
import { findSecrets } from './secret-rules'
import type { Span } from './types'

export interface RulesRequest {
  id: number
  text: string
  pii: boolean
  secrets: boolean
  entropy: boolean
  hosts: boolean
}

export interface RulesResponse {
  id: number
  spans: Span[]
}

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = (event: MessageEvent<RulesRequest>) => {
  const { id, text, pii, secrets, entropy, hosts } = event.data
  const spans: Span[] = []
  if (pii) spans.push(...findPii(text))
  if (secrets) spans.push(...findSecrets(text, { entropy, hosts }))
  scope.postMessage({ id, spans } satisfies RulesResponse)
}
