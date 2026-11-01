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
  StatGrid,
  UnitToggle,
  WeightField,
  bandFor,
  bmiOf,
  cmToIn,
  feetInches,
  fmt,
  kgToLb,
  useUnitSystem,
  type Band,
} from './common'

const BMI_BANDS: Band[] = [
  { label: 'Underweight', min: 0, max: 18.5, tone: 'bg-chart-2' },
  { label: 'Healthy weight', min: 18.5, max: 25, tone: 'bg-chart-5' },
  { label: 'Overweight', min: 25, max: 30, tone: 'bg-chart-3' },
  { label: 'Obesity class I', min: 30, max: 35, tone: 'bg-chart-4' },
  { label: 'Obesity class II', min: 35, max: 40, tone: 'bg-chart-1' },
  { label: 'Obesity class III', min: 40, max: Infinity, tone: 'bg-destructive' },
]

const GAUGE_MIN = 13
const GAUGE_MAX = 43
const CX = 160
const CY = 152
const R = 118
const SW = 22

function polar(t: number): { x: number; y: number } {
  const rad = ((180 + t * 180) * Math.PI) / 180
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) }
}

function tOf(bmi: number): number {
  return Math.min(1, Math.max(0, (bmi - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)))
}

function arc(from: number, to: number): string {
  const a = polar(from)
  const b = polar(to)
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}

function BmiGauge({ bmi, band }: { bmi: number; band?: Band }) {
  const stops = [GAUGE_MIN, 18.5, 25, 30, 35, 40, GAUGE_MAX]
  const t = tOf(bmi)
  const needle = polar(t)
  const inner = {
    x: CX + (R - SW) * Math.cos(((180 + t * 180) * Math.PI) / 180),
    y: CY + (R - SW) * Math.sin(((180 + t * 180) * Math.PI) / 180),
  }

  return (
    <svg
      viewBox="0 0 320 186"
      className="mx-auto w-full max-w-[24rem]"
      role="img"
      aria-label={`BMI gauge showing ${fmt(bmi, 1)}, category ${band?.label ?? 'unknown'}`}
    >
      {BMI_BANDS.map((b, i) => {
        const from = tOf(stops[i] ?? GAUGE_MIN)
        const to = tOf(stops[i + 1] ?? GAUGE_MAX)
        return (
          <path
            key={b.label}
            d={arc(from + 0.004, to - 0.004)}
            fill="none"
            strokeWidth={SW}
            strokeLinecap="butt"
            className={band && band.label === b.label ? 'stroke-chart-1' : 'stroke-chart-5'}
          />
        )
      })}

      {stops.slice(1, -1).map((s) => {
        const p = polar(tOf(s))
        const lx = CX + (R + 16) * Math.cos(((180 + tOf(s) * 180) * Math.PI) / 180)
        const ly = CY + (R + 16) * Math.sin(((180 + tOf(s) * 180) * Math.PI) / 180)
        return (
          <g key={s}>
            <circle cx={p.x} cy={p.y} r={1.6} className="fill-background" />
            <text
              x={lx}
              y={ly + 3}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {s}
            </text>
          </g>
        )
      })}

      {Number.isFinite(bmi) ? (
        <>
          <line
            x1={inner.x}
            y1={inner.y}
            x2={needle.x}
            y2={needle.y}
            strokeWidth={4}
            strokeLinecap="round"
            className="stroke-foreground"
          />
          <circle cx={CX} cy={CY} r={7} className="fill-foreground" />
          <text
            x={CX}
            y={CY - 44}
            textAnchor="middle"
            className="fill-foreground text-[38px] font-bold tabular-nums"
          >
            {fmt(bmi, 1)}
          </text>
          <text x={CX} y={CY - 24} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {band?.label ?? ''}
          </text>
        </>
      ) : (
        <text x={CX} y={CY - 30} textAnchor="middle" className="fill-muted-foreground text-[13px]">
          Enter your height and weight
        </text>
      )}
    </svg>
  )
}

