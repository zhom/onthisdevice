import { useMemo, useState } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import { Timeline } from '@/components/viz'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToday } from '@/components/tools/finance/hooks'
import { NumberField } from '@/components/tools/health/common'
import { addDays, gestation } from './body-math'
import { Assumptions, CalcGrid, Choice, Formula, Headline, Note, ResultPanel, Stats, num } from './mb-ui'
import type { FormulaItem } from './mb-ui'
import { cn } from '@/lib/utils'

type Mode = 'lmp' | 'due'

const TRIMESTER = ['first', 'second', 'third'] as const
const TRIMESTER_WEEKS = ['weeks 0 to 13', 'weeks 14 to 27', 'weeks 28 to 40'] as const

/** Milestones in weeks from the start of the last period: [from, to] (to inclusive). */
const MILESTONES = [
  { from: 6, to: 6, label: 'Heartbeat seen on ultrasound' },
  { from: 11, to: 13, label: 'First-trimester screening' },
  { from: 18, to: 22, label: 'Anatomy scan' },
  { from: 24, to: 28, label: 'Glucose test' },
  { from: 39, to: 39, label: 'Full term' },
  { from: 40, to: 40, label: 'Due date' },
] as const

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const long = (d: Date) => format(d, 'EEE d MMM yyyy')
const short = (d: Date) => format(d, 'd MMM yyyy')

function parseDate(s: string): Date | null {
  if (!s) return null
  const d = parseISO(s)
  return isValid(d) ? d : null
}

function weeksDays(days: number): string {
  if (!Number.isFinite(days)) return '–'
  const d = Math.round(days)
  const w = Math.floor(d / 7)
  const r = d - w * 7
  return `${w} ${w === 1 ? 'week' : 'weeks'} ${r} ${r === 1 ? 'day' : 'days'}`
}

