import { useState } from 'react'
import { Gauge } from '@/components/viz'
import { HeightField, LengthField, SexToggle, UnitToggle, cmToIn, useUnitSystem, type Sex } from '@/components/tools/health/common'
import { waistToHip, whrBands } from './body-math'
import { Assumptions, CalcGrid, Formula, Headline, ResultPanel, Stats, num } from './mb-ui'
import type { FormulaItem } from './mb-ui'

const MIN = 0.6
const MAX = 1.2
/** WHO cut-off for substantially increased risk of metabolic complications. */
const WHO_CUTOFF: Record<Sex, number> = { male: 0.9, female: 0.85 }
const WHTR_CUTOFF = 0.5

/** Band edges are set half a step up (0.955) so a ratio rounded to 2 decimals lands in the right band. Show the rounded edge. */
const edge = (v: number) => num(Math.floor(v * 100 + 1e-9) / 100, 2)
/** The first 2-decimal ratio above an edge (0.955 gives 0.96). */
const after = (v: number) => num(Math.ceil(v * 100 - 1e-9) / 100, 2)

export default function WaistToHipRatioCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [sex, setSex] = useState<Sex>('male')
  const [waist, setWaist] = useState(86)
  const [hip, setHip] = useState(100)
  const [height, setHeight] = useState(0)

  const metric = units === 'metric'
  const len = (cm: number) => (metric ? `${num(cm, 1)} cm` : `${num(cmToIn(cm), 1)} in`)
  const ok = waist > 20 && hip > 20 && waist < 300 && hip < 300
  const whr = ok ? waistToHip(waist, hip) : NaN
  const rounded = Math.round(whr * 100) / 100
  const bands = whrBands(sex).map((b, i, all) => (i === all.length - 1 ? { ...b, to: MAX } : b))
  const band = bands.find((b) => rounded < b.to) ?? bands[bands.length - 1]!
  const who = WHO_CUTOFF[sex]
  const overWho = rounded >= who
  const hasHeight = height >= 100 && height <= 250
  const whtr = ok && hasHeight ? waist / height : NaN
  const people = sex === 'male' ? 'men' : 'women'
  const lowTo = bands[0]?.to ?? 0
  const modTo = bands[1]?.to ?? 0

  const working: FormulaItem[] = [
    { label: 'Waist-to-hip ratio', general: 'WHR = waist ÷ hip', steps: [`WHR = ${num(waist, 1)} ÷ ${num(hip, 1)} (cm)`], result: num(whr, 3) },
  ]
  if (hasHeight) {
    working.push({ label: 'Waist-to-height ratio', general: 'WHtR = waist ÷ height', steps: [`WHtR = ${num(waist, 1)} ÷ ${num(height, 1)} (cm)`], result: num(whtr, 3) })
  }

  return (
    <CalcGrid
      inputs={
        <>
          <UnitToggle units={units} onChange={setUnits} className="max-w-none" />
          <SexToggle sex={sex} onChange={setSex} hint="Men and women have different cut-offs." />
          <LengthField id="whr-waist" label="Waist" cm={waist} onChange={setWaist} units={units} hint="Midway between the lowest rib and the top of the hip bone, after a normal breath out." />
          <LengthField id="whr-hip" label="Hip" cm={hip} onChange={setHip} units={units} hint="Around the widest part of the buttocks, feet together." />
          <HeightField id="whr-height" label="Height (optional)" cm={height} onChange={setHeight} units={units} />
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Waist-to-hip ratio"
            value={whr}
            format={(n) => num(n, 2)}
            hint={ok ? `${band.label} for ${people}. Waist ${len(waist)} ÷ hip ${len(hip)}.` : 'Enter a waist and a hip measurement.'}
          />
          <Stats
            items={[
              { label: 'Risk band', value: ok ? band.label : '–' },
              {
                label: `WHO cut-off ${num(who, 2)}`,
                value: ok ? (overWho ? 'At or above' : 'Below') : '–',
                hint: ok ? (overWho ? 'substantially higher risk' : 'not in the higher-risk group') : undefined,
              },
              {
                label: 'Waist-to-height',
                value: Number.isFinite(whtr) ? num(whtr, 2) : '–',
                hint: Number.isFinite(whtr) ? (whtr < WHTR_CUTOFF ? 'under the 0.5 cut-off' : 'at or above 0.5') : 'add your height',
              },
            ]}
          />
          {ok ? (
            <Gauge
              value={rounded}
              min={MIN}
              max={MAX}
              bands={bands}
              formatValue={edge}
              ariaLabel={`Waist-to-hip scale from ${num(MIN, 1)} to ${num(MAX, 1)}. Your ratio ${num(rounded, 2)} is in the ${band.label.toLowerCase()} band.`}
              center={
                <p className="text-sm text-muted-foreground">
                  Your ratio <span className="font-[650] text-foreground">{num(rounded, 2)}</span>
                </p>
              }
              summary={`For ${people}: ${edge(lowTo)} or less is low risk, ${after(lowTo)} to ${edge(modTo)} is moderate and above ${edge(modTo)} is high. Your ${num(rounded, 2)} is ${band.label.toLowerCase()}.`}
            />
          ) : null}
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <Formula items={working} note="Both ratios have no unit, so inches give the same result as centimetres." />
          <Assumptions
            title="Limits"
            items={[
              'A screening measure of where fat sits on the body. It does not diagnose a disease.',
              'The cut-offs come from studies of mostly white European adults. For some Asian groups, risk starts at a lower ratio.',
              'It is not valid during pregnancy or for children.',
              'A small change in where you put the tape changes the result. Measure the same way each time.',
            ]}
          />
        </div>
      }
    />
  )
}
