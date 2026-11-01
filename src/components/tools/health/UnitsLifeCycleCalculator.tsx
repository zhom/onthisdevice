import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
  subDays,
} from 'date-fns'
import { Printer, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula } from '@/components/shared/Formula'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { cn } from '@/lib/utils'

export type CycleMode = 'ovulation' | 'period' | 'conception'

interface Props {
  mode: CycleMode
}

const STORAGE_KEY = 'otd.units-life.cycle.v1'
const GESTATION_FROM_OVULATION = 266
const GESTATION_FROM_LMP = 280

interface Cycle {
  index: number
  start: Date
  periodEnd: Date
  fertileStart: Date
  ovulation: Date
  fertileEnd: Date
  pmsStart: Date
  nextStart: Date
  dueDate: Date
}

function buildCycles(lmp: Date, cycleLength: number, luteal: number, periodLength: number, count: number): Cycle[] {
  const out: Cycle[] = []
  for (let i = 0; i < count; i += 1) {
    const start = addDays(lmp, cycleLength * i)
    const ovulation = addDays(start, cycleLength - luteal)
    const nextStart = addDays(start, cycleLength)
    out.push({
      index: i,
      start,
      periodEnd: addDays(start, periodLength - 1),
      fertileStart: subDays(ovulation, 5),
      ovulation,
      // Six days: the five days before ovulation and the day itself.
      fertileEnd: ovulation,
      pmsStart: subDays(nextStart, 7),
      nextStart,
      dueDate: addDays(ovulation, GESTATION_FROM_OVULATION),
    })
  }
  return out
}

type Marker = 'period' | 'fertile' | 'ovulation' | 'pms'

const MARKER_STYLE: Record<Marker, string> = {
  period: 'bg-muted-foreground text-background',
  fertile: 'text-foreground ring-2 ring-inset ring-foreground',
  ovulation: 'bg-primary text-primary-foreground font-semibold',
  pms: 'border border-dashed border-foreground text-foreground',
}

const MARKER_LABEL: Record<Marker, string> = {
  period: 'Period',
  fertile: 'Fertile window',
  ovulation: 'Estimated ovulation',
  pms: 'Premenstrual week',
}

