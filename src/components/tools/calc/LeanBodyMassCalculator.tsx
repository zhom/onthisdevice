import { useState } from 'react'
import { BarList, Donut } from '@/components/viz'
import { HeightField, NumberField, SexToggle, UnitToggle, WeightField, kgToLb, useUnitSystem, type Sex } from '@/components/tools/health/common'
import { katchMcArdle, lbmBoer, lbmFromBodyFat, lbmHume, lbmJames } from './body-math'
import { Assumptions, CalcGrid, Formula, Headline, Note, ResultPanel, SelectField, Stats, num, pct } from './mb-ui'
import type { FormulaItem } from './mb-ui'

type LbmFormula = 'boer' | 'james' | 'hume' | 'bodyfat'

const NAMES: Record<LbmFormula, string> = { boer: 'Boer', james: 'James', hume: 'Hume', bodyfat: 'Body fat %' }

/** Linear formulas: LBM = a × kg + b × cm + c. */
const LINEAR: Record<'boer' | 'hume', Record<Sex, [number, number, number]>> = {
  boer: { male: [0.407, 0.267, -19.2], female: [0.252, 0.473, -48.3] },
  hume: { male: [0.3281, 0.33929, -29.5336], female: [0.29569, 0.41813, -43.2933] },
}
/** James: LBM = a × kg − b × (kg ÷ cm)². */
const JAMES: Record<Sex, [number, number]> = { male: [1.1, 128], female: [1.07, 148] }
/** BMI above which the James formula falls as weight rises: a × 10000 ÷ (2 × b). */
const JAMES_PEAK_BMI: Record<Sex, number> = { male: (1.1 * 10000) / 256, female: (1.07 * 10000) / 296 }

const isFormula = (v: string): v is LbmFormula => v in NAMES

