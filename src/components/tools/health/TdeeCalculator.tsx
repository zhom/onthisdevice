import { useMemo, useState } from 'react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import {
  ACTIVITY_LEVELS,
  CalcLayout,
  EmptyState,
  EstimateNote,
  FormulaBlock,
  HeightField,
  Interpretation,
  KCAL_PER_KG_FAT,
  NumberField,
  SexToggle,
  StatGrid,
  UnitToggle,
  WeightField,
  activityById,
  fmt,
  katchMcArdle,
  kcal,
  kgToLb,
  mifflinStJeor,
  useUnitSystem,
  type Sex,
} from './common'

interface Goal {
  id: string
  label: string
  pct: number
  blurb: string
}

const GOALS: Goal[] = [
  {
    id: 'aggressive-cut',
    label: 'Aggressive cut',
    pct: -0.25,
    blurb: 'Fast loss. Hard to sustain past 8–12 weeks and costs more lean mass.',
  },
  {
    id: 'cut',
    label: 'Standard cut',
    pct: -0.2,
    blurb: 'The usual recommendation: noticeable progress, still liveable.',
  },
  {
    id: 'mild-cut',
    label: 'Mild cut',
    pct: -0.1,
    blurb: 'Slow, low-friction loss. Good alongside heavy training.',
  },
  {
    id: 'maintain',
    label: 'Maintain',
    pct: 0,
    blurb: 'Hold current weight while you recomposition or take a diet break.',
  },
  {
    id: 'lean-bulk',
    label: 'Lean bulk',
    pct: 0.1,
    blurb: 'Enough surplus to build muscle without much fat gain.',
  },
  {
    id: 'bulk',
    label: 'Bulk',
    pct: 0.2,
    blurb: 'Fast gain for hard gainers; expect a meaningful share as fat.',
  },
]

