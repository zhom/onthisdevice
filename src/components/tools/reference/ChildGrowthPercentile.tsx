import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import growthData from '@/data/growth-cdc.json'
import type { DataMeta } from './data'
import { loadJson } from './data'
import { Loading, Segmented, useLoaded } from './controls'
import type { ChartSeries } from './LineChart'
import { LineChart, numberTicks } from './LineChart'
import type { LmsRow } from './lms'
import { PERCENTILE_Z, ordinal, percentileOf, valueAtZ } from './lms'
import { parseAmount } from './fx'
import { SourceNote } from './SourceNote'

interface GrowthManifest {
  meta: DataMeta
  charts: { id: string; title: string; unit: string; from: number; to: number }[]
  files: string
}
type Charts = Record<string, { male: LmsRow[]; female: LmsRow[] }>
const D = growthData as unknown as GrowthManifest
type Sex = 'female' | 'male'
type Units = 'metric' | 'us'
type Measure = 'weight' | 'height' | 'head' | 'bmi'

const LB = 0.45359237
const IN = 2.54

/** Which CDC chart applies: infant charts under 24 months, 2 to 20 years from 24 months. */
function chartFor(measure: Measure, months: number): string | null {
  if (measure === 'head') return months <= 36 ? 'hcageinf' : null
  if (months < 24) return measure === 'weight' ? 'wtageinf' : measure === 'height' ? 'lenageinf' : null
  if (months > 240) return null
  return measure === 'weight' ? 'wtage' : measure === 'height' ? 'statage' : 'bmiagerev'
}

const LABEL: Record<Measure, string> = { weight: 'Weight', height: 'Length or height', head: 'Head circumference', bmi: 'BMI' }

