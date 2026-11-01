import { useMemo, useState } from 'react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import {
  BandTable,
  CalcLayout,
  EmptyState,
  EstimateNote,
  FormulaBlock,
  HeightField,
  Interpretation,
  LengthField,
  NumberField,
  SexToggle,
  StatGrid,
  UnitToggle,
  WeightField,
  bandFor,
  bmiOf,
  cmToIn,
  fmt,
  katchMcArdle,
  kcal,
  kgToLb,
  useUnitSystem,
  type Band,
  type Sex,
} from './common'

const MALE_BANDS: Band[] = [
  { label: 'Essential fat', min: 0, max: 6, tone: 'bg-chart-2', note: 'Below this is not survivable long term' },
  { label: 'Athletes', min: 6, max: 14, tone: 'bg-chart-5', note: 'Visible abdominal definition' },
  { label: 'Fitness', min: 14, max: 18, tone: 'bg-chart-5', note: 'Lean and healthy' },
  { label: 'Average', min: 18, max: 25, tone: 'bg-chart-3', note: 'Typical adult male range' },
  { label: 'Obese', min: 25, max: Infinity, tone: 'bg-chart-4' },
]

const FEMALE_BANDS: Band[] = [
  { label: 'Essential fat', min: 0, max: 14, tone: 'bg-chart-2', note: 'Below this menstrual function is usually affected' },
  { label: 'Athletes', min: 14, max: 21, tone: 'bg-chart-5', note: 'Competitive physique range' },
  { label: 'Fitness', min: 21, max: 25, tone: 'bg-chart-5', note: 'Lean and healthy' },
  { label: 'Average', min: 25, max: 32, tone: 'bg-chart-3', note: 'Typical adult female range' },
  { label: 'Obese', min: 32, max: Infinity, tone: 'bg-chart-4' },
]

/** US Navy circumference method — all inputs in centimetres. */
function navyBodyFat(sex: Sex, waistCm: number, neckCm: number, hipCm: number, heightCm: number): number {
  if (sex === 'male') {
    const d = waistCm - neckCm
    if (d <= 0 || heightCm <= 0) return NaN
    return 495 / (1.0324 - 0.19077 * Math.log10(d) + 0.15456 * Math.log10(heightCm)) - 450
  }
  const d = waistCm + hipCm - neckCm
  if (d <= 0 || heightCm <= 0) return NaN
  return 495 / (1.29579 - 0.35004 * Math.log10(d) + 0.221 * Math.log10(heightCm)) - 450
}

/** Deurenberg BMI-based estimate. */
function bmiBodyFat(sex: Sex, bmi: number, age: number): number {
  if (!Number.isFinite(bmi)) return NaN
  return 1.2 * bmi + 0.23 * age - 10.8 * (sex === 'male' ? 1 : 0) - 5.4
}

