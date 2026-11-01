import { useEffect, useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfDay } from 'date-fns'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CalcLayout,
  EmptyState,
  EstimateNote,
  Field,
  FormulaBlock,
  Interpretation,
  NumberField,
  Segmented,
  StatGrid,
} from './common'

type Method = 'lmp' | 'conception' | 'ivf' | 'ultrasound'

const GESTATION_DAYS = 280

interface Milestone {
  day: number
  label: string
  note: string
}

const MILESTONES: Milestone[] = [
  { day: 28, label: '4 weeks', note: 'A missed period. Home tests are usually positive from around now.' },
  { day: 42, label: '6 weeks', note: 'A heartbeat is often visible on an early transvaginal scan.' },
  { day: 56, label: '8 weeks', note: 'The embryo is now called a fetus; most first midwife appointments fall between here and 10 weeks.' },
  { day: 70, label: '10 weeks', note: 'Earliest point for non-invasive prenatal testing (NIPT) on maternal blood.' },
  { day: 77, label: '11 weeks', note: 'Dating and nuchal translucency scan window opens (11+0 to 13+6).' },
  { day: 97, label: '13 weeks 6 days', note: 'End of the first trimester.' },
  { day: 126, label: '18 weeks', note: 'Anatomy (mid-pregnancy) scan window opens; runs to about 22 weeks.' },
  { day: 140, label: '20 weeks', note: 'Halfway. Movements usually become noticeable between 18 and 22 weeks.' },
  { day: 168, label: '24 weeks', note: 'The threshold of viability in most high-income healthcare systems.' },
  { day: 195, label: '27 weeks 6 days', note: 'End of the second trimester.' },
  { day: 196, label: '28 weeks', note: 'Third trimester begins. Glucose tolerance testing usually falls just before this.' },
  { day: 245, label: '35 weeks', note: 'Group B strep swab is commonly offered between 35 and 37 weeks.' },
  { day: 259, label: '37 weeks', note: 'Early term: no longer classed as premature.' },
  { day: 273, label: '39 weeks', note: 'Full term begins. Best outcomes cluster in the 39 to 40 week window.' },
  { day: 280, label: '40 weeks (due date)', note: 'The estimated date of delivery. About 4% of babies arrive on it.' },
  { day: 287, label: '41 weeks', note: 'Late term. Induction is usually discussed around here.' },
  { day: 294, label: '42 weeks', note: 'Post term. Very few pregnancies are allowed to continue past this point.' },
]

function weeksDays(days: number): string {
  if (!Number.isFinite(days)) return '–'
  const sign = days < 0 ? '−' : ''
  const d = Math.abs(Math.round(days))
  return `${sign}${Math.floor(d / 7)}w ${d % 7}d`
}

