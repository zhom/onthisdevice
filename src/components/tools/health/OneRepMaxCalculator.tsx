import { useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import {
  CalcLayout,
  EmptyState,
  EstimateNote,
  FormulaBlock,
  Interpretation,
  NumberField,
  Segmented,
  StatGrid,
  UnitToggle,
  fmt,
  kgToLb,
  lbToKg,
  useUnitSystem,
} from './common'

interface Model {
  id: string
  name: string
  fn: (w: number, r: number) => number
  formula: string
  blurb: string
}

const MODELS: Model[] = [
  {
    id: 'epley',
    name: 'Epley',
    fn: (w, r) => w * (1 + r / 30),
    formula: 'w × (1 + reps ÷ 30)',
    blurb: 'The most widely used. Gives the same result as Brzycki at 10 reps.',
  },
  {
    id: 'brzycki',
    name: 'Brzycki',
    fn: (w, r) => (r < 37 ? (w * 36) / (37 - r) : NaN),
    formula: 'w × 36 ÷ (37 − reps)',
    blurb: 'A little lower than Epley below 10 reps and higher above; the basis of most percentage charts.',
  },
  {
    id: 'lombardi',
    name: 'Lombardi',
    fn: (w, r) => w * Math.pow(r, 0.1),
    formula: 'w × reps^0.10',
    blurb: 'A power curve rather than a straight line; the flattest of the four.',
  },
  {
    id: 'oconner',
    name: "O'Conner",
    fn: (w, r) => w * (1 + 0.025 * r),
    formula: 'w × (1 + 0.025 × reps)',
    blurb: 'A simple 2.5% per rep rule. Very close to Epley at low reps.',
  },
]

const PERCENTS = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50]

/** Brzycki inverted: reps ≈ 37 − 36 × (fraction of 1RM). */
function repsAt(pct: number): number {
  return Math.max(1, Math.round(37 - 36 * pct))
}

const PURPOSE: Record<number, string> = {
  100: 'Max single (testing only)',
  95: 'Heavy singles and doubles',
  90: 'Strength triples',
  85: 'Classic 5×5 / strength work',
  80: 'Strength–hypertrophy overlap',
  75: 'Hypertrophy, sets of 8–10',
  70: 'Volume work, sets of 10–12',
  65: 'Technique and back-off sets',
  60: 'Speed work and warm-ups',
  55: 'Deload / bar speed',
  50: 'Warm-up and rehab loading',
}

