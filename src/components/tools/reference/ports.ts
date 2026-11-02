/** IANA port registry search (pure, unit-tested in scripts/data/test.mjs). */

/** [from, to, service name, protocols, description, reference] */
export type PortEntry = [number, number, string, string, string, string]
type Entry = PortEntry

/** Searches the registry: a number finds the entries covering that port; text finds names, then descriptions. */
export function searchPorts(entries: Entry[], query: string): Entry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  if (/^\d+$/.test(q)) {
    const n = Number(q)
    return entries.filter((e) => e[0] <= n && n <= e[1])
  }
  const exact = entries.filter((e) => e[2].toLowerCase() === q)
  const starts = entries.filter((e) => e[2].toLowerCase() !== q && e[2].toLowerCase().startsWith(q))
  const words = q.split(/\s+/)
  const inText = entries.filter((e) => {
    if (e[2].toLowerCase().startsWith(q)) return false
    const hay = `${e[2]} ${e[4]}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
  return [...exact, ...starts, ...inText]
}

export function zoneOf(port: number): { name: string; index: number; from: number; to: number } {
  if (port <= 1023) return { name: 'System (well-known) port', index: 0, from: 0, to: 1023 }
  if (port <= 49151) return { name: 'Registered (user) port', index: 1, from: 1024, to: 49151 }
  return { name: 'Dynamic (private) port', index: 2, from: 49152, to: 65535 }
}