/** 40 squares, one per week, in three rows: the trimesters (14, 14 and 12 weeks). */
function WeekGrid({ days }: { days: number }) {
  const done = Math.max(0, Math.min(40, Math.floor(days / 7)))
  const current = days >= 0 && days < 280 ? done : -1
  const rows: [number, number, string][] = [
    [0, 14, '1st'],
    [14, 28, '2nd'],
    [28, 40, '3rd'],
  ]
  const label =
    current >= 0
      ? `${done} of 40 weeks done. You are in week ${current + 1}.`
      : `${done} of 40 weeks done.`
  return (
    <figure className="space-y-2">
      <div role="img" aria-label={label} className="space-y-1">
        {rows.map(([a, b, name]) => (
          <div key={name} className="flex items-center gap-2">
            <span aria-hidden="true" className="w-7 shrink-0 text-xs text-muted-foreground">
              {name}
            </span>
            <div className="grid min-w-0 flex-1 grid-cols-14 gap-[3px]">
              {Array.from({ length: b - a }, (_, k) => {
                const i = a + k
                return (
                  <span
                    key={i}
                    className={cn(
                      'aspect-square rounded-[2px] transition-colors duration-300',
                      i < done ? 'bg-foreground' : 'bg-background',
                      i === current && 'ring-2 ring-foreground ring-inset',
                    )}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <figcaption className="text-[0.8125rem] text-pretty text-muted-foreground">
        One square for each week, one row for each trimester.{' '}
        {current >= 0
          ? `The ${done} filled squares are the weeks done. The outlined square is week ${current + 1}, the week you are in now.`
          : `The ${done} filled squares are the weeks done.`}
      </figcaption>
    </figure>
  )
}

export default function PregnancyWeekCalculator() {
  const today = useToday()
  const [mode, setMode] = useState<Mode>('lmp')
  // null = the default, which follows today's date (so it is right after mount).
  const [lmpText, setLmpText] = useState<string | null>(null)
  const [dueText, setDueText] = useState<string | null>(null)
  const [cycle, setCycle] = useState(28)

  const lmpValue = lmpText ?? iso(addDays(today, -140))
  const dueValue = dueText ?? iso(addDays(today, 140))

  const c = useMemo(() => {
    const cyc = Math.max(21, Math.min(40, Math.round(cycle) || 28))
    if (mode === 'lmp') {
      const lmp = parseDate(lmpValue)
      if (!lmp) return null
      return { mode, input: lmp, cyc, g: gestation(lmp, today, cyc) }
    }
    const due = parseDate(dueValue)
    if (!due) return null
    return { mode, input: due, cyc: 28, g: gestation(addDays(due, -280), today, 28) }
  }, [mode, lmpValue, dueValue, cycle, today])

  const g = c?.g
  const before = g !== undefined && g.days < 0
  const late = g !== undefined && g.days > 294
  const shownDays = g && !before ? g.days : NaN
  const start = g?.adjustedLmp

  const events = start
    ? MILESTONES.map((m) => ({
        at: m.from,
        label: m.label,
        detail:
          m.from === m.to
            ? short(addDays(start, m.from * 7))
            : `Weeks ${m.from} to ${m.to}: ${format(addDays(start, m.from * 7), 'd MMM')} to ${short(addDays(start, m.to * 7 + 6))}`,
      }))
    : []
  const next = g ? MILESTONES.find((m) => m.from * 7 > g.days) : undefined

  const formula: FormulaItem[] =
    c && g && start
      ? [
          c.mode === 'lmp'
            ? {
                label: 'Start of the count, with the cycle correction',
                general: 'start = first day of last period + (cycle − 28) days',
                steps: [`${short(c.input)} + (${c.cyc} − 28) days`],
                result: short(start),
              }
            : {
                label: 'Start of the count from the due date',
                general: 'start = due date − 280 days',
                steps: [`${short(c.input)} − 280 days`],
                result: short(start),
              },
          {
            label: 'Weeks pregnant today',
            general: 'days = today − start; weeks = days ÷ 7',
            steps: [`${short(today)} − ${short(start)} = ${g.days} days`, `${g.days} ÷ 7 = ${g.weeks} weeks, remainder ${g.rem} days`],
            result: weeksDays(g.days),
          },
          {
            label: 'Due date',
            general: 'due date = start + 280 days (40 weeks)',
            steps: [`${short(start)} + 280 days`],
            result: long(g.due),
          },
          {
            label: g.daysLeft >= 0 ? 'Days to go' : 'Days past the due date',
            general: 'days to go = due date − today',
            steps: [`${short(g.due)} − ${short(today)}`],
            result: `${num(Math.abs(g.daysLeft))} days`,
          },
        ]
      : []

  return (
    <CalcGrid
      inputs={
        <>
          <Choice<Mode>
            label="I know the"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'lmp', label: 'Last period' },
              { value: 'due', label: 'Due date' },
            ]}
          />
          {mode === 'lmp' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="pw-lmp">First day of your last period</Label>
                <Input id="pw-lmp" type="date" value={lmpValue} max={iso(today)} onChange={(e) => setLmpText(e.target.value)} />
                <p className="text-xs text-muted-foreground">The first day of bleeding.</p>
              </div>
              <NumberField
                id="pw-cycle"
                label="Cycle length"
                value={cycle}
                onChange={setCycle}
                unit="days"
                min={21}
                max={40}
                dp={0}
                hint="21 to 40 days. A longer cycle moves the dates later."
              />
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="pw-due">Due date</Label>
              <Input id="pw-due" type="date" value={dueValue} onChange={(e) => setDueText(e.target.value)} />
              <p className="text-xs text-muted-foreground">The date from your clinic or a scan.</p>
            </div>
          )}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Weeks pregnant today"
            value={shownDays}
            format={weeksDays}
            hint={
              g && !before
                ? `You are in week ${Math.min(42, g.weeks + 1)}, the ${TRIMESTER[g.trimester - 1]} trimester.`
                : 'Enter a date to see how far along you are.'
            }
          />
          {!c ? <Note warn>Enter a date.</Note> : null}
          {before ? <Note warn>That date puts the start of the pregnancy after today. Check the date.</Note> : null}
          {late ? <Note warn>That is more than 42 weeks. Check the date, and speak to your midwife or doctor.</Note> : null}
          {g && !before ? (
            <>
              <Stats
                items={[
                  { label: 'Trimester', value: `${g.trimester}`, hint: TRIMESTER_WEEKS[g.trimester - 1] },
                  { label: 'Due date', value: short(g.due), hint: format(g.due, 'EEEE') },
                  g.daysLeft >= 0
                    ? { label: 'Days to go', value: num(g.daysLeft), hint: weeksDays(g.daysLeft) }
                    : { label: 'Days past the due date', value: num(-g.daysLeft) },
                ]}
              />
              <WeekGrid days={g.days} />
              <Timeline
                start={0}
                end={40}
                spans={[
                  { from: 0, to: 14, label: 'First trimester' },
                  { from: 14, to: 28, label: 'Second trimester' },
                  { from: 28, to: 40, label: 'Third trimester' },
                ]}
                events={events}
                now={Math.min(40, g.days / 7)}
                nowLabel={`${g.weeks}w ${g.rem}d`}
                formatAt={(w) => `Week ${w}`}
                ariaLabel="Pregnancy timeline from week 0 to week 40"
                summary={
                  next
                    ? `You are ${weeksDays(g.days)} pregnant. Next milestone: ${next.label.toLowerCase()} at week ${next.from}, in ${weeksDays(next.from * 7 - g.days)}.`
                    : `You are ${weeksDays(g.days)} pregnant. All the milestones on this timeline are past.`
                }
              />
            </>
          ) : null}
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          {formula.length ? <Formula items={formula} /> : null}
          <Assumptions
            title="Limits"
            items={[
              'Weeks are counted from the first day of the last period, about two weeks before conception.',
              'The cycle correction assumes ovulation 14 days before the next period. With irregular cycles the dates are less exact.',
              'An early ultrasound dates a pregnancy more exactly than the period date. If your clinic gave you a due date, enter that date.',
              'The milestone weeks are typical. Your clinic sets your own schedule.',
            ]}
          />
        </div>
      }
    />
  )
}
