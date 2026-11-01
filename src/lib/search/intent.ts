/**
 * Two kinds of queries that name what the visitor wants without naming a tool:
 * a format pair ("heic to jpg", "mov mp4", "pdf into word") and a target size ("under 100kb").
 */
import { FORMAT_BY_ALIAS } from './synonyms'

export interface PairIntent {
  from: string
  to: string
  /** True when the query holds nothing but the two formats and connecting words. */
  pure: boolean
}

export type SizeDomain = 'image' | 'jpg' | 'png' | 'pdf'

export interface SizeIntent {
  kb: number
  domain: SizeDomain | null
}

const CONNECT = new Set(['to', 'into', '2', 'as', 'in'])
const FILLER = new Set([
  'convert', 'converter', 'conversion', 'change', 'turn', 'transform', 'export', 'save', 'file',
  'files', 'online', 'free', 'format', 'from', 'a', 'an', 'the', 'my', 'how', 'do', 'i', 'can',
  'with', 'without', 'losing', 'quality', 'batch', 'bulk', 'fast', 'high', 'tool', 'one',
])

/** `tokens` are the words of the normalized query, stopwords included. */
export function parsePair(tokens: readonly string[]): PairIntent | null {
  const at: number[] = []
  tokens.forEach((t, i) => {
    if (FORMAT_BY_ALIAS.has(t)) at.push(i)
  })
  for (let a = 0; a < at.length; a++) {
    for (let b = a + 1; b < at.length; b++) {
      const i = at[a]
      const j = at[b]
      const between = tokens.slice(i + 1, j)
      if (between.length > 2 || !between.every((w) => CONNECT.has(w) || FILLER.has(w))) continue
      const from = FORMAT_BY_ALIAS.get(tokens[i]) ?? ''
      const to = FORMAT_BY_ALIAS.get(tokens[j]) ?? ''
      if (!from || !to || from === to) continue
      const pure = tokens.every((w, k) => k === i || k === j || CONNECT.has(w) || FILLER.has(w))
      return { from, to, pure }
    }
  }
  return null
}

const SIZE = /(?:^|[^a-z0-9.])(\d+(?:\.\d+)?)(kb|k|kib|mb|mib|m)\b/
const SIZE_CUE = /\b(?:under|below|less|smaller|max|maximum|within|compress|reduce|shrink|size|kb|mb)\b/

/** `text` is the normalized query, where "100 kb" is already "100kb". */
export function parseSize(text: string, tokens: readonly string[]): SizeIntent | null {
  const m = SIZE.exec(text)
  if (!m) return null
  const n = Number(m[1])
  const unit = m[2]
  if (!Number.isFinite(n) || n <= 0) return null
  // "5m" is more often metres than megabytes; only read it as a size with a size word nearby.
  if (unit === 'm' && !SIZE_CUE.test(text.replace(m[0], ' '))) return null
  const kb = unit.startsWith('m') ? n * 1000 : n
  if (kb < 1 || kb > 100_000) return null
  let domain: SizeDomain | null = null
  for (const t of tokens) {
    const f = FORMAT_BY_ALIAS.get(t)
    if (f === 'pdf') domain = 'pdf'
    else if (f === 'jpg' && domain !== 'pdf') domain = 'jpg'
    else if (f === 'png' && domain !== 'pdf') domain = 'png'
    else if ((f === 'image' || f === 'webp' || f === 'avif' || f === 'heic') && !domain) domain = 'image'
  }
  return { kb, domain }
}

/** A tool that compresses to a size: a preset ("compress-image-to-100kb") or any size. */
export interface SizeTool {
  domain: SizeDomain
  /** Target in KB, or 0 when the visitor picks the size. */
  kb: number
}

const PRESET = /^(?:compress|reduce|resize)-(image|photo|pdf|jpeg|jpg|png)-to-(\d+(?:\.\d+)?)(kb|mb)$/
const ANY_SIZE = /^(?:compress|reduce|resize)-(image|photo|pdf|jpeg|jpg|png)-(?:to-size|size-in-kb|to-kb)$/

function domainOf(word: string): SizeDomain {
  if (word === 'pdf') return 'pdf'
  if (word === 'jpeg' || word === 'jpg') return 'jpg'
  if (word === 'png') return 'png'
  return 'image'
}

export function sizeToolOf(slug: string): SizeTool | null {
  const p = PRESET.exec(slug)
  if (p) return { domain: domainOf(p[1]), kb: Number(p[2]) * (p[3] === 'mb' ? 1000 : 1) }
  const a = ANY_SIZE.exec(slug)
  if (a) return { domain: domainOf(a[1]), kb: 0 }
  return null
}

/** How well a size tool answers a size intent: 0 (not at all) to 100. */
export function sizeFit(tool: SizeTool, want: SizeIntent): number {
  const d = want.domain
  let domainFit: number
  if (d === null) domainFit = tool.domain === 'image' ? 1 : tool.domain === 'pdf' ? 0.8 : 0.7
  else if (d === tool.domain) domainFit = 1
  else if (d === 'image' && (tool.domain === 'jpg' || tool.domain === 'png')) domainFit = 0.7
  else if ((d === 'jpg' || d === 'png') && tool.domain === 'image') domainFit = 0.85
  else return 0
  let sizeFit: number
  if (tool.kb === 0) sizeFit = 0.75
  else if (tool.kb === want.kb) sizeFit = 1
  else if (tool.kb < want.kb) sizeFit = 0.45 + 0.1 * (tool.kb / want.kb)
  else sizeFit = 0.05
  return 100 * domainFit * sizeFit
}

/** Slug words on each side of "-to-": "pdf-to-word" gives [["pdf"], ["word"]]. */
export function slugPair(slug: string): [string[], string[]] | null {
  const k = slug.indexOf('-to-')
  if (k < 0) return null
  return [slug.slice(0, k).split('-'), slug.slice(k + 4).split('-')]
}
