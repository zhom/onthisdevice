import { useMemo, useState } from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { downloadBlob } from '@/lib/utils'
import { formatNumber } from '@/components/tools/finance/format'
import { MiniStat, ZonePicker, useMounted, useNow, useZoneState } from './common'
import {
  formatInZone,
  getZonedParts,
  inputsToInstant,
  pad2,
  relativeTime,
  toRfc2822,
  zoneAbbreviation,
  zoneOffsetMs,
  zonedDateInput,
  zonedTimeInput,
} from './tz'

type Unit = 'auto' | 's' | 'ms' | 'us' | 'ns'

const UNIT_LABELS: Record<Unit, string> = {
  auto: 'Detect automatically',
  s: 'Seconds',
  ms: 'Milliseconds',
  us: 'Microseconds',
  ns: 'Nanoseconds',
}

const MIN_MS = -62_167_219_200_000 // 0001-01-01
const MAX_MS = 253_402_300_799_999 // 9999-12-31

interface Parsed {
  ms: number
  unit: Exclude<Unit, 'auto'>
  detected: boolean
}

/** Read a raw timestamp string into milliseconds, guessing the unit by magnitude. */
function parseTimestamp(raw: string, unit: Unit): Parsed | { error: string } {
  const cleaned = raw.trim().replace(/[_,\s]/g, '')
  if (!cleaned) return { error: 'Enter a timestamp.' }
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return { error: `“${raw.trim()}” is not a number. Unix timestamps are digits only.` }
  }
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return { error: 'That number is too large to represent.' }

  const digits = cleaned.replace(/^-/, '').split('.')[0]?.length ?? 0
  let resolved: Exclude<Unit, 'auto'>
  if (unit !== 'auto') {
    resolved = unit
  } else if (digits >= 18) {
    resolved = 'ns'
  } else if (digits >= 15) {
    resolved = 'us'
  } else if (digits >= 12) {
    resolved = 'ms'
  } else {
    resolved = 's'
  }

  const factor = resolved === 's' ? 1000 : resolved === 'ms' ? 1 : resolved === 'us' ? 1e-3 : 1e-6
  const ms = n * factor
  if (ms < MIN_MS || ms > MAX_MS) {
    return { error: 'That timestamp falls outside the years 1–9999. Check the unit.' }
  }
  return { ms, unit: resolved, detected: unit === 'auto' }
}

/** ISO 8601 with the real offset for a zone, e.g. 2026-08-16T14:05:07+02:00. */
function isoWithOffset(instant: Date, zone: string): string {
  const p = getZonedParts(instant, zone)
  const offset = zoneOffsetMs(instant, zone)
  const sign = offset < 0 ? '-' : '+'
  const abs = Math.abs(Math.round(offset / 60000))
  const oh = pad2(Math.floor(abs / 60))
  const om = pad2(abs % 60)
  const suffix = offset === 0 ? 'Z' : `${sign}${oh}:${om}`
  return `${String(p.year).padStart(4, '0')}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}${suffix}`
}

interface BatchRow {
  token: string
  error: string | null
  unit: string
  iso: string
  local: string
  utc: string
  relative: string
}

