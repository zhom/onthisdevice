import { useMemo, useState } from 'react'
import { Gauge } from '@/components/viz'
import { HeightField, LengthField, NumberField, SexToggle, UnitToggle, WeightField, useUnitSystem } from '@/components/tools/health/common'
import type { Sex } from '@/components/tools/health/common'
import { CM_PER_IN, KG_PER_LB, armyMaxBodyFat, armyOneSite, navyBodyFatIn } from './body-math'
import { Assumptions, CalcGrid, Choice, Formula, Headline, Note, ResultPanel, Stats, num, pct } from './mb-ui'
import type { FormulaItem } from './mb-ui'

type Method = 'one' | 'two'

function ageGroup(age: number): string {
  if (age <= 20) return '17 to 20'
  if (age <= 27) return '21 to 27'
  if (age <= 39) return '28 to 39'
  return '40 and over'
}

const inch = (cm: number) => cm / CM_PER_IN

export default function ArmyBodyFatCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [method, setMethod] = useState<Method>('one')
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState(25)
  const [kg, setKg] = useState(80)
  const [abdomen, setAbdomen] = useState(86)
  const [neck, setNeck] = useState(38)
  const [height, setHeight] = useState(178)
  const [hip, setHip] = useState(100)

  const c = useMemo(() => {
    const max = armyMaxBodyFat(sex, age)
    const lb = kg / KG_PER_LB
    const abIn = inch(abdomen)
    const hIn = inch(height)
    const neckIn = inch(neck)
    const hipIn = inch(hip)
    const ok = age > 0 && abdomen > 0 && (method === 'one' ? kg > 0 : height > 0 && neck > 0 && (sex === 'male' || hip > 0))
    const bf = !ok ? NaN : method === 'one' ? armyOneSite(sex, lb, abIn) : navyBodyFatIn(sex, hIn, neckIn, abIn, hipIn)
    return { max, lb, abIn, hIn, neckIn, hipIn, bf, ok: Number.isFinite(bf), meets: bf <= max }
  }, [method, sex, age, kg, abdomen, neck, height, hip])

  const people = sex === 'male' ? 'men' : 'women'
  const group = `${people} aged ${ageGroup(age)}`
  const status = c.meets ? 'Meets the standard' : 'Over the standard'
  const odd = c.ok && (c.bf < 2 || c.bf > 60)

  const conversions =
    method === 'one'
      ? [`weight ${num(kg, 1)} kg ÷ 0.45359237 = ${num(c.lb, 1)} lb, abdomen ${num(abdomen, 1)} cm ÷ 2.54 = ${num(c.abIn, 2)} in`]
      : [
          `height ${num(height, 1)} cm = ${num(c.hIn, 2)} in, neck ${num(neck, 1)} cm = ${num(c.neckIn, 2)} in`,
          sex === 'male'
            ? `abdomen ${num(abdomen, 1)} cm = ${num(c.abIn, 2)} in`
            : `waist ${num(abdomen, 1)} cm = ${num(c.abIn, 2)} in, hips ${num(hip, 1)} cm = ${num(c.hipIn, 2)} in`,
        ]
  const general =
    method === 'one'
      ? sex === 'male'
        ? 'BF% = −26.97 − 0.12 × weight lb + 1.99 × abdomen in'
        : 'BF% = −9.15 − 0.015 × weight lb + 1.27 × abdomen in'
      : sex === 'male'
        ? 'BF% = 86.010 × log10(abdomen − neck) − 70.041 × log10(height) + 36.76'
        : 'BF% = 163.205 × log10(waist + hips − neck) − 97.684 × log10(height) − 78.387'
  const substituted =
    method === 'one'
      ? sex === 'male'
        ? `−26.97 − 0.12 × ${num(c.lb, 1)} + 1.99 × ${num(c.abIn, 2)}`
        : `−9.15 − 0.015 × ${num(c.lb, 1)} + 1.27 × ${num(c.abIn, 2)}`
      : sex === 'male'
        ? `86.010 × log10(${num(c.abIn, 2)} − ${num(c.neckIn, 2)}) − 70.041 × log10(${num(c.hIn, 2)}) + 36.76`
        : `163.205 × log10(${num(c.abIn, 2)} + ${num(c.hipIn, 2)} − ${num(c.neckIn, 2)}) − 97.684 × log10(${num(c.hIn, 2)}) − 78.387`
  const formula: FormulaItem[] = c.ok
    ? [
        {
          label: `${method === 'one' ? 'One-site tape' : 'Neck and waist method'}, ${people} (inches and pounds)`,
          general,
          steps: [...conversions, substituted],
          result: pct(c.bf, 1),
        },
        {
          label: 'Against the standard',
          general: 'meets the standard when BF% ≤ the maximum for the age and sex',
          steps: [`${pct(c.bf, 1)} ${c.meets ? '≤' : '>'} ${c.max}% (${group})`],
          result: status.toLowerCase(),
        },
      ]
    : []

  return (
    <CalcGrid
      inputs={
        <>
          <Choice<Method>
            label="Method"
            value={method}
            onChange={setMethod}
            options={[
              { value: 'one', label: 'One-site tape (2023)' },
              { value: 'two', label: 'Neck and waist (before 2023)' },
            ]}
          />
          <UnitToggle units={units} onChange={setUnits} />
          <SexToggle sex={sex} onChange={setSex} hint="The Army has separate formulas and limits for men and women." />
          <NumberField id="abf-age" label="Age" value={age} onChange={setAge} unit="years" dp={0} min={17} max={80} />
          {method === 'one' ? (
            <>
              <WeightField id="abf-weight" kg={kg} onChange={setKg} units={units} />
              <LengthField id="abf-abdomen" label="Abdomen at the navel" cm={abdomen} onChange={setAbdomen} units={units} />
            </>
          ) : (
            <>
              <HeightField id="abf-height" cm={height} onChange={setHeight} units={units} />
              <LengthField id="abf-neck" label="Neck, just below the larynx" cm={neck} onChange={setNeck} units={units} />
              <LengthField
                id="abf-abdomen"
                label={sex === 'male' ? 'Abdomen at the navel' : 'Waist at the narrowest point'}
                cm={abdomen}
                onChange={setAbdomen}
                units={units}
              />
              {sex === 'female' ? <LengthField id="abf-hip" label="Hips at the widest point" cm={hip} onChange={setHip} units={units} /> : null}
            </>
          )}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Body fat"
            value={c.ok ? c.bf : NaN}
            format={(v) => pct(v, 1)}
            hint={
              c.ok
                ? c.meets
                  ? `Meets the standard. The maximum for ${group} is ${c.max}%.`
                  : `Over the standard by ${num(c.bf - c.max, 1)} points. The maximum for ${group} is ${c.max}%.`
                : undefined
            }
          />
          {!c.ok ? <Note warn>Enter all the measurements.</Note> : null}
          {odd ? <Note warn>This result is outside the usual range. Check the measurements and the units.</Note> : null}
          {c.ok ? (
            <>
              <Stats
                items={[
                  { label: 'Army maximum', value: `${c.max}%`, hint: group },
                  { label: 'Result', value: status },
                  { label: c.meets ? 'Under the maximum by' : 'Over the maximum by', value: `${num(Math.abs(c.max - c.bf), 1)} points` },
                ]}
              />
              <Gauge
                variant="bar"
                value={c.bf}
                min={0}
                max={45}
                bands={[
                  { to: c.max + 1e-9, label: 'Meets the standard' },
                  { to: 45, label: 'Over the standard' },
                ]}
                formatValue={(v) => `${Math.round(v)}%`}
                ariaLabel={`Scale from 0 to 45% body fat. Value ${pct(c.bf, 1)}, ${status.toLowerCase()}. The maximum is ${c.max}%.`}
                summary={`${pct(c.bf, 1)} body fat against an Army maximum of ${c.max}% for ${group}: ${status.toLowerCase()}.`}
              />
            </>
          ) : null}
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          {formula.length ? <Formula items={formula} /> : null}
          <Assumptions
            title="Limits"
            items={[
              'Soldiers are first checked against a weight-for-height table. Only those over the table weight take the tape test.',
              'The official test is done by trained staff, who take repeated tape readings and fill in the Army worksheet. This page gives an estimate.',
              'The one-site tape replaced the neck and waist method for Army tests in 2023. The older method is here for comparison.',
              'Tape methods are estimates. For many people they differ from a lab scan by a few percentage points.',
            ]}
          />
        </div>
      }
    />
  )
}
