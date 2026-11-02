import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ToolPanel } from '@/components/shared/ToolPanel'
import namesData from '@/data/baby-names.json'
import type { DataMeta } from './data'
import { loadJson } from './data'
import { Segmented } from './controls'
import type { ChartSeries } from './LineChart'
import { LineChart, numberTicks } from './LineChart'
import { SourceNote } from './SourceNote'

type Sex = 'F' | 'M'
/** [first year, counts per year, ranks per year (0 = not ranked)] */
type Series = [number, number[], number[]]
type Shard = Record<string, Partial<Record<Sex, Series>>>
interface NamesManifest {
  meta: DataMeta
  first: number
  last: number
  births: Record<Sex, number[]>
  top: Record<Sex, string[]>
  files: string
}
const D = namesData as unknown as NamesManifest
const YEARS = Array.from({ length: D.last - D.first + 1 }, (_, i) => D.first + i)
const STYLES: ChartSeries['style'][] = ['solid', 'dashed', 'grey', 'grey']
const MAX_NAMES = 3

const loadShard = (letter: string) => loadJson<Shard>(`${D.files}/${letter}.json`)
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

interface Found {
  name: string
  series: Series | null
}

type Measure = 'rank' | 'count'

export default function BabyNamePopularity() {
  const [text, setText] = useState('Emma, Olivia')
  const [sex, setSex] = useState<Sex>('F')
  const [measure, setMeasure] = useState<Measure>('rank')
  const [found, setFound] = useState<Found[]>([])
  const [error, setError] = useState<string | null>(null)

  const names = useMemo(
    () =>
      [...new Set(text.split(/[,;\n]+/).map((s) => titleCase(s.trim())).filter((s) => /^[A-Za-z]{2,}$/.test(s)))].slice(0, MAX_NAMES),
    [text],
  )

  useEffect(() => {
    let live = true
    Promise.all(
      names.map(async (name) => {
        const shard = await loadShard(name[0].toLowerCase())
        return { name, series: shard[name]?.[sex] ?? null }
      }),
    ).then(
      (r) => {
        if (live) {
          setFound(r)
          setError(null)
        }
      },
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
  }, [names, sex])

  const chart = useMemo(() => {
    const series: ChartSeries[] = found
      .filter((f) => f.series)
      .map((f, i) => {
        const [start, counts, ranks] = f.series as Series
        const values = YEARS.map((y) => {
          const k = y - start
          if (k < 0 || k >= counts.length) return null
          if (measure === 'count') return counts[k] || null
          return ranks[k] ? -ranks[k] : null
        })
        return { label: f.name, values, style: STYLES[i] }
      })
    return series
  }, [found, measure])

  const stats = found
    .filter((f) => f.series)
    .map((f) => {
      const [start, counts, ranks] = f.series as Series
      let peak = 0
      for (let k = 0; k < ranks.length; k++) if (ranks[k] && (!ranks[peak] || ranks[k] < ranks[peak])) peak = k
      const last = counts.length - 1
      const total = counts.reduce((a, b) => a + b, 0)
      return { name: f.name, peakYear: start + peak, peakRank: ranks[peak], peakCount: counts[peak], lastRank: ranks[last], lastCount: counts[last], total }
    })
  const missing = found.filter((f) => !f.series).map((f) => f.name)
  const sexWord = sex === 'F' ? 'girls' : 'boys'

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="bn-names">Names, up to {MAX_NAMES}, separated by commas</Label>
            <Input id="bn-names" value={text} onChange={(e) => setText(e.target.value)} placeholder="Emma, Olivia" className="text-base" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <span className="block text-sm font-[600]">Sex</span>
            <Segmented
              value={sex}
              onChange={setSex}
              options={[
                { id: 'F', label: 'Girls' },
                { id: 'M', label: 'Boys' },
              ]}
              label="Sex"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <span className="mr-1 text-muted-foreground">Top {sexWord} in {D.last}:</span>
          {D.top[sex].slice(0, 6).map((n) => (
            <Button key={n} type="button" variant="ghost" size="sm" onClick={() => setText(n)}>
              {n}
            </Button>
          ))}
        </div>
        {error ? <ErrorNote message={error} /> : null}
        {missing.length ? (
          <p className="text-sm text-muted-foreground">
            {missing.join(', ')} {missing.length === 1 ? 'was' : 'were'} never in the top 1,000 for {sexWord}.
          </p>
        ) : null}
      </ToolPanel>

      {chart.length ? (
        <ToolPanel title={`${chart.map((s) => s.label).join(', ')}: ${measure === 'rank' ? 'rank' : 'babies'} per year, ${sexWord}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
              {chart.map((s) => (
                <li key={s.label} className="flex items-center gap-1.5">
                  <svg viewBox="0 0 16 4" className="h-1 w-4">
                    <line x1={0} x2={16} y1={2} y2={2} strokeWidth={2} strokeDasharray={s.style === 'dashed' ? '5 3' : undefined} stroke={s.style === 'grey' ? 'var(--chart-3)' : 'var(--foreground)'} />
                  </svg>
                  {s.label}
                </li>
              ))}
            </ul>
            <Segmented
              value={measure}
              onChange={setMeasure}
              options={[
                { id: 'rank', label: 'Rank' },
                { id: 'count', label: 'Babies' },
              ]}
              label="Measure"
            />
          </div>
          <LineChart
            x={YEARS}
            series={chart}
            zero={measure === 'count'}
            formatY={(v) => (measure === 'rank' ? `#${Math.max(1, Math.round(-v)).toLocaleString('en-US')}` : Math.round(v).toLocaleString('en-US'))}
            formatX={(y) => String(y)}
            xTicks={numberTicks}
            ariaLabel={`Popularity of ${chart.map((s) => s.label).join(', ')} for ${sexWord} from ${D.first} to ${D.last}`}
            summary={stats
              .map((s) => `${s.name} peaked at #${s.peakRank} in ${s.peakYear} (${s.peakCount.toLocaleString('en-US')} babies) and was ${s.lastRank ? `#${s.lastRank}` : 'not ranked'} in ${D.last}.`)
              .join(' ')}
          />
        </ToolPanel>
      ) : null}

      {stats.length ? (
        <ToolPanel title="In numbers">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm tabular-nums" role="status" aria-live="polite">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-3 font-[560]">Name</th>
                  <th className="py-1 pr-3 text-right font-[560]">Rank in {D.last}</th>
                  <th className="py-1 pr-3 text-right font-[560]">Babies in {D.last}</th>
                  <th className="py-1 pr-3 text-right font-[560]">Best rank</th>
                  <th className="py-1 text-right font-[560]">Since {D.first}</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.name}>
                    <td className="py-1 pr-3 font-[650]">{s.name}</td>
                    <td className="py-1 pr-3 text-right">{s.lastRank ? `#${s.lastRank.toLocaleString('en-US')}` : '–'}</td>
                    <td className="py-1 pr-3 text-right">{s.lastCount ? s.lastCount.toLocaleString('en-US') : '–'}</td>
                    <td className="py-1 pr-3 text-right">
                      #{s.peakRank} ({s.peakYear})
                    </td>
                    <td className="py-1 text-right">{s.total.toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CopyButton
            value={stats.map((s) => `${s.name} (${sexWord}): #${s.lastRank || '–'} in ${D.last}, best #${s.peakRank} in ${s.peakYear}, ${s.total} babies since ${D.first}`).join('\n')}
            label="Copy"
          />
        </ToolPanel>
      ) : null}

      <SourceNote meta={D.meta}>
        Names given to at least 5 babies of one sex in a year, {D.first} to {D.last}; this tool has every name that reached the top 1,000.
      </SourceNote>
    </div>
  )
}
