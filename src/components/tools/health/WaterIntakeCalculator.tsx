import { useState } from 'react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Label } from '@/components/ui/label'
import {
  CalcLayout,
  EmptyState,
  EstimateNote,
  FormulaBlock,
  Interpretation,
  ML_PER_FLOZ,
  NumberField,
  Segmented,
  SexToggle,
  StatGrid,
  UnitToggle,
  WeightField,
  fmt,
  kgToLb,
  useUnitSystem,
  type Sex,
} from './common'

interface Climate {
  id: string
  label: string
  factor: number
  description: string
}

const CLIMATES: Climate[] = [
  { id: 'cold', label: 'Cold', factor: 1.05, description: 'Below about 5 °C. Heated indoor air is very dry, and cold blunts thirst.' },
  { id: 'temperate', label: 'Temperate', factor: 1, description: 'Roughly 15–24 °C. The baseline these figures are built on.' },
  { id: 'warm', label: 'Warm', factor: 1.08, description: 'Roughly 25–30 °C. Noticeably more sweat over the day.' },
  { id: 'hot', label: 'Hot', factor: 1.15, description: 'Roughly 31–37 °C, or a hot workplace such as a kitchen or a building site.' },
  { id: 'humid', label: 'Very hot / humid', factor: 1.25, description: 'Above 37 °C or high humidity, where sweat evaporates poorly and losses climb.' },
]

const LIFE: { id: string; label: string; addMl: number; note: string }[] = [
  { id: 'none', label: 'None', addMl: 0, note: '' },
  { id: 'pregnant', label: 'Pregnant', addMl: 300, note: 'EFSA adds about 300 ml a day during pregnancy.' },
  { id: 'breastfeeding', label: 'Breastfeeding', addMl: 700, note: 'EFSA adds about 700 ml a day while breastfeeding.' },
]

/** ml per kg of body weight, tapering with age as kidney concentrating ability falls. */
function baseRate(age: number): { ml: number; label: string } {
  if (age <= 30) return { ml: 40, label: 'age 18–30: 40 ml per kg' }
  if (age <= 55) return { ml: 35, label: 'age 31–55: 35 ml per kg' }
  return { ml: 30, label: 'age 56 and over: 30 ml per kg' }
}

const ML_PER_MIN_EXERCISE = 12 // ≈ 350 ml per 30 minutes of moderate exercise

function Glasses({ count }: { count: number }) {
  const shown = Math.min(count, 24)
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="img"
      aria-label={`About ${count} glasses of 250 millilitres each.`}
    >
      {Array.from({ length: shown }, (_, i) => (
        <svg key={i} viewBox="0 0 14 20" className="h-7 w-5" aria-hidden="true">
          <path
            d="M2 1 h10 l-1.4 18 h-7.2 Z"
            className="fill-none stroke-muted-foreground"
            strokeWidth="1"
          />
          <path d="M2.6 6 h8.8 l-1 13 h-6.8 Z" className="fill-foreground" />
        </svg>
      ))}
      {count > shown ? (
        <span className="self-center text-xs text-muted-foreground">+{count - shown} more</span>
      ) : null}
    </div>
  )
}

