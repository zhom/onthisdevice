import { useEffect, useMemo, useState } from 'react'
import { findRuleSpans, ruleSpans } from '@/lib/ml/text/rules-client'
import type { RuleSet } from '@/lib/ml/text/rules-client'
import type { Span } from '@/lib/ml/text/types'

const INLINE = 40_000

/** Raw rule spans for `text`: computed in the render for short text, in a worker for long text. */
export function useRuleSpans(text: string, set: RuleSet): Span[] | null {
  const { pii, secrets, entropy, hosts } = set
  const short = text.length <= INLINE
  const inline = useMemo(
    () => (short ? findRuleSpans(text, { pii, secrets, entropy, hosts }) : null),
    [text, short, pii, secrets, entropy, hosts],
  )
  const [later, setLater] = useState<{ text: string; spans: Span[] } | null>(null)
  useEffect(() => {
    if (short) return
    let live = true
    void ruleSpans(text, { pii, secrets, entropy, hosts }).then((spans) => {
      if (live) setLater({ text, spans })
    })
    return () => {
      live = false
    }
  }, [text, short, pii, secrets, entropy, hosts])
  if (inline) return inline
  return later && later.text === text ? later.spans : null
}