export default function TdeeCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [sex, setSex] = useState<Sex>('male')
  const [cm, setCm] = useState(178)
  const [kg, setKg] = useState(78)
  const [age, setAge] = useState(30)
  const [activity, setActivity] = useState('moderate')
  const [useBodyFat, setUseBodyFat] = useState(false)
  const [bodyFat, setBodyFat] = useState(18)

  const valid = cm >= 90 && cm <= 260 && kg > 0 && age >= 15 && age <= 100
  const bfValid = useBodyFat && bodyFat >= 3 && bodyFat <= 65
  const level = activityById(activity)

  const bmr = useMemo(() => {
    if (!valid) return NaN
    return bfValid ? katchMcArdle(kg, bodyFat) : mifflinStJeor(sex, kg, cm, age)
  }, [valid, bfValid, kg, bodyFat, sex, cm, age])

  const tdee = bmr * level.multiplier
  const metric = units === 'metric'
  const weeklyChange = (dailyDelta: number) => {
    const kgPerWeek = (dailyDelta * 7) / KCAL_PER_KG_FAT
    return metric ? `${fmt(kgPerWeek, 2)} kg/wk` : `${fmt(kgToLb(kgPerWeek), 2)} lb/wk`
  }

  const summary = valid
    ? [
        `BMR (${bfValid ? 'Katch-McArdle' : 'Mifflin-St Jeor'}): ${Math.round(bmr)} kcal/day`,
        `Activity: ${level.label} (×${level.multiplier})`,
        `TDEE / maintenance: ${Math.round(tdee)} kcal/day`,
        '',
        ...GOALS.map(
          (g) =>
            `${g.label} (${g.pct === 0 ? '±0%' : `${g.pct > 0 ? '+' : ''}${Math.round(g.pct * 100)}%`}): ${Math.round(tdee * (1 + g.pct))} kcal/day`,
        ),
        '',
        'Calculated at onthisdevice.com/tdee-calculator',
      ].join('\n')
    : ''

  const restShare = valid ? (bmr / tdee) * 100 : 0

  return (
    <CalcLayout
      inputs={
        <ToolPanel title="About you" description="Results update as you type.">
          <div className="space-y-4">
            <UnitToggle units={units} onChange={setUnits} className="max-w-none" />
            <SexToggle sex={sex} onChange={setSex} />
            <HeightField id="tdee-height" cm={cm} onChange={setCm} units={units} />
            <WeightField id="tdee-weight" kg={kg} onChange={setKg} units={units} />
            <NumberField
              id="tdee-age"
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
                    className="flex items-start gap-3 rounded-lg p-3 has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-foreground"
                  >
                    <RadioGroupItem value={a.id} id={`tdee-act-${a.id}`} className="mt-1" />
                    <Label htmlFor={`tdee-act-${a.id}`} className="cursor-pointer font-normal">
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
              <p className="text-xs text-muted-foreground">
                Most people pick one level too high. One to three short gym sessions a week on top of
                a desk job is &ldquo;lightly active&rdquo;.
              </p>
            </fieldset>

            <div className="rounded-lg bg-muted p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="tdee-bf-toggle" className="cursor-pointer">
                  Use body fat % (Katch-McArdle)
                </Label>
                <Switch id="tdee-bf-toggle" checked={useBodyFat} onCheckedChange={setUseBodyFat} />
              </div>
              {useBodyFat ? (
                <div className="mt-3">
                  <NumberField
                    id="tdee-bf"
                    label="Body fat percentage"
                    value={bodyFat}
                    onChange={setBodyFat}
                    unit="%"
                    min={3}
                    max={65}
                    step={0.5}
                    hint={bodyFat > 0 && !bfValid ? 'Enter a value between 3% and 65%.' : undefined}
                  />
                </div>
              ) : null}
            </div>

            <EstimateNote>
              Activity multipliers are broad averages. Expect your true maintenance to sit within
              about 10 to 15 percent of this figure. Two weeks of daily weigh-ins will pin it down
              far better than any equation.
            </EstimateNote>
          </div>
        </ToolPanel>
      }
      results={
        valid ? (
          <>
            <ToolPanel
              title="Total daily energy expenditure"
              footer={<CopyButton value={summary} label="Copy all targets" />}
            >
              <StatGrid cols={3}>
                <ResultStat
                  label="Maintenance (TDEE)"
                  value={kcal(tdee)}
                  hint="eat this to stay the same weight"
                  emphasis
                />
                <ResultStat
                  label="BMR"
                  value={kcal(bmr)}
                  hint={bfValid ? 'Katch-McArdle, from lean mass' : 'Mifflin-St Jeor'}
                />
                <ResultStat
                  label="Activity multiplier"
                  value={`×${level.multiplier}`}
                  hint={level.label}
                />
              </StatGrid>

              <div className="mt-5">
                <h3 className="text-sm font-semibold">Where the calories go</h3>
                <div
                  className="mt-2 flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
                  role="img"
                  aria-label={`About ${Math.round(restShare)} percent of your daily burn is basal metabolism and ${Math.round(100 - restShare)} percent is activity and digestion.`}
                >
                  <div className="bg-primary" style={{ width: `${restShare}%` }} />
                  <div className="bg-chart-3" style={{ width: `${100 - restShare}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
                    Basal metabolism {Math.round(restShare)}% · {kcal(bmr)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2 rounded-full bg-chart-3" />
                    Movement + digestion {Math.round(100 - restShare)}% · {kcal(tdee - bmr)}
                  </span>
                </div>
              </div>
            </ToolPanel>

            <ToolPanel
              title="Calorie targets by goal"
              description="Percentages of maintenance, with the weight change each implies."
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Goal
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Change
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Calories / day
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Expected rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {GOALS.map((g) => {
                      const target = tdee * (1 + g.pct)
                      const delta = target - tdee
                      return (
                        <tr
                          key={g.id}
                          className="border-b border-border align-top last:border-0"
                        >
                          <th scope="row" className="py-2 pr-3 text-left font-normal">
                            <span className="flex items-center gap-2 font-medium">
                              {g.label}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {g.blurb}
                            </span>
                          </th>
                          <td className="py-2 pr-3 tabular-nums whitespace-nowrap text-muted-foreground">
                            {g.pct === 0
                              ? '±0%'
                              : `${g.pct > 0 ? '+' : ''}${Math.round(g.pct * 100)}%`}
                          </td>
                          <td className="py-2 pr-3 font-semibold tabular-nums whitespace-nowrap">
                            {Math.round(target).toLocaleString('en-US')}
                          </td>
                          <td className="py-2 tabular-nums whitespace-nowrap text-muted-foreground">
                            {delta === 0 ? 'no change' : weeklyChange(delta)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </ToolPanel>

            <FormulaBlock
              lines={[
                {
                  label: bfValid ? 'BMR (Katch-McArdle)' : 'BMR (Mifflin-St Jeor)',
                  expr: bfValid
                    ? `370 + 21.6 × ${fmt(kg * (1 - bodyFat / 100), 1)} kg lean mass`
                    : sex === 'male'
                      ? `(10 × ${fmt(kg, 1)}) + (6.25 × ${fmt(cm, 1)}) − (5 × ${age}) + 5`
                      : `(10 × ${fmt(kg, 1)}) + (6.25 × ${fmt(cm, 1)}) − (5 × ${age}) − 161`,
                  result: `${Math.round(bmr)} kcal`,
                },
                {
                  label: 'TDEE',
                  expr: `${Math.round(bmr)} × ${level.multiplier} (${level.label.toLowerCase()})`,
                  result: `${Math.round(tdee)} kcal/day`,
                },
                {
                  label: 'Rate of change',
                  expr: `(daily surplus or deficit × 7) ÷ ${KCAL_PER_KG_FAT.toLocaleString('en-US')} kcal per kg of fat`,
                },
              ]}
              note="The activity multiplier already includes your workouts. Do not add a fitness-tracker exercise burn on top."
            />

            <Interpretation>
              <p>
                <strong>Eat about {kcal(tdee)} a day and your weight should hold steady.</strong>{' '}
                That figure is your basal rate of {kcal(bmr)} multiplied by {level.multiplier} for a{' '}
                {level.label.toLowerCase()} lifestyle.
              </p>
              <p>
                For fat loss, a 20 percent cut ({kcal(tdee * 0.8)}) is the sweet spot for most
                people: fast enough to see progress in a fortnight, slow enough that training
                quality and mood survive. For muscle gain, a 10 percent surplus is plenty; anything
                bigger mostly adds fat, because muscle can only be built so fast.
              </p>
              <p>
                Track it honestly for two weeks and weigh yourself every morning. If your seven-day
                average is flat, this number was right. If it moved, adjust by 100 to 150 kcal and
                repeat. That measured figure beats every equation on this page.
              </p>
            </Interpretation>
          </>
        ) : (
          <EmptyState message="Enter your details on the left to see maintenance calories plus cut, maintain and bulk targets." />
        )
      }
    />
  )
}