export default function WaterIntakeCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [sex, setSex] = useState<Sex>('female')
  const [kg, setKg] = useState(68)
  const [age, setAge] = useState(30)
  const [exerciseMin, setExerciseMin] = useState(45)
  const [climateId, setClimateId] = useState('temperate')
  const [lifeId, setLifeId] = useState('none')

  const metric = units === 'metric'
  const climate = CLIMATES.find((c) => c.id === climateId) ?? CLIMATES[1]
  // Pregnancy and breastfeeding apply to the female setting only.
  const life = (sex === 'female' ? LIFE.find((l) => l.id === lifeId) : undefined) ?? LIFE[0]
  const valid = kg > 0 && kg < 400 && age >= 15 && age <= 110

  const rate = baseRate(age)
  const baseMl = kg * rate.ml
  const exerciseMl = Math.max(0, exerciseMin) * ML_PER_MIN_EXERCISE
  const subtotal = baseMl + exerciseMl
  const climateMl = subtotal * (climate.factor - 1)
  const totalMl = subtotal * climate.factor + life.addMl
  const drinksMl = totalMl * 0.8

  const litres = totalMl / 1000
  const flOz = totalMl / ML_PER_FLOZ
  const cups = totalMl / 240
  const glasses = Math.round(drinksMl / 250)
  const bottles = drinksMl / 500
  const perWakingHour = drinksMl / 16

  const showVol = (ml: number) =>
    metric ? `${fmt(ml / 1000, 2)} L` : `${fmt(ml / ML_PER_FLOZ, 0)} fl oz`

  const summary = valid
    ? [
        `Total water per day: ${fmt(litres, 2)} L (${fmt(flOz, 0)} fl oz, ${fmt(cups, 1)} US cups)`,
        `From drinks: ${fmt(drinksMl / 1000, 2)} L (${fmt(drinksMl / ML_PER_FLOZ, 0)} fl oz), about ${glasses} × 250 ml glasses`,
        `From food: about ${fmt((totalMl - drinksMl) / 1000, 2)} L`,
        '',
        `Baseline (${rate.label}): ${fmt(baseMl, 0)} ml`,
        `Exercise (${exerciseMin} min × 12 ml): ${fmt(exerciseMl, 0)} ml`,
        `Climate (${climate.label}, ×${climate.factor}): ${climateMl >= 0 ? '+' : ''}${fmt(climateMl, 0)} ml`,
        life.addMl ? `${life.label}: +${life.addMl} ml` : '',
        '',
        'Calculated at onthisdevice.com/water-intake-calculator',
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  return (
    <CalcLayout
      inputs={
        <ToolPanel title="Your day">
          <div className="space-y-4">
            <UnitToggle units={units} onChange={setUnits} className="max-w-none" />
            <WeightField id="water-weight" kg={kg} onChange={setKg} units={units} label="Body weight" />
            <NumberField
              id="water-age"
              label="Age"
              value={age}
              onChange={setAge}
              unit="years"
              min={15}
              max={110}
              dp={0}
              hint={rate.label}
            />
            <SexToggle
              sex={sex}
              onChange={setSex}
              hint="Sex only affects the life-stage options below; the baseline is driven by body weight."
            />
            <NumberField
              id="water-exercise"
              label="Exercise or heavy exertion"
              value={exerciseMin}
              onChange={setExerciseMin}
              unit="min/day"
              min={0}
              max={480}
              step={15}
              dp={0}
              hint="Roughly 350 ml (12 fl oz) is added for every 30 minutes of sweaty activity."
            />
            <div className="space-y-1.5">
              <Label htmlFor="water-climate">Climate</Label>
              <select
                id="water-climate"
                value={climateId}
                onChange={(e) => setClimateId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {CLIMATES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} (×{c.factor})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{climate.description}</p>
            </div>
            {sex === 'female' ? (
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Life stage</span>
                <Segmented
                  label="Life stage"
                  value={lifeId}
                  onChange={setLifeId}
                  options={LIFE.map((l) => ({ value: l.id, label: l.label }))}
                />
                {life.note ? <p className="text-xs text-muted-foreground">{life.note}</p> : null}
              </div>
            ) : null}
            <EstimateNote>
              Hydration needs vary a lot between people and days. If you have heart, kidney or liver
              disease, or take diuretics, your fluid target should come from your doctor rather than
              a formula.
            </EstimateNote>
          </div>
        </ToolPanel>
      }
      results={
        valid ? (
          <>
            <ToolPanel
              title="How much to drink"
              footer={<CopyButton value={summary} label="Copy target" />}
            >
              <div className="space-y-5">
                <StatGrid cols={3}>
                  <ResultStat
                    label="From drinks"
                    value={metric ? `${fmt(drinksMl / 1000, 2)} L` : `${fmt(drinksMl / ML_PER_FLOZ, 0)} fl oz`}
                    hint="what you actually need to drink"
                    emphasis
                  />
                  <ResultStat
                    label="Total water"
                    value={metric ? `${fmt(litres, 2)} L` : `${fmt(flOz, 0)} fl oz`}
                    hint="drinks plus the water in your food"
                  />
                  <ResultStat
                    label="In cups"
                    value={`${fmt(cups, 1)} cups`}
                    hint="US cups of 240 ml"
                  />
                  <ResultStat label="250 ml glasses" value={`${glasses}`} hint="of drinks, spread over the day" />
                  <ResultStat label="500 ml bottles" value={fmt(bottles, 1)} hint="standard sports bottle" />
                  <ResultStat
                    label="Per waking hour"
                    value={metric ? `${fmt(perWakingHour, 0)} ml` : `${fmt(perWakingHour / ML_PER_FLOZ, 1)} fl oz`}
                    hint="across a 16-hour day"
                  />
                </StatGrid>

                <div>
                  <h3 className="text-sm font-semibold">What that looks like</h3>
                  <div className="mt-3">
                    <Glasses count={glasses} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {glasses} glasses of 250 ml. Front-load the day: most people are mildly
                    dehydrated on waking and then try to catch up in the evening.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">Where the total comes from</h3>
                  <div
                    className="mt-2 flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
                    role="img"
                    aria-label={`Baseline ${Math.round(baseMl)} millilitres, exercise ${Math.round(exerciseMl)}, climate ${Math.round(climateMl)}, life stage ${life.addMl}.`}
                  >
                    <div className="bg-chart-1" style={{ width: `${(baseMl / totalMl) * 100}%` }} />
                    <div className="bg-chart-2" style={{ width: `${(exerciseMl / totalMl) * 100}%` }} />
                    <div className="bg-chart-3" style={{ width: `${(climateMl / totalMl) * 100}%` }} />
                    <div className="bg-chart-4" style={{ width: `${(life.addMl / totalMl) * 100}%` }} />
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="size-2 rounded-full bg-chart-1" />
                      Baseline {showVol(baseMl)}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="size-2 rounded-full bg-chart-2" />
                      Exercise {showVol(exerciseMl)}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="size-2 rounded-full bg-chart-3" />
                      Climate {showVol(climateMl)}
                    </li>
                    {life.addMl ? (
                      <li className="flex items-center gap-1.5">
                        <span aria-hidden="true" className="size-2 rounded-full bg-chart-4" />
                        {life.label} {showVol(life.addMl)}
                      </li>
                    ) : null}
                  </ul>
                </div>
              </div>
            </ToolPanel>

            <FormulaBlock
              lines={[
                {
                  label: 'Baseline',
                  expr: `${fmt(kg, 1)} kg × ${rate.ml} ml/kg`,
                  result: `${fmt(baseMl, 0)} ml`,
                },
                {
                  label: 'Exercise',
                  expr: `${exerciseMin} min × 12 ml/min (≈350 ml per 30 min)`,
                  result: `${fmt(exerciseMl, 0)} ml`,
                },
                {
                  label: 'Climate',
                  expr: `(${fmt(baseMl, 0)} + ${fmt(exerciseMl, 0)}) × ${climate.factor} (${climate.label.toLowerCase()})`,
                  result: `${fmt(subtotal * climate.factor, 0)} ml`,
                },
                ...(life.addMl
                  ? [{ label: life.label, expr: `+ ${life.addMl} ml`, result: `${fmt(totalMl, 0)} ml` }]
                  : []),
                {
                  label: 'From drinks',
                  expr: `${fmt(totalMl, 0)} ml × 80% (food supplies roughly the other 20%)`,
                  result: `${fmt(drinksMl, 0)} ml`,
                },
                {
                  label: 'Imperial check',
                  expr: `${fmt(drinksMl, 0)} ml ÷ 29.57 ml per US fl oz`,
                  result: `${fmt(drinksMl / ML_PER_FLOZ, 0)} fl oz`,
                },
              ]}
              note={`A common US rule of thumb is half your body weight in pounds as fluid ounces. For you that is about ${fmt(kgToLb(kg) / 2, 0)} fl oz, which lands close to the figure above.`}
            />

            <Interpretation>
              <p>
                <strong>
                  Aim for roughly {metric ? `${fmt(drinksMl / 1000, 2)} litres` : `${fmt(drinksMl / ML_PER_FLOZ, 0)} fluid ounces`}{' '}
                  of drinks a day
                </strong>{' '}
                (about {glasses} glasses), with the rest of your water coming from food. Fruit,
                vegetables, soup, yoghurt and even bread all contribute.
              </p>
              <p>
                Tea and coffee count. The mild diuretic effect of caffeine at normal intakes does not
                outweigh the water in the cup. Alcohol is the exception: it suppresses vasopressin
                and genuinely increases losses.
              </p>
              <p>
                Thirst and urine colour are better day-to-day guides than any number. Pale straw is
                the target; consistently dark yellow means drink more, and completely clear all day
                usually means you are overdoing it. If you train for more than about 90 minutes or
                sweat heavily, add electrolytes rather than plain water alone.
              </p>
            </Interpretation>
          </>
        ) : (
          <EmptyState message="Enter your body weight and age to see a daily water target." />
        )
      }
    />
  )
}
