import { useMemo, useState } from 'react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Label } from '@/components/ui/label'
import {
  CalcLayout,
  EmptyState,
  EstimateNote,
  FormulaBlock,
  Interpretation,
  KM_PER_MI,
  NumberField,
  Segmented,
  StatGrid,
  UnitToggle,
  fmt,
  hms,
  useUnitSystem,
} from './common'

type SolveFor = 'pace' | 'time' | 'distance'

interface Preset {
  id: string
  label: string
  meters: number
}

const PRESETS: Preset[] = [
  { id: '1k', label: '1 km', meters: 1000 },
  { id: 'mile', label: '1 mile', meters: 1609.344 },
  { id: '5k', label: '5K', meters: 5000 },
  { id: '10k', label: '10K', meters: 10000 },
  { id: '10mi', label: '10 miles', meters: 16093.44 },
  { id: 'half', label: 'Half marathon', meters: 21097.5 },
  { id: 'marathon', label: 'Marathon', meters: 42195 },
  { id: '50k', label: '50K ultra', meters: 50000 },
  { id: 'custom', label: 'Custom distance', meters: 0 },
]

const EQUIVALENTS = ['5k', '10k', 'half', 'marathon'] as const

/** Riegel: T2 = T1 × (D2 ÷ D1)^1.06 */
function riegel(t1: number, d1: number, d2: number): number {
  if (!(d1 > 0) || !(t1 > 0)) return NaN
  return t1 * Math.pow(d2 / d1, 1.06)
}

