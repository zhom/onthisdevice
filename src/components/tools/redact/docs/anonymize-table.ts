/** Applies a column plan to table cells: keep, mask, hash, fake, redact inside, drop. */
import { hmacHex, KIND_TYPE, maskValue } from '@/lib/ml/text/columns'
import type { ColumnAction, ColumnKind } from '@/lib/ml/text/columns'
import { mergeSpans } from '@/lib/ml/text/merge'
import { findPii } from '@/lib/ml/text/pii-rules'
import { maskSpans } from '@/lib/ml/text/placeholders'
import type { Replacer } from '@/lib/ml/text/placeholders'
import { findSecrets } from '@/lib/ml/text/secret-rules'
import type { Span } from '@/lib/ml/text/types'
import { nextFrame } from '@/lib/utils'

export interface ColumnPlan {
  kind: ColumnKind
  action: ColumnAction
}

export interface Engine {
  replacer: Replacer
  key: CryptoKey
  /** Free text: [NAME] labels or fake values. */
  textStyle: 'label' | 'fake'
  /** Model spans for each text, when the model is on. */
  ner?: (texts: string[], onProgress: (p: number) => void) => Promise<Span[][]>
}

function fakeCell(kind: ColumnKind, value: string, replacer: Replacer): string {
  if (!value.trim()) return value
  if (kind === 'first-name') return replacer.fakePart(value, 'first')
  if (kind === 'last-name') return replacer.fakePart(value, 'last')
  return replacer.fake(KIND_TYPE[kind] ?? 'ID', value)
}

/** One column's new values. Hashes are computed once per distinct value. */
export async function transformColumn(values: string[], plan: ColumnPlan, engine: Engine, onProgress?: (p: number) => void): Promise<string[]> {
  const { action, kind } = plan
  if (action === 'keep' || action === 'drop') return values
  if (action === 'mask') return values.map((v) => maskValue(kind, v))
  if (action === 'fake') return values.map((v) => fakeCell(kind, v, engine.replacer))
  if (action === 'hash') {
    const cache = new Map<string, string>()
    const out: string[] = []
    for (let i = 0; i < values.length; i++) {
      const v = values[i]
      if (!v.trim()) {
        out.push(v)
        continue
      }
      let h = cache.get(v)
      if (h === undefined) {
        h = await hmacHex(engine.key, kind === 'email' ? v.trim().toLowerCase() : v)
        cache.set(v, h)
      }
      out.push(h)
      if (i % 2000 === 1999) {
        onProgress?.(i / values.length)
        await nextFrame()
      }
    }
    return out
  }
  // Redact inside free text: rules, plus the model when it is on.
  const model = engine.ner ? await engine.ner(values, (p) => onProgress?.(p * 0.8)) : null
  const out: string[] = []
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (!v.trim()) {
      out.push(v)
      continue
    }
    const spans = mergeSpans(v, [...findPii(v), ...findSecrets(v), ...(model?.[i] ?? [])]).filter((s) => s.type !== 'DATE' && s.type !== 'PRODUCT' && s.type !== 'URL')
    out.push(maskSpans(v, spans, engine.textStyle === 'fake' ? 'fake' : 'label', engine.replacer).output)
    if (i % 500 === 499) {
      onProgress?.(0.8 + (i / values.length) * 0.2)
      await nextFrame()
    }
  }
  return out
}
