import { useMemo, useState } from 'react'
import { LineChart, StackedBars } from '@/components/viz'
import { KM_PER_MI, NumberField } from '@/components/tools/health/common'
import { riegel } from './body-math'
import { Assumptions, CalcGrid, Formula, Headline, Note, ResultPanel, SelectField, Stats, clock, num, numUpTo } from './mb-ui'

type RaceId = 'mile' | '5k' | '10k' | 'half' | 'marathon'

/** label: the select and table; name: inside a sentence; short: chart marker. */
const RACES: { id: RaceId; label: string; name: string; short: string; km: number }[] = [
  { id: 'mile', label: '1 mile', name: 'mile', short: 'Mile', km: KM_PER_MI },
  { id: '5k', label: '5K', name: '5K', short: '5K', km: 5 },
  { id: '10k', label: '10K', name: '10K', short: '10K', km: 10 },
  { id: 'half', label: 'Half marathon', name: 'half marathon', short: 'Half', km: 21.0975 },
  { id: 'marathon', label: 'Marathon', name: 'marathon', short: 'Marathon', km: 42.195 },
]

const raceOf = (id: string) => RACES.find((r) => r.id === id)

/** Distances for the pace chart: every km from 1 to 42, plus the race distances. */
const CHART_KM = [...new Set([...Array.from({ length: 42 }, (_, i) => i + 1), ...RACES.map((r) => r.km)])].sort((a, b) => a - b)

const km = (d: number) => `${numUpTo(d, d < 10 ? 2 : 1)} km`

/** Split points for even-pace splits: quarter miles for the mile, every km up to 10 km, then every 5 km. */
function splitPoints(d: number, isMile: boolean): { at: number; label: string }[] {
  if (isMile) return ['¼ mi', '½ mi', '¾ mi', '1 mi'].map((label, i) => ({ at: (d * (i + 1)) / 4, label }))
  const step = d <= 10 ? 1 : 5
  const out: { at: number; label: string }[] = []
  for (let a = step; a < d - 1e-9; a += step) out.push({ at: a, label: `${a} km` })
  out.push({ at: d, label: `${numUpTo(d, 1)} km` })
  return out
}

