import { useMemo, useState } from 'react'
import { Hourglass } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { formatNumber } from '@/components/tools/finance/format'
import { MiniStat } from './common'
import { pad2 } from './tz'

const CLOCK_RE = /^-?\d{1,4}:\d{1,2}(:\d{1,2})?$/
const RANGE_RE = /^(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2}(?::\d{2})?)$/i
const TOKEN_RE = /^(-?(?:\d+(?:\.\d+)?\s*(?:w|d|h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)\s*)+)$/i

function clockToSeconds(value: string): number | null {
  const negative = value.startsWith('-')
  const parts = value.replace(/^-/, '').split(':').map(Number)
  if (parts.some((n) => !Number.isFinite(n))) return null
  const [h = 0, m = 0, s = 0] = parts
  if (m >= 60 || s >= 60) return null
  const total = h * 3600 + m * 60 + s
  return negative ? -total : total
}

/**
 * Parse one duration. Accepts `HH:MM`, `HH:MM:SS`, `1h 30m`, `90m`, `1.5h`,
 * a bare number (read as minutes) and clock ranges like `09:15-17:45`.
 */
export function parseDuration(input: string): number | null {
  const raw = input.trim().toLowerCase()
  if (!raw) return null

  const range = RANGE_RE.exec(raw)
  if (range && range[1] && range[2]) {
    const from = clockToSeconds(range[1])
    const to = clockToSeconds(range[2])
    if (from === null || to === null) return null
    return to >= from ? to - from : to + 86_400 - from // crosses midnight
  }

  if (CLOCK_RE.test(raw)) return clockToSeconds(raw)

  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw)
    return Number.isFinite(n) ? Math.round(n * 60) : null
  }

  if (TOKEN_RE.test(raw)) {
    let total = 0
    let matched = false
    const negative = raw.startsWith('-')
    const re = /(\d+(?:\.\d+)?)\s*(w|d|hrs|hr|hours|hour|h|mins|min|minutes|minute|m|secs|sec|seconds|second|s)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(raw)) !== null) {
      matched = true
      const value = Number(m[1])
      const unit = m[2] ?? ''
      const factor = unit.startsWith('w')
        ? 604_800
        : unit.startsWith('d')
          ? 86_400
          : unit.startsWith('h')
            ? 3600
            : unit.startsWith('m')
              ? 60
              : 1
      total += value * factor
    }
    if (!matched) return null
    return Math.round(negative ? -total : total)
  }

  return null
}

export function formatClock(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '−' : ''
  const abs = Math.abs(Math.round(totalSeconds))
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  return `${sign}${h}:${pad2(m)}:${pad2(s)}`
}

export function formatHuman(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? 'minus ' : ''
  const abs = Math.abs(Math.round(totalSeconds))
  if (abs === 0) return '0 seconds'
  const d = Math.floor(abs / 86_400)
  const h = Math.floor((abs % 86_400) / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  const parts: string[] = []
  if (d) parts.push(`${d} day${d === 1 ? '' : 's'}`)
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`)
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`)
  if (s) parts.push(`${s} second${s === 1 ? '' : 's'}`)
  return sign + parts.join(', ')
}

type Op = 'add' | 'subtract'

