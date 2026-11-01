import { useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import {
  CalcLayout,
  EmptyState,
  EstimateNote,
  FormulaBlock,
  HeightField,
  Interpretation,
  Segmented,
  SexToggle,
  StatGrid,
  UnitToggle,
  WeightField,
  bmiOf,
  cmToIn,
  feetInches,
  fmt,
  kgToLb,
  useUnitSystem,
  type Sex,
} from './common'

type Frame = 'small' | 'medium' | 'large'

interface FormulaResult {
  id: string
  name: string
  year: string
  kg: number
  expr: string
  blurb: string
}

const FRAME_FACTOR: Record<Frame, number> = { small: 0.9, medium: 1, large: 1.1 }

export default function IdealWeightCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [sex, setSex] = useState<Sex>('female')
  const [cm, setCm] = useState(168)
  const [kg, setKg] = useState(68)
  const [frame, setFrame] = useState<Frame>('medium')

  const metric = units === 'metric'
  const valid = cm >= 120 && cm <= 260
  const inchesOver5ft = cmToIn(cm) - 60
  const over = fmt(inchesOver5ft, 1)

  const results = useMemo<FormulaResult[]>(() => {
    if (!valid) return []
    const x = inchesOver5ft
    const male = sex === 'male'
    return [
      {
        id: 'devine',
        name: 'Devine',
        year: '1974',
        kg: (male ? 50 : 45.5) + 2.3 * x,
        expr: `${male ? '50.0' : '45.5'} kg + (2.3 × ${over} in over 5 ft)`,
        blurb:
          'Written for gentamicin dosing and still the standard in clinical pharmacy. The most widely quoted of the four.',
      },
      {
        id: 'robinson',
        name: 'Robinson',
        year: '1983',
        kg: (male ? 52 : 49) + (male ? 1.9 : 1.7) * x,
        expr: `${male ? '52.0' : '49.0'} kg + (${male ? '1.9' : '1.7'} × ${over} in over 5 ft)`,
        blurb:
          'A re-fit of the Devine data against the Metropolitan Life tables. Reads lower than Devine at tall heights.',
      },
      {
        id: 'miller',
        name: 'Miller',
        year: '1983',
        kg: (male ? 56.2 : 53.1) + (male ? 1.41 : 1.36) * x,
        expr: `${male ? '56.2' : '53.1'} kg + (${male ? '1.41' : '1.36'} × ${over} in over 5 ft)`,
        blurb:
          'The flattest gradient of the four: it adds least per inch, so it is the most generous for short people and the most conservative for tall ones.',
      },
      {
        id: 'hamwi',
        name: 'Hamwi',
        year: '1964',
        kg: (male ? 48 : 45.5) + (male ? 2.7 : 2.2) * x,
        expr: `${male ? '48.0' : '45.5'} kg + (${male ? '2.7' : '2.2'} × ${over} in over 5 ft)`,
        blurb:
          'The bedside rule dietitians learned: 106 lb for the first 5 ft plus 6 lb an inch for men, 100 lb plus 5 lb an inch for women. Allows ±10% for frame size.',
      },
    ]
  }, [valid, inchesOver5ft, sex, over])

  const m = cm / 100
  const bmiLow = 18.5 * m * m
  const bmiHigh = 24.9 * m * m
  const mean = results.length ? results.reduce((s, r) => s + r.kg, 0) / results.length : NaN
  const lo = results.length ? Math.min(...results.map((r) => r.kg)) : NaN
  const hi = results.length ? Math.max(...results.map((r) => r.kg)) : NaN
  const hamwi = results.find((r) => r.id === 'hamwi')
  const frameAdjusted = hamwi ? hamwi.kg * FRAME_FACTOR[frame] : NaN
  const currentBmi = bmiOf(kg, cm)

  const show = (v: number) => (metric ? `${fmt(v, 1)} kg` : `${fmt(kgToLb(v), 1)} lb`)
  const diff = kg > 0 && Number.isFinite(mean) ? kg - mean : NaN

  const chartMin = Math.min(lo, bmiLow, kg > 0 ? kg : lo) * 0.94
  const chartMax = Math.max(hi, bmiHigh, kg > 0 ? kg : hi) * 1.06
  const pos = (v: number) => ((v - chartMin) / (chartMax - chartMin)) * 100

  const summary = results.length
    ? [
        `Height: ${metric ? `${fmt(cm, 1)} cm` : `${feetInches(cm).ft} ft ${fmt(feetInches(cm).inch, 1)} in`} (${sex})`,
        '',
        ...results.map((r) => `${r.name} (${r.year}): ${show(r.kg)}`),
        `Average of the four: ${show(mean)}`,
        `Hamwi adjusted for a ${frame} frame: ${show(frameAdjusted)}`,
        `Healthy BMI range (18.5–24.9): ${show(bmiLow)} – ${show(bmiHigh)}`,
        kg > 0 ? `Current weight: ${show(kg)} (BMI ${fmt(currentBmi, 1)})` : '',
        '',
        'Calculated at onthisdevice.com/ideal-weight-calculator',
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  return (
    <CalcLayout
      inputs={
        <ToolPanel title="Your height">
          <div className="space-y-4">
            <UnitToggle units={units} onChange={setUnits} className="max-w-none" />
            <SexToggle sex={sex} onChange={setSex} />
            <HeightField id="iw-height" cm={cm} onChange={setCm} units={units} />
            <WeightField
              id="iw-weight"
              kg={kg}
              onChange={setKg}
              units={units}
              label="Current weight (optional)"
              hint="Only used to show how far you are from each estimate."
            />
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Frame size</span>
              <Segmented
                label="Frame size"
                value={frame}
                onChange={setFrame}
                options={[
                  { value: 'small', label: 'Small' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'large', label: 'Large' },
                ]}
              />
              <p className="text-xs text-muted-foreground">
                Applies the Hamwi ±10% frame allowance. Quick check: wrap your thumb and middle
                finger around the opposite wrist. Overlapping fingers suggest a small frame, and fingers that do not touch suggest
                a large one.
              </p>
            </div>
            {cm > 0 && cm < 152.4 ? (
              <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  All four formulas are anchored at 5 ft and subtract below that, so they
                  under-predict for shorter adults. Trust the healthy BMI range more than the formula
                  numbers here.
                </span>
              </p>
            ) : null}
            <EstimateNote>
              These equations were designed for medication dosing and ventilator settings, not for
              setting a personal goal weight. There is no single correct weight for a given height.
            </EstimateNote>
          </div>
        </ToolPanel>
      }
      results={
        results.length ? (
          <>
            <ToolPanel
              title="Ideal body weight estimates"
              footer={<CopyButton value={summary} label="Copy comparison" />}
            >
              <div className="space-y-5">
                <StatGrid cols={3}>
                  <ResultStat
                    label="Average of four formulas"
                    value={show(mean)}
                    hint={`range ${show(lo)} – ${show(hi)}`}
                    emphasis
                  />
                  <ResultStat
                    label="Healthy BMI range"
                    value={`${show(bmiLow)} – ${show(bmiHigh)}`}
                    hint="BMI 18.5 – 24.9 at your height"
                  />
                  <ResultStat
                    label={`Hamwi, ${frame} frame`}
                    value={show(frameAdjusted)}
                    hint={`${frame === 'medium' ? 'no adjustment' : frame === 'small' ? '−10%' : '+10%'} on the base figure`}
                  />
                </StatGrid>

                <div>
                  <h3 className="text-sm font-semibold">All four side by side</h3>
                  <div className="mt-3 space-y-3">
                    {results.map((r) => (
                      <div key={r.id}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">
                            {r.name}{' '}
                            <span className="font-normal text-muted-foreground">({r.year})</span>
                          </span>
                          <span className="text-sm font-semibold tabular-nums">{show(r.kg)}</span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(6, pos(r.kg))}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{r.blurb}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">On one scale</h3>
                  <div className="relative mt-6 h-10">
                    <div className="absolute inset-x-0 top-4 h-2 rounded-full bg-muted" />
                    <div
                      className="absolute top-4 h-2 rounded-full bg-chart-4"
                      style={{ left: `${pos(bmiLow)}%`, width: `${pos(bmiHigh) - pos(bmiLow)}%` }}
                      aria-hidden="true"
                    />
                    {results.map((r) => (
                      <span
                        key={r.id}
                        className="absolute top-2 size-6 -translate-x-1/2 rounded-full border-2 border-background bg-primary text-[9px] leading-5 font-bold text-primary-foreground"
                        style={{ left: `${pos(r.kg)}%` }}
                        title={`${r.name}: ${show(r.kg)}`}
                      >
                        <span className="block text-center">{r.name.charAt(0)}</span>
                      </span>
                    ))}
                    {kg > 0 ? (
                      <span
                        className="absolute -top-4 -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap"
                        style={{ left: `${Math.min(96, Math.max(4, pos(kg)))}%` }}
                      >
                        you · {show(kg)}
                        <span aria-hidden="true" className="block text-center">
                          ▼
                        </span>
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Grey band = the healthy BMI range. D = Devine, R = Robinson, M = Miller, H =
                    Hamwi.
                  </p>
                </div>
              </div>
            </ToolPanel>

            <FormulaBlock
              lines={[
                {
                  label: 'Height over 5 ft',
                  expr: `${fmt(cmToIn(cm), 1)} in − 60 in`,
                  result: `${over} in`,
                },
                ...results.map((r) => ({
                  label: r.name,
                  expr: r.expr,
                  result: show(r.kg),
                })),
                {
                  label: 'Healthy BMI range',
                  expr: `18.5 × ${fmt(m * m, 3)} m² to 24.9 × ${fmt(m * m, 3)} m²`,
                  result: `${show(bmiLow)} – ${show(bmiHigh)}`,
                },
              ]}
              note="Every formula uses the same shape: a base weight at 5 ft, plus a fixed amount per inch above it. They differ only in the base and the gradient."
            />

            <Interpretation>
              <p>
                <strong>
                  The four formulas cluster between {show(lo)} and {show(hi)}, averaging {show(mean)}
                  .
                </strong>{' '}
                The healthy BMI range for your height is wider: {show(bmiLow)} to {show(bmiHigh)}.
                That width is the honest answer: a {show(bmiLow)} and a {show(bmiHigh)} version of
                you can both be healthy.
              </p>
              {kg > 0 && Number.isFinite(diff) ? (
                <p>
                  At {show(kg)} you are{' '}
                  {Math.abs(diff) < 0.5 ? (
                    <strong>essentially on the average estimate</strong>
                  ) : (
                    <>
                      <strong>
                        {show(Math.abs(diff))} {diff > 0 ? 'above' : 'below'}
                      </strong>{' '}
                      it
                    </>
                  )}
                  , with a BMI of {fmt(currentBmi, 1)}.
                  {currentBmi >= 18.5 && currentBmi < 25
                    ? ' That is already inside the healthy BMI range.'
                    : ''}
                </p>
              ) : null}
              <p>
                None of these formulas know anything about muscle. A lifter can sit well above every
                line on this page and be leaner than someone sitting on it. Use the range as a
                sanity check, then judge progress with a tape measure and how your training is
                going.
              </p>
            </Interpretation>
          </>
        ) : (
          <EmptyState message="Enter a height to compare the Devine, Robinson, Miller and Hamwi formulas against the healthy BMI range." />
        )
      }
    />
  )
}
