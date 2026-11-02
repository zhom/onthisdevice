import { useMemo, useState } from 'react'
import { BarList } from '@/components/viz'
import { HeightField, UnitToggle, WeightField, feetInches, kgToLb, useUnitSystem } from '@/components/tools/health/common'
import type { UnitSystem } from '@/components/tools/health/common'
import { BSA } from './body-math'
import type { BsaFormula } from './body-math'
import { Assumptions, CalcGrid, Formula, Headline, Note, ResultPanel, SelectField, Stats, num, numUpTo, pct } from './mb-ui'

const p = (base: number, exp: number) => Math.pow(base, exp).toFixed(4)

/** Each formula: name, year, the general form and the steps with the user's numbers. */
const FORMULAS: { id: BsaFormula; name: string; year: number; general: string; steps: (kg: number, cm: number) => string[] }[] = [
  {
    id: 'mosteller',
    name: 'Mosteller',
    year: 1987,
    general: 'BSA = √(H × W ÷ 3600)',
    steps: (kg, cm) => [`√(${numUpTo(cm, 1)} × ${numUpTo(kg, 1)} ÷ 3600)`, `√${((cm * kg) / 3600).toFixed(4)}`],
  },
  {
    id: 'dubois',
    name: 'Du Bois and Du Bois',
    year: 1916,
    general: 'BSA = 0.007184 × W^0.425 × H^0.725',
    steps: (kg, cm) => [`0.007184 × ${numUpTo(kg, 1)}^0.425 × ${numUpTo(cm, 1)}^0.725`, `0.007184 × ${p(kg, 0.425)} × ${p(cm, 0.725)}`],
  },
  {
    id: 'haycock',
    name: 'Haycock',
    year: 1978,
    general: 'BSA = 0.024265 × W^0.5378 × H^0.3964',
    steps: (kg, cm) => [`0.024265 × ${numUpTo(kg, 1)}^0.5378 × ${numUpTo(cm, 1)}^0.3964`, `0.024265 × ${p(kg, 0.5378)} × ${p(cm, 0.3964)}`],
  },
  {
    id: 'gehanGeorge',
    name: 'Gehan and George',
    year: 1970,
    general: 'BSA = 0.0235 × W^0.51456 × H^0.42246',
    steps: (kg, cm) => [`0.0235 × ${numUpTo(kg, 1)}^0.51456 × ${numUpTo(cm, 1)}^0.42246`, `0.0235 × ${p(kg, 0.51456)} × ${p(cm, 0.42246)}`],
  },
  {
    id: 'boyd',
    name: 'Boyd',
    year: 1935,
    general: 'BSA = 0.0003207 × H^0.3 × G^(0.7285 − 0.0188 × log10 G), G = weight in grams',
    steps: (kg, cm) => {
      const g = kg * 1000
      const e = 0.7285 - 0.0188 * Math.log10(g)
      return [
        `G = ${numUpTo(kg, 1)} × 1000 = ${numUpTo(g, 0)} g`,
        `exponent = 0.7285 − 0.0188 × log10(${numUpTo(g, 0)}) = ${e.toFixed(4)}`,
        `0.0003207 × ${p(cm, 0.3)} × ${p(g, e)}`,
      ]
    },
  },
  {
    id: 'fujimoto',
    name: 'Fujimoto',
    year: 1968,
    general: 'BSA = 0.008883 × W^0.444 × H^0.663',
    steps: (kg, cm) => [`0.008883 × ${numUpTo(kg, 1)}^0.444 × ${numUpTo(cm, 1)}^0.663`, `0.008883 × ${p(kg, 0.444)} × ${p(cm, 0.663)}`],
  },
]

const m2 = (v: number) => (Number.isFinite(v) ? `${num(v, 2)} m²` : '–')

function heightText(cm: number, units: UnitSystem): string {
  if (units === 'metric') return `${numUpTo(cm, 1)} cm`
  const { ft, inch } = feetInches(cm)
  return `${ft} ft ${numUpTo(inch, 1)} in`
}

const weightText = (kg: number, units: UnitSystem) => (units === 'metric' ? `${numUpTo(kg, 1)} kg` : `${numUpTo(kgToLb(kg), 1)} lb`)

export default function BodySurfaceAreaCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [cm, setCm] = useState(170)
  const [kg, setKg] = useState(70)
  const [formula, setFormula] = useState<BsaFormula>('mosteller')

  const c = useMemo(() => {
    const ok = cm > 0 && kg > 0
    const all = FORMULAS.map((f) => ({ ...f, value: ok ? BSA[f.id](kg, cm) : NaN }))
    const values = all.map((f) => f.value)
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const chosen = all.find((f) => f.id === formula) ?? all[0]!
    return { ok, all, lo, hi, mean, chosen, low: all.find((f) => f.value === lo), high: all.find((f) => f.value === hi) }
  }, [cm, kg, formula])

  const who = `${heightText(cm, units)} and ${weightText(kg, units)}`

  return (
    <CalcGrid
      inputs={
        <>
          <UnitToggle units={units} onChange={setUnits} />
          <HeightField id="bsa-height" cm={cm} onChange={setCm} units={units} />
          <WeightField id="bsa-weight" kg={kg} onChange={setKg} units={units} />
          <SelectField
            id="bsa-formula"
            label="Formula"
            value={formula}
            onChange={(v) => setFormula(v as BsaFormula)}
            options={FORMULAS.map((f) => ({ value: f.id, label: `${f.name} (${f.year})` }))}
          />
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Body surface area"
            value={c.chosen.value}
            format={m2}
            hint={c.ok ? `By the ${c.chosen.name} formula, for ${who}.` : undefined}
          />
          {c.ok ? (
            <>
              <Stats
                items={[
                  { label: 'Lowest of the six', value: m2(c.lo), hint: c.low?.name },
                  { label: 'Highest of the six', value: m2(c.hi), hint: c.high?.name },
                  { label: 'Mean of the six', value: m2(c.mean) },
                ]}
              />
              <BarList
                items={c.all.map((f) => ({ label: f.name, note: String(f.year), value: f.value, highlight: f.id === formula }))}
                formatValue={m2}
                columns={['Formula', 'BSA']}
                summary={`For ${who}, the six formulas give ${m2(c.lo)} to ${m2(c.hi)}. The spread is ${num(c.hi - c.lo, 2)} m², ${pct(((c.hi - c.lo) / c.chosen.value) * 100, 1)} of the ${c.chosen.name} result.`}
                table
              />
            </>
          ) : (
            <Note warn>Enter a height and a weight.</Note>
          )}
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          {c.ok ? (
            <Formula
              items={[
                {
                  label: `${c.chosen.name} (${c.chosen.year}), H = height in cm, W = weight in kg`,
                  general: c.chosen.general,
                  steps: c.chosen.steps(kg, cm),
                  result: `${c.chosen.value.toFixed(4)} m², shown as ${m2(c.chosen.value)}`,
                },
              ]}
            />
          ) : null}
          <Assumptions
            title="Limits"
            items={[
              'Each formula was fitted on a small group of people. The formulas agree well for adults of usual build and differ more for children and for very heavy or very light bodies.',
              'Haycock and Mosteller are often used for children. Fujimoto was fitted on Japanese adults.',
              'Drug doses and kidney function are often scaled to body surface area. For a dose, use the value from your care team.',
            ]}
          />
        </div>
      }
    />
  )
}
