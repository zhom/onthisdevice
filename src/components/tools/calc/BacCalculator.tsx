import { useState } from 'react'
import { LineChart } from '@/components/viz'
import { NumberField, SexToggle, UnitToggle, WeightField, useUnitSystem, type Sex } from '@/components/tools/health/common'
import { ETHANOL_G_PER_ML, WIDMARK_BETA, WIDMARK_R, alcoholGrams, hoursToSober, widmarkBac } from './body-math'
import { Assumptions, CalcGrid, Choice, Formula, Headline, Note, ResultPanel, Stats, num, numUpTo } from './mb-ui'

type DrinkId = 'beer' | 'wine' | 'spirit'
type Mode = 'drinks' | 'standard'

const DRINKS: { id: DrinkId; label: string; ml: number; abv: number; floz: string }[] = [
  { id: 'beer', label: 'Beer', ml: 355, abv: 5, floz: '12' },
  { id: 'wine', label: 'Wine', ml: 150, abv: 12, floz: '5' },
  { id: 'spirit', label: 'Spirits, one shot', ml: 44, abv: 40, floz: '1.5' },
]

/** One US standard drink, grams of alcohol. */
const STANDARD_G = 14
const US_LIMIT = 0.08
/** Longest time the chart shows, hours. */
const CHART_HOURS = 48

const bacText = (n: number) => `${num(n, 3)}%`

