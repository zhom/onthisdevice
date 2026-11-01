import { useEffect, useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  ACTIVITY_LEVELS,
  CALORIE_FLOOR,
  CalcLayout,
  EmptyState,
  EstimateNote,
  FormulaBlock,
  HeightField,
  Interpretation,
  KCAL_PER_KG_FAT,
  NumberField,
  Segmented,
  SexToggle,
  StatGrid,
  UnitToggle,
  WeightField,
  activityById,
  fmt,
  kcal,
  kgToLb,
  lbToKg,
  mifflinStJeor,
  useUnitSystem,
  type Sex,
  type UnitSystem,
} from './common'

const RATE_LABELS = ['Relaxed', 'Steady', 'Fast', 'Aggressive'] as const
const METRIC_RATES = [0.25, 0.5, 0.75, 1] // kg per week
const IMPERIAL_RATES = [0.5, 1, 1.5, 2] // lb per week

function rateKgPerWeek(index: number, units: UnitSystem): number {
  const i = Math.min(3, Math.max(0, index))
  return units === 'metric' ? (METRIC_RATES[i] ?? 0.5) : lbToKg(IMPERIAL_RATES[i] ?? 1)
}

interface Point {
  week: number
  kg: number
}

/**
 * Fixed intake, recalculated expenditure. Loss slows as the body gets lighter,
 * which is why real diets plateau — the naive 7,700 kcal-per-kg line does not.
 */
function project(
  startKg: number,
  goalKg: number,
  intake: number,
  sex: Sex,
  cm: number,
  age: number,
  multiplier: number,
): { points: Point[]; reachedWeek: number | null } {
  const losing = goalKg < startKg
  const points: Point[] = [{ week: 0, kg: startKg }]
  let w = startKg
  let reachedWeek: number | null = null
  for (let week = 1; week <= 260; week++) {
    const tdee = mifflinStJeor(sex, w, cm, age + week / 52) * multiplier
    const dailyDelta = intake - tdee
    const dw = (dailyDelta * 7) / KCAL_PER_KG_FAT
    const next = w + dw
    if (Math.abs(next - w) < 0.0005) break
    w = Math.max(25, next)
    points.push({ week, kg: w })
    if (reachedWeek === null && ((losing && w <= goalKg) || (!losing && w >= goalKg))) {
      reachedWeek = week
      break
    }
  }
  return { points, reachedWeek }
}

function TrendChart({
  points,
  goalKg,
  metric,
}: {
  points: Point[]
  goalKg: number
  metric: boolean
}) {
  if (points.length < 2) return null
  const W = 420
  const H = 170
  const PAD = { t: 12, r: 12, b: 26, l: 44 }
  const weights = points.map((p) => p.kg).concat(goalKg)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const span = Math.max(1, maxW - minW)
  const lo = minW - span * 0.12
  const hi = maxW + span * 0.12
  const maxWeek = points[points.length - 1]?.week ?? 1
  const x = (week: number) => PAD.l + (week / Math.max(1, maxWeek)) * (W - PAD.l - PAD.r)
  const y = (kg: number) => PAD.t + (1 - (kg - lo) / (hi - lo)) * (H - PAD.t - PAD.b)
  const show = (kg: number) => (metric ? `${fmt(kg, 1)}` : `${fmt(kgToLb(kg), 0)}`)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.week).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(' ')
  const area = `${d} L ${x(maxWeek).toFixed(1)} ${(H - PAD.b).toFixed(1)} L ${x(0).toFixed(1)} ${(H - PAD.b).toFixed(1)} Z`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`Projected weight from ${show(points[0]!.kg)} to ${show(points[points.length - 1]!.kg)} ${metric ? 'kilograms' : 'pounds'} over ${maxWeek} weeks.`}
    >
      <line
        x1={PAD.l}
        y1={H - PAD.b}
        x2={W - PAD.r}
        y2={H - PAD.b}
        className="stroke-muted-foreground"
        strokeWidth={1}
      />
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} className="stroke-muted-foreground" strokeWidth={1} />
      <line
        x1={PAD.l}
        y1={y(goalKg)}
        x2={W - PAD.r}
        y2={y(goalKg)}
        className="stroke-chart-3"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      <text x={W - PAD.r} y={y(goalKg) - 5} textAnchor="end" className="fill-muted-foreground text-[10px]">
        goal {show(goalKg)}
      </text>
      <path d={area} className="fill-chart-5" />
      <path d={d} fill="none" strokeWidth={2.5} strokeLinejoin="round" className="stroke-primary" />
      {[lo, (lo + hi) / 2, hi].map((v) => (
        <text
          key={v}
          x={PAD.l - 6}
          y={y(v) + 3}
          textAnchor="end"
          className="fill-muted-foreground text-[10px] tabular-nums"
        >
          {show(v)}
        </text>
      ))}
      <text x={PAD.l} y={H - 8} className="fill-muted-foreground text-[10px]">
        week 0
      </text>
      <text x={W - PAD.r} y={H - 8} textAnchor="end" className="fill-muted-foreground text-[10px]">
        week {maxWeek}
      </text>
    </svg>
  )
}

