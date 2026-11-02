import { useMemo, useState } from 'react'
import { Gauge } from '@/components/viz'
import { KM_PER_MI, NumberField, SexToggle, UnitToggle, WeightField, kgToLb, useUnitSystem } from '@/components/tools/health/common'
import type { Sex } from '@/components/tools/health/common'
import { vo2Bands, vo2Cooper, vo2OneAndHalfMile, vo2Rockport, vo2Uth } from './body-math'
import { Assumptions, CalcGrid, Formula, Headline, Note, ResultPanel, SelectField, Stats, num } from './mb-ui'
import type { FormulaItem } from './mb-ui'

type Method = 'cooper' | 'mile15' | 'rockport' | 'uth'

const METHODS: { value: Method; label: string }[] = [
  { value: 'cooper', label: 'Cooper 12-minute run' },
  { value: 'mile15', label: '1.5-mile run' },
  { value: 'rockport', label: 'Rockport 1-mile walk' },
  { value: 'uth', label: 'Resting heart rate ratio' },
]

const MIN = 10
const MAX = 70

function ageGroup(age: number): string {
  if (age <= 29) return 'under 30'
  if (age <= 39) return '30 to 39'
  if (age <= 49) return '40 to 49'
  if (age <= 59) return '50 to 59'
  return '60 and over'
}

const minSec = (min: number, sec: number) => `${num(min)} min ${num(sec)} s`