export default function RaceTimePredictor() {
  const [known, setKnown] = useState<string>('5k')
  const [customKm, setCustomKm] = useState(15)
  const [h, setH] = useState(0)
  const [m, setM] = useState(25)
  const [s, setS] = useState(0)
  const [k, setK] = useState(1.06)
  const [target, setTarget] = useState<RaceId>('half')

  const c = useMemo(() => {
    const d1 = known === 'custom' ? customKm : (raceOf(known)?.km ?? 5)
    const t1 = h * 3600 + m * 60 + s
    const exp = Math.max(1.01, Math.min(1.15, k || 1.06))
    const race = raceOf(target) ?? RACES[3]!
    const d2 = race.km
    const t2 = riegel(t1, d1, d2, exp)
    const ok = Number.isFinite(t2)
    const paceKm = t2 / d2
    const rows = RACES.map((r) => {
      const t = riegel(t1, d1, r.km, exp)
      return { ...r, t, perKm: t / r.km, perMi: (t / r.km) * KM_PER_MI }
    })
    const pace = CHART_KM.map((d) => riegel(t1, d1, d, exp) / d)
    const splits = splitPoints(d2, race.id === 'mile').map((sp, i, all) => {
      const prev = i > 0 ? all[i - 1]!.at : 0
      return { ...sp, before: prev * paceKm, split: (sp.at - prev) * paceKm }
    })
    return { d1, t1, exp, race, d2, t2, ok, paceKm, paceMi: paceKm * KM_PER_MI, rows, pace, splits, factor: Math.pow(d2 / d1, exp) }
  }, [known, customKm, h, m, s, k, target])

  const knownLabel = known === 'custom' ? km(c.d1) : (raceOf(known)?.label ?? '')
  const half = c.splits[Math.floor((c.splits.length - 1) / 2)]

  return (
    <CalcGrid
      inputs={
        <>
          <SelectField
            id="rt-known"
            label="Race you ran"
            value={known}
            onChange={setKnown}
            options={[...RACES.map((r) => ({ value: r.id, label: r.label })), { value: 'custom', label: 'Other distance' }]}
          />
          {known === 'custom' ? (
            <NumberField id="rt-km" label="Distance" value={customKm} onChange={setCustomKm} unit="km" step={0.1} dp={3} hint={`${numUpTo(customKm / KM_PER_MI, 2)} miles`} />
          ) : null}
          <div className="space-y-1.5">
            <span className="text-sm font-medium leading-none">Your time</span>
            <div className="grid grid-cols-3 gap-2">
              <NumberField id="rt-h" label="Hours" value={h} onChange={setH} unit="h" dp={0} max={24} placeholder="0" />
              <NumberField id="rt-m" label="Minutes" value={m} onChange={setM} unit="m" dp={0} max={59} placeholder="0" />
              <NumberField id="rt-s" label="Seconds" value={s} onChange={setS} unit="s" dp={0} max={59} placeholder="0" />
            </div>
          </div>
          <SelectField
            id="rt-target"
            label="Race to predict"
            value={target}
            onChange={(v) => setTarget(v as RaceId)}
            options={RACES.map((r) => ({ value: r.id, label: r.label }))}
          />
          <NumberField
            id="rt-k"
            label="Fatigue exponent"
            value={k}
            onChange={setK}
            step={0.01}
            min={1.01}
            max={1.15}
            dp={2}
            hint="1.06 is the usual value (1.01 to 1.15). A higher value gives slower long-race times."
          />
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label={`Predicted ${c.race.name} time`}
            value={c.ok ? c.t2 : NaN}
            format={clock}
            hint={c.ok ? `From ${clock(c.t1)} for ${knownLabel}, with an exponent of ${num(c.exp, 2)}.` : undefined}
          />
          {c.ok ? (
            <>
              <Stats
                items={[
                  { label: 'Pace per km', value: clock(c.paceKm) },
                  { label: 'Pace per mile', value: clock(c.paceMi) },
                  { label: 'Speed', value: `${num(c.d2 / (c.t2 / 3600), 1)} km/h`, hint: `${num(c.d2 / KM_PER_MI / (c.t2 / 3600), 1)} mph` },
                ]}
              />
              <LineChart
                x={CHART_KM}
                series={[{ id: 'pace', label: 'Pace per km', values: c.pace, stroke: 'solid' }]}
                xLabel="Distance"
                formatX={km}
                formatY={clock}
                formatValue={(v) => `${clock(v)} /km`}
                markers={RACES.filter((r) => r.id !== 'mile').map((r) => ({ x: r.km, label: r.short }))}
                zero={false}
                defaultIndex={CHART_KM.indexOf(c.d2)}
                ariaLabel="Predicted pace per km against race distance"
                summary={`Predicted pace gets slower as the race gets longer: ${clock(c.pace[0]!)} per km for 1 km and ${clock(c.pace[c.pace.length - 1]!)} per km for the marathon. For the ${c.race.name} it is ${clock(c.paceKm)} per km.`}
              />
            </>
          ) : (
            <Note warn>Enter a time and a distance above 0.</Note>
          )}
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          {c.ok ? (
            <>
              <ResultPanel title="Predictions for the standard races">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm tabular-nums">
                    <caption className="sr-only">Predicted time and pace for each standard race</caption>
                    <thead>
                      <tr className="text-muted-foreground">
                        <th scope="col" className="py-1.5 pr-3 text-left font-[560]">Race</th>
                        <th scope="col" className="px-3 py-1.5 text-right font-[560]">Time</th>
                        <th scope="col" className="px-3 py-1.5 text-right font-[560]">Per km</th>
                        <th scope="col" className="py-1.5 pl-3 text-right font-[560]">Per mile</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.rows.map((r) => {
                        const strong = r.id === c.race.id
                        return (
                          <tr key={r.id} className={strong ? 'font-[650]' : undefined}>
                            <th scope="row" className="py-1.5 pr-3 text-left font-[inherit] whitespace-nowrap">
                              {r.label}
                              {r.id === known ? <span className="font-normal text-muted-foreground"> (your race)</span> : null}
                            </th>
                            <td className="px-3 py-1.5 text-right">{clock(r.t)}</td>
                            <td className="px-3 py-1.5 text-right">{clock(r.perKm)}</td>
                            <td className="py-1.5 pl-3 text-right">{clock(r.perMi)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </ResultPanel>
              <ResultPanel title={`Even-pace splits for the ${c.race.name}`}>
                <StackedBars
                  categories={c.splits.map((sp) => sp.label)}
                  series={[
                    { id: 'before', label: 'Time before', values: c.splits.map((sp) => sp.before), paint: 'grey' },
                    { id: 'split', label: 'This split', values: c.splits.map((sp) => sp.split), paint: 'ink' },
                  ]}
                  categoryLabel="At"
                  formatY={clock}
                  formatValue={clock}
                  showTotal
                  defaultIndex={c.splits.length - 1}
                  summary={`Each bar is the time on the clock at that point; the ink part is the last split. At an even ${clock(c.paceKm)} per km you pass ${half?.label ?? ''} in ${clock((half?.before ?? 0) + (half?.split ?? 0))} and finish in ${clock(c.t2)}.`}
                  table
                />
              </ResultPanel>
              <Formula
                items={[
                  {
                    label: 'Riegel formula',
                    general: 'T₂ = T₁ × (D₂ ÷ D₁)^k',
                    steps: [
                      `T₁ = ${clock(c.t1)} = ${num(c.t1)} s, D₁ = ${numUpTo(c.d1, 4)} km, D₂ = ${numUpTo(c.d2, 4)} km, k = ${num(c.exp, 2)}`,
                      `T₂ = ${num(c.t1)} × (${numUpTo(c.d2, 4)} ÷ ${numUpTo(c.d1, 4)})^${num(c.exp, 2)} = ${num(c.t1)} × ${c.factor.toFixed(4)}`,
                    ],
                    result: `${num(c.t2)} s = ${clock(c.t2)}`,
                  },
                  {
                    label: 'Pace',
                    general: 'pace = T₂ ÷ D₂',
                    steps: [`${num(c.t2)} s ÷ ${numUpTo(c.d2, 4)} km = ${num(c.paceKm, 1)} s per km`, `${num(c.paceKm, 1)} × 1.609344 = ${num(c.paceMi, 1)} s per mile`],
                    result: `${clock(c.paceKm)} per km, ${clock(c.paceMi)} per mile`,
                  },
                ]}
              />
            </>
          ) : null}
          <Assumptions
            title="Limits"
            items={[
              'Riegel fitted the formula on race times from about 3.5 minutes to about 4 hours. Outside that range it is less exact.',
              'The prediction assumes that you train for the longer race. Many runners without long training runs are slower in a marathon than a 5K time predicts.',
              'Heat, hills, wind and the course change the time. The splits assume an even pace from start to finish.',
            ]}
          />
        </div>
      }
    />
  )
}