export default function CalorieCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [sex, setSex] = useState<Sex>('female')
  const [cm, setCm] = useState(166)
  const [kg, setKg] = useState(74)
  const [goalKg, setGoalKg] = useState(65)
  const [age, setAge] = useState(32)
  const [activity, setActivity] = useState('light')
  const [rateIndex, setRateIndex] = useState(1)
  // Today is known only on the client; the static HTML shows no dates.
  const [today, setToday] = useState<Date | null>(null)
  useEffect(() => setToday(new Date()), [])

  const metric = units === 'metric'
  const valid = cm >= 90 && cm <= 260 && kg > 0 && age >= 15 && age <= 100 && goalKg > 0
  const level = activityById(activity)

  const bmr = valid ? mifflinStJeor(sex, kg, cm, age) : NaN
  const tdee = bmr * level.multiplier

  const direction = !valid ? 'maintain' : goalKg < kg - 0.05 ? 'lose' : goalKg > kg + 0.05 ? 'gain' : 'maintain'
  const rate = rateKgPerWeek(rateIndex, units)
  const dailyDelta =
    direction === 'maintain' ? 0 : ((direction === 'lose' ? -1 : 1) * rate * KCAL_PER_KG_FAT) / 7
  const rawTarget = tdee + dailyDelta
  const floor = CALORIE_FLOOR[sex]
  const belowFloor = valid && direction === 'lose' && rawTarget < floor
  const target = belowFloor ? floor : rawTarget

  const { points, reachedWeek } = useMemo(() => {
    if (!valid || direction === 'maintain') return { points: [] as Point[], reachedWeek: null }
    return project(kg, goalKg, target, sex, cm, age, level.multiplier)
  }, [valid, direction, kg, goalKg, target, sex, cm, age, level.multiplier])

  const totalChange = Math.abs(kg - goalKg)
  const showW = (v: number) => (metric ? `${fmt(v, 1)} kg` : `${fmt(kgToLb(v), 1)} lb`)
  const showRate = metric
    ? `${fmt(rate, 2)} kg/week`
    : `${fmt(kgToLb(rate), 2)} lb/week`
  const pctPerWeek = kg > 0 ? (rate / kg) * 100 : 0
  const targetDate = reachedWeek !== null && today ? addDays(today, reachedWeek * 7) : null

  const milestoneRows = useMemo(() => {
    if (!points.length) return []
    const step = Math.max(1, Math.ceil((points[points.length - 1]?.week ?? 4) / 10 / 2) * 2)
    const rows = points.filter((p) => p.week % step === 0)
    const last = points[points.length - 1]!
    if (rows[rows.length - 1]?.week !== last.week) rows.push(last)
    return rows.slice(0, 14)
  }, [points])

  const summary = valid
    ? [
        `Maintenance (TDEE): ${Math.round(tdee)} kcal/day`,
        `Goal: ${direction === 'maintain' ? 'maintain weight' : `${direction} ${showW(totalChange)}`}`,
        direction === 'maintain' ? '' : `Rate: ${showRate}`,
        `Daily calorie target: ${Math.round(target)} kcal`,
        reachedWeek !== null
          ? `Projected to reach ${showW(goalKg)} in ${reachedWeek} weeks${targetDate ? `, around ${format(targetDate, 'd MMMM yyyy')}` : ''}`
          : '',
        '',
        'Calculated at onthisdevice.com/calorie-calculator',
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  return (
    <CalcLayout
      inputs={
        <ToolPanel title="Your details and goal">
          <div className="space-y-4">
            <UnitToggle units={units} onChange={setUnits} className="max-w-none" />
            <SexToggle sex={sex} onChange={setSex} />
            <HeightField id="cal-height" cm={cm} onChange={setCm} units={units} />
            <WeightField id="cal-weight" kg={kg} onChange={setKg} units={units} label="Current weight" />
            <WeightField id="cal-goal" kg={goalKg} onChange={setGoalKg} units={units} label="Goal weight" />
            <NumberField
              id="cal-age"
              label="Age"
              value={age}
              onChange={setAge}
              unit="years"
              min={15}
              max={100}
              dp={0}
            />

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Activity level</legend>
              <RadioGroup value={activity} onValueChange={setActivity} className="gap-2">
                {ACTIVITY_LEVELS.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 rounded-lg p-2.5 has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-foreground"
                  >
                    <RadioGroupItem value={a.id} id={`cal-act-${a.id}`} className="mt-1" />
                    <Label htmlFor={`cal-act-${a.id}`} className="cursor-pointer font-normal">
                      <span className="block text-sm font-medium">
                        {a.label}{' '}
                        <span className="font-normal text-muted-foreground">×{a.multiplier}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {a.description}
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>

            {direction !== 'maintain' ? (
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Rate of change</span>
                <Segmented
                  label="Rate of weight change"
                  value={String(rateIndex)}
                  onChange={(v) => setRateIndex(Number(v))}
                  options={RATE_LABELS.map((_label, i) => ({
                    value: String(i),
                    label: `${metric ? METRIC_RATES[i] : IMPERIAL_RATES[i]} ${metric ? 'kg' : 'lb'}`,
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  {RATE_LABELS[rateIndex]}: {showRate}, about {fmt(pctPerWeek, 2)}% of your body
                  weight per week.
                  {pctPerWeek > 1
                    ? ' Above 1% a week you start losing meaningful muscle alongside fat.'
                    : ''}
                </p>
              </div>
            ) : null}

            <EstimateNote>
              Calorie targets are estimates built on population averages. If you are pregnant,
              breastfeeding, under 18, or managing a condition like diabetes or an eating disorder,
              set targets with a clinician rather than a calculator.
            </EstimateNote>
          </div>
        </ToolPanel>
      }
      results={
        valid ? (
          <>
            <ToolPanel
              title="Your daily calorie target"
              footer={<CopyButton value={summary} label="Copy plan" />}
            >
              <div className="space-y-4">
                <StatGrid cols={3}>
                  <ResultStat
                    label="Eat per day"
                    value={kcal(target)}
                    hint={
                      direction === 'maintain'
                        ? 'to hold your current weight'
                        : `${target < tdee ? 'deficit' : 'surplus'} of ${Math.abs(Math.round(target - tdee))} kcal`
                    }
                    emphasis
                  />
                  <ResultStat label="Maintenance (TDEE)" value={kcal(tdee)} hint={`BMR ${Math.round(bmr)} × ${level.multiplier}`} />
                  <ResultStat
                    label={direction === 'maintain' ? 'Weight change' : `Total to ${direction}`}
                    value={direction === 'maintain' ? 'none' : showW(totalChange)}
                    hint={direction === 'maintain' ? 'goal equals current weight' : `at ${showRate}`}
                  />
                </StatGrid>

                {belowFloor ? (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm"
                  >
                    <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span>
                      That rate would put you at {kcal(rawTarget)} a day, below the{' '}
                      {floor.toLocaleString('en-US')} kcal floor commonly used for {sex === 'male' ? 'men' : 'women'}
                      . The target has been held at {kcal(floor)}. Choose a slower rate, or add
                      activity to widen the deficit instead of cutting food further.
                    </span>
                  </p>
                ) : null}

                {direction !== 'maintain' && points.length > 1 ? (
                  <>
                    <TrendChart points={points} goalKg={goalKg} metric={metric} />
                    <div role="status" aria-live="polite" className="text-sm">
                      {reachedWeek !== null ? (
                        <p>
                          At {kcal(target)} a day you should reach{' '}
                          <strong className="font-semibold">{showW(goalKg)}</strong> in about{' '}
                          <strong className="font-semibold">{reachedWeek} weeks</strong>
                          {targetDate ? (
                            <>
                              , around{' '}
                              <strong className="font-semibold">
                                {format(targetDate, 'd MMMM yyyy')}
                              </strong>
                            </>
                          ) : null}
                          .
                        </p>
                      ) : (
                        <p className="text-muted-foreground">
                          At this intake your weight settles at about{' '}
                          {showW(points[points.length - 1]!.kg)} before reaching the goal, because the
                          deficit closes as you get lighter. Pick a slightly lower intake or a
                          higher activity level to go further.
                        </p>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </ToolPanel>

            {milestoneRows.length > 1 ? (
              <ToolPanel
                title="Projected timeline"
                description="Expenditure is recalculated every week, so the curve flattens the way real weight loss does."
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[24rem] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Week
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Date
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Weight
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          Change so far
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {milestoneRows.map((p) => (
                        <tr key={p.week} className="border-b border-border last:border-0">
                          <td className="py-2 pr-3 tabular-nums">{p.week}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                            {today ? format(addDays(today, p.week * 7), 'd MMM yyyy') : '–'}
                          </td>
                          <td className="py-2 pr-3 font-medium tabular-nums whitespace-nowrap">
                            {showW(p.kg)}
                          </td>
                          <td className="py-2 tabular-nums whitespace-nowrap text-muted-foreground">
                            {p.week === 0 ? '–' : `${p.kg < kg ? '−' : '+'}${showW(Math.abs(p.kg - kg))}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ToolPanel>
            ) : null}

            <FormulaBlock
              lines={[
                {
                  label: 'BMR (Mifflin-St Jeor)',
                  expr:
                    sex === 'male'
                      ? `(10 × ${fmt(kg, 1)}) + (6.25 × ${fmt(cm, 1)}) − (5 × ${age}) + 5`
                      : `(10 × ${fmt(kg, 1)}) + (6.25 × ${fmt(cm, 1)}) − (5 × ${age}) − 161`,
                  result: `${Math.round(bmr)} kcal`,
                },
                {
                  label: 'Maintenance',
                  expr: `${Math.round(bmr)} × ${level.multiplier}`,
                  result: `${Math.round(tdee)} kcal/day`,
                },
                ...(direction === 'maintain'
                  ? []
                  : [
                      {
                        label: 'Daily adjustment',
                        expr: `${fmt(rate, 2)} kg/week × ${KCAL_PER_KG_FAT.toLocaleString('en-US')} kcal ÷ 7 days`,
                        result: `${Math.round(Math.abs(dailyDelta))} kcal/day`,
                      },
                      {
                        label: 'Target',
                        expr: `${Math.round(tdee)} ${direction === 'lose' ? '−' : '+'} ${Math.round(Math.abs(dailyDelta))}`,
                        result: `${Math.round(rawTarget)} kcal/day`,
                      },
                    ]),
              ]}
              note="One kilogram of body fat stores about 7,700 kcal (3,500 kcal per pound). The timeline above re-runs the maintenance calculation at each new weight instead of assuming a straight line."
            />

            <Interpretation>
              <p>
                {direction === 'maintain' ? (
                  <>
                    <strong>Your goal weight matches your current weight</strong>, so the target is
                    maintenance: {kcal(tdee)} a day.
                  </>
                ) : (
                  <>
                    <strong>
                      Eating {kcal(target)} a day puts you in a{' '}
                      {Math.abs(Math.round(target - tdee))} kcal daily{' '}
                      {direction === 'lose' ? 'deficit' : 'surplus'}.
                    </strong>{' '}
                    That is {showRate}, or about {fmt(pctPerWeek, 2)} percent of your body weight
                    each week.
                  </>
                )}
              </p>
              <p>
                Weight moves on a weekly average, not day to day. A single salty meal, a hard leg
                session or a missed bathroom visit can swing the scale by a kilogram of water. Weigh
                yourself at the same time each morning and only compare seven-day averages.
              </p>
              <p>
                Recalculate whenever you have lost or gained about 5 percent of your body weight.
                By then your maintenance has moved and the old target is no longer the
                same deficit.
              </p>
            </Interpretation>
          </>
        ) : (
          <EmptyState message="Fill in your details and a goal weight to get a daily calorie target and a projected timeline." />
        )
      }
    />
  )
}