function key(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function buildMarkers(cycles: Cycle[]): Map<string, Marker> {
  const map = new Map<string, Marker>()
  const put = (d: Date, m: Marker, force = false) => {
    const k = key(d)
    if (force || !map.has(k)) map.set(k, m)
  }
  for (const c of cycles) {
    for (const d of eachDayOfInterval({ start: c.pmsStart, end: subDays(c.nextStart, 1) })) put(d, 'pms')
    for (const d of eachDayOfInterval({ start: c.fertileStart, end: c.fertileEnd })) put(d, 'fertile', true)
    for (const d of eachDayOfInterval({ start: c.start, end: c.periodEnd })) put(d, 'period', true)
    put(c.ovulation, 'ovulation', true)
  }
  return map
}

function MonthGrid({ month, markers }: { month: Date; markers: Map<string, Marker> }) {
  const first = startOfMonth(month)
  const last = endOfMonth(month)
  const days = eachDayOfInterval({ start: first, end: last })
  // Monday-first grid.
  const lead = (first.getDay() + 6) % 7

  return (
    <div className="rounded-lg bg-card p-3 break-inside-avoid">
      <div className="mb-2 text-sm font-semibold text-foreground">{format(month, 'MMMM yyyy')}</div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={`${d}-${i}`} aria-hidden="true">
            {d}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((d) => {
          const marker = markers.get(key(d))
          return (
            <div
              key={key(d)}
              className={cn(
                'grid aspect-square place-items-center rounded text-[12px] tabular-nums',
                marker ? MARKER_STYLE[marker] : 'text-muted-foreground',
              )}
              title={marker ? `${format(d, 'd MMMM')}: ${MARKER_LABEL[marker]}` : format(d, 'd MMMM')}
            >
              <span className="sr-only">
                {format(d, 'd MMMM yyyy')}
                {marker ? `, ${MARKER_LABEL[marker]}` : ''}
              </span>
              <span aria-hidden="true">{format(d, 'd')}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const LONG = 'EEEE d MMMM yyyy'
const SHORT = 'EEE d MMM yyyy'

/** Fixed date for the static HTML and the first client render; the real date replaces it on mount. */
const SSR_TODAY = new Date(2026, 0, 1)

export default function UnitsLifeCycleCalculator({ mode }: Props) {
  const [today, setToday] = useState<Date>(SSR_TODAY)
  useEffect(() => setToday(new Date()), [])
  return <CycleCalculator key={today.getTime()} mode={mode} today={today} />
}

function CycleCalculator({ mode, today }: Props & { today: Date }) {
  const uid = useId()

  const [lmpText, setLmpText] = useState(() => format(subDays(today, 7), 'yyyy-MM-dd'))
  const [dueText, setDueText] = useState(() => format(addDays(today, 200), 'yyyy-MM-dd'))
  const [cycleLength, setCycleLength] = useState('28')
  const [luteal, setLuteal] = useState('14')
  const [periodLength, setPeriodLength] = useState('5')
  const [conceptionDirection, setConceptionDirection] = useState<'from-due' | 'from-lmp'>('from-due')
  const [remember, setRemember] = useState(false)
  const [loaded, setLoaded] = useState(false)

  /* Opt-in persistence only. Nothing is written until the switch is on. */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, string>
        if (saved.lmp) setLmpText(saved.lmp)
        if (saved.due) setDueText(saved.due)
        if (saved.cycleLength) setCycleLength(saved.cycleLength)
        if (saved.luteal) setLuteal(saved.luteal)
        if (saved.periodLength) setPeriodLength(saved.periodLength)
        setRemember(true)
      }
    } catch {
      /* storage disabled — the tool works exactly the same without it */
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      if (remember) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ lmp: lmpText, due: dueText, cycleLength, luteal, periodLength }),
        )
      }
    } catch {
      /* ignore */
    }
  }, [cycleLength, dueText, lmpText, loaded, luteal, periodLength, remember])

  const forget = useCallback(() => {
    setRemember(false)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const cycleN = Math.round(Number(cycleLength))
  const lutealN = Math.round(Number(luteal))
  const periodN = Math.round(Number(periodLength))

  const lmp = useMemo(() => {
    const d = parseISO(lmpText)
    return isValid(d) ? d : null
  }, [lmpText])

  const due = useMemo(() => {
    const d = parseISO(dueText)
    return isValid(d) ? d : null
  }, [dueText])

  const problems: string[] = []
  if (mode !== 'conception' || conceptionDirection === 'from-lmp') {
    if (!lmp) problems.push('Pick the first day of your last period.')
  }
  if (mode === 'conception' && conceptionDirection === 'from-due' && !due) {
    problems.push('Pick an estimated due date.')
  }
  if (!Number.isFinite(cycleN) || cycleN < 20 || cycleN > 45) {
    problems.push('Cycle length should be between 20 and 45 days.')
  }
  if (!Number.isFinite(lutealN) || lutealN < 9 || lutealN > 17) {
    problems.push('The luteal phase is normally 9 to 17 days. 14 is the usual assumption.')
  }
  if (mode === 'period' && (!Number.isFinite(periodN) || periodN < 1 || periodN > 10)) {
    problems.push('Period length should be between 1 and 10 days.')
  }

  const cycleCount = mode === 'period' ? 6 : 3
  const cycles = useMemo(() => {
    if (!lmp || problems.length > 0) return []
    return buildCycles(lmp, cycleN, lutealN, Math.max(1, periodN), cycleCount)
  }, [cycleCount, cycleN, lmp, lutealN, periodN, problems.length])

  const markers = useMemo(() => buildMarkers(cycles), [cycles])

  const months = useMemo(() => {
    if (cycles.length === 0) return []
    const start = startOfMonth(cycles[0].start)
    const end = startOfMonth(cycles[cycles.length - 1].nextStart)
    const list: Date[] = []
    let cursor = start
    while (cursor <= end && list.length < 9) {
      list.push(cursor)
      cursor = addMonths(cursor, 1)
    }
    return list
  }, [cycles])

  /* Conception mode works backwards from a due date. */
  const conception = useMemo(() => {
    if (mode !== 'conception') return null
    if (conceptionDirection === 'from-due') {
      if (!due) return null
      return {
        conceptionDate: subDays(due, GESTATION_FROM_OVULATION),
        windowStart: subDays(due, GESTATION_FROM_OVULATION + 5),
        windowEnd: subDays(due, GESTATION_FROM_OVULATION),
        lmp: subDays(due, GESTATION_FROM_LMP),
        due,
      }
    }
    if (!lmp || problems.length > 0) return null
    const ov = addDays(lmp, cycleN - lutealN)
    return {
      conceptionDate: ov,
      windowStart: subDays(ov, 5),
      windowEnd: ov,
      lmp,
      due: addDays(ov, GESTATION_FROM_OVULATION),
    }
  }, [conceptionDirection, cycleN, due, lmp, lutealN, mode, problems.length])

  const first = cycles[0]

  const summaryText = useMemo(() => {
    if (mode === 'conception' && conception) {
      return [
        `Estimated conception: ${format(conception.conceptionDate, LONG)}`,
        `Likely conception window: ${format(conception.windowStart, SHORT)} to ${format(conception.windowEnd, SHORT)}`,
        `First day of last period: ${format(conception.lmp, SHORT)}`,
        `Estimated due date: ${format(conception.due, SHORT)}`,
      ].join('\n')
    }
    if (!first) return ''
    if (mode === 'period') {
      return cycles
        .map((c, i) => `Period ${i + 1}: ${format(c.start, SHORT)} to ${format(c.periodEnd, SHORT)}`)
        .join('\n')
    }
    return cycles
      .map(
        (c, i) =>
          `Cycle ${i + 1}: fertile ${format(c.fertileStart, SHORT)}–${format(c.fertileEnd, SHORT)}, ovulation ${format(
            c.ovulation,
            SHORT,
          )}`,
      )
      .join('\n')
  }, [conception, cycles, first, mode])

  const daysToOvulation = first ? differenceInCalendarDays(first.ovulation, today) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg bg-muted p-4 text-sm print:hidden">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-foreground" aria-hidden="true" />
        <div className="text-pretty">
          <p className="font-medium text-foreground">Nothing you type here is sent anywhere.</p>
          <p className="mt-1 text-muted-foreground">
            The dates are used only by JavaScript in this page, which sets no cookies and has no
            analytics. They are discarded when you close the tab unless you switch on storage below,
            and you can delete stored dates with one click.
          </p>
        </div>
      </div>

      <ToolPanel title="Your dates" description="Two numbers do all the work: when your last period started, and how long your cycle usually runs.">
        {mode === 'conception' ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-direction`}>Work it out</Label>
            <Select
              value={conceptionDirection}
              onValueChange={(v) => setConceptionDirection(v as 'from-due' | 'from-lmp')}
            >
              <SelectTrigger id={`${uid}-direction`} className="w-full sm:w-[340px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="from-due">Backwards from a due date</SelectItem>
                <SelectItem value="from-lmp">Forwards from the last period</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mode === 'conception' && conceptionDirection === 'from-due' ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-due`}>Estimated due date</Label>
              <Input
                id={`${uid}-due`}
                type="date"
                value={dueText}
                onChange={(e) => setDueText(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-lmp`}>First day of your last period</Label>
              <Input
                id={`${uid}-lmp`}
                type="date"
                value={lmpText}
                onChange={(e) => setLmpText(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-cycle`}>Average cycle length (days)</Label>
            <Input
              id={`${uid}-cycle`}
              type="number"
              min={20}
              max={45}
              inputMode="numeric"
              className="tabular-nums"
              value={cycleLength}
              onChange={(e) => setCycleLength(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">First day of one period to the first day of the next.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-luteal`}>Luteal phase (days)</Label>
            <Input
              id={`${uid}-luteal`}
              type="number"
              min={9}
              max={17}
              inputMode="numeric"
              className="tabular-nums"
              value={luteal}
              onChange={(e) => setLuteal(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Ovulation to the next period. Far steadier than cycle length. Use 14 days if you don't know.
            </p>
          </div>

          {mode === 'period' ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-period`}>Period length (days)</Label>
              <Input
                id={`${uid}-period`}
                type="number"
                min={1}
                max={10}
                inputMode="numeric"
                className="tabular-nums"
                value={periodLength}
                onChange={(e) => setPeriodLength(e.target.value)}
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-4">
          <div className="flex items-center gap-3">
            <Switch id={`${uid}-remember`} checked={remember} onCheckedChange={(v) => (v ? setRemember(true) : forget())} />
            <Label htmlFor={`${uid}-remember`} className="cursor-pointer">
              Remember these dates on this device
            </Label>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={forget}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete saved data
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 print:hidden"
            onClick={() => window.print()}
          >
            <Printer className="size-4" aria-hidden="true" />
            Print this page
          </Button>
        </div>
      </ToolPanel>

      {problems.length > 0 ? (
        <ErrorNote
          title="Check these entries"
          message={
            <span>
              {problems.map((p) => (
                <span key={p} className="block">
                  {p}
                </span>
              ))}
            </span>
          }
        />
      ) : null}

      <div role="status" aria-live="polite" className="space-y-4">
        {mode === 'ovulation' && first ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat
                label="Estimated ovulation"
                value={format(first.ovulation, 'd MMM yyyy')}
                hint={
                  daysToOvulation === 0
                    ? 'That is today, on these figures.'
                    : daysToOvulation > 0
                      ? `${daysToOvulation} days from today.`
                      : `${Math.abs(daysToOvulation)} days ago.`
                }
                emphasis
              />
              <ResultStat
                label="Fertile window"
                value={`${format(first.fertileStart, 'd MMM')} – ${format(first.fertileEnd, 'd MMM')}`}
                hint="Six days: the five before ovulation plus the day itself. Sperm survive up to five days; an egg lasts about 24 hours."
                emphasis
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <ResultStat label="Most fertile days" value={`${format(subDays(first.ovulation, 2), 'd MMM')} – ${format(first.ovulation, 'd MMM')}`} hint="Conception rates peak in the two days before ovulation." />
              <ResultStat label="Next period expected" value={format(first.nextStart, 'd MMM yyyy')} hint={`${cycleN} days after the last one started.`} />
              <ResultStat label="Due date if you conceive now" value={format(first.dueDate, 'd MMM yyyy')} hint="266 days from ovulation." />
            </div>
          </>
        ) : null}

        {mode === 'period' && first ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat
              label="Next period starts"
              value={format(first.nextStart, 'd MMM yyyy')}
              hint={`${differenceInCalendarDays(first.nextStart, today)} days from today.`}
              emphasis
            />
            <ResultStat
              label="Premenstrual week"
              value={`${format(first.pmsStart, 'd MMM')} – ${format(subDays(first.nextStart, 1), 'd MMM')}`}
              hint="The seven days before the next period, when PMS symptoms usually appear."
              emphasis
            />
            <ResultStat
              label="Period length"
              value={`${periodN} days`}
              hint={`So the next one runs to about ${format(addDays(first.nextStart, periodN - 1), 'd MMM')}.`}
              emphasis
            />
          </div>
        ) : null}

        {mode === 'conception' && conception ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat
                label="Estimated conception date"
                value={format(conception.conceptionDate, 'd MMM yyyy')}
                hint="266 days before the due date. This is the day of ovulation, which is not always the day of intercourse."
                emphasis
              />
              <ResultStat
                label="Likely conception window"
                value={`${format(conception.windowStart, 'd MMM')} – ${format(conception.windowEnd, 'd MMM')}`}
                hint="Intercourse anywhere in this six-day span could have led to this pregnancy."
                emphasis
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat label="First day of last period" value={format(conception.lmp, 'd MMM yyyy')} hint="280 days before the due date, by Naegele's rule." />
              <ResultStat label="Estimated due date" value={format(conception.due, 'd MMM yyyy')} hint="Only about 4% of babies arrive on it." />
            </div>
          </>
        ) : null}

        {summaryText ? <CopyButton value={summaryText} label="Copy these dates" /> : null}
      </div>

      {(mode !== 'conception' || conceptionDirection === 'from-lmp') && cycles.length > 0 ? (
        <ToolPanel
          title="The working"
          description="Your dates, substituted into the arithmetic. No averages from other people are used."
        >
          <Formula caption="This is the calendar method. It predicts, it does not observe: basal body temperature, cervical mucus and LH test strips tell you what actually happened.">
            {[
              'ovulation = first day of last period + (cycle length − luteal phase)',
              `ovulation = ${format(cycles[0].start, 'd MMM yyyy')} + (${cycleN} − ${lutealN}) days`,
              `ovulation = ${format(cycles[0].start, 'd MMM yyyy')} + ${cycleN - lutealN} days = ${format(cycles[0].ovulation, 'd MMM yyyy')}`,
              '',
              'fertile window = ovulation − 5 days … ovulation day',
              `fertile window = ${format(cycles[0].fertileStart, 'd MMM')} … ${format(cycles[0].fertileEnd, 'd MMM')}`,
              '',
              'next period = first day of last period + cycle length',
              `next period = ${format(cycles[0].start, 'd MMM yyyy')} + ${cycleN} days = ${format(cycles[0].nextStart, 'd MMM yyyy')}`,
            ].join('\n')}
          </Formula>
        </ToolPanel>
      ) : null}

      {cycles.length > 0 && mode !== 'conception' ? (
        <ToolPanel
          title={mode === 'period' ? 'Your next six cycles' : 'Your next three cycles'}
          description="Every date below comes from the same two inputs. Print the page to take it with you."
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Period starts</TableHead>
                  {mode === 'period' ? <TableHead>Period ends</TableHead> : null}
                  <TableHead>Fertile window</TableHead>
                  <TableHead>Ovulation</TableHead>
                  {mode === 'period' ? <TableHead>PMS week from</TableHead> : <TableHead>Due date if conceived</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.map((c) => (
                  <TableRow key={key(c.start)}>
                    <TableCell className="font-medium">{c.index + 1}</TableCell>
                    <TableCell className="tabular-nums">{format(c.start, SHORT)}</TableCell>
                    {mode === 'period' ? (
                      <TableCell className="tabular-nums">{format(c.periodEnd, SHORT)}</TableCell>
                    ) : null}
                    <TableCell className="tabular-nums">
                      {format(c.fertileStart, 'd MMM')} – {format(c.fertileEnd, 'd MMM')}
                    </TableCell>
                    <TableCell className="tabular-nums">{format(c.ovulation, SHORT)}</TableCell>
                    {mode === 'period' ? (
                      <TableCell className="tabular-nums text-muted-foreground">{format(c.pmsStart, SHORT)}</TableCell>
                    ) : (
                      <TableCell className="tabular-nums text-muted-foreground">{format(c.dueDate, SHORT)}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      ) : null}

      {months.length > 0 && mode !== 'conception' ? (
        <ToolPanel title="Calendar" description="Printable. Period in solid grey, fertile window outlined, ovulation solid black, premenstrual week with a dashed outline.">
          <div className="flex flex-wrap gap-3 text-xs">
            {(Object.keys(MARKER_LABEL) as Marker[]).map((m) => (
              <span key={m} className="inline-flex items-center gap-1.5">
                <span className={cn('size-3.5 rounded', MARKER_STYLE[m])} aria-hidden="true" />
                {MARKER_LABEL[m]}
              </span>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {months.map((m) => (
              <MonthGrid key={key(m)} month={m} markers={markers} />
            ))}
          </div>
        </ToolPanel>
      ) : null}
    </div>
  )
}
