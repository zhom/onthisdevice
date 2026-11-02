/** Support status of a software release cycle (pure, unit-tested in scripts/data/test.mjs). */

/** An end date: ISO date, true (ended, no date), false (no end set), null (not tracked). */
export type Until = string | boolean | null
/** [name, label, released, activeSupportUntil, securitySupportUntil, latest, latestDate, lts] */
export type Cycle = [string, string, string, Until, Until, string, string, number]

export type CycleState = 'active' | 'security' | 'eol' | 'unknown'

const passed = (u: Until, today: string): boolean => u === true || (typeof u === 'string' && u <= today)

export function cycleState(c: Cycle, today: string): CycleState {
  const [, , , active, security] = c
  if (passed(security, today)) return 'eol'
  if (security === null && active === null) return 'unknown'
  if (passed(active, today)) return 'security'
  return 'active'
}

/** The cycle a version belongs to: the longest cycle name that is the version or a dotted prefix of it. */
export function matchCycle(version: string, cycles: Cycle[]): Cycle | null {
  const v = version.trim().toLowerCase().replace(/^v/, '')
  if (!v) return null
  let best: Cycle | null = null
  for (const c of cycles) {
    const name = c[0].toLowerCase()
    if ((v === name || v.startsWith(`${name}.`) || v.startsWith(`${name}-`) || v.startsWith(`${name} `)) && (!best || name.length > best[0].length)) best = c
  }
  return best
}

/** Days from `from` to `to` (ISO dates). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}
