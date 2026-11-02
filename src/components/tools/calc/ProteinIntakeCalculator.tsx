import { useState } from 'react'
import { BarList, Gauge } from '@/components/viz'
import { KG_PER_LB, NumberField, UnitToggle, WeightField, useUnitSystem } from '@/components/tools/health/common'
import { PROTEIN_GOALS } from './body-math'
import type { ProteinGoal } from './body-math'
import { Assumptions, CalcGrid, Formula, Headline, ResultPanel, SelectField, Stats, num, numUpTo } from './mb-ui'

const SCALE_MIN = 0.6
const SCALE_MAX = 2.6
const BANDS = [
  { to: 0.8, label: 'Below the RDA' },
  { to: 1.2, label: 'Sedentary and older adults' },
  { to: 1.6, label: 'Regular exercise' },
  { to: 2.4, label: 'Build muscle or lose fat' },
  { to: SCALE_MAX, label: 'Above the usual ranges' },
]

const LOWEST = Math.min(...PROTEIN_GOALS.map((g) => g.min))
const HIGHEST = Math.max(...PROTEIN_GOALS.map((g) => g.max))

const grams = (n: number) => `${num(n, 0)} g`
const isGoal = (v: string): v is ProteinGoal => PROTEIN_GOALS.some((g) => g.id === v)
const span = (lo: number, hi: number, f: (n: number) => string) => (f(lo) === f(hi) ? f(lo) : `${f(lo)}–${f(hi)}`)

export default function ProteinIntakeCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [kg, setKg] = useState(75)
  const [goalId, setGoalId] = useState<ProteinGoal>('active')
  const [meals, setMeals] = useState(3)

  const metric = units === 'metric'
  const goal = PROTEIN_GOALS.find((g) => g.id === goalId) ?? PROTEIN_GOALS[0]
  const perKg = (goal.min + goal.max) / 2
  const ok = kg >= 20 && kg <= 350
  const mealCount = Math.max(1, Math.round(meals) || 1)
  const low = goal.min * kg
  const high = goal.max * kg
  const mid = ok ? perKg * kg : NaN
  const single = goal.min === goal.max
  const perLb = (g: number) => num(g * KG_PER_LB, 2)
  const weightText = metric ? `${num(kg, 1)} kg` : `${num(kg / KG_PER_LB, 1)} lb`
  const rangeText = span(low, high, (n) => num(n, 0))

  return (
    <CalcGrid
      inputs={
        <>
          <UnitToggle units={units} onChange={setUnits} className="max-w-none" />
          <WeightField id="pi-weight" kg={kg} onChange={setKg} units={units} />
          <SelectField id="pi-goal" label="Goal" value={goalId} onChange={(v) => isGoal(v) && setGoalId(v)} options={PROTEIN_GOALS.map((g) => ({ value: g.id, label: g.label }))} />
          <NumberField id="pi-meals" label="Meals a day" value={meals} onChange={setMeals} min={1} max={8} dp={0} />
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Protein per day"
            value={mid}
            format={grams}
            hint={
              ok
                ? single
                  ? `${numUpTo(goal.min, 1)} g per kg of body weight, ${weightText}.`
                  : `The middle of ${rangeText} g, which is ${numUpTo(goal.min, 1)} to ${numUpTo(goal.max, 1)} g per kg of body weight.`
                : 'Enter a weight from 20 to 350 kg.'
            }
          />
          <Stats
            cols={2}
            items={[
              { label: 'Daily range', value: ok ? `${rangeText} g` : '–' },
              {
                label: metric ? 'Per kg of weight' : 'Per lb of weight',
                value: metric ? `${span(goal.min, goal.max, (n) => numUpTo(n, 1))} g` : `${span(goal.min, goal.max, perLb)} g`,
                hint: metric ? undefined : `${span(goal.min, goal.max, (n) => numUpTo(n, 1))} g per kg`,
              },
              {
                label: 'Per meal',
                value: ok ? grams(mid / mealCount) : '–',
                hint: ok ? `${span(low / mealCount, high / mealCount, (n) => num(n, 0))} g over ${mealCount} ${mealCount === 1 ? 'meal' : 'meals'}` : undefined,
              },
              { label: 'Energy from protein', value: ok ? `${num(mid * 4, 0)} kcal` : '–', hint: '4 kcal per gram' },
            ]}
          />
          {ok ? (
            <Gauge
              variant="bar"
              value={perKg}
              min={SCALE_MIN}
              max={SCALE_MAX}
              bands={BANDS}
              formatValue={(v) => numUpTo(v, 1)}
              ariaLabel={`Protein scale from ${numUpTo(SCALE_MIN, 1)} to ${numUpTo(SCALE_MAX, 1)} g per kg. Your target ${numUpTo(perKg, 1)} g per kg.`}
              center={
                <p className="text-sm text-muted-foreground">
                  Your target <span className="font-[650] text-foreground">{numUpTo(perKg, 1)} g per kg</span>
                </p>
              }
              summary={`Grams of protein per kg of body weight. ${goal.label}: ${span(goal.min, goal.max, (n) => numUpTo(n, 1))} g per kg; the marker is at ${numUpTo(perKg, 1)}.`}
            />
          ) : null}
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          {ok ? (
            <ResultPanel title="Each goal at your weight">
              <BarList
                items={PROTEIN_GOALS.map((g) => ({
                  label: g.label,
                  value: ((g.min + g.max) / 2) * kg,
                  note: `${span(g.min * kg, g.max * kg, (n) => num(n, 0))} g`,
                  highlight: g.id === goal.id,
                }))}
                formatValue={grams}
                columns={['Goal', 'Grams a day (middle)']}
                summary={`At ${weightText}, the goals run from ${grams(LOWEST * kg)} a day at the RDA to ${grams(HIGHEST * kg)} at the top of the fat loss range.`}
                table
              />
            </ResultPanel>
          ) : null}
          <Formula
            items={[
              {
                label: 'Protein per day',
                general: 'protein = weight × g per kg',
                steps: single
                  ? [`protein = ${num(kg, 1)} × ${numUpTo(goal.min, 1)}`]
                  : [
                      `low = ${num(kg, 1)} × ${numUpTo(goal.min, 1)} = ${num(low, 1)} g`,
                      `high = ${num(kg, 1)} × ${numUpTo(goal.max, 1)} = ${num(high, 1)} g`,
                      `middle = ${num(kg, 1)} × ${numUpTo(perKg, 2)}`,
                    ],
                result: `${num(mid, 1)} g`,
              },
              { label: 'Per meal', general: 'per meal = protein ÷ meals', steps: [`per meal = ${num(mid, 1)} ÷ ${mealCount}`], result: `${num(mid / mealCount, 1)} g` },
            ]}
            note="Weight is in kilograms. Pounds are converted first (1 lb = 0.4536 kg)."
          />
          <Assumptions
            title="Limits"
            items={[
              'The ranges are for healthy adults. Pregnancy, breastfeeding and kidney or liver disease change the need. Ask a doctor or dietitian.',
              'The grams are per kg of total body weight. With a high body fat percentage this overstates the need; use your goal weight instead.',
              'The figures are grams of protein, not grams of food. 100 g of cooked chicken breast has about 30 g of protein.',
            ]}
          />
        </div>
      }
    />
  )
}
