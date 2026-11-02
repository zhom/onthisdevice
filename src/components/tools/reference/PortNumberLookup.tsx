import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ToolPanel } from '@/components/shared/ToolPanel'
import portsData from '@/data/ports.json'
import type { DataMeta } from './data'
import { loadJson } from './data'
import { Loading, useLoaded } from './controls'
import type { PortEntry as Entry } from './ports'
import { searchPorts, zoneOf } from './ports'
import { SourceNote } from './SourceNote'

interface PortsManifest {
  meta: DataMeta
  counts: { entries: number; named: number }
  files: string
}
const D = portsData as unknown as PortsManifest
const EXAMPLES = ['22', '443', '3389', '5432', '8080', 'ssh', 'mysql', 'kerberos']
const LIMIT = 200

/** The three port ranges as equal thirds, with a marker that slides to the port. */
function PortBar({ port }: { port: number | null }) {
  const zone = port === null ? null : zoneOf(port)
  const pos = zone && port !== null ? (zone.index + (port - zone.from) / (zone.to - zone.from)) / 3 : 0
  return (
    <div className="space-y-1.5" aria-hidden="true">
      <div className="relative grid h-3 grid-cols-3 gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`rounded-sm transition-colors duration-300 ${zone?.index === i ? 'bg-chart-3' : 'bg-background'}`} />
        ))}
        {zone ? (
          <div className="pointer-events-none absolute inset-0 overflow-x-clip">
            <div className="absolute inset-y-0 left-0.5 right-0.5 transition-transform duration-500 ease-[var(--ease-out)] motion-reduce:transition-none" style={{ transform: `translateX(${pos * 100}%)` }}>
              <span className="absolute top-1/2 left-0 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
            </div>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground tabular-nums">
        <span>0–1023</span>
        <span>1024–49151</span>
        <span>49152–65535</span>
      </div>
    </div>
  )
}

export default function PortNumberLookup() {
  const [query, setQuery] = useState('443')
  const data = useLoaded('ports', () => loadJson<Entry[]>(`${D.files}/ports.json`))
  const results = useMemo(() => (data.state === 'ready' ? searchPorts(data.data, query) : []), [data, query])
  const port = /^\d+$/.test(query.trim()) ? Number(query.trim()) : results.length && results[0][0] === results[0][1] ? results[0][0] : null
  const outOfRange = port !== null && port > 65535
  const zone = port !== null && !outOfRange ? zoneOf(port) : null

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="space-y-1.5">
          <Label htmlFor="port-q">Port number or service name</Label>
          <Input id="port-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="443 or https" className="text-base" autoComplete="off" autoCapitalize="off" spellCheck={false} />
        </div>
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <span className="mr-1 text-muted-foreground">Examples:</span>
          {EXAMPLES.map((ex) => (
            <Button key={ex} type="button" variant="ghost" size="sm" onClick={() => setQuery(ex)}>
              {ex}
            </Button>
          ))}
        </div>
        {outOfRange ? <ErrorNote message="Ports go from 0 to 65535." /> : null}
        <PortBar port={outOfRange ? null : port} />
        {zone ? (
          <p className="text-sm">
            <span className="font-[600]">Port {port}</span> <span className="text-muted-foreground">is a {zone.name.toLowerCase()}.</span>
          </p>
        ) : null}
      </ToolPanel>

      {data.state === 'loading' ? <Loading label="Loading the port registry" /> : null}
      {data.state === 'error' ? <ErrorNote message={data.message} /> : null}

      {data.state === 'ready' && query.trim() && !outOfRange ? (
        <ToolPanel title={results.length ? `${results.length > LIMIT ? `First ${LIMIT} of ${results.length}` : results.length} ${results.length === 1 ? 'entry' : 'entries'}` : 'No entries'}>
          <div role="status" aria-live="polite" className="sr-only">
            {results.length} registry entries found
          </div>
          {results.length ? (
            <ul className="space-y-3">
              {results.slice(0, LIMIT).map((e, i) => (
                <li key={i} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 text-sm">
                  <span className="font-[680] tabular-nums">{e[0] === e[1] ? e[0] : `${e[0]}–${e[1]}`}</span>
                  <span className="min-w-0">
                    <span className="font-[600] break-words">{e[2] || (e[4] === 'Unassigned' ? 'Unassigned' : 'Reserved')}</span>
                    {e[3] ? <span className="text-muted-foreground"> · {e[3].toUpperCase().split(' ').join(', ')}</span> : null}
                    {e[2] && e[4] ? <span className="block text-muted-foreground break-words">{e[4]}</span> : null}
                    {e[5] ? <span className="block text-xs text-muted-foreground">{e[5]}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">The registry has no service with this name or description.</p>
          )}
        </ToolPanel>
      ) : null}

      <SourceNote meta={D.meta}>{D.counts.named.toLocaleString('en-US')} named entries.</SourceNote>
    </div>
  )
}