export default function PaceCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [solveFor, setSolveFor] = useState<SolveFor>('pace')
  const [presetId, setPresetId] = useState('10k')
  const [customDist, setCustomDist] = useState(8)
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(50)
  const [seconds, setSeconds] = useState(0)
  const [paceMin, setPaceMin] = useState(5)
  const [paceSec, setPaceSec] = useState(0)

  const metric = units === 'metric'
  const unitLabel = metric ? 'km' : 'mi'
  const metersPerUnit = metric ? 1000 : 1609.344
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[3]

  const inputDistanceM = presetId === 'custom' ? customDist * metersPerUnit : preset.meters
  const inputTimeSec = hours * 3600 + minutes * 60 + seconds
  const inputPacePerUnit = paceMin * 60 + paceSec

  const { distanceM, timeSec, pacePerUnit, error } = useMemo(() => {
    if (solveFor === 'pace') {
      if (!(inputDistanceM > 0)) return { distanceM: 0, timeSec: 0, pacePerUnit: 0, error: 'Enter a distance greater than zero.' }
      if (!(inputTimeSec > 0)) return { distanceM: 0, timeSec: 0, pacePerUnit: 0, error: 'Enter a finish time.' }
      const unitsRun = inputDistanceM / metersPerUnit
      return {
        distanceM: inputDistanceM,
        timeSec: inputTimeSec,
        pacePerUnit: inputTimeSec / unitsRun,
        error: null,
      }
    }
    if (solveFor === 'time') {
      if (!(inputDistanceM > 0)) return { distanceM: 0, timeSec: 0, pacePerUnit: 0, error: 'Enter a distance greater than zero.' }
      if (!(inputPacePerUnit > 0)) return { distanceM: 0, timeSec: 0, pacePerUnit: 0, error: 'Enter a target pace.' }
      const unitsRun = inputDistanceM / metersPerUnit
      return {
        distanceM: inputDistanceM,
        timeSec: inputPacePerUnit * unitsRun,
        pacePerUnit: inputPacePerUnit,
        error: null,
      }
    }
    if (!(inputTimeSec > 0)) return { distanceM: 0, timeSec: 0, pacePerUnit: 0, error: 'Enter how long you ran for.' }
    if (!(inputPacePerUnit > 0)) return { distanceM: 0, timeSec: 0, pacePerUnit: 0, error: 'Enter the pace you held.' }
    return {
      distanceM: (inputTimeSec / inputPacePerUnit) * metersPerUnit,
      timeSec: inputTimeSec,
      pacePerUnit: inputPacePerUnit,
      error: null,
    }
  }, [solveFor, inputDistanceM, inputTimeSec, inputPacePerUnit, metersPerUnit])

  const ok = !error && distanceM > 0 && timeSec > 0 && pacePerUnit > 0
  const paceSecPerKm = ok ? (timeSec / distanceM) * 1000 : NaN
  const paceSecPerMi = paceSecPerKm * KM_PER_MI
  const kmh = ok ? distanceM / 1000 / (timeSec / 3600) : NaN
  const mph = kmh / KM_PER_MI
  const distanceUnits = distanceM / metersPerUnit

  const splits = useMemo(() => {
    if (!ok) return []
    const full = Math.floor(distanceUnits + 1e-9)
    const rows: { label: string; cumulative: number; split: number }[] = []
    const limit = Math.min(full, 60)
    for (let i = 1; i <= limit; i++) {
      rows.push({ label: `${i} ${unitLabel}`, cumulative: pacePerUnit * i, split: pacePerUnit })
    }
    const remainder = distanceUnits - full
    if (remainder > 0.01 && full <= 60) {
      rows.push({
        label: `${fmt(distanceUnits, 2)} ${unitLabel} (finish)`,
        cumulative: timeSec,
        split: pacePerUnit * remainder,
      })
    }
    return rows
  }, [ok, distanceUnits, pacePerUnit, unitLabel, timeSec])

  const equivalents = useMemo(() => {
    if (!ok) return []
    return EQUIVALENTS.map((id) => {
      const p = PRESETS.find((x) => x.id === id)!
      const t = riegel(timeSec, distanceM, p.meters)
      return {
        label: p.label,
        seconds: t,
        pacePerKm: (t / p.meters) * 1000,
      }
    })
  }, [ok, timeSec, distanceM])

  const summary = ok
    ? [
        `Distance: ${fmt(distanceM / 1000, 3)} km (${fmt(distanceM / 1609.344, 3)} miles)`,
        `Time: ${hms(timeSec, true)}`,
        `Pace: ${hms(paceSecPerKm)} /km · ${hms(paceSecPerMi)} /mile`,
        `Speed: ${fmt(kmh, 2)} km/h · ${fmt(mph, 2)} mph`,
        '',
        `Splits (${unitLabel}):`,
        ...splits.map((s) => `  ${s.label}: ${hms(s.cumulative, true)}`),
        '',
        'Equivalent race times (Riegel):',
        ...equivalents.map((e) => `  ${e.label}: ${hms(e.seconds, true)} (${hms(e.pacePerKm)} /km)`),
        '',
        'Calculated at onthisdevice.com/pace-calculator',
      ].join('\n')
    : ''

  return (
    <CalcLayout
      inputs={
        <ToolPanel title="What do you want to work out?">
          <div className="space-y-4">
            <UnitToggle units={units} onChange={setUnits} className="max-w-none" />
            <Segmented
              label="Solve for"
              value={solveFor}
              onChange={setSolveFor}
              options={[
                { value: 'pace', label: 'Pace' },
                { value: 'time', label: 'Finish time' },
                { value: 'distance', label: 'Distance' },
              ]}
            />

            {solveFor !== 'distance' ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pace-distance">Distance</Label>
                  <select
                    id="pace-distance"
                    value={presetId}
                    onChange={(e) => setPresetId(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                        {p.meters
                          ? ` (${metric ? `${fmt(p.meters / 1000, 3)} km` : `${fmt(p.meters / 1609.344, 3)} mi`})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {presetId === 'custom' ? (
                  <NumberField
                    id="pace-custom"
                    label="Custom distance"
                    value={customDist}
                    onChange={setCustomDist}
                    unit={unitLabel}
                    min={0}
                    step={0.1}
                    dp={3}
                  />
                ) : null}
              </div>
            ) : null}

            {solveFor !== 'time' ? (
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">
                  {solveFor === 'distance' ? 'Time you ran for' : 'Finish time'}
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  <NumberField
                    id="pace-h"
                    label="Hours"
                    value={hours}
                    onChange={setHours}
                    min={0}
                    max={99}
                    dp={0}
                  />
                  <NumberField
                    id="pace-m"
                    label="Minutes"
                    value={minutes}
                    onChange={setMinutes}
                    min={0}
                    max={59}
                    dp={0}
                  />
                  <NumberField
                    id="pace-s"
                    label="Seconds"
                    value={seconds}
                    onChange={setSeconds}
                    min={0}
                    max={59}
                    dp={0}
                  />
                </div>
              </fieldset>
            ) : null}

            {solveFor !== 'pace' ? (
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Pace per {unitLabel}</legend>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    id="pace-pmin"
                    label="Minutes"
                    value={paceMin}
                    onChange={setPaceMin}
                    min={0}
                    max={59}
                    dp={0}
                  />
                  <NumberField
                    id="pace-psec"
                    label="Seconds"
                    value={paceSec}
                    onChange={setPaceSec}
                    min={0}
                    max={59}
                    dp={0}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Switching the unit toggle changes whether this pace is per kilometre or per mile.
                </p>
              </fieldset>
            ) : null}

            <EstimateNote>
              Split tables assume an even effort on flat ground. Hills, heat, wind and altitude all
              move real times, and race predictions assume you have actually trained for the longer
              distance.
            </EstimateNote>
          </div>
        </ToolPanel>
      }
      results={
        ok ? (
          <>
            <ToolPanel
              title="Pace, speed and time"
              footer={<CopyButton value={summary} label="Copy splits" />}
            >
              <StatGrid cols={3}>
                <ResultStat
                  label={`Pace per ${unitLabel}`}
                  value={hms(metric ? paceSecPerKm : paceSecPerMi)}
                  hint={metric ? `${hms(paceSecPerMi)} per mile` : `${hms(paceSecPerKm)} per km`}
                  emphasis
                />
                <ResultStat
                  label="Finish time"
                  value={hms(timeSec, true)}
                  hint={`over ${metric ? `${fmt(distanceM / 1000, 2)} km` : `${fmt(distanceM / 1609.344, 2)} miles`}`}
                />
                <ResultStat
                  label="Speed"
                  value={metric ? `${fmt(kmh, 2)} km/h` : `${fmt(mph, 2)} mph`}
                  hint={metric ? `${fmt(mph, 2)} mph` : `${fmt(kmh, 2)} km/h`}
                />
                <ResultStat
                  label="Distance"
                  value={metric ? `${fmt(distanceM / 1000, 3)} km` : `${fmt(distanceM / 1609.344, 3)} mi`}
                  hint={metric ? `${fmt(distanceM / 1609.344, 3)} miles` : `${fmt(distanceM / 1000, 3)} km`}
                />
                <ResultStat label="Time per 400 m lap" value={hms((paceSecPerKm * 400) / 1000)} hint="track pace check" />
                <ResultStat
                  label="Distance in one hour"
                  value={metric ? `${fmt(kmh, 2)} km` : `${fmt(mph, 2)} mi`}
                  hint="at this pace, held flat"
                />
              </StatGrid>
            </ToolPanel>

            {splits.length ? (
              <ToolPanel
                title={`Split table: every ${unitLabel}`}
                description="Even pacing. Aim a few seconds slower than target for the first two splits and you will almost always finish faster."
              >
                <div className="max-h-[26rem] overflow-auto rounded-lg">
                  <table className="w-full min-w-[22rem] text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border text-left">
                        <th scope="col" className="px-3 py-2 font-medium">
                          Split
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Cumulative
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Segment
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {splits.map((s) => (
                        <tr key={s.label} className="border-b border-border last:border-0">
                          <th scope="row" className="px-3 py-1.5 text-left font-normal tabular-nums">
                            {s.label}
                          </th>
                          <td className="px-3 py-1.5 font-medium tabular-nums">
                            {hms(s.cumulative, true)}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                            {hms(s.split)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ToolPanel>
            ) : null}

            <ToolPanel
              title="Equivalent race times"
              description="What this performance predicts at other distances, using Riegel's endurance exponent of 1.06."
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[26rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Race
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Predicted time
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Pace / km
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Pace / mile
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {equivalents.map((e) => (
                      <tr key={e.label} className="border-b border-border last:border-0">
                        <th scope="row" className="py-2 pr-3 text-left font-medium">
                          {e.label}
                        </th>
                        <td className="py-2 pr-3 font-semibold tabular-nums whitespace-nowrap">
                          {hms(e.seconds, true)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                          {hms(e.pacePerKm)}
                        </td>
                        <td className="py-2 tabular-nums text-muted-foreground">
                          {hms(e.pacePerKm * KM_PER_MI)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ToolPanel>

            <FormulaBlock
              lines={[
                {
                  label: 'Pace',
                  expr: `${hms(timeSec, true)} ÷ ${fmt(distanceM / 1000, 3)} km`,
                  result: `${hms(paceSecPerKm)} per km`,
                },
                {
                  label: 'Pace conversion',
                  expr: `${hms(paceSecPerKm)} per km × 1.609344`,
                  result: `${hms(paceSecPerMi)} per mile`,
                },
                {
                  label: 'Speed',
                  expr: `${fmt(distanceM / 1000, 3)} km ÷ ${fmt(timeSec / 3600, 4)} h`,
                  result: `${fmt(kmh, 2)} km/h`,
                },
                {
                  label: 'Riegel prediction',
                  expr: 'T₂ = T₁ × (D₂ ÷ D₁)^1.06',
                },
              ]}
              note="The 1.06 exponent is what makes the prediction realistic: doubling the distance costs more than double the time, because pace has to drop."
            />

            <Interpretation>
              <p>
                <strong>
                  {hms(paceSecPerKm)} per kilometre ({hms(paceSecPerMi)} per mile) is{' '}
                  {fmt(kmh, 2)} km/h or {fmt(mph, 2)} mph.
                </strong>{' '}
                Holding it for {metric ? `${fmt(distanceM / 1000, 2)} km` : `${fmt(distanceM / 1609.344, 2)} miles`}{' '}
                gives {hms(timeSec, true)}.
              </p>
              <p>
                On the track that is {hms((paceSecPerKm * 400) / 1000)} per 400 m lap, which is the
                easiest way to check whether the pace actually feels right before you commit to it in
                a race.
              </p>
              <p>
                The equivalents above assume you have trained for the distance in question. Moving up
                from 5K to a marathon on 5K training will not deliver the predicted time. Treat the
                longer predictions as a ceiling and the shorter ones as realistic.
              </p>
            </Interpretation>
          </>
        ) : (
          <EmptyState message={error ?? 'Enter two of distance, time and pace to solve for the third.'} />
        )
      }
    />
  )
}