export default function Vo2MaxCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [method, setMethod] = useState<Method>('cooper')
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState(35)
  const [metres, setMetres] = useState(2400)
  const [runMin, setRunMin] = useState(12)
  const [runSec, setRunSec] = useState(0)
  const [kg, setKg] = useState(75)
  const [walkMin, setWalkMin] = useState(15)
  const [walkSec, setWalkSec] = useState(0)
  const [walkHr, setWalkHr] = useState(120)
  const [maxHr, setMaxHr] = useState(185)
  const [restHr, setRestHr] = useState(60)

  const metric = units === 'metric'

  const c = useMemo(() => {
    const run = runMin + runSec / 60
    const walk = walkMin + walkSec / 60
    const lb = kgToLb(kg)
    let v = NaN
    let item: FormulaItem | null = null
    if (method === 'cooper') {
      v = metres > 0 ? vo2Cooper(metres) : NaN
      item = {
        label: 'Cooper 12-minute run (Cooper, 1968)',
        general: 'VO2 max = (distance in m − 504.9) ÷ 44.73',
        steps: [`(${num(metres)} − 504.9) ÷ 44.73`],
        result: `${num(v, 1)} ml/kg/min`,
      }
    } else if (method === 'mile15') {
      v = vo2OneAndHalfMile(run)
      item = {
        label: '1.5-mile run',
        general: 'VO2 max = 3.5 + 483 ÷ time in minutes',
        steps: [`time = ${minSec(runMin, runSec)} = ${num(run, 2)} min`, `3.5 + 483 ÷ ${num(run, 2)}`],
        result: `${num(v, 1)} ml/kg/min`,
      }
    } else if (method === 'rockport') {
      v = kg > 0 && walk > 0 && walkHr > 0 && age > 0 ? vo2Rockport(sex, age, lb, walk, walkHr) : NaN
      item = {
        label: 'Rockport 1-mile walk (Kline, 1987)',
        general: 'VO2 max = 132.853 − 0.0769 × weight lb − 0.3877 × age + 6.315 × sex − 3.2649 × time min − 0.1565 × heart rate (sex = 1 for men, 0 for women)',
        steps: [
          `weight = ${num(kg, 1)} kg = ${num(lb, 1)} lb, time = ${minSec(walkMin, walkSec)} = ${num(walk, 2)} min`,
          `132.853 − 0.0769 × ${num(lb, 1)} − 0.3877 × ${num(age)} + 6.315 × ${sex === 'male' ? 1 : 0} − 3.2649 × ${num(walk, 2)} − 0.1565 × ${num(walkHr)}`,
        ],
        result: `${num(v, 1)} ml/kg/min`,
      }
    } else {
      v = maxHr > 0 ? vo2Uth(maxHr, restHr) : NaN
      item = {
        label: 'Heart rate ratio (Uth and others, 2004)',
        general: 'VO2 max = 15.3 × maximum heart rate ÷ resting heart rate',
        steps: [`15.3 × ${num(maxHr)} ÷ ${num(restHr)}`],
        result: `${num(v, 1)} ml/kg/min`,
      }
    }
    const ok = Number.isFinite(v) && v > 0
    const bands = vo2Bands(sex, age).map((b, i, all) => (i === all.length - 1 ? { ...b, to: MAX } : b))
    const idx = bands.findIndex((b) => v < b.to)
    const bandIdx = idx < 0 ? bands.length - 1 : idx
    return { v, ok, item, bands, bandIdx, band: bands[bandIdx]!, lower: bandIdx > 0 ? bands[bandIdx - 1]!.to : MIN, next: bands[bandIdx + 1] }
  }, [method, sex, age, metres, runMin, runSec, kg, walkMin, walkSec, walkHr, maxHr, restHr])

  const group = `${sex === 'male' ? 'men' : 'women'} aged ${ageGroup(age)}`
  const ml = (v: number) => num(v, 1)

  return (
    <CalcGrid
      inputs={
        <>
          <SelectField id="vo2-method" label="Test" value={method} onChange={(v) => setMethod(v as Method)} options={METHODS} />
          <UnitToggle units={units} onChange={setUnits} />
          <SexToggle sex={sex} onChange={setSex} hint="The fitness bands differ for men and women." />
          <NumberField id="vo2-age" label="Age" value={age} onChange={setAge} unit="years" dp={0} min={15} max={100} />
          {method === 'cooper' ? (
            <NumberField
              key={units}
              id="vo2-distance"
              label="Distance in 12 minutes"
              value={metric ? metres : metres / 1000 / KM_PER_MI}
              onChange={(n) => setMetres(metric ? n : n * KM_PER_MI * 1000)}
              unit={metric ? 'm' : 'mi'}
              step={metric ? 10 : 0.01}
              dp={metric ? 0 : 2}
              hint={metric ? `${num(metres / 1000 / KM_PER_MI, 2)} miles. Run as far as you can in 12 minutes.` : `${num(metres)} m. Run as far as you can in 12 minutes.`}
            />
          ) : null}
          {method === 'mile15' ? (
            <div className="space-y-1.5">
              <span className="text-sm font-medium leading-none">Time for 1.5 miles (2.4 km)</span>
              <div className="grid grid-cols-2 gap-2">
                <NumberField id="vo2-run-min" label="Minutes" value={runMin} onChange={setRunMin} unit="min" dp={0} />
                <NumberField id="vo2-run-sec" label="Seconds" value={runSec} onChange={setRunSec} unit="s" dp={0} max={59} placeholder="0" />
              </div>
            </div>
          ) : null}
          {method === 'rockport' ? (
            <>
              <WeightField id="vo2-weight" kg={kg} onChange={setKg} units={units} />
              <div className="space-y-1.5">
                <span className="text-sm font-medium leading-none">Time to walk 1 mile (1.6 km)</span>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField id="vo2-walk-min" label="Minutes" value={walkMin} onChange={setWalkMin} unit="min" dp={0} />
                  <NumberField id="vo2-walk-sec" label="Seconds" value={walkSec} onChange={setWalkSec} unit="s" dp={0} max={59} placeholder="0" />
                </div>
              </div>
              <NumberField id="vo2-walk-hr" label="Heart rate at the finish" value={walkHr} onChange={setWalkHr} unit="bpm" dp={0} hint="Count it as soon as you stop." />
            </>
          ) : null}
          {method === 'uth' ? (
            <>
              <NumberField
                id="vo2-max-hr"
                label="Maximum heart rate"
                value={maxHr}
                onChange={setMaxHr}
                unit="bpm"
                dp={0}
                hint={`If you have not measured it, 220 − age is ${num(220 - age)} bpm.`}
              />
              <NumberField id="vo2-rest-hr" label="Resting heart rate" value={restHr} onChange={setRestHr} unit="bpm" dp={0} hint="Count it in bed, after you wake up." />
            </>
          ) : null}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="VO2 max, ml/kg/min"
            value={c.ok ? c.v : NaN}
            format={ml}
            hint={c.ok ? `${c.band.label} for ${group}.` : undefined}
          />
          {!c.ok ? <Note warn>Enter the test result.</Note> : null}
          {c.ok ? (
            <>
              <Stats
                items={[
                  { label: 'Fitness level', value: c.band.label, hint: group },
                  c.next
                    ? { label: `${c.next.label} from`, value: `${num(c.band.to, 1)}`, hint: `${num(c.band.to - c.v, 1)} more` }
                    : { label: 'Next level', value: 'Top band' },
                  { label: 'METs', value: num(c.v / 3.5, 1), hint: 'VO2 max ÷ 3.5' },
                ]}
              />
              <Gauge
                value={c.v}
                min={MIN}
                max={MAX}
                bands={c.bands}
                formatValue={(v) => num(v, 1)}
                center={
                  <>
                    <p className="text-lg font-[650]">{ml(c.v)}</p>
                    <p className="text-[0.8125rem] text-muted-foreground">{c.band.label}</p>
                  </>
                }
                summary={`${ml(c.v)} ml/kg/min is in the ${c.band.label.toLowerCase()} band for ${group}, which runs from ${num(c.lower, 1)} to ${c.next ? num(c.band.to, 1) : 'the top of the scale'}.`}
              />
            </>
          ) : null}
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          {c.ok && c.item ? (
            <Formula
              items={[
                c.item,
                { label: 'METs', general: 'METs = VO2 max ÷ 3.5 (1 MET = 3.5 ml/kg/min)', steps: [`${ml(c.v)} ÷ 3.5`], result: num(c.v / 3.5, 1) },
              ]}
            />
          ) : null}
          <Assumptions
            title="Limits"
            items={[
              'Field tests estimate VO2 max. A lab test that measures the air you breathe during a maximal treadmill or bike test is more exact.',
              'The run tests assume a maximal, even effort. The walk test needs a brisk, steady walk on a flat track.',
              'The heart rate ratio works best with a measured maximum heart rate. 220 − age can be off by 10 or more beats a minute, and that error goes into the result.',
              'The fitness bands are adult norms by age group and sex. Norm tables from different sources differ by a few points.',
            ]}
          />
        </div>
      }
    />
  )
}