function hoursText(h: number): string {
  const total = Math.round(h * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  if (hh === 0) return `${mm} min`
  return mm === 0 ? `${hh} h` : `${hh} h ${mm} min`
}

export default function BacCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [sex, setSex] = useState<Sex>('male')
  const [kg, setKg] = useState(75)
  const [mode, setMode] = useState<Mode>('drinks')
  const [counts, setCounts] = useState<Record<DrinkId, number>>({ beer: 2, wine: 1, spirit: 0 })
  const [standard, setStandard] = useState(3)
  const [hours, setHours] = useState(2)

  const metric = units === 'metric'
  const r = WIDMARK_R[sex]
  const ok = kg >= 30 && kg <= 350
  const perDrink = DRINKS.map((d) => ({ ...d, count: counts[d.id], grams: counts[d.id] * alcoholGrams(d.ml, d.abv) }))
  const grams = mode === 'drinks' ? perDrink.reduce((s, d) => s + d.grams, 0) : standard * STANDARD_G
  const peak = ok ? widmarkBac(grams, kg, sex, 0) : NaN
  const bac = ok ? widmarkBac(grams, kg, sex, hours) : NaN
  const toZero = ok ? hoursToSober(grams, kg, sex) : NaN
  const remaining = Math.max(0, toZero - hours)

  const end = Math.min(CHART_HOURS, Math.max(1, Math.ceil(Math.max(toZero, hours) * 2) / 2 + 0.5))
  const step = end > 12 ? 0.5 : 0.25
  const x = Array.from({ length: Math.round(end / step) + 1 }, (_, i) => i * step)
  const curve = x.map((t) => widmarkBac(grams, kg, sex, t))
  const nowIndex = Math.min(x.length - 1, Math.round(hours / step))
  const over = (limit: number) => (peak > limit ? (peak - limit) / WIDMARK_BETA : 0)

  const drinkLabel = (d: (typeof DRINKS)[number]) => `${d.label}, ${metric ? `${d.ml} ml` : `${d.floz} fl oz`} at ${d.abv}%`
  const gramSteps =
    mode === 'drinks'
      ? perDrink.filter((d) => d.count > 0).map((d) => `${d.label}: ${numUpTo(d.count, 1)} × ${d.ml} × ${num(d.abv / 100, 2)} × ${ETHANOL_G_PER_ML} = ${num(d.grams, 1)} g`)
      : [`${numUpTo(standard, 1)} × ${STANDARD_G} g`]

  return (
    <CalcGrid
      inputs={
        <>
          <UnitToggle units={units} onChange={setUnits} className="max-w-none" />
          <SexToggle sex={sex} onChange={setSex} hint="Women have less body water for the same weight, so the same drinks give a higher BAC." />
          <WeightField id="bac-weight" kg={kg} onChange={setKg} units={units} />
          <Choice
            label="Count drinks as"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'drinks', label: 'Drinks' },
              { value: 'standard', label: 'Standard drinks' },
            ]}
          />
          {mode === 'drinks' ? (
            DRINKS.map((d) => (
              <NumberField
                key={d.id}
                id={`bac-${d.id}`}
                label={drinkLabel(d)}
                value={counts[d.id]}
                onChange={(n) => setCounts((c) => ({ ...c, [d.id]: n }))}
                min={0}
                max={50}
                step={1}
                dp={1}
                placeholder="0"
              />
            ))
          ) : (
            <NumberField
              id="bac-standard"
              label="US standard drinks"
              value={standard}
              onChange={setStandard}
              min={0}
              max={50}
              step={1}
              dp={1}
              placeholder="0"
              hint={`One standard drink has ${STANDARD_G} g of alcohol.`}
            />
          )}
          <NumberField id="bac-hours" label="Hours since the first drink" value={hours} onChange={setHours} unit="h" min={0} max={48} step={0.5} dp={2} placeholder="0" />
        </>
      }
      results={
        <ResultPanel>
          <Note warn>
            An estimate for learning only. Do not use it to decide whether you can drive or are safe. Real BAC depends on food, absorption, medication and health. The only safe level for driving is zero.
          </Note>
          <Headline
            label="Estimated blood alcohol (BAC)"
            value={bac}
            format={bacText}
            hint={
              ok
                ? `${num(bac * 10, 2)} g per litre of blood. ${remaining > 0 ? `The model reaches 0 in ${hoursText(remaining)}.` : 'The model is at 0 now.'}`
                : 'Enter a weight from 30 to 350 kg.'
            }
          />
          <Stats
            cols={2}
            items={[
              { label: 'Time until 0', value: ok ? hoursText(remaining) : '–', hint: ok ? `${hoursText(toZero)} after the first drink` : undefined },
              { label: 'Alcohol', value: `${num(grams, 1)} g`, hint: `${num(grams / STANDARD_G, 1)} US standard drinks` },
              { label: 'Peak in the model', value: ok ? bacText(peak) : '–', hint: 'at the first drink' },
              { label: `Above ${num(US_LIMIT, 2)}%`, value: ok ? hoursText(over(US_LIMIT)) : '–', hint: 'from the first drink' },
            ]}
          />
          {ok ? (
            <LineChart
              x={x}
              series={[{ id: 'bac', label: 'BAC', values: curve, stroke: 'solid' }]}
              xLabel="After"
              formatX={(h) => `${numUpTo(h, 2)} h`}
              formatY={(v) => numUpTo(v, 3)}
              formatValue={bacText}
              guides={[
                { y: US_LIMIT, label: '0.08%' },
                { y: 0.05, label: '0.05%' },
              ]}
              markers={[{ x: Math.min(hours, end), label: 'Now' }]}
              defaultIndex={nowIndex}
              summary={`Widmark model: all ${num(grams, 1)} g of alcohol counts as absorbed at the first drink, so BAC starts at ${bacText(peak)} and falls by ${WIDMARK_BETA}% each hour. It is ${bacText(bac)} after ${numUpTo(hours, 2)} h and reaches 0 after ${hoursText(toZero)}. In real life BAC rises for 30 to 90 minutes first.`}
              table
            />
          ) : null}
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <Formula
            items={[
              {
                label: 'Grams of alcohol',
                general: mode === 'drinks' ? 'A = count × ml × ABV × 0.789' : `A = standard drinks × ${STANDARD_G} g`,
                steps: gramSteps.length > 0 ? gramSteps : ['No drinks'],
                result: `${num(grams, 1)} g`,
              },
              {
                label: 'Peak BAC (Widmark)',
                general: 'BAC₀ = A ÷ (W × 1000 × r) × 100',
                steps: [`r = ${r} (${sex})`, `BAC₀ = ${num(grams, 1)} ÷ (${num(kg, 1)} × 1000 × ${r}) × 100`],
                result: bacText(peak),
              },
              {
                label: 'BAC now',
                general: `BAC = BAC₀ − ${WIDMARK_BETA} × t`,
                steps: [`BAC = ${num(peak, 4)} − ${WIDMARK_BETA} × ${numUpTo(hours, 2)}`],
                result: bacText(bac),
              },
              {
                label: 'Hours until 0',
                general: `t₀ = BAC₀ ÷ ${WIDMARK_BETA}`,
                steps: [`t₀ = ${num(peak, 4)} ÷ ${WIDMARK_BETA}`],
                result: `${num(toZero, 2)} h`,
              },
            ]}
            note="W is weight in kg. BAC is in grams of alcohol per 100 ml of blood, the US unit. Multiply by 10 for grams per litre."
          />
          <Assumptions
            title="Limits"
            items={[
              'The Widmark model counts all alcohol as absorbed at the first drink. Real BAC rises for 30 to 90 minutes, longer after a meal, and its peak is often lower.',
              `The body water factor r (${WIDMARK_R.male} for men, ${WIDMARK_R.female} for women) and the fall of ${WIDMARK_BETA}% an hour are averages. Each varies from person to person by a large amount.`,
              'Medication, liver health, fatigue and drinking speed change the result. Coffee, water or a cold shower do not make it fall faster.',
              'The legal limit is 0.08% in every US state except Utah (0.05%), and 0.05% in many other countries. Many places set a lower limit for new or commercial drivers. Impairment starts below every limit.',
            ]}
          />
        </div>
      }
    />
  )
}
