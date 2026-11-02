import { useState } from 'react'
import { Gauge } from '@/components/viz'
import { NumberField } from '@/components/tools/health/common'
import { HR_ZONES, karvonen, maxHeartRate } from './body-math'
import type { MaxHrFormula } from './body-math'
import { Assumptions, CalcGrid, Field, Formula, Headline, ResultPanel, SelectField, Stats, num, numUpTo, toPositive } from './mb-ui'
import { cn } from '@/lib/utils'

type MaxMode = MaxHrFormula | 'measured'

const MODES: { value: MaxMode; label: string; general: string; name: string }[] = [
  { value: 'fox', label: 'Fox: 220 − age', general: 'HRmax = 220 − age', name: 'Fox' },
  { value: 'tanaka', label: 'Tanaka: 208 − 0.7 × age', general: 'HRmax = 208 − 0.7 × age', name: 'Tanaka' },
  { value: 'gellish', label: 'Gellish: 207 − 0.7 × age', general: 'HRmax = 207 − 0.7 × age', name: 'Gellish' },
  { value: 'measured', label: 'I know my max heart rate', general: '', name: 'measured' },
]

const isMode = (v: string): v is MaxMode => MODES.some((m) => m.value === v)

/** "Zone 3" from "Zone 3, moderate". */
const zoneName = (label: string) => label.split(',')[0] ?? label