const READING: Record<string, string> = {
  Underweight:
    'Your weight is below the range associated with the lowest health risk for your height. That can be normal for a naturally slight build, but persistent or unexplained low weight is worth a conversation with a doctor.',
  'Healthy weight':
    'Your weight sits inside the range associated with the lowest all-cause mortality risk for your height. Nothing here needs changing on BMI grounds alone.',
  Overweight:
    'You are above the healthy-weight band. On its own that says little, because a muscular build reads the same way. But combined with a waist over half your height it is a useful nudge to look at habits.',
  'Obesity class I':
    'This band is associated with a measurably higher risk of type 2 diabetes, high blood pressure and joint problems. Losing 5 to 10 percent of body weight is enough to move most of those markers meaningfully.',
  'Obesity class II':
    'Health risk rises further in this band. A structured plan with a GP or dietitian tends to work far better than going it alone, and modest, sustained loss still delivers most of the benefit.',
  'Obesity class III':
    'This band carries the highest statistical risk in the BMI scale. It is worth getting proper medical support. The options available today go well beyond diet advice.',
}

export default function BmiCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [cm, setCm] = useState(175)
  const [kg, setKg] = useState(72)

  const bmi = useMemo(() => bmiOf(kg, cm), [kg, cm])
  const band = bandFor(BMI_BANDS, bmi)
  const valid = Number.isFinite(bmi) && cm >= 90 && cm <= 260 && kg > 0

  const m = cm / 100
  const lowKg = 18.5 * m * m
  const highKg = 24.9 * m * m
  const metric = units === 'metric'
  const w = (v: number) => (metric ? `${fmt(v, 1)} kg` : `${fmt(kgToLb(v), 1)} lb`)
  const delta = kg < lowKg ? lowKg - kg : kg > highKg ? kg - highKg : 0

  const summary = valid
    ? [
        `BMI: ${fmt(bmi, 1)} (${band?.label ?? ''})`,
        `Height: ${metric ? `${fmt(cm, 1)} cm` : `${feetInches(cm).ft} ft ${fmt(feetInches(cm).inch, 1)} in`}`,
        `Weight: ${w(kg)}`,
        `Healthy weight range for this height: ${w(lowKg)} – ${w(highKg)}`,
        `BMI Prime: ${fmt(bmi / 25, 2)}`,
        '',
        'Calculated at onthisdevice.com/bmi-calculator',
      ].join('\n')
    : ''

  return (
    <div className="space-y-6">
      <CalcLayout
        inputs={
          <ToolPanel title="Your measurements" description="Everything updates as you type.">
            <div className="space-y-4">
              <UnitToggle units={units} onChange={setUnits} className="max-w-none" />
              <HeightField id="bmi-height" cm={cm} onChange={setCm} units={units} />
              <WeightField id="bmi-weight" kg={kg} onChange={setKg} units={units} />
              {cm > 0 && (cm < 90 || cm > 260) ? (
                <p role="alert" className="text-sm text-destructive">
                  That height looks out of range. Enter a value between 90 cm (3 ft) and 260
                  cm (8 ft 6 in).
                </p>
              ) : null}
              <EstimateNote>
                BMI is a screening number for adults aged 20 and over, not a diagnosis. It is not
                valid during pregnancy or for children, who are assessed on percentile charts.
              </EstimateNote>
            </div>
          </ToolPanel>
        }
        results={
          valid ? (
            <>
              <ToolPanel
                title="Your BMI"
                footer={<CopyButton value={summary} label="Copy result" />}
              >
                <div className="space-y-5">
                  <BmiGauge bmi={bmi} band={band} />
                  <StatGrid cols={3}>
                    <ResultStat label="Body mass index" value={fmt(bmi, 1)} hint="kg/m²" emphasis />
                    <ResultStat
                      label="Category"
                      value={band?.label ?? '–'}
                      hint="WHO adult classification"
                    />
                    <ResultStat
                      label="Healthy weight range"
                      value={`${w(lowKg)} – ${w(highKg)}`}
                      hint="BMI 18.5 – 24.9 at your height"
                    />
                    <ResultStat
                      label="BMI Prime"
                      value={fmt(bmi / 25, 2)}
                      hint="your BMI ÷ 25; above 1.00 is over the healthy band"
                    />
                    <ResultStat
                      label={delta === 0 ? 'Inside the range by' : kg < lowKg ? 'To reach 18.5' : 'To reach 24.9'}
                      value={
                        delta === 0
                          ? `${w(Math.min(kg - lowKg, highKg - kg))} of headroom`
                          : `${w(delta)} to ${kg < lowKg ? 'gain' : 'lose'}`
                      }
                      hint="distance to the nearest healthy-weight boundary"
                    />
                    <ResultStat
                      label="Ponderal index"
                      value={fmt(kg / (m * m * m), 1)}
                      hint="kg/m³; scales better at very tall or short heights"
                    />
                  </StatGrid>
                </div>
              </ToolPanel>

              <FormulaBlock
                lines={[
                  { label: 'Metric', expr: 'BMI = weight (kg) ÷ height (m)²' },
                  {
                    expr: `BMI = ${fmt(kg, 1)} ÷ (${fmt(m, 3)} × ${fmt(m, 3)}) = ${fmt(kg, 1)} ÷ ${fmt(m * m, 4)}`,
                    result: fmt(bmi, 1),
                  },
                  { label: 'Imperial', expr: 'BMI = 703 × weight (lb) ÷ height (in)²' },
                  {
                    expr: `BMI = 703 × ${fmt(kgToLb(kg), 1)} ÷ ${fmt(cmToIn(cm) ** 2, 1)}`,
                    result: fmt(bmi, 1),
                  },
                  {
                    label: 'Healthy range',
                    // The multiplication is metric and yields kilograms, so in
                    // imperial mode the working has to show the kg step and the
                    // conversion — otherwise the line reads "18.5 × 3.06 = 125 lb".
                    expr: metric
                      ? `18.5 × ${fmt(m * m, 4)} to 24.9 × ${fmt(m * m, 4)}`
                      : `18.5 × ${fmt(m * m, 4)} to 24.9 × ${fmt(m * m, 4)} = ${fmt(lowKg, 1)} kg – ${fmt(highKg, 1)} kg, ÷ 0.45359237`,
                    result: `${w(lowKg)} – ${w(highKg)}`,
                  },
                ]}
                note="Both forms give the same answer. The 703 factor converts pounds and inches into kilograms and metres."
              />

              <Interpretation>
                <p>
                  <strong>
                    A BMI of {fmt(bmi, 1)} falls in the “{band?.label}” band.
                  </strong>{' '}
                  {band ? READING[band.label] : ''}
                </p>
                <p>
                  For your height, a BMI of 18.5 to 24.9 corresponds to {w(lowKg)} – {w(highKg)}.
                  {delta > 0
                    ? ` You are ${w(delta)} outside that range.`
                    : ' You are inside that range.'}
                </p>
                <p>
                  BMI knows nothing about muscle, bone density or where fat is stored. A 95 kg rower
                  and a 95 kg sedentary adult of the same height get an identical score. If you
                  train seriously with weights, check body fat percentage or waist-to-height ratio.
                  Keeping your waist under half your height is a better single indicator of
                  metabolic risk than BMI is.
                </p>
              </Interpretation>

              <BandTable
                bands={BMI_BANDS}
                active={band?.label}
                caption="World Health Organization adult BMI classification (kg/m²)."
                head="BMI"
              />
            </>
          ) : (
            <EmptyState message="Enter a height and weight to see your BMI, your category and the healthy weight range for your height." />
          )
        }
      />
    </div>
  )
}
