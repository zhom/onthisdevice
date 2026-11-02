/**
 * Airports with an IATA code (OurAirports, public domain) and a light world outline
 * (Natural Earth 1:110m land, public domain) for the flight distance map. Tier: monthly.
 *
 *   src/data/airports.json                     meta + counts
 *   public/data/airports/<hash>/airports.json  [[iata, icao, name, city, country, lat, lon, size], ...]
 *   public/data/airports/<hash>/world.json     { width, height, path } equirectangular, lon -180..180, lat 84..-60
 */
import { check, checkRange, commit, csvObjects, get, meta, readJson, run } from './lib.mjs'

const URL_AIRPORTS = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
const URL_LAND = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson'
const TOP = 84
const BOTTOM = -60
const SIZE = { large_airport: 'L', medium_airport: 'M', small_airport: 'S', seaplane_base: 'W', heliport: 'H' }

/** OurAirports CSV -> rows with an IATA code, open, of a known type. */
export function parseAirports(text) {
  return csvObjects(text)
    .filter((r) => /^[A-Z0-9]{3}$/.test(r.iata_code) && SIZE[r.type])
    .map((r) => [
      r.iata_code,
      /^[A-Z]{4}$/.test(r.icao_code) ? r.icao_code : /^[A-Z]{4}$/.test(r.gps_code) ? r.gps_code : '',
      r.name,
      r.municipality,
      r.iso_country,
      Number(Number(r.latitude_deg).toFixed(4)),
      Number(Number(r.longitude_deg).toFixed(4)),
      SIZE[r.type],
    ])
    .filter((r) => Number.isFinite(r[5]) && Number.isFinite(r[6]))
}

/** GeoJSON land polygons -> one SVG path, projected equirectangular and thinned. */
export function outlinePath(geojson, minStep = 0.35) {
  const parts = []
  const project = ([lon, lat]) => [lon + 180, TOP - Math.max(BOTTOM, Math.min(TOP, lat))]
  for (const f of geojson.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    for (const poly of polys) {
      for (const ring of poly) {
        if (ring.every(([, lat]) => lat < BOTTOM)) continue
        const pts = []
        for (const c of ring) {
          const p = project(c)
          const last = pts[pts.length - 1]
          if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= minStep) pts.push(p)
        }
        if (pts.length < 4) continue
        parts.push(`M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`)
      }
    }
  }
  return parts.join('')
}

async function main() {
  const rows = parseAirports(await get(URL_AIRPORTS, { timeoutMs: 240_000 }))
  // A code can be listed twice (a closed duplicate); keep the larger airport.
  const rank = { L: 0, M: 1, S: 2, W: 3, H: 4 }
  const byCode = new Map()
  for (const r of rows) {
    const had = byCode.get(r[0])
    if (!had || rank[r[7]] < rank[had[7]]) byCode.set(r[0], r)
  }
  const airports = [...byCode.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  check(airports.length > 6000 && airports.length < 15_000, `airports: ${airports.length} with IATA codes`)
  const get3 = (c) => byCode.get(c)
  for (const [code, lat, lon] of [
    ['JFK', 40.64, -73.78],
    ['LHR', 51.47, -0.46],
    ['SYD', -33.95, 151.18],
    ['NRT', 35.76, 140.39],
  ]) {
    const a = get3(code)
    check(a, `airports: ${code} missing`)
    checkRange(Math.abs(a[5] - lat) + Math.abs(a[6] - lon), 0, 0.2, `airports ${code} position`)
  }
  for (const a of airports) {
    checkRange(a[5], -90, 90, `airports ${a[0]} lat`)
    checkRange(a[6], -180, 180, `airports ${a[0]} lon`)
  }
  const prev = readJson('src/data/airports.json')
  if (prev?.count) check(Math.abs(airports.length - prev.count) / prev.count < 0.1, `airports: ${prev.count} -> ${airports.length}`)

  const land = await get(URL_LAND, { as: 'json' })
  const path = outlinePath(land)
  check(path.length > 10_000 && path.length < 200_000, `airports: world outline is ${path.length} characters`)

  const lazy = new Map([
    ['airports.json', `[\n${airports.map((a) => JSON.stringify(a)).join(',\n')}\n]`],
    ['world.json', JSON.stringify({ width: 360, height: TOP - BOTTOM, top: TOP, path })],
  ])
  commit(
    'airports',
    {
      meta: meta({
        source: { name: 'OurAirports; world outline from Natural Earth', url: 'https://ourairports.com/data/' },
        sources: [
          { name: 'OurAirports', url: 'https://ourairports.com/data/' },
          { name: 'Natural Earth 1:110m land', url: 'https://www.naturalearthdata.com/' },
        ],
        licence: { name: 'Public domain (both)', url: 'https://ourairports.com/data/' },
        validFor: new Date().toISOString().slice(0, 10),
      }),
      count: airports.length,
    },
    lazy,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) run('airports', main)
