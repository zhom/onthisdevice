import { useEffect, useMemo, useState } from 'react'
import { Check, Globe, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { cn } from '@/lib/utils'
import { MiniStat, ZonePicker, useMounted, usePersistentState, useZoneState } from './common'
import { formatInZone, getZonedParts, inputsToInstant, isDstActive, listTimeZones, localTimeZone, pad2, zoneAbbreviation, zoneLabel, zoneOffsetMs, zonedDateInput, zonedPartsToInstant, utcMs } from './tz'

const ZONES_KEY = 'otd:timezone-converter:zones'
const DEFAULT_ZONES = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo']

function dayOffsetLabel(refDay: number, zoneDay: number): string {
  const diff = zoneDay - refDay
  if (diff === 0) return 'same day'
  if (diff === 1) return 'next day'
  if (diff === -1) return 'previous day'
  return `${diff > 0 ? '+' : ''}${diff} days`
}

function dayNumberOf(instant: Date, zone: string): number {
  const p = getZonedParts(instant, zone)
  return Math.floor(utcMs(p.year, p.month - 1, p.day) / 86_400_000)
}

export default function TimezoneConverter() {
  const mounted = useMounted()
  const [refZone, setRefZone] = useZoneState()
  const [dateValue, setDateValue] = useState('')
  const [timeValue, setTimeValue] = useState('09:00')
  const [zones, setZones] = usePersistentState<string[]>(ZONES_KEY, DEFAULT_ZONES)
  const [candidate, setCandidate] = useState('Europe/Paris')
  const [workStart, setWorkStart] = useState('9')
  const [workEnd, setWorkEnd] = useState('18')
  const [addError, setAddError] = useState<string | null>(null)

  // Default the reference moment to "now, rounded down to the hour" once mounted.
  useEffect(() => {
    const local = localTimeZone()
    const nowDate = new Date()
    setDateValue(zonedDateInput(nowDate, local))
    setTimeValue(`${pad2(getZonedParts(nowDate, local).hour)}:00`)
  }, [])

  const instant = useMemo(
    () => (dateValue ? inputsToInstant(dateValue, timeValue, refZone) : null),
    [dateValue, timeValue, refZone],
  )

  const allZones = useMemo(() => (mounted ? [refZone, ...zones.filter((z) => z !== refZone)] : []), [mounted, refZone, zones])

  const rows = useMemo(() => {
    if (!instant) return []
    const refDay = dayNumberOf(instant, refZone)
    const refOffset = zoneOffsetMs(instant, refZone)
    return allZones.map((zone) => {
      const offset = zoneOffsetMs(instant, zone)
      const diffHours = (offset - refOffset) / 3_600_000
      return {
        zone,
        time: formatInZone(instant, zone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
        date: formatInZone(instant, zone, { weekday: 'short', day: 'numeric', month: 'short' }),
        abbr: zoneAbbreviation(instant, zone),
        offsetHours: offset / 3_600_000,
        diffHours,
        dst: isDstActive(instant, zone),
        dayLabel: dayOffsetLabel(refDay, dayNumberOf(instant, zone)),
      }
    })
  }, [instant, allZones, refZone])

  // 24 columns, one per hour of the reference day.
  const strip = useMemo(() => {
    if (!instant) return null
    const refParts = getZonedParts(instant, refZone)
    const columns = Array.from({ length: 24 }, (_, hour) =>
      zonedPartsToInstant(
        { year: refParts.year, month: refParts.month, day: refParts.day, hour, minute: 0, second: 0 },
        refZone,
      ),
    )
    const start = Number(workStart)
    const end = Number(workEnd)
    const inWindow = (h: number) => (start <= end ? h >= start && h < end : h >= start || h < end)
    const zoneRows = allZones.map((zone) => ({
      zone,
      cells: columns.map((col) => {
        const p = getZonedParts(col, zone)
        return { hour: p.hour, day: p.day, working: inWindow(p.hour) }
      }),
    }))
    const overlapColumns = columns.map((_, i) => zoneRows.every((r) => r.cells[i]?.working === true))
    return { columns, zoneRows, overlapColumns, refParts }
  }, [instant, allZones, refZone, workStart, workEnd])

  const addZone = () => {
    const valid = listTimeZones().includes(candidate)
    if (!valid) {
      setAddError('Pick a timezone from the list before adding it.')
      return
    }
    if (zones.includes(candidate) || candidate === refZone) {
      setAddError('That timezone is already in the comparison.')
      return
    }
    setAddError(null)
    setZones([...zones, candidate])
  }

  const summary = useMemo(() => {
    if (!instant || rows.length === 0) return ''
    const width = Math.max(...rows.map((r) => r.zone.length))
    return [
      `Meeting time across ${rows.length} time zones`,
      '',
      ...rows.map(
        (r) => `${r.zone.padEnd(width)}  ${r.time}  ${r.date}  (${r.abbr}, ${r.dayLabel})`,
      ),
    ].join('\n')
  }, [instant, rows])

  const invalid = dateValue.length > 0 && instant === null

  return (
    <div className="space-y-6">
      <ToolPanel title="Reference time" description="Enter one moment, then read it in every zone you care about.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="tz-date">Date</Label>
            <Input id="tz-date" type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tz-time">Time</Label>
            <Input id="tz-time" type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} />
          </div>
          <ZonePicker value={refZone} onChange={setRefZone} label="Reference timezone" />
        </div>
      </ToolPanel>

      <ToolPanel title="Compared time zones" description="Saved on this device so your usual set is here next time.">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <ZonePicker value={candidate} onChange={setCandidate} label="Add a timezone" />
          <Button type="button" onClick={addZone}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        </div>
        {addError ? (
          <div className="mt-3">
            <ErrorNote message={addError} />
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {zones.map((z) => (
            <span
              key={z}
              className="inline-flex items-center gap-1 rounded-md bg-muted py-1 pl-3 pr-1 text-sm text-foreground"
            >
              {zoneLabel(z)}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label={`Remove ${z}`}
                onClick={() => setZones(zones.filter((x) => x !== z))}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </span>
          ))}
          {zones.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              Only the reference zone is shown. Add one or more zones to compare.
            </span>
          ) : null}
        </div>
      </ToolPanel>

      {invalid ? <ErrorNote message="That date isn’t valid. Check the day and month." /> : null}

      {!instant || !mounted ? (
        <div className="rounded-xl bg-muted p-8 text-center">
          <Globe className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">Choose a date and time to convert.</p>
        </div>
      ) : (
        <div className="space-y-6" role="status" aria-live="polite">
          <div className="overflow-x-auto rounded-xl">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">The same instant expressed in each selected timezone</caption>
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Time zone</th>
                  <th scope="col" className="px-3 py-2 font-medium">Local time</th>
                  <th scope="col" className="px-3 py-2 font-medium">Date</th>
                  <th scope="col" className="px-3 py-2 font-medium">Offset</th>
                  <th scope="col" className="px-3 py-2 font-medium">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.zone} className={r.zone === refZone ? 'bg-muted font-semibold' : undefined}>
                    <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
                      {zoneLabel(r.zone)}
                      <span className="block text-xs font-normal text-muted-foreground">{r.zone}</span>
                    </th>
                    <td className="px-3 py-2 text-lg font-semibold tabular-nums text-foreground">{r.time}</td>
                    <td className="px-3 py-2">
                      {r.date}
                      <span className="block text-xs text-muted-foreground">{r.dayLabel}</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.abbr}
                      <span className="block text-xs text-muted-foreground">
                        UTC{r.offsetHours >= 0 ? '+' : '−'}
                        {pad2(Math.floor(Math.abs(r.offsetHours)))}:{pad2(Math.round((Math.abs(r.offsetHours) % 1) * 60))}
                        {r.dst ? ' · DST' : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.diffHours === 0
                        ? 'reference'
                        : `${r.diffHours > 0 ? '+' : '−'}${Math.abs(r.diffHours).toFixed(Math.abs(r.diffHours) % 1 === 0 ? 0 : 2)} h`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CopyButton value={summary} label="Copy all times" />
          </div>

          {strip ? (
            <div className="rounded-xl bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Meeting overlap</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Every hour of {formatInZone(instant, refZone, { dateStyle: 'full' })} in {zoneLabel(refZone)}, shown
                    in each zone. Tap a column to set that hour.
                  </p>
                </div>
                <div className="flex items-end gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="tz-work-start">Work starts</Label>
                    <Input
                      id="tz-work-start"
                      type="number"
                      min={0}
                      max={23}
                      className="w-20"
                      value={workStart}
                      onChange={(e) => setWorkStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tz-work-end">Work ends</Label>
                    <Input
                      id="tz-work-end"
                      type="number"
                      min={0}
                      max={23}
                      className="w-20"
                      value={workEnd}
                      onChange={(e) => setWorkEnd(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <div className="min-w-[46rem]">
                  <div className="mb-1 grid grid-cols-[8rem_repeat(24,minmax(0,1fr))] gap-px text-[0.65rem] text-muted-foreground">
                    <div />
                    {strip.overlapColumns.map((ok, i) => (
                      <div key={i} className="text-center">
                        {ok ? <Check className="mx-auto size-3 text-foreground" role="img" aria-label="Everyone is inside working hours" /> : ''}
                      </div>
                    ))}
                  </div>
                  {strip.zoneRows.map((row) => (
                    <div
                      key={row.zone}
                      className="grid grid-cols-[8rem_repeat(24,minmax(0,1fr))] gap-px border-b border-border py-1 last:border-b-0"
                    >
                      <div className="truncate pr-2 text-xs font-medium text-foreground" title={row.zone}>
                        {zoneLabel(row.zone)}
                      </div>
                      {row.cells.map((cell, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setTimeValue(`${pad2(i)}:00`)}
                          aria-label={`${zoneLabel(row.zone)} ${pad2(cell.hour)}:00, set reference hour to ${pad2(i)}:00`}
                          className={cn(
                            'h-7 rounded-[3px] text-center text-[0.65rem] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            cell.working
                              ? 'bg-primary text-primary-foreground'
                              : cell.hour >= 6 && cell.hour < 22
                                ? 'bg-muted-foreground text-background'
                                : 'bg-background text-muted-foreground',
                            strip.refParts.hour === i && 'ring-2 ring-foreground ring-offset-1 ring-offset-background',
                          )}
                        >
                          {cell.hour}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-[3px] bg-primary" aria-hidden="true" />
                  Inside working hours
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-[3px] bg-muted-foreground" aria-hidden="true" />
                  Awake but outside working hours
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-[3px] bg-background" aria-hidden="true" />
                  Night (22:00–06:00)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3 text-foreground" aria-hidden="true" />
                  Everyone is inside working hours
                </span>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MiniStat label="UTC instant" value={instant.toISOString().replace('.000Z', 'Z')} />
            <MiniStat
              label="Zones compared"
              value={String(rows.length)}
              hint="including the reference zone"
            />
            <MiniStat
              label="Overlapping hours"
              value={String(strip ? strip.overlapColumns.filter(Boolean).length : 0)}
              hint="hours that suit every zone"
            />
          </div>
        </div>
      )}
    </div>
  )
}
