/**
 * What this visitor used, kept in this browser's localStorage only: the recent tools, and how
 * often one tool followed another (for "next tool" suggestions). Never sent anywhere.
 */

const RECENTS_KEY = 'otd:recent-tools'
const PAIRS_KEY = 'otd:tool-pairs'
const LAST_KEY = 'otd:last-tool'
const MAX_RECENTS = 8
const MAX_FROM = 80
const MAX_TO = 8
/** Two visits further apart than this are not one session. */
const SESSION_MS = 45 * 60 * 1000

type Pairs = Record<string, Record<string, number>>

function read<T>(key: string, valid: (v: unknown) => v is T, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    return valid(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage off or full: history is optional */
  }
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string')
const isPairs = (v: unknown): v is Pairs => typeof v === 'object' && v !== null && !Array.isArray(v)
const isLast = (v: unknown): v is { slug: string; at: number } =>
  typeof v === 'object' && v !== null && typeof (v as { slug?: unknown }).slug === 'string' && typeof (v as { at?: unknown }).at === 'number'

export function readRecents(): string[] {
  return read(RECENTS_KEY, isStringArray, []).slice(0, MAX_RECENTS)
}

/** Records that the visitor opened a tool page. Call once per page view. */
export function recordVisit(slug: string, now = Date.now()): void {
  const recents = readRecents()
  write(RECENTS_KEY, [slug, ...recents.filter((s) => s !== slug)].slice(0, MAX_RECENTS))

  const last = read(LAST_KEY, isLast, null)
  if (last && last.slug !== slug && now - last.at < SESSION_MS) {
    const pairs = read(PAIRS_KEY, isPairs, {})
    const row = { ...(pairs[last.slug] ?? {}) }
    row[slug] = (row[slug] ?? 0) + 1
    const trimmed = Object.fromEntries(
      Object.entries(row)
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_TO),
    )
    delete pairs[last.slug]
    const next: Pairs = { [last.slug]: trimmed, ...pairs }
    write(PAIRS_KEY, Object.fromEntries(Object.entries(next).slice(0, MAX_FROM)))
  }
  write(LAST_KEY, { slug, at: now })
}

/** Tools the visitor opened after `slug`, most often first. */
export function readNext(slug: string): [string, number][] {
  const row = read(PAIRS_KEY, isPairs, {})[slug]
  if (!row || typeof row !== 'object') return []
  return Object.entries(row)
    .filter((e): e is [string, number] => typeof e[1] === 'number')
    .sort((a, b) => b[1] - a[1])
}

/** A small search score bonus for recently used tools: 3 for the latest, less for older. */
export function usageBoost(): Map<string, number> {
  return new Map(readRecents().map((slug, i) => [slug, Math.max(0.5, 3 - i * 0.4)]))
}