export default function TimeDurationCalculator() {
  const [a, setA] = useState('02:30:00')
  const [b, setB] = useState('01:45:30')
  const [op, setOp] = useState<Op>('add')
  const [sheet, setSheet] = useState('09:00-12:30\n13:15-17:45\n1h 20m')
  const [convert, setConvert] = useState('7:30')

  const aSec = parseDuration(a)
  const bSec = parseDuration(b)
  const pairResult = aSec !== null && bSec !== null ? (op === 'add' ? aSec + bSec : aSec - bSec) : null

  const sheetRows = useMemo(() => {
    return sheet
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        // Allow "Monday: 09:00-17:00" or "09:00-17:00 # note"
        const stripped = line.replace(/^[^0-9-]*[:,]\s*/, '').replace(/\s*[#/].*$/, '')
        const seconds = parseDuration(stripped)
        return { line, seconds }
      })
  }, [sheet])

  const sheetTotal = sheetRows.reduce((sum, r) => sum + (r.seconds ?? 0), 0)
  const sheetValid = sheetRows.filter((r) => r.seconds !== null)
  const sheetInvalid = sheetRows.filter((r) => r.seconds === null)

  const convertSec = parseDuration(convert)

  const sheetSummary = useMemo(() => {
    if (sheetValid.length === 0) return ''
    return [
      ...sheetRows.map((r) => `${r.line} → ${r.seconds === null ? 'not understood' : formatClock(r.seconds)}`),
      '',
      `Total: ${formatClock(sheetTotal)} (${(sheetTotal / 3600).toFixed(2)} decimal hours)`,
      `Entries: ${sheetValid.length}`,
      `Average: ${formatClock(sheetTotal / Math.max(1, sheetValid.length))}`,
    ].join('\n')
  }, [sheetRows, sheetTotal, sheetValid.length])

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pair" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="pair" className="flex-1">
            Add / subtract
          </TabsTrigger>
          <TabsTrigger value="sheet" className="flex-1">
            Sum a list
          </TabsTrigger>
          <TabsTrigger value="convert" className="flex-1">
            Convert units
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pair" className="mt-4 space-y-6">
          <ToolPanel
            title="Two durations"
            description="Type HH:MM:SS, HH:MM, shorthand like 1h 30m, or a clock range such as 09:15-17:45."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="td-a">First duration</Label>
                <Input id="td-a" value={a} spellCheck={false} onChange={(e) => setA(e.target.value)} aria-invalid={aSec === null} />
                <p className="text-xs text-muted-foreground">
                  {aSec === null ? 'Not understood yet' : `${formatClock(aSec)} · ${formatHuman(aSec)}`}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="td-b">Second duration</Label>
                <Input id="td-b" value={b} spellCheck={false} onChange={(e) => setB(e.target.value)} aria-invalid={bSec === null} />
                <p className="text-xs text-muted-foreground">
                  {bSec === null ? 'Not understood yet' : `${formatClock(bSec)} · ${formatHuman(bSec)}`}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <span className="text-sm font-medium leading-none">Operation</span>
              <Tabs value={op} onValueChange={(v) => setOp(v as Op)}>
                <TabsList className="w-full">
                  <TabsTrigger value="add" className="flex-1">
                    Add
                  </TabsTrigger>
                  <TabsTrigger value="subtract" className="flex-1">
                    Subtract
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </ToolPanel>

          {aSec === null || bSec === null ? (
            <ErrorNote message="Enter both durations as HH:MM:SS, HH:MM, 1h 30m, 90m or a range like 09:15-17:45." />
          ) : null}

          {pairResult !== null && aSec !== null && bSec !== null ? (
            <div className="space-y-4" role="status" aria-live="polite">
              <div className="rounded-xl bg-card p-5 sm:p-6">
                <div className="text-sm font-medium text-muted-foreground">Result</div>
                <div className="mt-1 text-4xl font-bold tabular-nums text-foreground sm:text-5xl">
                  {formatClock(pairResult)}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{formatHuman(pairResult)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatClock(aSec)} {op === 'add' ? '+' : '−'} {formatClock(bSec)} = {formatClock(pairResult)}
                </p>
                <div className="mt-4">
                  <CopyButton value={formatClock(pairResult)} label="Copy result" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ResultStat label="Decimal hours" value={(pairResult / 3600).toFixed(4)} emphasis />
                <MiniStat label="Total minutes" value={formatNumber(pairResult / 60, 2)} />
                <MiniStat label="Total seconds" value={formatNumber(pairResult, 0)} />
                <MiniStat label="Days" value={(pairResult / 86_400).toFixed(4)} />
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="sheet" className="mt-4 space-y-6">
          <ToolPanel
            title="Timesheet"
            description="One entry per line. Ranges, durations and labels all work. Labels before a colon are ignored."
          >
            <div className="space-y-1.5">
              <Label htmlFor="td-sheet">Entries</Label>
              <Textarea
                id="td-sheet"
                rows={8}
                spellCheck={false}
                value={sheet}
                onChange={(e) => setSheet(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Examples: <code>09:00-17:30</code>, <code>7:45</code>, <code>1h 20m</code>, <code>Mon: 08:00-16:00</code>,{' '}
                <code>-0:30</code> to deduct a break.
              </p>
            </div>
          </ToolPanel>

          {sheetRows.length === 0 ? (
            <div className="rounded-xl bg-muted p-8 text-center">
              <Hourglass className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm text-muted-foreground">Add some entries to total them up.</p>
            </div>
          ) : (
            <div className="space-y-4" role="status" aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ResultStat label="Total" value={formatClock(sheetTotal)} hint={formatHuman(sheetTotal)} emphasis />
                <ResultStat label="Decimal hours" value={(sheetTotal / 3600).toFixed(2)} hint="for payroll and invoices" />
                <MiniStat label="Entries counted" value={String(sheetValid.length)} />
                <MiniStat
                  label="Average per entry"
                  value={formatClock(sheetTotal / Math.max(1, sheetValid.length))}
                />
              </div>

              <div className="overflow-x-auto rounded-lg">
                <table className="w-full min-w-[24rem] text-left text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Entry</th>
                      <th scope="col" className="px-3 py-2 font-medium">Duration</th>
                      <th scope="col" className="px-3 py-2 font-medium">Decimal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sheetRows.map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-xs">{r.line}</td>
                        {r.seconds === null ? (
                          <td colSpan={2} className="px-3 py-2 text-destructive">
                            Not understood. Try HH:MM or 1h 30m
                          </td>
                        ) : (
                          <>
                            <td className="px-3 py-2 tabular-nums">{formatClock(r.seconds)}</td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">
                              {(r.seconds / 3600).toFixed(2)}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-muted">
                    <tr>
                      <th scope="row" className="px-3 py-2 text-left font-semibold">Total</th>
                      <td className="px-3 py-2 font-semibold tabular-nums">{formatClock(sheetTotal)}</td>
                      <td className="px-3 py-2 font-semibold tabular-nums">{(sheetTotal / 3600).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {sheetInvalid.length > 0 ? (
                <ErrorNote
                  message={`${sheetInvalid.length} line${sheetInvalid.length === 1 ? '' : 's'} could not be read and ${sheetInvalid.length === 1 ? 'was' : 'were'} left out of the total.`}
                />
              ) : null}

              <CopyButton value={sheetSummary} label="Copy timesheet" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="convert" className="mt-4 space-y-6">
          <ToolPanel title="Convert a duration" description="Enter one duration and read it in every unit at once.">
            <div className="space-y-1.5">
              <Label htmlFor="td-convert">Duration</Label>
              <Input
                id="td-convert"
                value={convert}
                spellCheck={false}
                onChange={(e) => setConvert(e.target.value)}
                aria-invalid={convertSec === null}
              />
              <p className="text-xs text-muted-foreground">
                A bare number is read as minutes. Use <code>2h</code>, <code>3d</code> or <code>1w</code> for other units.
              </p>
            </div>
          </ToolPanel>

          {convertSec === null ? (
            <ErrorNote message="That duration isn’t recognised. Try 7:30, 90m, 1h 30m or 1d 2h." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-live="polite">
              <ResultStat label="Clock format" value={formatClock(convertSec)} emphasis />
              <ResultStat label="Decimal hours" value={(convertSec / 3600).toFixed(6)} />
              <ResultStat label="Minutes" value={formatNumber(convertSec / 60, 4)} />
              <ResultStat label="Seconds" value={formatNumber(convertSec, 0)} />
              <ResultStat label="Milliseconds" value={formatNumber(convertSec * 1000, 0)} />
              <ResultStat label="Days" value={(convertSec / 86_400).toFixed(6)} />
              <ResultStat label="Weeks" value={(convertSec / 604_800).toFixed(6)} />
              <ResultStat label="In words" value={formatHuman(convertSec)} />
              <ResultStat label="Years (365.2425 d)" value={(convertSec / 31_556_952).toFixed(8)} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