export default function LeanBodyMassCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [sex, setSex] = useState<Sex>('male')
  const [cm, setCm] = useState(178)
  const [kg, setKg] = useState(80)
  const [bodyFat, setBodyFat] = useState(0)
  const [picked, setPicked] = useState<LbmFormula>('boer')

  const metric = units === 'metric'
  const mass = (v: number) => (Number.isFinite(v) ? (metric ? `${num(v, 1)} kg` : `${num(kgToLb(v), 1)} lb`) : '–')
  const hasBf = bodyFat > 0 && bodyFat < 75
  const formula: LbmFormula = picked === 'bodyfat' && !hasBf ? 'boer' : picked
  const valid = cm >= 100 && cm <= 250 && kg >= 25 && kg <= 350

  const values: Record<LbmFormula, number> = {
    boer: lbmBoer(sex, kg, cm),
    james: lbmJames(sex, kg, cm),
    hume: lbmHume(sex, kg, cm),
    bodyfat: hasBf ? lbmFromBodyFat(kg, bodyFat) : NaN,
  }
  const raw = values[formula]
  const lbm = valid && raw > 0 && raw < kg ? raw : NaN
  const fat = kg - lbm
  const fatPct = (fat / kg) * 100
  const ree = katchMcArdle(lbm)
  const ok = Number.isFinite(lbm)
  const bmi = kg / (cm / 100) ** 2
  const jamesPast = valid && bmi > JAMES_PEAK_BMI[sex]

  const shown: LbmFormula[] = hasBf ? ['boer', 'james', 'hume', 'bodyfat'] : ['boer', 'james', 'hume']
  const options = shown.map((f) => ({ value: f, label: f === 'bodyfat' ? 'From my body fat %' : NAMES[f] }))

  const working: FormulaItem[] = []
  if (formula === 'boer' || formula === 'hume') {
    const [a, b, c] = LINEAR[formula][sex]
    working.push({
      label: `Lean body mass, ${NAMES[formula]} (${sex})`,
      general: `LBM = ${a} × W + ${b} × H − ${Math.abs(c)}`,
      steps: [`LBM = ${a} × ${num(kg, 1)} + ${b} × ${num(cm, 1)} − ${Math.abs(c)}`],
      result: `${num(raw, 2)} kg`,
    })
  } else if (formula === 'james') {
    const [a, b] = JAMES[sex]
    working.push({
      label: `Lean body mass, James (${sex})`,
      general: `LBM = ${a} × W − ${b} × (W ÷ H)²`,
      steps: [`LBM = ${a} × ${num(kg, 1)} − ${b} × (${num(kg, 1)} ÷ ${num(cm, 1)})²`],
      result: `${num(raw, 2)} kg`,
    })
  } else {
    working.push({
      label: 'Lean body mass from body fat %',
      general: 'LBM = W × (1 − BF ÷ 100)',
      steps: [`LBM = ${num(kg, 1)} × (1 − ${num(bodyFat, 1)} ÷ 100)`],
      result: `${num(raw, 2)} kg`,
    })
  }
  working.push(
    { label: 'Fat mass', general: 'Fat = W − LBM', steps: [`Fat = ${num(kg, 1)} − ${num(lbm, 2)} = ${num(fat, 2)} kg`, `Fat % = ${num(fat, 2)} ÷ ${num(kg, 1)} × 100`], result: pct(fatPct, 1) },
    { label: 'Resting energy (Katch-McArdle)', general: 'REE = 370 + 21.6 × LBM', steps: [`REE = 370 + 21.6 × ${num(lbm, 2)}`], result: `${num(ree, 0)} kcal a day` },
  )

  return (
    <CalcGrid
      inputs={
        <>
          <UnitToggle units={units} onChange={setUnits} className="max-w-none" />
          <SexToggle sex={sex} onChange={setSex} hint="The formulas have separate male and female versions." />
          <HeightField id="lbm-height" cm={cm} onChange={setCm} units={units} />
          <WeightField id="lbm-weight" kg={kg} onChange={setKg} units={units} />
          <NumberField
            id="lbm-bf"
            label="Body fat (optional)"
            value={bodyFat}
            onChange={setBodyFat}
            unit="%"
            max={75}
            step={0.5}
            placeholder="e.g. 18"
            hint="From a scan, calipers or a smart scale. Adds a fourth estimate."
          />
          <SelectField id="lbm-formula" label="Formula" value={formula} onChange={(v) => isFormula(v) && setPicked(v)} options={options} />
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Lean body mass"
            value={lbm}
            format={mass}
            hint={
              ok
                ? `${pct(100 - fatPct, 1)} of your weight, by the ${NAMES[formula]} formula. The rest, ${mass(fat)}, is fat.`
                : 'Enter a height from 100 to 250 cm and a weight from 25 to 350 kg.'
            }
          />
          <Stats
            items={[
              { label: 'Fat mass', value: mass(fat) },
              { label: 'Body fat', value: pct(fatPct, 1) },
              { label: 'Resting energy', value: Number.isFinite(ree) ? `${num(ree, 0)} kcal` : '–', hint: 'a day, Katch-McArdle' },
            ]}
          />
          {ok ? (
            <Donut
              parts={[
                { label: 'Lean mass', value: lbm, paint: 'ink' },
                { label: 'Fat mass', value: fat, paint: 'hatch' },
              ]}
              center={
                <>
                  <span className="text-xl font-[720]">{pct(100 - fatPct, 0)}</span>
                  <span className="text-xs text-muted-foreground">lean</span>
                </>
              }
              size={160}
              formatValue={mass}
              summary={`Of your ${mass(kg)}, the ${NAMES[formula]} formula puts ${mass(lbm)} as lean mass and ${mass(fat)} as fat (${pct(fatPct, 1)}).`}
            />
          ) : null}
          {jamesPast ? (
            <Note warn>
              Your BMI is {num(bmi, 1)}. Above a BMI of {num(JAMES_PEAK_BMI[sex], 1)} the James formula gives less lean mass as weight goes up, so its result is too low. Use Boer or Hume.
            </Note>
          ) : null}
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          {valid ? (
            <ResultPanel title="The formulas side by side">
              <BarList
                items={shown.map((f) => ({
                  label: NAMES[f],
                  value: values[f],
                  note: `${pct((values[f] / kg) * 100, 0)} of weight`,
                  highlight: f === formula,
                }))}
                max={kg}
                formatValue={mass}
                columns={['Formula', 'Lean body mass']}
                summary={`The estimates run from ${mass(Math.min(...shown.map((f) => values[f])))} to ${mass(Math.max(...shown.map((f) => values[f])))}. A full bar is your whole weight, ${mass(kg)}.`}
                table
              />
            </ResultPanel>
          ) : null}
          <Formula items={working} note="The formulas use kilograms (W) and centimetres (H). Imperial entries are converted first." />
          <Assumptions
            title="Limits"
            items={[
              'Boer, James and Hume are regression formulas from adult reference groups. They predict the average lean mass for a height and weight, so a muscular person gets too low a value and a person with much fat too high a value.',
              'They are for adults. Children need other formulas.',
              'A measured body fat percentage gives a better figure, as long as the measurement is good. Smart scales and calipers can be off by several percentage points.',
              'Katch-McArdle estimates resting energy from lean mass only. Age, health and medication also change it.',
            ]}
          />
        </div>
      }
    />
  )
}
