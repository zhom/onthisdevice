import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { ScrollTable, StatGrid, StatTile, StepList, tdClass, thClass, type Step } from './ui'
import { describe, dispersion, fmtGrouped, fmtNum, parseNumberList } from './math-core'

const SAMPLE = '12, 7, 3, 7, 21, 15, 7, 9'

export default function AverageCalculator() {
  const [raw, setRaw] = useState(SAMPLE)

  const parsed = useMemo(() => parseNumberList(raw), [raw])
  const stats = useMemo(() => describe(parsed.values), [parsed.values])
  const spread = useMemo(() => dispersion(parsed.values), [parsed.values])

  const steps = useMemo<Step[]>(() => {
    if (!stats) return []
    const shown = stats.sorted.length <= 12 ? stats.sorted.map((n) => fmtNum(n)).join(' + ') : `${stats.sorted.slice(0, 8).map((n) => fmtNum(n)).join(' + ')} + … (${stats.count - 8} more)`
    const out: Step[] = [
      {
        label: 'Add every value together.',
        expr: `Σx = ${shown} = ${fmtNum(stats.sum, 8)}`,
      },
      {
        label: 'Divide the sum by how many values there are. The result is the mean.',
        expr: `mean = ${fmtNum(stats.sum, 8)} ÷ ${stats.count} = ${fmtNum(stats.mean, 8)}`,
      },
      {
        label: 'Sort the values from smallest to largest to find the median.',
        expr:
          stats.count <= 20
            ? stats.sorted.map((n) => fmtNum(n)).join(', ')
            : `${stats.sorted.slice(0, 10).map((n) => fmtNum(n)).join(', ')}, … , ${stats.sorted.slice(-3).map((n) => fmtNum(n)).join(', ')}`,
      },
      {
        label:
          stats.count % 2 === 1
            ? `With ${stats.count} values the median is the single middle one, at position ${(stats.count + 1) / 2}.`
            : `With ${stats.count} values the median is the average of positions ${stats.count / 2} and ${stats.count / 2 + 1}.`,
        expr: `median = ${fmtNum(stats.median, 8)}`,
      },
      {
        label: stats.modes.length ? 'Count how often each value appears. The most frequent value is the mode.' : 'Count how often each value appears.',
        expr: stats.modes.length
          ? `mode = ${stats.modes.map((m) => fmtNum(m)).join(', ')}`
          : 'Every value appears exactly once, so this data set has no mode.',
      },
      {
        label: 'Subtract the smallest value from the largest for the range.',
        expr: `range = ${fmtNum(stats.max)} − ${fmtNum(stats.min)} = ${fmtNum(stats.range, 8)}`,
      },
    ]
    return out
  }, [stats])

  const summaryText = useMemo(() => {
    if (!stats) return ''
    return [
      `Count: ${stats.count}`,
      `Sum: ${fmtNum(stats.sum, 8)}`,
      `Mean: ${fmtNum(stats.mean, 8)}`,
      `Median: ${fmtNum(stats.median, 8)}`,
      `Mode: ${stats.modes.length ? stats.modes.map((m) => fmtNum(m)).join(', ') : 'none'}`,
      `Range: ${fmtNum(stats.range, 8)}`,
      `Minimum: ${fmtNum(stats.min, 8)}`,
      `Maximum: ${fmtNum(stats.max, 8)}`,
      `Q1: ${fmtNum(stats.q1, 8)}`,
      `Q3: ${fmtNum(stats.q3, 8)}`,
    ].join('\n')
  }, [stats])

  const frequency = useMemo(() => {
    if (!stats) return []
    const map = new Map<number, number>()
    for (const v of parsed.values) map.set(v, (map.get(v) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 30)
  }, [parsed.values, stats])

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Your numbers"
        description="Paste a column from a spreadsheet or type a list. Commas, spaces, tabs, semicolons and newlines all separate values."
        footer={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setRaw(SAMPLE)}>
              Load example
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRaw('')}>
              Clear
            </Button>
          </div>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="avg-input">Numbers</Label>
          <Textarea
            id="avg-input"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
            spellCheck={false}
            className="font-mono text-sm"
            placeholder="12, 7, 3, 7, 21, 15, 7, 9"
            aria-describedby="avg-count"
          />
          <p id="avg-count" className="text-xs text-muted-foreground">
            {parsed.values.length} number{parsed.values.length === 1 ? '' : 's'} recognised
            {parsed.invalid.length ? ` · ${parsed.invalid.length} token${parsed.invalid.length === 1 ? '' : 's'} skipped` : ''}
          </p>
        </div>
      </ToolPanel>

      {parsed.invalid.length > 0 && (
        <ErrorNote
          message={`These entries were not numbers and have been ignored: ${parsed.invalid.slice(0, 12).join(', ')}${parsed.invalid.length > 12 ? ` and ${parsed.invalid.length - 12} more` : ''}.`}
        />
      )}

      {!stats ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground" role="status">
          Enter at least one number to see the mean, median, mode and range.
        </p>
      ) : (
        <div className="space-y-5" role="status" aria-live="polite">
          <StatGrid cols={4}>
            <StatTile label="Mean (average)" value={fmtGrouped(stats.mean, 8)} hint="sum ÷ count" />
            <StatTile label="Median" value={fmtGrouped(stats.median, 8)} hint="middle value" />
            <StatTile
              label="Mode"
              value={stats.modes.length ? stats.modes.map((m) => fmtGrouped(m, 6)).join(', ') : 'none'}
              hint={stats.modes.length ? 'most frequent' : 'no value repeats'}
            />
            <StatTile label="Range" value={fmtGrouped(stats.range, 8)} hint="max − min" />
          </StatGrid>

          <StatGrid cols={4}>
            <StatTile label="Sum" value={fmtGrouped(stats.sum, 8)} tone="muted" />
            <StatTile label="Count" value={String(stats.count)} tone="muted" />
            <StatTile label="Minimum" value={fmtGrouped(stats.min, 8)} tone="muted" />
            <StatTile label="Maximum" value={fmtGrouped(stats.max, 8)} tone="muted" />
            <StatTile label="First quartile (Q1)" value={fmtGrouped(stats.q1, 6)} tone="muted" />
            <StatTile label="Third quartile (Q3)" value={fmtGrouped(stats.q3, 6)} tone="muted" />
            <StatTile label="Interquartile range" value={fmtGrouped(stats.iqr, 6)} tone="muted" />
            <StatTile
              label="Standard deviation"
              value={spread && Number.isFinite(spread.sampleSd) ? fmtGrouped(spread.sampleSd, 6) : '–'}
              hint="sample, n − 1"
              tone="muted"
            />
            <StatTile
              label="Geometric mean"
              value={stats.geometricMean === null ? 'n/a' : fmtGrouped(stats.geometricMean, 6)}
              hint={stats.geometricMean === null ? 'needs all values > 0' : 'for growth rates'}
              tone="muted"
            />
            <StatTile
              label="Harmonic mean"
              value={stats.harmonicMean === null ? 'n/a' : fmtGrouped(stats.harmonicMean, 6)}
              hint={stats.harmonicMean === null ? 'needs all values ≠ 0' : 'for averaged rates'}
              tone="muted"
            />
            <StatTile label="Midrange" value={fmtGrouped((stats.min + stats.max) / 2, 6)} tone="muted" />
            <StatTile label="Mean absolute deviation" value={fmtGrouped(parsed.values.reduce((a, b) => a + Math.abs(b - stats.mean), 0) / stats.count, 6)} tone="muted" />
          </StatGrid>

          <div className="flex flex-wrap items-center gap-2">
            <CopyButton value={summaryText} label="Copy all results" />
            <CopyButton value={stats.sorted.join(', ')} label="Copy sorted list" />
          </div>

          <StepList steps={steps} />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Frequency table</h3>
            <ScrollTable caption="How often each value appears">
              <thead>
                <tr>
                  <th className={thClass} scope="col">Value</th>
                  <th className={thClass} scope="col">Count</th>
                  <th className={thClass} scope="col">Share</th>
                  <th className={thClass} scope="col">Distance from mean</th>
                </tr>
              </thead>
              <tbody>
                {frequency.map(([value, count]) => (
                  <tr key={value}>
                    <td className={tdClass}>{fmtNum(value)}</td>
                    <td className={tdClass}>{count}</td>
                    <td className={tdClass}>{fmtNum((count / stats.count) * 100, 2)}%</td>
                    <td className={tdClass}>{value - stats.mean >= 0 ? '+' : '−'}{fmtNum(Math.abs(value - stats.mean), 4)}</td>
                  </tr>
                ))}
              </tbody>
            </ScrollTable>
            {frequency.length === 30 && (
              <p className="text-xs text-muted-foreground">Showing the 30 most common values.</p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
