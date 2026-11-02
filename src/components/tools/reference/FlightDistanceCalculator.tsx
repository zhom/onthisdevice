import { useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { AIRPORTS, AirportPicker, WorldMap, airportLine, useAirportData } from './airports'
import { Facts, Loading } from './controls'
import { bearing, compass, distanceKm, greatCircle } from './geo'
import { SourceNote } from './SourceNote'

const KM_PER_MI = 1.609344
const KM_PER_NMI = 1.852
const SPEED_KMH = 800

const n0 = (v: number) => Math.round(v).toLocaleString('en-US')

export default function FlightDistanceCalculator() {
  const data = useAirportData()
  const [fromCode, setFromCode] = useState('JFK')
  const [toCode, setToCode] = useState('LHR')
  const [spin, setSpin] = useState(0)

  if (data.state !== 'ready') {
    return (
      <ToolPanel>
        {data.state === 'error' ? <ErrorNote message={data.message} /> : <Loading label={`Loading ${AIRPORTS.count.toLocaleString('en-US')} airports`} />}
      </ToolPanel>
    )
  }
  const from = data.data.byCode.get(fromCode) ?? null
  const to = data.data.byCode.get(toCode) ?? null
  const km = from && to ? distanceKm(from[5], from[6], to[5], to[6]) : 0
  const route = from && to ? greatCircle(from[5], from[6], to[5], to[6], 128) : undefined
  const b = from && to ? bearing(from[5], from[6], to[5], to[6]) : 0
  const minutes = km / SPEED_KMH * 60 + 30
  const mid = route ? route[Math.floor(route.length / 2)] : null
  const summary = from && to ? `${from[0]} to ${to[0]}: ${n0(km)} km (${n0(km / KM_PER_MI)} mi, ${n0(km / KM_PER_NMI)} nmi) great-circle distance` : ''

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="flex items-end gap-2">
          <AirportPicker id="fd-from" label="From" list={data.data.list} value={from} onPick={(a) => setFromCode(a[0])} />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Swap airports"
            onClick={() => {
              setFromCode(toCode)
              setToCode(fromCode)
              setSpin((s) => s + 1)
            }}
          >
            <ArrowLeftRight className="transition-transform duration-300 ease-[var(--ease-out)]" style={{ transform: `rotate(${spin * 180}deg)` }} />
          </Button>
          <AirportPicker id="fd-to" label="To" list={data.data.list} value={to} onPick={(a) => setToCode(a[0])} />
        </div>
        {from && to ? (
          <p className="text-sm text-muted-foreground">
            {airportLine(from)}
            <br />
            {airportLine(to)}
          </p>
        ) : null}
      </ToolPanel>

      {from && to && route ? (
        <ToolPanel>
          <div role="status" aria-live="polite" className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {from[0]} to {to[0]} is
            </p>
            <p key={`${from[0]}-${to[0]}`} className="reveal text-[2rem] leading-tight font-[740] tabular-nums sm:text-[2.5rem]">
              {n0(km)} km
            </p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {n0(km / KM_PER_MI)} miles · {n0(km / KM_PER_NMI)} nautical miles
            </p>
          </div>
          <WorldMap world={data.data.world} points={[from, to]} route={route} label={`Great-circle route from ${from[2]} to ${to[2]}`} />
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultStat label="Flight time, estimate" value={`${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, '0')} min`} hint="At 800 km/h plus 30 minutes" />
            <ResultStat label="Initial heading" value={`${Math.round(b)}° ${compass(b)}`} hint="From the origin, measured from north" />
          </div>
          <Facts
            rows={[
              ['Midpoint', mid ? `${Math.abs(mid[0]).toFixed(2)}° ${mid[0] >= 0 ? 'N' : 'S'}, ${Math.abs(mid[1]).toFixed(2)}° ${mid[1] >= 0 ? 'E' : 'W'}` : '–'],
              ['Formula', 'Haversine, mean Earth radius 6,371 km'],
            ]}
          />
          <CopyButton value={summary} label="Copy result" />
        </ToolPanel>
      ) : null}

      <SourceNote meta={AIRPORTS.meta} />
    </div>
  )
}
