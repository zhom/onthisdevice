/**
 * Loading the reference data files. Small manifests are imported at build time from
 * src/data/; bigger files are fetched from this site (`/data/<name>/<hash>/...`). The hash
 * folder never changes content, so a cached copy is always the right one.
 */

export interface DataLink {
  name: string
  url: string
}

export interface DataMeta {
  source: DataLink
  sources?: DataLink[]
  licence: DataLink
  fetchedAt: string
  validFor: string
}

const jsonCache = new Map<string, Promise<unknown>>()
const textCache = new Map<string, Promise<string>>()

async function get(url: string): Promise<Response> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status}).`)
  return res
}

/** Fetches and parses a JSON file from this site once per page. */
export function loadJson<T>(url: string): Promise<T> {
  let p = jsonCache.get(url)
  if (!p) {
    p = get(url).then((r) => r.json())
    p.catch(() => jsonCache.delete(url))
    jsonCache.set(url, p)
  }
  return p as Promise<T>
}

export function loadText(url: string): Promise<string> {
  let p = textCache.get(url)
  if (!p) {
    p = get(url).then((r) => r.text())
    p.catch(() => textCache.delete(url))
    textCache.set(url, p)
  }
  return p
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-10-30" or an ISO timestamp -> "Oct 30, 2026" (UTC, so the server date and the reader agree). */
export function formatDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`
}

/** "2026-09" -> "Sep 2026" */
export function formatMonth(ym: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(ym)
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : ym
}

/** Day number (days since 1970-01-01, UTC) of an ISO date. */
export function dayNumber(iso: string): number {
  return Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000)
}

export function isoOfDay(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10)
}
