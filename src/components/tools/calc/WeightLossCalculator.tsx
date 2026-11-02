import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { LineChart } from '@/components/viz'
import { useToday } from '@/components/tools/finance/hooks'
import { CALORIE_FLOOR, HeightField, NumberField, SexToggle, UnitToggle, WeightField, kgToLb, useUnitSystem } from '@/components/tools/health/common'
import type { Sex } from '@/components/tools/health/common'
import { KCAL_PER_KG, addDays, mifflin, simulateLoss } from './body-math'
import { Assumptions, CalcGrid, Formula, Headline, Note, ResultPanel, SelectField, Stats, num, numUpTo } from './mb-ui'

const ACTIVITY = [
  { value: '1.2', label: 'Sedentary: little or no exercise' },
  { value: '1.375', label: 'Light: exercise 1 to 3 days a week' },
  { value: '1.55', label: 'Moderate: exercise 3 to 5 days a week' },
  { value: '1.725', label: 'Very active: hard exercise 6 to 7 days a week' },
  { value: '1.9', label: 'Extra active: physical job and daily training' },
]

const PACES = ['0.25', '0.5', '0.75', '1']

const kcal = (n: number) => `${num(n)} kcal`

export default function WeightLossCalculator() {
  const today = useToday()
  const [units, setUnits] = useUnitSystem()
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState(35)
  const [cm, setCm] = useState(175)
  const [kg, setKg] = useState(90)
  const [goal, setGoal] = useState(80)
  const [activity, setActivity] = useState('1.375')
  const [pace, setPace] = useState('0.5')

  const metric = units === 'metric'
  const disp = (v: number) => (metric ? v : kgToLb(v))
  const w = (v: number, dp = 1) => `${num(disp(v), dp)} ${metric ? 'kg' : 'lb'}`
  const paceText = (v: number) => (metric ? `${numUpTo(v, 2)} kg` : `${num(kgToLb(v), 1)} lb`)

  const c = useMemo(() => {
    const act = Number(activity)
    const perWeek = Number(pace)
    const ok = kg > 0 && cm > 0 && age > 0 && goal > 0
    if (!ok) return { ok: false as const }
    if (goal >= kg) return { ok: false as const, up: true }
    const sim = simulateLoss({ sex, kg, cm, age, activity: act, goalKg: goal, kgPerWeek: perWeek })
    const bmr = mifflin(sex, kg, cm, age)
    const tdeeAt = (x: number) => mifflin(sex, x, cm, age) * act
    const days = sim.reached ? sim.days.length - 1 : NaN
    const weeks = sim.reached ? Math.ceil(days / 7) : 156
    const x = Array.from({ length: weeks + 1 }, (_, i) => i)
    const curve = x.map((i) => sim.days[Math.min(i * 7, sim.days.length - 1)]!)
    const plan = x.map((i) => Math.max(goal, kg - perWeek * i))
    // With a fixed intake the weight levels off where TDEE equals the intake.
    const floorKg = (sim.intake / act - (6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161))) / 10
    return {
      ok: true as const,
      act,
      perWeek,
      sim,
      bmr,
      days,
      weeks,
      x,
      curve,
      plan,
      floorKg,
      deficit: sim.startTdee - sim.intake,
      endTdee: tdeeAt(goal),
      firstDay: kg - sim.days[1]!,
      lastDay: sim.reached ? sim.days[sim.days.length - 2]! - sim.days[sim.days.length - 1]! : NaN,
      straightWeeks: (kg - goal) / perWeek,
    }
  }, [sex, age, cm, kg, goal, activity, pace])

  const goalDate = (d: number) => format(addDays(today, d), 'd MMM yyyy')

  return (
    <CalcGrid
      inputs={
        <>
          <UnitToggle units={units} onChange={setUnits} />
          <SexToggle sex={sex} onChange={setSex} hint="The resting energy formula has one constant for men and one for women." />
          <NumberField id="wl-age" label="Age" value={age} onChange={setAge} unit="years" dp={0} min={15} max={100} />
          <HeightField id="wl-height" cm={cm} onChange={setCm} units={units} />
          <WeightField id="wl-weight" label="Weight now" kg={kg} onChange={setKg} units={units} />
          <WeightField id="wl-goal" label="Goal weight" kg={goal} onChange={setGoal} units={units} />
          <SelectField id="wl-activity" label="Activity" value={activity} onChange={setActivity} options={ACTIVITY} />
          <SelectField
            id="wl-pace"
            label="Planned loss at the start"
            value={pace}
            onChange={setPace}
            options={PACES.map((v) => ({ value: v, label: `${paceText(Number(v))} a week` }))}
          />
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="You reach your goal on"
            value={c.ok ? c.days : NaN}
            format={goalDate}
            hint={c.ok && c.sim.reached ? `In ${num(c.weeks)} weeks (${num(c.days)} days), if you eat ${kcal(c.sim.intake)} a day.` : undefined}
          />
          {!c.ok ? <Note warn>{'up' in c && c.up ? 'Enter a goal weight below your weight now.' : 'Enter your age, height, weight and goal weight.'}</Note> : null}
          {c.ok ? (
            <>
              <Stats
                items={[
                  { label: 'Eat each day', value: kcal(c.sim.intake) },
                  { label: 'You burn now (TDEE)', value: kcal(c.sim.startTdee) },
                  { label: 'Deficit', value: kcal(c.deficit), hint: 'a day at the start' },
                ]}
              />
              {c.sim.intake < CALORIE_FLOOR[sex] ? (
                <Note warn>
                  {kcal(c.sim.intake)} a day is under {kcal(CALORIE_FLOOR[sex])}, the usual lowest intake for {sex === 'male' ? 'men' : 'women'} without medical supervision. Choose a slower pace or more activity.
                </Note>
              ) : null}
              {c.perWeek > kg * 0.01 ? (
                <Note warn>
                  {paceText(c.perWeek)} a week is more than 1% of your body weight ({paceText(kg * 0.01)}). Faster loss takes more muscle. Most guidelines suggest 1% a week or less.
                </Note>
              ) : null}
              {!c.sim.reached ? (
                <Note warn>
                  At {kcal(c.sim.intake)} a day your weight levels off near {w(c.floorKg)}, where your TDEE equals the intake. The goal is not reached in 3 years. Choose a faster pace or a higher goal.
                </Note>
              ) : null}
              <LineChart
                x={c.x}
                series={[
                  { id: 'curve', label: 'Your weight', values: c.curve.map(disp), stroke: 'solid' },
                  { id: 'plan', label: `Fixed ${paceText(c.perWeek)} a week`, values: c.plan.map(disp), stroke: 'grey' },
                ]}
                xLabel="Week"
                formatValue={(v) => `${num(v, 1)} ${metric ? 'kg' : 'lb'}`}
                formatY={(v) => numUpTo(v, 1)}
                guides={[{ y: disp(goal), label: `Goal ${w(goal)}`, align: 'left' }]}
                markers={c.sim.reached ? [{ x: c.days / 7, label: `Week ${num(c.weeks)}` }] : []}
                zero={false}
                summary={
                  c.sim.reached
                    ? `The line curves: as your weight falls, your TDEE falls from ${kcal(c.sim.startTdee)} to ${kcal(c.endTdee)}, while the intake stays at ${kcal(c.sim.intake)}. The loss slows from ${w(c.firstDay * 7, 2)} to ${w(c.lastDay * 7, 2)} a week, so the goal takes ${num(c.weeks)} weeks instead of ${num(Math.ceil(c.straightWeeks))}.`
                    : `The line curves and levels off near ${w(c.floorKg)}: as your weight falls, your TDEE falls toward the fixed intake of ${kcal(c.sim.intake)}.`
                }
                table
              />
            </>
          ) : null}
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          {c.ok ? (
            <Formula
              note="The formulas use kilograms and centimetres."
              items={[
                {
                  label: 'Resting energy (Mifflin-St Jeor)',
                  general: `BMR = 10 × W + 6.25 × H − 5 × A ${sex === 'male' ? '+ 5' : '− 161'}`,
                  steps: [`10 × ${numUpTo(kg, 1)} + 6.25 × ${numUpTo(cm, 1)} − 5 × ${numUpTo(age, 0)} ${sex === 'male' ? '+ 5' : '− 161'}`],
                  result: kcal(c.bmr),
                },
                {
                  label: 'Energy you burn now (TDEE)',
                  general: 'TDEE = BMR × activity factor',
                  steps: [`${num(c.bmr, 1)} × ${c.act}`],
                  result: kcal(c.sim.startTdee),
                },
                {
                  label: 'Daily intake',
                  general: `intake = TDEE − kg per week × ${num(KCAL_PER_KG)} ÷ 7`,
                  steps: [`${num(c.sim.startTdee, 1)} − ${c.perWeek} × ${num(KCAL_PER_KG)} ÷ 7 = ${num(c.sim.startTdee, 1)} − ${num(c.deficit, 1)}`],
                  result: kcal(c.sim.intake),
                },
                {
                  label: 'Weight change each day',
                  general: `change = (TDEE at that day's weight − intake) ÷ ${num(KCAL_PER_KG)}`,
                  steps: [
                    `day 1: (${num(c.sim.startTdee, 1)} − ${num(c.sim.intake, 1)}) ÷ ${num(KCAL_PER_KG)} = ${c.firstDay.toFixed(4)} kg`,
                    'The calculator repeats this day by day until the weight reaches the goal.',
                  ],
                  result: c.sim.reached ? `${num(c.days)} days to ${numUpTo(goal, 1)} kg` : 'goal not reached in 3 years',
                },
              ]}
            />
          ) : null}
          <Assumptions
            title="Limits"
            items={[
              `One kilogram of body weight is taken as ${num(KCAL_PER_KG)} kcal. The first weeks are often faster than the line because you also lose water.`,
              'The intake stays fixed at the start value. The TDEE comes from the Mifflin-St Jeor formula times your activity factor, so it falls as your weight falls.',
              'The body can also adapt to a deficit and burn less than the formula says. The calculator does not include this.',
              'Ask a doctor before a large deficit, and if you are pregnant, under 18 or have a medical condition.',
            ]}
          />
        </div>
      }
    />
  )
}