export default function TargetHeartRateCalculator() {
  const [age, setAge] = useState(35)
  const [rest, setRest] = useState(62)
  const [mode, setMode] = useState<MaxMode>('fox')
  const [measured, setMeasured] = useState(185)
  const [intensityText, setIntensityText] = useState('70')

  const intensity = Math.min(100, toPositive(intensityText)) / 100
  const modeInfo = MODES.find((m) => m.value === mode) ?? MODES[0]!
  const maxHr = mode === 'measured' ? measured : maxHeartRate(age, mode)
  const ageOk = mode === 'measured' || (age >= 10 && age <= 100)
  const restOk = rest >= 30 && rest <= 120
  const ok = ageOk && restOk && maxHr > rest + 20 && maxHr <= 230
  const reserve = maxHr - rest
  const target = ok ? karvonen(maxHr, rest, intensity) : NaN
  const at = (f: number) => karvonen(maxHr, rest, f)
  const zone = HR_ZONES.find((z) => intensity >= z.from && intensity < z.to) ?? (intensity >= 1 ? HR_ZONES[HR_ZONES.length - 1] : undefined)
  const zoneText = zone ? zone.label.toLowerCase() : 'below zone 1'
  const pctText = `${num(intensity * 100, 0)}%`

  const error = !ageOk
    ? 'Enter an age from 10 to 100.'
    : !restOk
      ? 'Enter a resting heart rate from 30 to 120 bpm.'
      : 'The maximum heart rate must be at least 20 bpm above the resting rate and at most 230.'

  const bands = [
    { to: at(HR_ZONES[0]!.from), label: 'Under 50%' },
    ...HR_ZONES.map((z, i) => ({ to: i === HR_ZONES.length - 1 ? maxHr : at(z.to), label: zoneName(z.label) })),
  ]

  return (
    <CalcGrid
      inputs={
        <>
          <NumberField id="thr-age" label="Age" value={age} onChange={setAge} unit="years" min={10} max={100} dp={0} />
          <NumberField
            id="thr-rest"
            label="Resting heart rate"
            value={rest}
            onChange={setRest}
            unit="bpm"
            min={30}
            max={120}
            dp={0}
            hint="Count your pulse for 60 seconds after you wake up, before you get out of bed."
          />
          <SelectField id="thr-max" label="Maximum heart rate" value={mode} onChange={(v) => isMode(v) && setMode(v)} options={MODES.map(({ value, label }) => ({ value, label }))} />
          {mode === 'measured' ? (
            <NumberField
              id="thr-measured"
              label="Measured maximum heart rate"
              value={measured}
              onChange={setMeasured}
              unit="bpm"
              min={100}
              max={230}
              dp={0}
              hint="The highest rate from a maximal test or a hard race."
            />
          ) : null}
          <Field id="thr-intensity" label="Intensity" value={intensityText} onChange={setIntensityText} suffix="%" hint="of heart rate reserve" slider={{ min: 50, max: 95, step: 1 }} />
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Target heart rate"
            value={target}
            format={(n) => `${num(n, 0)} bpm`}
            hint={ok ? `${pctText} of your heart rate reserve, in ${zoneText}.` : error}
          />
          <Stats
            items={[
              { label: 'Maximum heart rate', value: ok ? `${num(maxHr, 0)} bpm` : '–', hint: mode === 'measured' ? 'measured' : `${modeInfo.name} formula` },
              { label: 'Heart rate reserve', value: ok ? `${num(reserve, 0)} bpm` : '–', hint: 'maximum minus resting' },
              { label: '10-second count', value: ok ? num(target / 6, 0) : '–', hint: 'beats in 10 seconds' },
            ]}
          />
          {ok ? (
            <Gauge
              variant="bar"
              value={target}
              min={rest}
              max={maxHr}
              bands={bands}
              formatValue={(v) => num(v, 0)}
              ariaLabel={`Heart rate scale from ${num(rest, 0)} bpm at rest to ${num(maxHr, 0)} bpm maximum. Target ${num(target, 0)} bpm, ${zoneText}.`}
              center={
                <p className="text-sm text-muted-foreground">
                  Target <span className="font-[650] text-foreground">{num(target, 0)} bpm</span>
                </p>
              }
              summary={`Your scale runs from ${num(rest, 0)} bpm at rest to ${num(maxHr, 0)} bpm at maximum. ${pctText} of the reserve is ${num(target, 0)} bpm, in ${zoneText}.`}
            />
          ) : null}
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          {ok ? (
            <ResultPanel title="Your heart rate zones">
              <div className="overflow-x-auto rounded-lg bg-background">
                <table className="w-full min-w-[22rem] border-collapse text-[0.8125rem] tabular-nums">
                  <caption className="sr-only">Heart rate zones by the Karvonen method</caption>
                  <thead>
                    <tr className="text-muted-foreground">
                      <th scope="col" className="px-3 py-2 text-left font-[560]">Zone</th>
                      <th scope="col" className="px-3 py-2 text-right font-[560]">Reserve</th>
                      <th scope="col" className="px-3 py-2 text-right font-[560]">Heart rate</th>
                      <th scope="col" className="px-3 py-2 text-left font-[560]">Use</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HR_ZONES.map((z) => {
                      const mine = zone === z
                      return (
                        <tr key={z.label} className={cn(mine ? 'font-[650] text-foreground' : 'text-muted-foreground')}>
                          <th scope="row" className="px-3 py-2 text-left font-[inherit]">
                            {zoneName(z.label)}
                            {mine ? <span className="block text-xs font-normal">your target</span> : null}
                          </th>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {num(z.from * 100, 0)}–{num(z.to * 100, 0)}%
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {num(at(z.from), 0)}–{num(at(z.to), 0)} bpm
                          </td>
                          <td className="px-3 py-2">{z.use}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </ResultPanel>
          ) : null}
          <Formula
            items={[
              mode === 'measured'
                ? { label: 'Maximum heart rate', general: 'HRmax = your measured value', result: `${num(maxHr, 0)} bpm` }
                : {
                    label: 'Maximum heart rate',
                    general: modeInfo.general,
                    steps: [modeInfo.general.replace('age', num(age, 0))],
                    result: `${numUpTo(maxHr, 1)} bpm`,
                  },
              { label: 'Heart rate reserve', general: 'HRR = HRmax − HRrest', steps: [`HRR = ${numUpTo(maxHr, 1)} − ${num(rest, 0)}`], result: `${numUpTo(reserve, 1)} bpm` },
              {
                label: 'Target heart rate (Karvonen)',
                general: 'THR = HRR × intensity + HRrest',
                steps: [`THR = ${numUpTo(reserve, 1)} × ${num(intensity, 2)} + ${num(rest, 0)}`],
                result: `${numUpTo(target, 1)} bpm`,
              },
              { label: '10-second count', general: 'count = THR ÷ 6', steps: [`count = ${numUpTo(target, 1)} ÷ 6`], result: `${num(target / 6, 1)} beats` },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'Age formulas estimate the maximum heart rate of an average person. Your true maximum can be 10 to 20 bpm higher or lower. A measured maximum gives better zones.',
              'Beta blockers and some other medicines lower the heart rate. With them, heart rate zones do not show effort well.',
              'Heat, dehydration, caffeine, stress and poor sleep raise the heart rate at the same effort.',
              'If you have a heart condition, high blood pressure or have not exercised for a long time, ask a doctor before hard exercise.',
            ]}
          />
        </div>
      }
    />
  )
}
