/** Great-circle maths and airport search (pure, unit-tested in scripts/data/test.mjs). */

export const EARTH_KM = 6371.0088
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

/** Haversine distance in kilometres. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Initial bearing (degrees from north, clockwise) from point 1 toward point 2. */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2))
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1))
  return (deg(Math.atan2(y, x)) + 360) % 360
}

/** n+1 points along the great circle from 1 to 2, as [lat, lon]. */
export function greatCircle(lat1: number, lon1: number, lat2: number, lon2: number, n = 96): [number, number][] {
  const p1 = [Math.cos(rad(lat1)) * Math.cos(rad(lon1)), Math.cos(rad(lat1)) * Math.sin(rad(lon1)), Math.sin(rad(lat1))]
  const p2 = [Math.cos(rad(lat2)) * Math.cos(rad(lon2)), Math.cos(rad(lat2)) * Math.sin(rad(lon2)), Math.sin(rad(lat2))]
  const dot = Math.min(1, Math.max(-1, p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2]))
  const omega = Math.acos(dot)
  const out: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    let v: number[]
    if (omega < 1e-9) v = p1
    else {
      const a = Math.sin((1 - t) * omega) / Math.sin(omega)
      const b = Math.sin(t * omega) / Math.sin(omega)
      v = [a * p1[0] + b * p2[0], a * p1[1] + b * p2[1], a * p1[2] + b * p2[2]]
    }
    out.push([deg(Math.atan2(v[2], Math.hypot(v[0], v[1]))), deg(Math.atan2(v[1], v[0]))])
  }
  return out
}

/** Compass direction for a bearing ("NE", "WSW"). */
export function compass(b: number): string {
  const names = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return names[Math.round(b / 22.5) % 16]
}

/** Equirectangular map coordinates (x = lon + 180, y = top - lat). */
export function project(lat: number, lon: number, top: number): [number, number] {
  return [lon + 180, top - lat]
}

/** SVG path through projected points, broken where the line crosses the date line. */
export function mapPath(points: [number, number][], top: number): string {
  let d = ''
  let prevX: number | null = null
  for (const [lat, lon] of points) {
    const [x, y] = project(lat, lon, top)
    d += `${prevX === null || Math.abs(x - prevX) > 180 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
    prevX = x
  }
  return d
}

/** [iata, icao, name, city, country, lat, lon, size] (size L, M, S, W seaplane, H heliport) */
export type Airport = [string, string, string, string, string, number, number, string]

const SIZE_RANK: Record<string, number> = { L: 0, M: 1, S: 2, W: 3, H: 4 }

/** Code matches first (IATA, then ICAO), then names and cities that start with, then contain, the query. */
export function searchAirports(list: Airport[], query: string, limit = 20): Airport[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const scored: [number, Airport][] = []
  for (const a of list) {
    const iata = a[0].toLowerCase()
    const icao = a[1].toLowerCase()
    const name = a[2].toLowerCase()
    const city = a[3].toLowerCase()
    let s = -1
    if (iata === q) s = 0
    else if (icao === q) s = 1
    else if (city === q) s = 2
    else if (city.startsWith(q) || name.startsWith(q)) s = 3
    else if (city.includes(q) || name.includes(q)) s = 4
    if (s >= 0) scored.push([s * 10 + (SIZE_RANK[a[7]] ?? 5), a])
  }
  return scored
    .sort((x, y) => x[0] - y[0])
    .slice(0, limit)
    .map((x) => x[1])
}