export default function OneRepMaxCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [displayWeight, setDisplayWeight] = useState(100)
  const [reps, setReps] = useState(5)
  const [rounding, setRounding] = useState('2.5')

  const metric = units === 'metric'
  const unitLabel = metric ? 'kg' : 'lb'
  const shownWeight = displayWeight

  const valid = displayWeight > 0 && reps >= 1 && reps <= 20
  const tooManyReps = reps > 12

  const estimates = useMemo(() => {
    if (!valid) return []
    return MODELS.map((m) => ({
      ...m,
      value: reps === 1 ? shownWeight : m.fn(shownWeight, reps),
    })).filter((e) => Number.isFinite(e.value))
  }, [valid, shownWeight, reps])

  const average = estimates.length
    ? estimates.reduce((s, e) => s + e.value, 0) / estimates.length
    : NaN
  const lo = estimates.length ? Math.min(...estimates.map((e) => e.value)) : NaN
  const hi = estimates.length ? Math.max(...estimates.map((e) => e.value)) : NaN

  // A rounding step must be one of the steps offered for the current units.
  const steps = metric ? ['1', '2.5', '5'] : ['2.5', '5', '10']
  const increment = Number(steps.includes(rounding) ? rounding : '2.5')
  const roundTo = (v: number) => (increment > 0 ? Math.round(v / increment) * increment : v)

  const show = (v: number) => `${fmt(v, increment >= 1 ? 1 : 2)} ${unitLabel}`
  const alt = (v: number) =>
    metric ? `${fmt(kgToLb(v), 0)} lb` : `${fmt(lbToKg(v), 1)} kg`

  const repMaxes = useMemo(() => {
    if (!Number.isFinite(average)) return []
    return Array.from({ length: 12 }, (_, i) => {
      const r = i + 1
      // Brzycki solved for the weight that yields this 1RM at r reps.
      const w = (average * (37 - r)) / 36
      return { reps: r, weight: w }
    })
  }, [average])

  const summary = estimates.length
    ? [
        `Set entered: ${fmt(shownWeight, 1)} ${unitLabel} × ${reps} reps`,
        '',
        ...estimates.map((e) => `${e.name}: ${fmt(e.value, 1)} ${unitLabel}`),
        `Average 1RM: ${fmt(average, 1)} ${unitLabel} (${fmt(metric ? kgToLb(average) : lbToKg(average), 1)} ${metric ? 'lb' : 'kg'})`,
        '',
        `Training percentages (rounded to ${increment} ${unitLabel}):`,
        ...PERCENTS.map(
          (p) => `  ${p}%: ${fmt(roundTo((average * p) / 100), 1)} ${unitLabel}, about ${repsAt(p / 100)} reps`,
        ),
        '',
        'Calculated at onthisdevice.com/one-rep-max-calculator',
      ].join('\n')
    : ''

  return (
    <CalcLayout
      inputs={
        <ToolPanel title="The set you lifted">
          <div className="space-y-4">
            <UnitToggle units={units} onChange={setUnits} className="max-w-none" />
            <NumberField
              id="orm-weight"
              label="Weight lifted"
              value={displayWeight}
              onChange={setDisplayWeight}
              unit={unitLabel}
              min={0}
              max={metric ? 600 : 1400}
              step={metric ? 2.5 : 5}
              hint={
                displayWeight > 0
                  ? `${fmt(metric ? kgToLb(displayWeight) : lbToKg(displayWeight), 1)} ${metric ? 'lb' : 'kg'}, bar plus plates.`
                  : 'Include the bar.'
              }
            />
            <NumberField
              id="orm-reps"
              label="Reps completed"
              value={reps}
              onChange={setReps}
              unit="reps"
              min={1}
              max={20}
              step={1}
              dp={0}
              hint="Count only clean reps taken close to failure. Two to five is the most accurate range."
            />
            {tooManyReps ? (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  Above about 12 reps these formulas drift high, because endurance and technique start
                  to matter more than maximal strength. Treat the number as a ceiling, not a target.
                </span>
              </p>
            ) : null}
            {reps === 1 ? (
              <p className="text-xs text-muted-foreground">
                A single rep <em>is</em> your one rep max, so every model returns the weight you
                entered.
              </p>
            ) : null}

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Round percentages to</span>
              <Segmented
                label="Rounding increment"
                value={steps.includes(rounding) ? rounding : '2.5'}
                onChange={setRounding}
                options={
                  metric
                    ? [
                        { value: '1', label: '1 kg' },
                        { value: '2.5', label: '2.5 kg' },
                        { value: '5', label: '5 kg' },
                      ]
                    : [
                        { value: '2.5', label: '2.5 lb' },
                        { value: '5', label: '5 lb' },
                        { value: '10', label: '10 lb' },
                      ]
                }
              />
              <p className="text-xs text-muted-foreground">
                Match this to the smallest plate pair you have, so the numbers are actually loadable.
              </p>
            </div>

            <EstimateNote>
              Estimated maxes are for programming, not for bragging. Warm up properly, use a spotter
              or safety pins for anything heavy, and stop a set the moment form breaks down.
            </EstimateNote>
          </div>
        </ToolPanel>
      }
      results={
        estimates.length ? (
          <>
            <ToolPanel
              title="Estimated one rep max"
              footer={<CopyButton value={summary} label="Copy 1RM and percentages" />}
            >
              <div className="space-y-5">
                <StatGrid cols={3}>
                  <ResultStat
                    label="Average 1RM"
                    value={show(average)}
                    hint={`${alt(average)} · from ${fmt(shownWeight, 1)} ${unitLabel} × ${reps}`}
                    emphasis
                  />
                  <ResultStat
                    label="Range across formulas"
                    value={`${show(lo)} – ${show(hi)}`}
                    hint={`spread of ${fmt(hi - lo, 1)} ${unitLabel}`}
                  />
                  <ResultStat
                    label="Rounded for loading"
                    value={show(roundTo(average))}
                    hint={`to the nearest ${increment} ${unitLabel}`}
                  />
                </StatGrid>

                <div className="space-y-3">
                  {estimates.map((e) => (
                    <div key={e.id} className="rounded-lg bg-muted p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold">{e.name}</span>
                        <span className="text-base font-semibold tabular-nums">{show(e.value)}</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(e.value / hi) * 100}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        <span className="font-mono">{e.formula}</span>: {e.blurb}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </ToolPanel>

            <ToolPanel
              title="Training percentages"
              description={`Percentages of your ${show(roundTo(average))} estimated max, rounded to ${increment} ${unitLabel}.`}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        % of 1RM
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Weight
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Approx. reps
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Typical use
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERCENTS.map((p) => (
                      <tr key={p} className="border-b border-border last:border-0">
                        <th scope="row" className="py-2 pr-3 text-left font-medium tabular-nums">
                          {p}%
                        </th>
                        <td className="py-2 pr-3 font-semibold tabular-nums whitespace-nowrap">
                          {fmt(roundTo((average * p) / 100), 1)} {unitLabel}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{repsAt(p / 100)}</td>
                        <td className="py-2 text-muted-foreground">{PURPOSE[p]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ToolPanel>

            <ToolPanel
              title="Estimated rep maxes"
              description="The heaviest weight you should be able to hit for each rep count."
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[26rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Reps
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Weight
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        % of 1RM
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {repMaxes.map((r) => (
                      <tr
                        key={r.reps}
                        className={`border-b border-border last:border-0 ${r.reps === reps ? 'bg-background font-semibold' : ''}`}
                      >
                        <th scope="row" className="py-2 pr-3 text-left font-medium tabular-nums">
                          {r.reps} RM
                          {r.reps === reps ? (
                            <span className="ml-2 text-xs font-medium text-muted-foreground">
                              your set
                            </span>
                          ) : null}
                        </th>
                        <td className="py-2 pr-3 tabular-nums whitespace-nowrap">
                          {fmt(roundTo(r.weight), 1)} {unitLabel}
                        </td>
                        <td className="py-2 tabular-nums text-muted-foreground">
                          {fmt((r.weight / average) * 100, 0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ToolPanel>

            <FormulaBlock
              lines={[
                ...estimates.map((e) => ({
                  label: e.name,
                  expr:
                    reps === 1
                      ? `${fmt(shownWeight, 1)} ${unitLabel} at 1 rep is already a 1RM`
                      : e.id === 'epley'
                        ? `${fmt(shownWeight, 1)} × (1 + ${reps} ÷ 30)`
                        : e.id === 'brzycki'
                          ? `${fmt(shownWeight, 1)} × 36 ÷ (37 − ${reps})`
                          : e.id === 'lombardi'
                            ? `${fmt(shownWeight, 1)} × ${reps}^0.10`
                            : `${fmt(shownWeight, 1)} × (1 + 0.025 × ${reps})`,
                  result: `${fmt(e.value, 1)} ${unitLabel}`,
                })),
                {
                  label: 'Average',
                  expr: `(${estimates.map((e) => fmt(e.value, 1)).join(' + ')}) ÷ ${estimates.length}`,
                  result: `${fmt(average, 1)} ${unitLabel}`,
                },
                {
                  label: 'Reps at a %',
                  expr: 'reps ≈ 37 − 36 × (% of 1RM), the Brzycki equation rearranged',
                },
              ]}
              note="All four models are curve fits to real lifting data, not physics. They agree closely at low reps and diverge as reps climb, which is why the average is the safer number to programme from."
            />

            <Interpretation>
              <p>
                <strong>
                  {fmt(shownWeight, 1)} {unitLabel} for {reps} reps points to a one rep max of about{' '}
                  {show(roundTo(average))}.
                </strong>{' '}
                The four formulas span {show(lo)} to {show(hi)}, a spread of{' '}
                {fmt(hi - lo, 1)} {unitLabel}, which is the honest margin of error.
              </p>
              <p>
                For programming, most strength work lives between 75 and 90 percent of that number:{' '}
                {fmt(roundTo(average * 0.75), 1)} to {fmt(roundTo(average * 0.9), 1)} {unitLabel} for
                you. Hypertrophy work sits lower, around 65 to 80 percent, with more reps per set.
              </p>
              <p>
                Re-estimate every four to six weeks from a hard set of three to five rather than
                testing a true single. You get the same information for a fraction of the fatigue and
                risk.
              </p>
            </Interpretation>
          </>
        ) : (
          <EmptyState message="Enter the weight you lifted and how many reps you completed to estimate your one rep max." />
        )
      }
    />
  )
}
