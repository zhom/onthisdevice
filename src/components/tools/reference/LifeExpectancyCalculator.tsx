import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import lifeData from '@/data/life-table-us.json'
import type { DataMeta } from './data'
import { Segmented } from './controls'
import { LineChart, numberTicks } from './LineChart'
import { SourceNote } from './SourceNote'

interface Table {
  q: number[]
  l: number[]
  e: number[]
}
interface LifeManifest {
  meta: DataMeta
  year: number
  male: Table
  female: Table
}
const D = lifeData as unknown as LifeManifest
type Sex = 'female' | 'male'
const AGES = D.male.l.map((_, a) => a)

/** Chance (0..1) that a person alive at `from` is alive at `to`. Survivors interpolate within a year. */
export function survival(t: Table, from: number, to: number): number {
  const lx = t.l[from]
  if (!lx) return 0
  if (to >= t.l.length) return 0
  return t.l[to] / lx
}

/** The age by which half of the people alive at `from` have died. */
function medianAge(t: Table, from: number): number {
  const half = t.l[from] / 2
  for (let a = from + 1; a < t.l.length; a++) {
    if (t.l[a] <= half) {
      const prev = t.l[a - 1]
      return a - 1 + (prev - half) / Math.max(1, prev - t.l[a])
    }
  }
  return t.l.length - 1
}

const pct = (v: number) => (v >= 0.995 ? '>99%' : v < 0.005 ? '<1%' : `${Math.round(v * 100)}%`)

export default function LifeExpectancyCalculator() {
  const [ageText, setAgeText] = useState('40')
  const [sex, setSex] = useState<Sex>('female')
  const age = Number(ageText)
  const valid = ageText.trim() !== '' && Number.isInteger(age) && age >= 0 && age <= 119
  const a = valid ? age : 40
  const t = D[sex]
  const other: Sex = sex === 'female' ? 'male' : 'female'

  const view = useMemo(() => {
    const curve = (tab: Table) => AGES.map((x) => (x < a ? null : survival(tab, a, x) * 100))
    return {
      series: [
        { label: sex === 'female' ? 'Women' : 'Men', values: curve(D[sex]) },
        { label: other === 'female' ? 'Women' : 'Men', values: curve(D[other]), style: 'dashed' as const },
      ],
    }
  }, [a, sex, other])

  const years = t.e[a]
  const median = medianAge(t, a)
  const milestones = [65, 70, 75, 80, 85, 90, 95, 100].filter((m) => m > a)
  const summary = `A ${a}-year-old ${sex === 'female' ? 'woman' : 'man'} in the US has a life expectancy of ${years.toFixed(1)} more years (to age ${(a + years).toFixed(1)}), from the ${D.year} period life table.`

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="le-age">Age now (years)</Label>
            <Input id="le-age" inputMode="numeric" value={ageText} onChange={(e) => setAgeText(e.target.value)} className="tabular-nums" autoComplete="off" />
            <Slider min={0} max={110} step={1} value={[Math.min(110, a)]} onValueChange={([v]) => setAgeText(String(v))} aria-label="Age (slider)" />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-[600]" id="le-sex-label">
              Sex
            </span>
            <Segmented
              value={sex}
              onChange={setSex}
              options={[
                { id: 'female', label: 'Female' },
                { id: 'male', label: 'Male' },
              ]}
              label="Sex"
            />
          </div>
        </div>
        {valid ? null : <ErrorNote message="Enter a whole age from 0 to 119." />}
      </ToolPanel>

      <ToolPanel title="Result">
        <div role="status" aria-live="polite" className="space-y-1">
          <p className="text-sm text-muted-foreground">Life expectancy at {a}</p>
          <p className="text-[2rem] leading-tight font-[740] tabular-nums sm:text-[2.5rem]">{years.toFixed(1)} more years</p>
          <p className="text-sm text-muted-foreground">To an average age of {(a + years).toFixed(1)}. Half of people your age live past {median.toFixed(0)}.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <ResultStat label={`Chance to die before ${a + 1}`} value={`${(t.q[a] * 100).toFixed(t.q[a] < 0.01 ? 2 : 1)}%`} hint="In the next year" />
          <ResultStat label="Chance to reach 80" value={a >= 80 ? 'Reached' : pct(survival(t, a, 80))} />
          <ResultStat label="Chance to reach 90" value={a >= 90 ? 'Reached' : pct(survival(t, a, 90))} />
        </div>
        <CopyButton value={summary} label="Copy result" />
      </ToolPanel>

      <ToolPanel title="Survival curve">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
          {view.series.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <svg viewBox="0 0 16 4" className="h-1 w-4">
                <line x1={0} x2={16} y1={2} y2={2} strokeWidth={2} strokeDasharray={s.style === 'dashed' ? '5 3' : undefined} stroke="var(--foreground)" />
              </svg>
              {s.label} aged {a}
            </li>
          ))}
        </ul>
        <LineChart
          x={AGES}
          series={view.series}
          area
          zero
          formatY={(v) => `${Math.round(v)}%`}
          formatX={(x) => `Age ${x}`}
          xTicks={numberTicks}
          ariaLabel={`Chance to be alive at each age, for a ${sex} aged ${a}`}
          summary={`Of 100 people aged ${a}, about ${Math.round(survival(t, a, Math.min(119, a + 10)) * 100)} are alive at ${Math.min(119, a + 10)} and about ${Math.round(survival(t, a, Math.min(119, Math.max(a, 90))) * 100)} at ${Math.max(a, 90)}.`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm tabular-nums">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-3 font-[560]">Age</th>
                <th className="py-1 pr-3 text-right font-[560]">Chance to reach it</th>
                <th className="py-1 text-right font-[560]">Then years left</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => (
                <tr key={m}>
                  <td className="py-1 pr-3">{m}</td>
                  <td className="py-1 pr-3 text-right font-[600]">{pct(survival(t, a, m))}</td>
                  <td className="py-1 text-right">{t.e[m].toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ToolPanel>

      <SourceNote meta={D.meta}>Period life table for {D.year}, the US population by sex.</SourceNote>
    </div>
  )
}
