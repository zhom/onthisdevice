import { useMemo, useState } from 'react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  ACTIVITY_LEVELS,
  CalcLayout,
  EmptyState,
  EstimateNote,
  FormulaBlock,
  HeightField,
  Interpretation,
  NumberField,
  SexToggle,
  StatGrid,
  UnitToggle,
  WeightField,
  fmt,
  harrisBenedict,
  katchMcArdle,
  kcal,
  mifflinStJeor,
  useUnitSystem,
  type Sex,
} from './common'

interface Estimate {
  id: string
  name: string
  year: string
  value: number
  expr: string
  blurb: string
}

export default function BmrCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [sex, setSex] = useState<Sex>('male')
  const [cm, setCm] = useState(178)
  const [kg, setKg] = useState(78)
  const [age, setAge] = useState(30)
  const [useBodyFat, setUseBodyFat] = useState(false)
  const [bodyFat, setBodyFat] = useState(18)

  const valid = cm >= 90 && cm <= 260 && kg > 0 && age >= 15 && age <= 100
  const bfValid = useBodyFat && bodyFat >= 3 && bodyFat <= 65

  const estimates = useMemo<Estimate[]>(() => {
    if (!valid) return []
    const msj = mifflinStJeor(sex, kg, cm, age)
    const hb = harrisBenedict(sex, kg, cm, age)
    const list: Estimate[] = [
      {
        id: 'msj',
        name: 'Mifflin-St Jeor',
        year: '1990',
        value: msj,
        expr:
          sex === 'male'
            ? `(10 × ${fmt(kg, 1)}) + (6.25 × ${fmt(cm, 1)}) − (5 × ${age}) + 5`
            : `(10 × ${fmt(kg, 1)}) + (6.25 × ${fmt(cm, 1)}) − (5 × ${age}) − 161`,
        blurb:
          'The current default in dietetics. Validated on a modern population and usually the closest of the three for people of average body composition.',
      },
      {
        id: 'hb',
        name: 'Harris-Benedict',
        year: 'revised 1984',
        value: hb,
        expr:
          sex === 'male'
            ? `88.362 + (13.397 × ${fmt(kg, 1)}) + (4.799 × ${fmt(cm, 1)}) − (5.677 × ${age})`
            : `447.593 + (9.247 × ${fmt(kg, 1)}) + (3.098 × ${fmt(cm, 1)}) − (4.330 × ${age})`,
        blurb:
          'The classic equation, re-fitted by Roza and Shizgal in 1984. Tends to read a few percent high for sedentary adults because the 1919 sample was leaner and more active.',
      },
    ]
    if (bfValid) {
      const lean = kg * (1 - bodyFat / 100)
      list.push({
        id: 'km',
        name: 'Katch-McArdle',
        year: '1996',
        value: katchMcArdle(kg, bodyFat),
        expr: `370 + (21.6 × ${fmt(lean, 1)} kg lean mass)`,
        blurb:
          'Works from lean body mass instead of total weight, so it does not penalise a muscular build or over-predict at high body fat. The best choice when you have a real body-fat number.',
      })
    }
    return list
  }, [valid, bfValid, sex, kg, cm, age, bodyFat])

  const mean = estimates.length
    ? estimates.reduce((s, e) => s + e.value, 0) / estimates.length
    : NaN
  const spread = estimates.length
    ? Math.max(...estimates.map((e) => e.value)) - Math.min(...estimates.map((e) => e.value))
    : 0
  const best = estimates.find((e) => e.id === 'km') ?? estimates.find((e) => e.id === 'msj')
  const maxVal = estimates.length ? Math.max(...estimates.map((e) => e.value)) : 1

  const summary = estimates.length
    ? [
        'BMR estimates',
        ...estimates.map((e) => `${e.name} (${e.year}): ${Math.round(e.value)} kcal/day`),
        `Average: ${Math.round(mean)} kcal/day`,
        '',
        'Maintenance calories by activity level (using ' + (best?.name ?? '') + '):',
        ...ACTIVITY_LEVELS.map(
          (a) => `  ${a.label} (×${a.multiplier}): ${Math.round((best?.value ?? 0) * a.multiplier)} kcal/day`,
        ),
        '',
        'Calculated at onthisdevice.com/bmr-calculator',
      ].join('\n')
    : ''

  return (
    <CalcLayout
      inputs={
        <ToolPanel title="About you" description="Results recalculate on every keystroke.">
          <div className="space-y-4">
            <UnitToggle units={units} onChange={setUnits} className="max-w-none" />
            <SexToggle sex={sex} onChange={setSex} />
            <HeightField id="bmr-height" cm={cm} onChange={setCm} units={units} />
            <WeightField id="bmr-weight" kg={kg} onChange={setKg} units={units} />
            <NumberField
              id="bmr-age"
              label="Age"
              value={age}
              onChange={setAge}
              unit="years"
              min={15}
              max={100}
              dp={0}
              hint="These equations are validated for adults aged roughly 18 to 80."
            />

            <div className="rounded-lg bg-muted p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="bmr-bf-toggle" className="cursor-pointer">
                  I know my body fat %
                </Label>
                <Switch id="bmr-bf-toggle" checked={useBodyFat} onCheckedChange={setUseBodyFat} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Unlocks the Katch-McArdle equation, which uses lean mass instead of total weight.
              </p>
              {useBodyFat ? (
                <div className="mt-3">
                  <NumberField
                    id="bmr-bf"
                    label="Body fat percentage"
                    value={bodyFat}
                    onChange={setBodyFat}
                    unit="%"
                    min={3}
                    max={65}
                    step={0.5}
                    hint={
                      bodyFat > 0 && !bfValid
                        ? 'Enter a value between 3% and 65%.'
                        : 'Not sure? Estimate it with the body fat calculator first.'
                    }
                  />
                </div>
              ) : null}
            </div>

            <EstimateNote>
              Predictive equations land within about 10 percent of a measured BMR for most people,
              but individual metabolic rate varies by roughly ±200 kcal at the same height, weight
              and age. Use the number as a starting point, not a verdict.
            </EstimateNote>
          </div>
        </ToolPanel>
      }
      results={
        estimates.length ? (
          <>
            <ToolPanel
              title="Basal metabolic rate"
              description="Calories your body burns over 24 hours at complete rest."
              footer={<CopyButton value={summary} label="Copy all results" />}
            >
              <div className="space-y-5">
                <StatGrid cols={2}>
                  <ResultStat
                    label={best ? `${best.name} estimate` : 'BMR'}
                    value={kcal(best?.value ?? NaN)}
                    hint="per day, recommended figure"
                    emphasis
                  />
                  <ResultStat
                    label="Average of all equations"
                    value={kcal(mean)}
                    hint={`spread between highest and lowest: ${Math.round(spread)} kcal`}
                  />
                </StatGrid>

                <div className="space-y-3">
                  {estimates.map((e) => (
                    <div key={e.id} className="rounded-lg bg-muted p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-sm font-semibold">
                          {e.name}{' '}
                          <span className="font-normal text-muted-foreground">({e.year})</span>
                        </h3>
                        <span className="text-base font-semibold tabular-nums">
                          {kcal(e.value)}
                        </span>
                      </div>
                      <div
                        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
                        role="presentation"
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(4, (e.value / maxVal) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{e.blurb}</p>
                    </div>
                  ))}
                </div>
              </div>
            </ToolPanel>

            <FormulaBlock
              lines={estimates.map((e) => ({
                label: e.name,
                expr: e.expr,
                result: `${Math.round(e.value)} kcal/day`,
              }))}
              note={
                bfValid
                  ? 'Lean body mass = weight × (1 − body fat %). Katch-McArdle is the only one of the three that reacts to body composition.'
                  : 'Add a body fat percentage to unlock Katch-McArdle, which is usually the most accurate equation for lean or very muscular people.'
              }
            />

            <ToolPanel
              title="What that becomes over a real day"
              description={`BMR × activity multiplier, using the ${best?.name ?? ''} figure.`}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[26rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Activity level
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        ×
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Calories / day
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ACTIVITY_LEVELS.map((a) => (
                      <tr key={a.id} className="border-b border-border last:border-0 align-top">
                        <th scope="row" className="py-2 pr-3 text-left font-normal">
                          <span className="font-medium">{a.label}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {a.description}
                          </span>
                        </th>
                        <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                          {a.multiplier}
                        </td>
                        <td className="py-2 font-semibold tabular-nums whitespace-nowrap">
                          {Math.round((best?.value ?? 0) * a.multiplier).toLocaleString('en-US')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ToolPanel>

            <Interpretation>
              <p>
                <strong>
                  Your body burns roughly {kcal(best?.value ?? NaN)} a day doing nothing at all.
                </strong>{' '}
                That covers breathing, circulation, brain activity, kidney and liver function and
                keeping your temperature steady: about 60 to 70 percent of most people&rsquo;s
                total daily burn.
              </p>
              <p>
                The three equations differ by {Math.round(spread)} kcal here, which is normal. They
                were fitted to different populations decades apart, and none of them can see your
                thyroid function, your muscle mass or how much you fidget. Pick one, stick with it,
                and let two weeks of real weight data tell you whether it was right.
              </p>
              <p>
                BMR is never a calorie target. Even a completely sedentary day costs about 20 percent
                more than BMR once you add digestion and moving around.
              </p>
            </Interpretation>
          </>
        ) : (
          <EmptyState message="Fill in sex, height, weight and age to compare the three BMR equations side by side." />
        )
      }
    />
  )
}