export default function BodyFatCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [sex, setSex] = useState<Sex>('male')
  const [cm, setCm] = useState(178)
  const [kg, setKg] = useState(80)
  const [age, setAge] = useState(30)
  const [waist, setWaist] = useState(88)
  const [neck, setNeck] = useState(38)
  const [hip, setHip] = useState(96)

  const metric = units === 'metric'
  const bands = sex === 'male' ? MALE_BANDS : FEMALE_BANDS
  const baseValid = cm >= 90 && cm <= 260 && kg > 0 && age >= 15 && age <= 100

  const navyReady =
    baseValid && waist > 0 && neck > 0 && (sex === 'female' ? hip > 0 : true) &&
    (sex === 'male' ? waist > neck : waist + hip > neck)

  const navyRaw = useMemo(
    () => (navyReady ? navyBodyFat(sex, waist, neck, hip, cm) : NaN),
    [navyReady, sex, waist, neck, hip, cm],
  )
  // Outside 2–75% the formula is extrapolating from implausible measurements.
  const navyImplausible = Number.isFinite(navyRaw) && (navyRaw < 2 || navyRaw > 75)
  const navy = navyImplausible ? NaN : navyRaw
  const bmi = bmiOf(kg, cm)
  const deurenberg = baseValid ? bmiBodyFat(sex, bmi, age) : NaN

  const primary = Number.isFinite(navy) ? navy : deurenberg
  const band = bandFor(bands, primary)
  const fatMass = kg * (primary / 100)
  const leanMass = kg - fatMass
  const whtr = cm > 0 ? waist / cm : NaN
  const bmrLean = Number.isFinite(primary) ? katchMcArdle(kg, primary) : NaN

  const showMass = (v: number) => (metric ? `${fmt(v, 1)} kg` : `${fmt(kgToLb(v), 1)} lb`)
  const showLen = (v: number) => (metric ? `${fmt(v, 1)} cm` : `${fmt(cmToIn(v), 1)} in`)

  const summary = Number.isFinite(primary)
    ? [
        Number.isFinite(navy) ? `US Navy method: ${fmt(navy, 1)}% body fat` : '',
        Number.isFinite(deurenberg) ? `BMI (Deurenberg) method: ${fmt(deurenberg, 1)}% body fat` : '',
        `Category: ${band?.label ?? '–'} (${sex === 'male' ? 'men' : 'women'})`,
        `Fat mass: ${showMass(fatMass)}`,
        `Lean body mass: ${showMass(leanMass)}`,
        `Waist-to-height ratio: ${fmt(whtr, 2)}`,
        '',
        'Calculated at onthisdevice.com/body-fat-calculator',
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  return (
    <CalcLayout
      inputs={
        <ToolPanel
          title="Measurements"
          description="Measure first thing in the morning, before eating, tape snug but not compressing."
        >
          <div className="space-y-4">
            <UnitToggle units={units} onChange={setUnits} className="max-w-none" />
            <SexToggle sex={sex} onChange={setSex} />
            <HeightField id="bf-height" cm={cm} onChange={setCm} units={units} />
            <WeightField id="bf-weight" kg={kg} onChange={setKg} units={units} />
            <NumberField
              id="bf-age"
              label="Age"
              value={age}
              onChange={setAge}
              unit="years"
              min={15}
              max={100}
              dp={0}
              hint="Used by the BMI-based method only."
            />
            <LengthField
              id="bf-neck"
              label="Neck circumference"
              cm={neck}
              onChange={setNeck}
              units={units}
              hint="Just below the larynx, tape sloping slightly downward at the front."
            />
            <LengthField
              id="bf-waist"
              label="Waist circumference"
              cm={waist}
              onChange={setWaist}
              units={units}
              hint={
                sex === 'male'
                  ? 'At the navel, relaxed, at the end of a normal breath out.'
                  : 'At the narrowest point of the torso, usually just above the navel.'
              }
            />
            {sex === 'female' ? (
              <LengthField
                id="bf-hip"
                label="Hip circumference"
                cm={hip}
                onChange={setHip}
                units={units}
                hint="At the widest point of the buttocks, feet together."
              />
            ) : null}

            {navyImplausible ? (
              <p role="alert" className="text-sm text-destructive">
                These measurements give {fmt(navyRaw, 1)}%, which is not a possible body fat
                figure. Check the neck, waist{sex === 'female' ? ', hip' : ''} and height values.
              </p>
            ) : null}

            {baseValid && !navyReady ? (
              <p role="alert" className="text-sm text-destructive">
                {sex === 'male'
                  ? 'Waist must be larger than neck for the Navy formula to work. Check both measurements.'
                  : 'Waist plus hip must be larger than neck for the Navy formula to work. Check the measurements.'}
              </p>
            ) : null}

            <EstimateNote>
              Circumference methods estimate body fat, they do not measure it. Compared with a DEXA
              scan they are typically within 3 to 4 percentage points. Their real value is tracking
              change over weeks when you measure the same way each time.
            </EstimateNote>
          </div>
        </ToolPanel>
      }
      results={
        Number.isFinite(primary) ? (
          <>
            <ToolPanel
              title="Body fat estimate"
              footer={<CopyButton value={summary} label="Copy results" />}
            >
              <div className="space-y-5">
                <StatGrid cols={3}>
                  <ResultStat
                    label="US Navy method"
                    value={Number.isFinite(navy) ? `${fmt(navy, 1)}%` : '–'}
                    hint={Number.isFinite(navy) ? 'circumference-based, the more reliable of the two' : 'add neck and waist measurements'}
                    emphasis
                  />
                  <ResultStat
                    label="BMI method"
                    value={Number.isFinite(deurenberg) ? `${fmt(deurenberg, 1)}%` : '–'}
                    hint="Deurenberg equation from BMI, age and sex"
                  />
                  <ResultStat label="Category" value={band?.label ?? '–'} hint={`ACE bands for ${sex === 'male' ? 'men' : 'women'}`} />
                  <ResultStat label="Fat mass" value={showMass(fatMass)} hint={`${fmt(primary, 1)}% of ${showMass(kg)}`} />
                  <ResultStat label="Lean body mass" value={showMass(leanMass)} hint="muscle, bone, organs, water" />
                  <ResultStat
                    label="Waist-to-height ratio"
                    value={fmt(whtr, 2)}
                    hint={whtr < 0.5 ? 'under 0.5: the low-risk zone' : 'above 0.5: worth keeping an eye on'}
                  />
                </StatGrid>

                <div>
                  <h3 className="text-sm font-semibold">Where you sit</h3>
                  <div
                    className="mt-2 flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
                    role="img"
                    aria-label={`Body fat of ${fmt(primary, 1)} percent falls in the ${band?.label ?? 'unknown'} band.`}
                  >
                    {bands.map((b) => {
                      const upper = Number.isFinite(b.max) ? b.max : 45
                      const lower = b.min
                      return (
                        <div
                          key={b.label}
                          className={band && band.label === b.label ? 'bg-chart-1' : 'bg-chart-5'}
                          style={{ width: `${((upper - lower) / 45) * 100}%` }}
                        />
                      )
                    })}
                  </div>
                  <div className="relative mt-1 h-4">
                    <span
                      className="absolute -translate-x-1/2 text-xs font-semibold tabular-nums"
                      style={{ left: `${Math.min(98, Math.max(2, (primary / 45) * 100))}%` }}
                    >
                      ▲ {fmt(primary, 1)}%
                    </span>
                  </div>
                </div>
              </div>
            </ToolPanel>

            <FormulaBlock
              lines={[
                ...(Number.isFinite(navy)
                  ? [
                      {
                        label: 'US Navy',
                        expr:
                          sex === 'male'
                            ? '495 ÷ (1.0324 − 0.19077·log₁₀(waist − neck) + 0.15456·log₁₀(height)) − 450'
                            : '495 ÷ (1.29579 − 0.35004·log₁₀(waist + hip − neck) + 0.22100·log₁₀(height)) − 450',
                      },
                      {
                        expr:
                          sex === 'male'
                            ? `waist − neck = ${fmt(waist, 1)} − ${fmt(neck, 1)} = ${fmt(waist - neck, 1)} cm, height = ${fmt(cm, 1)} cm`
                            : `waist + hip − neck = ${fmt(waist, 1)} + ${fmt(hip, 1)} − ${fmt(neck, 1)} = ${fmt(waist + hip - neck, 1)} cm, height = ${fmt(cm, 1)} cm`,
                        result: `${fmt(navy, 1)}%`,
                      },
                    ]
                  : []),
                { label: 'BMI method', expr: '(1.20 × BMI) + (0.23 × age) − (10.8 × sex) − 5.4' },
                {
                  expr: `(1.20 × ${fmt(bmi, 1)}) + (0.23 × ${age}) − (10.8 × ${sex === 'male' ? 1 : 0}) − 5.4`,
                  result: `${fmt(deurenberg, 1)}%`,
                },
                {
                  label: 'Fat mass',
                  expr: `${fmt(kg, 1)} kg × ${fmt(primary, 1)}%`,
                  result: showMass(fatMass),
                },
                {
                  label: 'Lean mass',
                  expr: `${fmt(kg, 1)} kg − ${fmt(fatMass, 1)} kg`,
                  result: showMass(leanMass),
                },
              ]}
              note="The Navy equations are defined in centimetres; imperial measurements are converted before the logarithms are taken, so both unit systems give the same answer."
            />

            <Interpretation>
              <p>
                <strong>
                  About {fmt(primary, 1)} percent of your body weight is fat: roughly{' '}
                  {showMass(fatMass)} of fat and {showMass(leanMass)} of lean mass.
                </strong>{' '}
                That puts you in the &ldquo;{band?.label}&rdquo; band for{' '}
                {sex === 'male' ? 'men' : 'women'}.
              </p>
              {Number.isFinite(navy) && Number.isFinite(deurenberg) ? (
                <p>
                  The two methods differ by {fmt(Math.abs(navy - deurenberg), 1)} percentage points.
                  That gap is informative: the BMI method only sees height, weight, age and sex, so
                  it reads muscle as fat. If the Navy figure is the lower one, you carry more muscle
                  than average for your weight.
                </p>
              ) : null}
              <p>
                Your waist-to-height ratio is {fmt(whtr, 2)}: {showLen(waist)} of waist
                against {showLen(cm)} of height. Keeping it under 0.5 is one of the simplest and
                best-supported markers of metabolic health, and it works across heights and builds
                where BMI does not.
              </p>
              <p>
                Knowing your lean mass also unlocks the Katch-McArdle equation: it puts your basal
                metabolic rate at about {kcal(bmrLean)} a day.
              </p>
            </Interpretation>

            <BandTable
              bands={bands}
              active={band?.label}
              unit="%"
              head="Body fat"
              caption={`American Council on Exercise body fat categories for ${sex === 'male' ? 'men' : 'women'}.`}
              dp={0}
            />
          </>
        ) : (
          <EmptyState message="Enter your height, weight and tape measurements to estimate body fat with both methods." />
        )
      }
    />
  )
}
