import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { AIRPORTS, WorldMap, countryName, useAirportData } from './airports'
import { Facts, Loading } from './controls'
import type { Airport } from './geo'
import { searchAirports } from './geo'
import { SourceNote } from './SourceNote'

const SIZE: Record<string, string> = { L: 'Large airport', M: 'Medium airport', S: 'Small airport', W: 'Seaplane base', H: 'Heliport' }
const coord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`

export default function AirportCodeLookup() {
  const [query, setQuery] = useState('LHR')
  const [picked, setPicked] = useState<string | null>(null)
  const data = useAirportData()
  const results = useMemo(() => (data.state === 'ready' ? searchAirports(data.data.list, query, 30) : []), [data, query])
  const current: Airport | undefined = data.state === 'ready' ? (picked ? data.data.byCode.get(picked) : undefined) ?? results[0] : undefined

  const rows: [string, string][] = current
    ? [
        ['IATA code', current[0]],
        ['ICAO code', current[1] || 'None'],
        ['Airport', current[2]],
        ['City', current[3] || '–'],
        ['Country', `${countryName(current[4])} (${current[4]})`],
        ['Type', SIZE[current[7]] ?? current[7]],
        ['Coordinates', `${coord(current[5], 'N', 'S')}, ${coord(current[6], 'E', 'W')}`],
      ]
    : []

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="space-y-1.5">
          <Label htmlFor="ap-q">Airport code, city or name</Label>
          <Input
            id="ap-q"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPicked(null)
            }}
            placeholder="LHR, EGLL, Tokyo or Heathrow"
            className="text-base"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {data.state === 'loading' ? <Loading label={`Loading ${AIRPORTS.count.toLocaleString('en-US')} airports`} /> : null}
        {data.state === 'error' ? <ErrorNote message={data.message} /> : null}
        {data.state === 'ready' && query.trim() && !results.length ? <ErrorNote message="No airport with an IATA code matches this search." /> : null}
      </ToolPanel>

      {data.state === 'ready' && current ? (
        <ToolPanel>
          <div role="status" aria-live="polite" className="space-y-1">
            <p key={current[0]} className="reveal text-[2.5rem] leading-none font-[760] tabular-nums">
              {current[0]}
              {current[1] ? <span className="ml-3 text-[1.25rem] font-[600] text-muted-foreground">{current[1]}</span> : null}
            </p>
            <p className="text-lg font-[650]">{current[2]}</p>
            <p className="text-sm text-muted-foreground">{[current[3], countryName(current[4])].filter(Boolean).join(', ')}</p>
          </div>
          <WorldMap world={data.data.world} points={[current]} label={`Map with ${current[2]}`} />
          <Facts rows={rows} />
          <CopyButton value={rows.map(([k, v]) => `${k}: ${v}`).join('\n')} label="Copy details" />
        </ToolPanel>
      ) : null}

      {results.length > 1 ? (
        <ToolPanel title={`${results.length === 30 ? 'First 30' : results.length} matches`}>
          <ul className="space-y-1 text-sm">
            {results.map((a) => (
              <li key={a[0]}>
                <button
                  type="button"
                  onClick={() => setPicked(a[0])}
                  className={`grid w-full grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 rounded-md px-2 py-1 text-left hover:bg-background ${current?.[0] === a[0] ? 'bg-background' : ''}`}
                  aria-pressed={current?.[0] === a[0]}
                >
                  <span className="font-[700] tabular-nums">{a[0]}</span>
                  <span className="min-w-0">
                    {a[2]}
                    <span className="block text-xs text-muted-foreground">{[a[3], countryName(a[4]), a[1]].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </ToolPanel>
      ) : null}

      <SourceNote meta={AIRPORTS.meta}>{AIRPORTS.count.toLocaleString('en-US')} airports with an IATA code.</SourceNote>
    </div>
  )
}