export default function ChildGrowthPercentile() {
  const [sex, setSex] = useState<Sex>('female')
  const [units, setUnits] = useState<Units>('metric')
  const [years, setYears] = useState('4')
  const [months, setMonths] = useState('6')
  const [weight, setWeight] = useState('17')
  const [height, setHeight] = useState('104')
  const [head, setHead] = useState('')
  const [view, setView] = useState<Measure>('height')
  const data = useLoaded('growth', () => loadJson<Charts>(`${D.files}/growth.json`))

  const age = (Number(years) || 0) * 12 + (Number(months) || 0)
  // CDC tables are by age in months at the midpoint (e.g. 24.5); a child of 4 years 6 months is 54.5 months.
  const ageMonths = age + 0.5
  const ageValid = years.trim() !== '' && age >= 0 && age <= 240 && Number(months || 0) < 12
  const kg = (() => {
    const v = parseAmount(weight)
    return Number.isFinite(v) && v > 0 ? (units === 'us' ? v * LB : v) : null
  })()
  const cm = (() => {
    const v = parseAmount(height)
    return Number.isFinite(v) && v > 0 ? (units === 'us' ? v * IN : v) : null
  })()
  const hc = (() => {
    const v = parseAmount(head)
    return Number.isFinite(v) && v > 0 ? (units === 'us' ? v * IN : v) : null
  })()
  const bmi = kg && cm && age >= 24 ? kg / (cm / 100) ** 2 : null

  const results = useMemo(() => {
    if (data.state !== 'ready' || !ageValid) return []
    const values: Record<Measure, number | null> = { weight: kg, height: cm, head: hc, bmi }
    return (['weight', 'height', 'head', 'bmi'] as Measure[]).flatMap((m) => {
      const id = chartFor(m, age)
      const x = values[m]
      if (!id || x === null) return []
      const r = percentileOf(data.data[id][sex], ageMonths, x)
      return r ? [{ measure: m, id, x, ...r }] : []
    })
  }, [data, ageValid, age, ageMonths, sex, kg, cm, hc, bmi])

  const toUnits = (m: Measure, v: number) => (m === 'bmi' ? v : m === 'weight' ? (units === 'us' ? v / LB : v) : units === 'us' ? v / IN : v)

  const chart = useMemo(() => {
    if (data.state !== 'ready') return null
    const id = chartFor(view, Math.min(age, view === 'head' ? 36 : 240)) ?? chartFor(view, 30)
    if (!id) return null
    const rows = data.data[id][sex]
    const meta = D.charts.find((c) => c.id === id)
    const xs = rows.map((r) => r[0])
    const conv = (v: number) => (view === 'bmi' ? v : view === 'weight' ? (units === 'us' ? v / LB : v) : units === 'us' ? v / IN : v)
    const series: ChartSeries[] = PERCENTILE_Z.map(([p, z]) => ({
      label: `${p}th`,
      values: rows.map((r) => conv(valueAtZ(z, r[1], r[2], r[3]))),
      style: p === 50 ? 'solid' : p === 10 || p === 90 ? 'dashed' : 'grey',
    }))
    const mine = results.find((r) => r.id === id)
    const yearsAxis = !id.endsWith('inf')
    return { id, meta, xs: yearsAxis ? xs.map((m) => m / 12) : xs, series, mine, yearsAxis }
  }, [data, view, age, sex, results, units])

  const show = (m: Measure, v: number) =>
    m === 'bmi' ? v.toFixed(1) : m === 'weight' ? (units === 'us' ? `${(v / LB).toFixed(1)} lb` : `${v.toFixed(1)} kg`) : units === 'us' ? `${(v / IN).toFixed(1)} in` : `${v.toFixed(1)} cm`
  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="flex flex-wrap gap-3">
          <Segmented
            value={sex}
            onChange={setSex}
            options={[
              { id: 'female', label: 'Girl' },
              { id: 'male', label: 'Boy' },
            ]}
            label="Sex"
          />
          <Segmented
            value={units}
            onChange={setUnits}
            options={[
              { id: 'metric', label: 'kg, cm' },
              { id: 'us', label: 'lb, in' },
            ]}
            label="Units"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="gr-years">Age, years</Label>
            <Input id="gr-years" inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} className="tabular-nums" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gr-months">and months</Label>
            <Input id="gr-months" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} className="tabular-nums" autoComplete="off" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="gr-weight">Weight ({units === 'us' ? 'lb' : 'kg'})</Label>
            <Input id="gr-weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className="tabular-nums" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gr-height">
              {age < 24 ? 'Length' : 'Height'} ({units === 'us' ? 'in' : 'cm'})
            </Label>
            <Input id="gr-height" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} className="tabular-nums" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gr-head">Head circumference ({units === 'us' ? 'in' : 'cm'})</Label>
            <Input id="gr-head" inputMode="decimal" value={head} onChange={(e) => setHead(e.target.value)} className="tabular-nums" autoComplete="off" disabled={age > 36} placeholder={age > 36 ? 'Up to 36 months' : 'Optional'} />
          </div>
        </div>
        {ageValid ? null : <ErrorNote message="Enter an age from 0 to 20 years, with 0 to 11 months." />}
      </ToolPanel>

      {data.state === 'loading' ? <Loading label="Loading the CDC growth charts" /> : null}
      {data.state === 'error' ? <ErrorNote message={data.message} /> : null}

      {results.length ? (
        <ToolPanel title="Percentiles">
          <div className="grid gap-3 sm:grid-cols-2" role="status" aria-live="polite">
            {results.map((r) => (
              <ResultStat key={r.measure} label={`${LABEL[r.measure]}: ${show(r.measure, r.x)}`} value={`${ordinal(r.percentile)} percentile`} hint={`z-score ${r.z >= 0 ? '+' : '−'}${Math.abs(r.z).toFixed(2)}`} />
            ))}
          </div>
          <CopyButton
            value={`${sex === 'female' ? 'Girl' : 'Boy'}, ${years} years ${months || 0} months (CDC 2000 growth charts): ${results.map((r) => `${LABEL[r.measure]} ${show(r.measure, r.x)} = ${ordinal(r.percentile)} percentile (z ${r.z.toFixed(2)})`).join('; ')}`}
            label="Copy result"
          />
        </ToolPanel>
      ) : null}

      {chart ? (
        <ToolPanel title={chart.meta?.title ?? 'Growth chart'}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { id: 'weight', label: 'Weight' },
              { id: 'height', label: age < 24 ? 'Length' : 'Height' },
              ...(age <= 36 ? [{ id: 'head' as Measure, label: 'Head' }] : []),
              ...(age >= 24 ? [{ id: 'bmi' as Measure, label: 'BMI' }] : []),
            ]}
            label="Chart"
          />
          <LineChart
            x={chart.xs}
            series={chart.series}
            formatY={(v) => (view === 'bmi' ? v.toFixed(0) : v >= 100 ? v.toFixed(0) : v.toFixed(v < 10 ? 1 : 0))}
            formatX={(x) => (chart.yearsAxis ? `${Math.floor(x)} y ${Math.round((x % 1) * 12)} m` : `${x.toFixed(1)} months`)}
            xTicks={numberTicks}
            markers={chart.mine ? [{ x: chart.yearsAxis ? ageMonths / 12 : ageMonths, y: toUnits(view, chart.mine.x), label: 'Your child' }] : []}
            ariaLabel={`${chart.meta?.title ?? ''} percentile curves for ${sex === 'female' ? 'girls' : 'boys'}`}
            summary={
              chart.mine
                ? `Your child's ${LABEL[view].toLowerCase()} is on the ${ordinal(chart.mine.percentile)} percentile. Lines from bottom to top: 3rd, 10th, 25th, 50th (black), 75th, 90th and 97th percentiles. Age in ${chart.yearsAxis ? 'years' : 'months'}.`
                : `Lines from bottom to top: 3rd, 10th, 25th, 50th (black), 75th, 90th and 97th percentiles. Enter a ${LABEL[view].toLowerCase()} to plot your child.`
            }
          />
        </ToolPanel>
      ) : null}

      <SourceNote meta={D.meta}>For screening only; a doctor reads growth over several visits.</SourceNote>
    </div>
  )
}