function DateField({
  id,
  label,
  value,
  onChange,
  hint,
  max,
  min,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  max?: string
  min?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** Fixed date for the static HTML and the first client render; the real date replaces it on mount. */
const SSR_TODAY = new Date(2026, 0, 1)

export default function PregnancyDueDateCalculator() {
  const [today, setToday] = useState<Date>(SSR_TODAY)
  useEffect(() => setToday(startOfDay(new Date())), [])
  return <DueDateCalculator key={today.getTime()} today={today} />
}

function DueDateCalculator({ today }: { today: Date }) {
  const iso = (d: Date) => format(d, 'yyyy-MM-dd')

  const [method, setMethod] = useState<Method>('lmp')
  const [lmp, setLmp] = useState(() => iso(addDays(today, -70)))
  const [cycle, setCycle] = useState(28)
  const [conception, setConception] = useState(() => iso(addDays(today, -56)))
  const [transfer, setTransfer] = useState(() => iso(addDays(today, -49)))
  const [embryoDay, setEmbryoDay] = useState('5')
  const [scanDate, setScanDate] = useState(() => iso(addDays(today, -7)))
  const [scanWeeks, setScanWeeks] = useState(9)
  const [scanDays, setScanDays] = useState(2)

  const parsed = (s: string): Date | null => {
    if (!s) return null
    const d = parseISO(s)
    return isValid(d) ? startOfDay(d) : null
  }

  const { edd, startDay, error, working } = useMemo((): {
    edd: Date | null
    startDay: Date | null
    error: string | null
    working: { label?: string; expr: string; result?: string }[]
  } => {
    if (method === 'lmp') {
      const d = parsed(lmp)
      if (!d) return { edd: null, startDay: null, error: 'Enter the first day of your last period.', working: [] }
      if (cycle < 20 || cycle > 45)
        return { edd: null, startDay: null, error: 'Cycle length should be between 20 and 45 days.', working: [] }
      const adjust = cycle - 28
      const due = addDays(d, GESTATION_DAYS + adjust)
      return {
        edd: due,
        // Weeks are counted from the cycle-adjusted period date, so the
        // milestones, term window and conception estimate match the due date.
        startDay: addDays(d, adjust),
        error: null,
        working: [
          { label: "Naegele's rule", expr: 'due date = first day of last period + 280 days' },
          {
            label: 'Cycle adjustment',
            expr: `${format(d, 'd MMM yyyy')} + 280 days ${adjust >= 0 ? '+' : '−'} ${Math.abs(adjust)} days (cycle ${cycle} vs 28)`,
            result: format(due, 'd MMM yyyy'),
          },
        ],
      }
    }
    if (method === 'conception') {
      const d = parsed(conception)
      if (!d) return { edd: null, startDay: null, error: 'Enter the conception or ovulation date.', working: [] }
      const due = addDays(d, 266)
      return {
        edd: due,
        startDay: addDays(due, -GESTATION_DAYS),
        error: null,
        working: [
          { label: 'From conception', expr: 'due date = conception date + 266 days (38 weeks)' },
          { expr: `${format(d, 'd MMM yyyy')} + 266 days`, result: format(due, 'd MMM yyyy') },
        ],
      }
    }
    if (method === 'ivf') {
      const d = parsed(transfer)
      if (!d) return { edd: null, startDay: null, error: 'Enter the embryo transfer date.', working: [] }
      const age = Number(embryoDay)
      const offset = GESTATION_DAYS - 14 - age
      const due = addDays(d, offset)
      return {
        edd: due,
        startDay: addDays(due, -GESTATION_DAYS),
        error: null,
        working: [
          { label: 'IVF transfer', expr: 'due date = transfer date + 280 − 14 − embryo age in days' },
          {
            expr: `${format(d, 'd MMM yyyy')} + 280 − 14 − ${age} = + ${offset} days`,
            result: format(due, 'd MMM yyyy'),
          },
        ],
      }
    }
    const d = parsed(scanDate)
    if (!d) return { edd: null, startDay: null, error: 'Enter the date of the scan.', working: [] }
    const gaAtScan = scanWeeks * 7 + scanDays
    if (gaAtScan < 28 || gaAtScan > 294)
      return {
        edd: null,
        startDay: null,
        error: 'Gestational age at the scan should be between 4 and 42 weeks.',
        working: [],
      }
    const due = addDays(d, GESTATION_DAYS - gaAtScan)
    return {
      edd: due,
      startDay: addDays(due, -GESTATION_DAYS),
      error: null,
      working: [
        { label: 'From a dating scan', expr: 'due date = scan date + (280 − gestational age in days at the scan)' },
        {
          expr: `${format(d, 'd MMM yyyy')} + (280 − ${gaAtScan}) = + ${GESTATION_DAYS - gaAtScan} days`,
          result: format(due, 'd MMM yyyy'),
        },
      ],
    }
  }, [method, lmp, cycle, conception, transfer, embryoDay, scanDate, scanWeeks, scanDays])

  const gaDays = startDay ? differenceInCalendarDays(today, startDay) : NaN
  const daysToGo = edd ? differenceInCalendarDays(edd, today) : NaN
  const trimester = gaDays < 98 ? 1 : gaDays < 196 ? 2 : 3
  const progress = Number.isFinite(gaDays) ? Math.min(100, Math.max(0, (gaDays / GESTATION_DAYS) * 100)) : 0
  const outOfRange = Number.isFinite(gaDays) && (gaDays < 0 || gaDays > 320)
  const conceptionEstimate = startDay ? addDays(startDay, 14) : null

  const summary =
    edd && startDay
      ? [
          `Estimated due date: ${format(edd, 'EEEE d MMMM yyyy')}`,
          `Gestational age today: ${weeksDays(gaDays)} (${gaDays} days)`,
          `Trimester: ${trimester}`,
          `Days to go: ${daysToGo}`,
          conceptionEstimate ? `Estimated conception: around ${format(conceptionEstimate, 'd MMMM yyyy')}` : '',
          '',
          'Key dates:',
          ...MILESTONES.map((ms) => `  ${ms.label}: ${format(addDays(startDay, ms.day), 'd MMM yyyy')}`),
          '',
          'Calculated at onthisdevice.com/pregnancy-due-date-calculator',
        ]
          .filter(Boolean)
          .join('\n')
      : ''

  return (
    <CalcLayout
      inputs={
        <ToolPanel title="How would you like to date the pregnancy?">
          <div className="space-y-4">
            <Segmented
              label="Dating method"
              value={method}
              onChange={setMethod}
              options={[
                { value: 'lmp', label: 'Last period' },
                { value: 'conception', label: 'Conception' },
                { value: 'ivf', label: 'IVF transfer' },
                { value: 'ultrasound', label: 'Ultrasound' },
              ]}
            />

            {method === 'lmp' ? (
              <>
                <DateField
                  id="preg-lmp"
                  label="First day of your last period"
                  value={lmp}
                  onChange={setLmp}
                  max={iso(today)}
                  hint="The first day of bleeding, not the last."
                />
                <NumberField
                  id="preg-cycle"
                  label="Average cycle length"
                  value={cycle}
                  onChange={setCycle}
                  unit="days"
                  min={20}
                  max={45}
                  dp={0}
                  hint="28 days is the textbook assumption. A longer cycle means later ovulation and a later due date."
                />
              </>
            ) : null}

            {method === 'conception' ? (
              <DateField
                id="preg-conception"
                label="Conception or ovulation date"
                value={conception}
                onChange={setConception}
                max={iso(today)}
                hint="Use the date of ovulation if you tracked it: an LH surge, a temperature shift or a known IUI date."
              />
            ) : null}

            {method === 'ivf' ? (
              <>
                <DateField
                  id="preg-transfer"
                  label="Embryo transfer date"
                  value={transfer}
                  onChange={setTransfer}
                  max={iso(today)}
                />
                <Field
                  label="Embryo age at transfer"
                  hint="A day-5 blastocyst is the most common transfer. Your clinic will have this on the transfer report."
                >
                  <Segmented
                    label="Embryo age at transfer"
                    value={embryoDay}
                    onChange={setEmbryoDay}
                    options={[
                      { value: '3', label: 'Day 3' },
                      { value: '5', label: 'Day 5' },
                      { value: '6', label: 'Day 6' },
                    ]}
                  />
                </Field>
              </>
            ) : null}

            {method === 'ultrasound' ? (
              <>
                <DateField
                  id="preg-scan"
                  label="Date of the scan"
                  value={scanDate}
                  onChange={setScanDate}
                  hint="A first-trimester scan is the most accurate way to date a pregnancy."
                />
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    id="preg-scan-weeks"
                    label="Weeks at scan"
                    value={scanWeeks}
                    onChange={setScanWeeks}
                    unit="w"
                    min={4}
                    max={42}
                    dp={0}
                  />
                  <NumberField
                    id="preg-scan-days"
                    label="Plus days"
                    value={scanDays}
                    onChange={setScanDays}
                    unit="d"
                    min={0}
                    max={6}
                    dp={0}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Copy the gestational age exactly as the sonographer reported it, for example
                  &ldquo;9 weeks 2 days&rdquo;.
                </p>
              </>
            ) : null}

            <EstimateNote>
              A due date is an estimate, not an appointment. Only about 4 percent of babies arrive on
              it. Your midwife or doctor may re-date the pregnancy after a scan, and their date is
              the one your care will follow.
            </EstimateNote>
          </div>
        </ToolPanel>
      }
      results={
        error ? (
          <EmptyState message={error} />
        ) : edd && startDay ? (
          <>
            <ToolPanel
              title="Your dates"
              footer={<CopyButton value={summary} label="Copy all dates" />}
            >
              <div className="space-y-5">
                <StatGrid cols={3}>
                  <ResultStat
                    label="Estimated due date"
                    value={format(edd, 'd MMM yyyy')}
                    hint={format(edd, 'EEEE')}
                    emphasis
                  />
                  <ResultStat
                    label="Gestational age today"
                    value={weeksDays(gaDays)}
                    hint={`${gaDays} days since the start of the last cycle`}
                  />
                  <ResultStat
                    label={daysToGo >= 0 ? 'Days to go' : 'Days past the due date'}
                    value={`${Math.abs(daysToGo)}`}
                    hint={daysToGo >= 0 ? `about ${weeksDays(daysToGo)}` : 'past 40 weeks'}
                  />
                  <ResultStat
                    label="Trimester"
                    value={trimester === 1 ? 'First' : trimester === 2 ? 'Second' : 'Third'}
                    hint={
                      trimester === 1
                        ? 'weeks 0–13+6'
                        : trimester === 2
                          ? 'weeks 14+0–27+6'
                          : 'weeks 28+0 onwards'
                    }
                  />
                  <ResultStat
                    label="Estimated conception"
                    value={conceptionEstimate ? format(conceptionEstimate, 'd MMM yyyy') : '–'}
                    hint="about two weeks after the start of the last cycle"
                  />
                  <ResultStat
                    label="Full term window"
                    value={`${format(addDays(startDay, 273), 'd MMM')} – ${format(addDays(startDay, 286), 'd MMM')}`}
                    hint="39+0 to 40+6 weeks"
                  />
                </StatGrid>

                {outOfRange ? (
                  <p role="alert" className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
                    <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span>
                      That works out to {weeksDays(gaDays)} of gestation, which is outside the normal
                      range. Check the date you entered.
                    </span>
                  </p>
                ) : null}

                <div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">Progress</span>
                    <span className="tabular-nums text-muted-foreground">
                      {Math.round(progress)}% · {weeksDays(gaDays)} of 40w 0d
                    </span>
                  </div>
                  <div
                    className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress)}
                    aria-label="Pregnancy progress"
                  >
                    <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>1st trimester</span>
                    <span>2nd</span>
                    <span>3rd</span>
                    <span>40w</span>
                  </div>
                </div>
              </div>
            </ToolPanel>

            <ToolPanel title="Key dates and milestones" description="Dates are derived from the estimated due date above.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Stage
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Date
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        What happens
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {MILESTONES.map((ms) => {
                      const d = addDays(startDay, ms.day)
                      const past = differenceInCalendarDays(today, d) >= 0
                      return (
                        <tr
                          key={ms.day}
                          className={`border-b border-border align-top last:border-0 ${past ? 'text-muted-foreground' : ''}`}
                        >
                          <th scope="row" className="py-2 pr-3 text-left font-medium whitespace-nowrap">
                            {ms.label}
                            <span className="ml-2 text-[10px] font-semibold">
                              {past ? 'passed' : ''}
                            </span>
                          </th>
                          <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
                            {format(d, 'd MMM yyyy')}
                          </td>
                          <td className="py-2">{ms.note}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </ToolPanel>

            <FormulaBlock
              lines={[
                ...working,
                {
                  label: 'Gestational age',
                  expr: `${format(today, 'd MMM yyyy')} − ${format(startDay, 'd MMM yyyy')} = ${gaDays} days`,
                  result: weeksDays(gaDays),
                },
              ]}
              note="Gestational age is counted from the first day of the last period, which is about two weeks before conception. That is why you are already called four weeks pregnant when a test first turns positive."
            />

            <Interpretation>
              <p>
                <strong>
                  You are {weeksDays(gaDays)} pregnant, in the{' '}
                  {trimester === 1 ? 'first' : trimester === 2 ? 'second' : 'third'} trimester, with
                  an estimated due date of {format(edd, 'EEEE d MMMM yyyy')}.
                </strong>
              </p>
              <p>
                Roughly 80 percent of babies arrive within the two weeks either side of that date,
                and first pregnancies commonly run a few days past it. The useful window is 37 to 42
                weeks: {format(addDays(startDay, 259), 'd MMM')} to{' '}
                {format(addDays(startDay, 294), 'd MMM')} for you.
              </p>
              <p>
                If you have had an early scan, use the ultrasound option above: measuring the embryo
                directly beats a remembered period date, and clinical guidance is to re-date the
                pregnancy when the two differ by more than about five to seven days.
              </p>
            </Interpretation>
          </>
        ) : (
          <EmptyState message="Choose a dating method and enter a date to see your due date, gestational age and milestones." />
        )
      }
    />
  )
}