export default function UnixTimestampConverter() {
  const mounted = useMounted()
  const [zone, setZone] = useZoneState()
  const now = useNow(1000)
  const [raw, setRaw] = useState('')
  const [unit, setUnit] = useState<Unit>('auto')
  const [dateValue, setDateValue] = useState('')
  const [timeValue, setTimeValue] = useState('00:00:00')
  const [batch, setBatch] = useState('')

  const liveMs = mounted ? now.getTime() : 0

  const parsed = useMemo(() => (raw.trim() ? parseTimestamp(raw, unit) : null), [raw, unit])
  const instant = parsed && 'ms' in parsed ? new Date(parsed.ms) : null

  const toTimestamp = useMemo<{ instant: Date | null; error: string | null }>(() => {
    if (!dateValue) return { instant: null, error: null }
    const d = inputsToInstant(dateValue, timeValue, zone)
    if (!d) return { instant: null, error: 'Enter a valid date and a time as HH:MM or HH:MM:SS.' }
    return { instant: d, error: null }
  }, [dateValue, timeValue, zone])
  const toInstant = toTimestamp.instant

  const batchRows = useMemo<BatchRow[]>(() => {
    const tokens = batch
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 2000)
    return tokens.map((token) => {
      const p = parseTimestamp(token, unit)
      if ('error' in p) {
        return { token, error: p.error, unit: '', iso: '', local: '', utc: '', relative: '' }
      }
      const d = new Date(p.ms)
      return {
        token,
        error: null,
        unit: p.unit,
        iso: isoWithOffset(d, zone),
        local: formatInZone(d, zone, { dateStyle: 'medium', timeStyle: 'medium' }),
        utc: toRfc2822(d),
        relative: relativeTime(d, now),
      }
    })
  }, [batch, unit, zone, now])

  const batchCsv = useMemo(() => {
    const header = 'input,unit,iso_8601,local_time,utc_rfc2822,relative,error'
    const rows = batchRows.map((r) =>
      r.error
        ? `${r.token},,,,,,"${r.error.replace(/"/g, '""')}"`
        : `${r.token},${r.unit},${r.iso},"${r.local}","${r.utc}","${r.relative}",`,
    )
    return [header, ...rows].join('\n')
  }, [batchRows])

  const setNowTimestamp = () => setRaw(String(Math.floor(Date.now() / 1000)))
  const setNowDate = () => {
    const d = new Date()
    setDateValue(zonedDateInput(d, zone))
    setTimeValue(`${zonedTimeInput(d, zone)}:${pad2(getZonedParts(d, zone).second)}`)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Current Unix time</div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-foreground sm:text-4xl" role="status" aria-live="off">
              {mounted ? Math.floor(liveMs / 1000) : '–'}
            </div>
            <div className="mt-1 text-sm tabular-nums text-muted-foreground">
              {mounted ? `${liveMs} ms · ${formatInZone(now, zone, { dateStyle: 'medium', timeStyle: 'medium' })}` : 'starting clock…'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={mounted ? String(Math.floor(liveMs / 1000)) : ''} label="Copy seconds" />
            <CopyButton value={mounted ? String(liveMs) : ''} label="Copy milliseconds" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="from" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="from" className="flex-1">
            To date
          </TabsTrigger>
          <TabsTrigger value="to" className="flex-1">
            To timestamp
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex-1">
            Batch
          </TabsTrigger>
        </TabsList>

        <TabsContent value="from" className="mt-4 space-y-6">
          <ToolPanel title="Convert a timestamp" description="Paste an epoch value in seconds, milliseconds, microseconds or nanoseconds.">
            <div className="grid gap-4 sm:grid-cols-[1fr_minmax(0,14rem)]">
              <div className="space-y-1.5">
                <Label htmlFor="ts-input">Unix timestamp</Label>
                <Input
                  id="ts-input"
                  inputMode="numeric"
                  spellCheck={false}
                  placeholder="1755345600"
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ts-unit">Unit</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                  <SelectTrigger id="ts-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(UNIT_LABELS) as Unit[]).map((u) => (
                      <SelectItem key={u} value={u}>
                        {UNIT_LABELS[u]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={setNowTimestamp}>
                Use current timestamp
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRaw('')}>
                Clear
              </Button>
            </div>
            <div className="mt-4">
              <ZonePicker value={zone} onChange={setZone} label="Display timezone" />
            </div>
          </ToolPanel>

          {parsed && 'error' in parsed ? <ErrorNote message={parsed.error} /> : null}

          {instant && parsed && 'ms' in parsed ? (
            <div className="space-y-4" role="status" aria-live="polite">
              <div className="rounded-xl bg-card p-5">
                <div className="text-sm font-medium text-muted-foreground">
                  Read as {UNIT_LABELS[parsed.unit].toLowerCase()}
                  {parsed.detected ? ' (detected from the number of digits)' : ''}
                </div>
                <div className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
                  {formatInZone(instant, zone, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hourCycle: 'h23',
                  })}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {zone} · {zoneAbbreviation(instant, zone)} · {relativeTime(instant, now)}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <OutputRow label="ISO 8601 (selected zone)" value={isoWithOffset(instant, zone)} />
                <OutputRow label="ISO 8601 (UTC)" value={instant.toISOString()} />
                <OutputRow label="RFC 2822 / HTTP date" value={toRfc2822(instant)} />
                <OutputRow label="Relative" value={relativeTime(instant, now)} />
                <OutputRow label="Seconds" value={String(Math.floor(parsed.ms / 1000))} />
                <OutputRow label="Milliseconds" value={String(Math.round(parsed.ms))} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MiniStat label="Day of week" value={formatInZone(instant, zone, { weekday: 'long' })} />
                <MiniStat label="UTC time" value={formatInZone(instant, 'UTC', { dateStyle: 'medium', timeStyle: 'medium' })} />
                <MiniStat label="Offset applied" value={`${zoneAbbreviation(instant, zone)}`} hint={isoWithOffset(instant, zone).slice(-6)} />
                <MiniStat label="Days from now" value={formatNumber((instant.getTime() - now.getTime()) / 86_400_000, 2)} />
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="to" className="mt-4 space-y-6">
          <ToolPanel title="Convert a date" description="The date and time are read in the timezone you choose, then converted to epoch time.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ts-date">Date</Label>
                <Input id="ts-date" type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ts-time">Time</Label>
                <Input id="ts-time" type="time" step={1} value={timeValue} onChange={(e) => setTimeValue(e.target.value)} />
              </div>
            </div>
            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" onClick={setNowDate}>
                Use current date and time
              </Button>
            </div>
            <div className="mt-4">
              <ZonePicker value={zone} onChange={setZone} label="Input timezone" />
            </div>
          </ToolPanel>

          {toTimestamp.error ? <ErrorNote message={toTimestamp.error} /> : null}

          {toInstant ? (
            <div className="space-y-4" role="status" aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2">
                <OutputRow label="Unix seconds" value={String(Math.floor(toInstant.getTime() / 1000))} big />
                <OutputRow label="Unix milliseconds" value={String(toInstant.getTime())} big />
                <OutputRow label="ISO 8601 (UTC)" value={toInstant.toISOString()} />
                <OutputRow label="ISO 8601 (selected zone)" value={isoWithOffset(toInstant, zone)} />
                <OutputRow label="RFC 2822" value={toRfc2822(toInstant)} />
                <OutputRow label="Relative" value={relativeTime(toInstant, now)} />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatInZone(toInstant, zone, { dateStyle: 'full', timeStyle: 'long' })} in {zone} is the same
                instant as {formatInZone(toInstant, 'UTC', { dateStyle: 'full', timeStyle: 'long' })} UTC.
              </p>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="batch" className="mt-4 space-y-6">
          <ToolPanel
            title="Batch convert"
            description="One timestamp per line, or separated by commas. Up to 2,000 values at a time."
          >
            <div className="space-y-1.5">
              <Label htmlFor="ts-batch">Timestamps</Label>
              <Textarea
                id="ts-batch"
                rows={6}
                spellCheck={false}
                placeholder={'1755345600\n1700000000000\n946684800'}
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
              />
            </div>
            <div className="mt-3">
              <ZonePicker value={zone} onChange={setZone} label="Display timezone" />
            </div>
          </ToolPanel>

          {batchRows.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <CopyButton value={batchCsv} label="Copy as CSV" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadBlob(new Blob([batchCsv], { type: 'text/csv;charset=utf-8' }), 'timestamps.csv')
                  }
                >
                  Download CSV
                </Button>
                <span className="self-center text-sm text-muted-foreground">
                  {batchRows.length} value{batchRows.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg">
                <table className="w-full min-w-[46rem] text-left text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Input</th>
                      <th scope="col" className="px-3 py-2 font-medium">Unit</th>
                      <th scope="col" className="px-3 py-2 font-medium">ISO 8601</th>
                      <th scope="col" className="px-3 py-2 font-medium">Local time</th>
                      <th scope="col" className="px-3 py-2 font-medium">Relative</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {batchRows.map((r, i) => (
                      <tr key={`${r.token}-${i}`}>
                        <td className="px-3 py-2 tabular-nums">{r.token}</td>
                        {r.error ? (
                          <td colSpan={4} className="px-3 py-2 text-destructive">
                            {r.error}
                          </td>
                        ) : (
                          <>
                            <td className="px-3 py-2">{r.unit}</td>
                            <td className="px-3 py-2 tabular-nums">{r.iso}</td>
                            <td className="px-3 py-2">{r.local}</td>
                            <td className="px-3 py-2 text-muted-foreground">{r.relative}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-muted p-8 text-center">
              <Clock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm text-muted-foreground">
                Paste a list of timestamps to convert them all at once.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OutputRow({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-lg bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div
            className={
              big
                ? 'mt-1 break-all text-xl font-bold tabular-nums text-foreground'
                : 'mt-1 break-all font-mono text-sm text-foreground'
            }
          >
            {value}
          </div>
        </div>
        <CopyButton value={value} label="Copy" />
      </div>
    </div>
  )
}
