import { useMemo, useState } from 'react'
import { Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/components/tools/finance/format'
import { MiniStat, ZonePicker, useMounted, useNow, useZoneState } from './common'
import { breakdownMs, formatInZone, getZonedParts, pad2, zonedPartsToInstant, utcMs } from './tz'
import { REGION_LABELS, easterSunday, holidaysForYear, nthWeekdayOfMonth, upcomingHolidays } from './holidays'
import type { HolidayRegion } from './holidays'

const FILTERS: { id: 'all' | HolidayRegion; label: string }[] = [
  { id: 'all', label: 'All holidays' },
  { id: 'global', label: 'Widely observed' },
  { id: 'us', label: 'United States' },
  { id: 'uk', label: 'UK & Commonwealth' },
  { id: 'christian', label: 'Christian calendar' },
]

function isoOf(d: { year: number; month: number; day: number }): string {
  return `${d.year}-${pad2(d.month)}-${pad2(d.day)}`
}

/** Fixed date for the static HTML and the first client render; the real clock takes over on mount. */
const SSR_NOW = new Date(utcMs(2026, 0, 1, 12))

export default function DaysUntilChristmas() {
  const mounted = useMounted()
  const [zone, setZone] = useZoneState()
  const now = useNow(1000)
  const [filter, setFilter] = useState<'all' | HolidayRegion>('all')

  const today = useMemo(() => {
    const p = getZonedParts(mounted && now.getTime() > 0 ? now : SSR_NOW, zone)
    return { year: p.year, month: p.month, day: p.day }
  }, [mounted, now, zone])

  const christmas = useMemo(() => {
    const thisYear = zonedPartsToInstant(
      { year: today.year, month: 12, day: 25, hour: 0, minute: 0, second: 0 },
      zone,
    )
    const reference = mounted && now.getTime() > 0 ? now : SSR_NOW
    if (thisYear.getTime() > reference.getTime()) return thisYear
    return zonedPartsToInstant(
      { year: today.year + 1, month: 12, day: 25, hour: 0, minute: 0, second: 0 },
      zone,
    )
  }, [today.year, zone, mounted, now])

  const remaining = mounted && now.getTime() > 0 ? christmas.getTime() - now.getTime() : 0
  const parts = breakdownMs(Math.max(0, remaining))

  const list = useMemo(() => {
    const all = upcomingHolidays(today, 30)
    return filter === 'all' ? all : all.filter((h) => h.region === filter)
  }, [today, filter])

  const multiYear = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const year = today.year + i
      const thanksgiving = nthWeekdayOfMonth(year, 11, 4, 4)
      const easter = easterSunday(year)
      const blackFriday = holidaysForYear(year).find((h) => h.id === 'black-friday')
      return {
        year,
        easter,
        thanksgiving,
        blackFriday: blackFriday?.date ?? thanksgiving,
        christmas: { year, month: 12, day: 25 },
      }
    })
  }, [today.year])

  const copyValue = useMemo(
    () =>
      [
        `Upcoming holidays counted from ${isoOf(today)} (${zone})`,
        '',
        ...list.map(
          (h) =>
            `${String(h.daysAway).padStart(4)} days  ${isoOf(h.date)}  ${h.weekday.padEnd(9)}  ${h.name}`,
        ),
      ].join('\n'),
    [list, today, zone],
  )

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-card p-5 text-center sm:p-8">
        <div className="text-sm font-medium text-muted-foreground">
          Until Christmas Day, {formatInZone(christmas, zone, { year: 'numeric' })}
        </div>
        {mounted ? (
          <>
            <div
              className="mt-4 grid grid-cols-4 gap-2 sm:gap-4"
              role="timer"
              aria-live="off"
              aria-label={`${parts.days} days, ${parts.hours} hours, ${parts.minutes} minutes and ${parts.seconds} seconds until Christmas`}
            >
              {[
                { v: formatNumber(parts.days, 0), l: parts.days === 1 ? 'day' : 'days' },
                { v: pad2(parts.hours), l: 'hours' },
                { v: pad2(parts.minutes), l: 'minutes' },
                { v: pad2(parts.seconds), l: 'seconds' },
              ].map((cell) => (
                <div key={cell.l} className="rounded-lg bg-muted px-0.5 py-3 sm:px-2 sm:py-4">
                  <div className="text-2xl font-bold tabular-nums text-foreground sm:text-5xl">{cell.v}</div>
                  <div className="mt-1 text-[0.65rem] text-muted-foreground sm:text-xs sm:tracking-wide">
                    {cell.l}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Christmas Day {formatInZone(christmas, zone, { year: 'numeric' })} falls on a{' '}
              {formatInZone(christmas, zone, { weekday: 'long' })}. Counted from midnight in {zone}.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Starting the countdown…</p>
        )}
      </div>

      <ToolPanel
        title="Reference timezone"
        description="Days remaining are counted in calendar days where you are. Change the zone to count for another place."
      >
        <div className="sm:max-w-sm">
          <ZonePicker value={zone} onChange={setZone} label="Timezone" />
        </div>
      </ToolPanel>

      <div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter holidays by region">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              type="button"
              size="sm"
              variant={filter === f.id ? 'default' : 'outline'}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {mounted ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((h) => (
              <li
                key={h.id}
                className={cn(
                  'rounded-xl bg-card p-4',
                  h.daysAway === 0 && 'ring-2 ring-foreground',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">{h.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {h.weekday}, {isoOf(h.date)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{REGION_LABELS[h.region]}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-2xl font-bold tabular-nums text-foreground">
                      {formatNumber(h.daysAway, 0)}
                    </div>
                    <div className="text-[0.65rem] text-muted-foreground">
                      {h.daysAway === 0 ? 'today' : h.daysAway === 1 ? 'day' : 'days'}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Working out the dates…</p>
        )}

        {mounted && list.length > 0 ? (
          <div className="mt-4">
            <CopyButton value={copyValue} label="Copy the list" />
          </div>
        ) : null}
      </div>

      {mounted ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Today" value={isoOf(today)} hint={zone} />
            <MiniStat label="Holidays tracked" value={String(upcomingHolidays(today, 40).length)} />
            <MiniStat
              label="Next up"
              value={list[0] ? list[0].name : '–'}
              hint={list[0] ? `${list[0].daysAway} days away` : undefined}
            />
            <MiniStat
              label="Days left in the year"
              value={String(
                Math.max(
                  0,
                  Math.floor(utcMs(today.year, 11, 31) / 86_400_000) -
                    Math.floor(utcMs(today.year, today.month - 1, today.day) / 86_400_000),
                ),
              )}
            />
          </div>

          <div className="overflow-x-auto rounded-xl">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="px-3 py-2 text-left text-sm text-muted-foreground">
                Moving holiday dates for the next six years, computed from their rules
              </caption>
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Year</th>
                  <th scope="col" className="px-3 py-2 font-medium">Easter Sunday</th>
                  <th scope="col" className="px-3 py-2 font-medium">Thanksgiving (US)</th>
                  <th scope="col" className="px-3 py-2 font-medium">Black Friday</th>
                  <th scope="col" className="px-3 py-2 font-medium">Christmas Day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {multiYear.map((row) => (
                  <tr key={row.year}>
                    <th scope="row" className="px-3 py-2 text-left font-medium">{row.year}</th>
                    <td className="px-3 py-2 tabular-nums">{isoOf(row.easter)}</td>
                    <td className="px-3 py-2 tabular-nums">{isoOf(row.thanksgiving)}</td>
                    <td className="px-3 py-2 tabular-nums">{isoOf(row.blackFriday)}</td>
                    <td className="px-3 py-2 tabular-nums">{isoOf(row.christmas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {mounted && list.length === 0 ? (
        <div className="rounded-xl bg-muted p-8 text-center">
          <Gift className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            No holidays match that filter. Choose another region.
          </p>
        </div>
      ) : null}
    </div>
  )
}
