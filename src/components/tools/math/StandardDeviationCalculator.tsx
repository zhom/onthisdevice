import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { AnswerBanner, ScrollTable, StatGrid, StatTile, StepList, tdClass, thClass, type Step } from './ui'
import { dispersion, fmtGrouped, fmtNum, parseNumberList } from './math-core'

const SAMPLE = '9, 2, 5, 4, 12, 7, 8, 11, 9, 3, 7, 4, 12, 5, 4, 10, 9, 6, 9, 4'
const MAX_ROWS = 200

type Basis = 'sample' | 'population'

/* ───────────────────────────── dot plot ───────────────────────────────── */

function DotPlot({ values, mean, sd }: { values: number[]; mean: number; sd: number }) {
  const W = 720
  const H = 170
  const PAD = 44
  const BASE = 124
  let min = values[0]
  let max = values[0]
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const lo = min === max ? min - 1 : min
  const hi = min === max ? max + 1 : max
  const x = (v: number) => PAD + ((v - lo) / (hi - lo)) * (W - PAD * 2)

  const buckets = new Map<number, number>()
  const dots: { cx: number; cy: number }[] = []
  const sampled = values.length > 600 ? values.filter((_, i) => i % Math.ceil(values.length / 600) === 0) : values
  for (const v of sampled) {
    const cx = Math.round(x(v) / 7) * 7
    const stack = buckets.get(cx) ?? 0
    buckets.set(cx, stack + 1)
    if (stack < 15) dots.push({ cx, cy: BASE - 6 - stack * 7 })
  }

  const clampX = (v: number) => Math.max(PAD - 6, Math.min(W - PAD + 6, x(v)))
  const band = (k: number) => ({ from: clampX(mean - k * sd), to: clampX(mean + k * sd) })
  const b1 = band(1)
  const b2 = band(2)
  const showBands = Number.isFinite(sd) && sd > 0

  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto rounded-lg bg-card p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[20rem]"
          role="img"
          aria-label={`Dot plot of ${values.length} values from ${fmtNum(min)} to ${fmtNum(max)}, mean ${fmtNum(mean, 4)}, standard deviation ${fmtNum(sd, 4)}`}
        >
          {showBands && (
            <>
              <rect x={b2.from} y={18} width={Math.max(0, b2.to - b2.from)} height={BASE - 18} className="fill-chart-5" />
              <rect x={b1.from} y={18} width={Math.max(0, b1.to - b1.from)} height={BASE - 18} className="fill-chart-4" />
            </>
          )}
          <line x1={PAD - 10} y1={BASE} x2={W - PAD + 10} y2={BASE} className="stroke-muted-foreground" strokeWidth={1.5} />
          {dots.map((d, i) => (
            <circle key={i} cx={d.cx} cy={d.cy} r={2.8} className="fill-chart-1" />
          ))}
          <line x1={clampX(mean)} y1={16} x2={clampX(mean)} y2={BASE + 6} className="stroke-primary" strokeWidth={2} strokeDasharray="5 4" />
          <text x={clampX(mean)} y={12} textAnchor="middle" className="fill-primary text-[11px] font-semibold">
            mean {fmtNum(mean, 3)}
          </text>
          <text x={PAD} y={BASE + 20} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {fmtNum(lo, 4)}
          </text>
          <text x={W - PAD} y={BASE + 20} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {fmtNum(hi, 4)}
          </text>
          {showBands && (
            <>
              <text x={b1.to} y={BASE + 36} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                +1σ
              </text>
              <text x={b1.from} y={BASE + 36} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                −1σ
              </text>
            </>
          )}
        </svg>
      </div>
      <figcaption className="text-xs text-muted-foreground">
        Each dot is one value; identical values stack upward. The dashed line is the mean and the shaded bands are one and two
        standard deviations either side of it.
        {values.length > 600 ? ' A representative sample of the points is drawn to keep the chart readable.' : ''}
      </figcaption>
    </figure>
  )
}

/* ──────────────────────────── main island ─────────────────────────────── */

export default function StandardDeviationCalculator() {
  const [raw, setRaw] = useState(SAMPLE)
  const [basis, setBasis] = useState<Basis>('sample')

  const parsed = useMemo(() => parseNumberList(raw), [raw])
  const d = useMemo(() => dispersion(parsed.values), [parsed.values])

  const n = parsed.values.length
  const sd = d ? (basis === 'sample' ? d.sampleSd : d.populationSd) : NaN
  const variance = d ? (basis === 'sample' ? d.sampleVariance : d.populationVariance) : NaN
  const divisor = basis === 'sample' ? n - 1 : n

  const rows = useMemo(() => {
    if (!d) return []
    return parsed.values.slice(0, MAX_ROWS).map((v, i) => ({
      i: i + 1,
      v,
      dev: v - d.mean,
      sq: (v - d.mean) ** 2,
    }))
  }, [parsed.values, d])

  const steps = useMemo<Step[]>(() => {
    if (!d || n === 0) return []
    if (basis === 'sample' && n < 2) {
      return [
        {
          label: 'A sample standard deviation needs at least two values.',
          expr: 'n − 1 = 0, and dividing by zero is undefined.',
          note: 'Switch to the population formula if this single value really is the whole population.',
        },
      ]
    }
    const preview = parsed.values.slice(0, 6).map((v) => fmtNum(v)).join(' + ')
    return [
      {
        label: 'Find the mean of the data.',
        expr: `x̄ = (${preview}${n > 6 ? ' + …' : ''}) ÷ ${n} = ${fmtNum(d.mean, 8)}`,
      },
      {
        label: 'Subtract the mean from each value to get its deviation.',
        expr: parsed.values
          .slice(0, 4)
          .map((v) => `${fmtNum(v)} − ${fmtNum(d.mean, 4)} = ${fmtNum(v - d.mean, 4)}`)
          .join('\n') + (n > 4 ? `\n… and ${n - 4} more (see the table below)` : ''),
        note: 'Deviations always add up to zero, which is exactly why they get squared before being averaged.',
      },
      {
        label: 'Square every deviation and add them up.',
        expr: `Σ(x − x̄)² = ${fmtNum(d.sumSquares, 8)}`,
      },
      {
        label:
          basis === 'sample'
            ? 'Divide the sum of squares by n − 1 to get the sample variance.'
            : 'Divide the sum of squares by n to get the population variance.',
        expr: `s² = ${fmtNum(d.sumSquares, 8)} ÷ ${divisor} = ${fmtNum(variance, 8)}`,
        note:
          basis === 'sample'
            ? 'Dividing by n − 1 (the Bessel correction) compensates for measuring deviations from the sample mean rather than the true mean.'
            : 'Use this only when every member of the population is in the list.',
      },
      {
        label: 'Take the square root of the variance.',
        expr: `${basis === 'sample' ? 's' : 'σ'} = √${fmtNum(variance, 8)} = ${fmtNum(sd, 8)}`,
      },
    ]
  }, [d, n, basis, divisor, variance, sd, parsed.values])

  const copyText = useMemo(() => {
    if (!d) return ''
    return [
      `Count (n): ${n}`,
      `Mean: ${fmtNum(d.mean, 8)}`,
      `Sum of squared deviations: ${fmtNum(d.sumSquares, 8)}`,
      `Sample variance (n−1): ${fmtNum(d.sampleVariance, 8)}`,
      `Sample standard deviation: ${fmtNum(d.sampleSd, 8)}`,
      `Population variance (n): ${fmtNum(d.populationVariance, 8)}`,
      `Population standard deviation: ${fmtNum(d.populationSd, 8)}`,
    ].join('\n')
  }, [d, n])

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Your data"
        description="Paste numbers separated by commas, spaces, tabs or newlines. A spreadsheet column pastes straight in."
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
          <Label htmlFor="sd-input">Numbers</Label>
          <Textarea
            id="sd-input"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
            spellCheck={false}
            className="font-mono text-sm"
            placeholder="9, 2, 5, 4, 12, 7"
            aria-describedby="sd-count"
          />
          <p id="sd-count" className="text-xs text-muted-foreground">
            {n} value{n === 1 ? '' : 's'} recognised
            {parsed.invalid.length ? ` · ${parsed.invalid.length} skipped` : ''}
          </p>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-foreground">Which formula?</legend>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={basis === 'sample' ? 'default' : 'outline'}
              size="sm"
              aria-pressed={basis === 'sample'}
              onClick={() => setBasis('sample')}
            >
              Sample (÷ n − 1)
            </Button>
            <Button
              type="button"
              variant={basis === 'population' ? 'default' : 'outline'}
              size="sm"
              aria-pressed={basis === 'population'}
              onClick={() => setBasis('population')}
            >
              Population (÷ n)
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {basis === 'sample'
              ? 'Use this when your numbers are a subset drawn from a bigger group, which is the usual case.'
              : 'Use this only when the list contains every member of the group you care about.'}
          </p>
        </fieldset>
      </ToolPanel>

      {parsed.invalid.length > 0 && (
        <ErrorNote
          message={`Ignored these non-numeric entries: ${parsed.invalid.slice(0, 10).join(', ')}${parsed.invalid.length > 10 ? '…' : ''}.`}
        />
      )}

      {!d ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground" role="status">
          Paste at least two numbers to see the standard deviation and the full working.
        </p>
      ) : (
        <div className="space-y-5" role="status" aria-live="polite">
          <AnswerBanner
            label={basis === 'sample' ? 'Sample standard deviation (s)' : 'Population standard deviation (σ)'}
            value={Number.isFinite(sd) ? fmtGrouped(sd, 8) : 'needs 2+ values'}
            sub={
              Number.isFinite(sd)
                ? `Mean ${fmtNum(d.mean, 6)} · variance ${fmtNum(variance, 6)} · n = ${n}`
                : 'The sample formula divides by n − 1, so it needs at least two values.'
            }
          />

          <StatGrid cols={4}>
            <StatTile label="Mean (x̄)" value={fmtGrouped(d.mean, 8)} tone="muted" />
            <StatTile label="Count (n)" value={String(n)} tone="muted" />
            <StatTile label="Σ(x − x̄)²" value={fmtGrouped(d.sumSquares, 8)} hint="sum of squares" tone="muted" />
            <StatTile label={basis === 'sample' ? 'Sample variance (s²)' : 'Population variance (σ²)'} value={Number.isFinite(variance) ? fmtGrouped(variance, 8) : '–'} tone="muted" />
            <StatTile label="Sample SD (n − 1)" value={Number.isFinite(d.sampleSd) ? fmtGrouped(d.sampleSd, 8) : '–'} tone="muted" />
            <StatTile label="Population SD (n)" value={fmtGrouped(d.populationSd, 8)} tone="muted" />
            <StatTile
              label="Standard error of the mean"
              value={Number.isFinite(d.sampleSd) ? fmtGrouped(d.sampleSd / Math.sqrt(n), 8) : '–'}
              hint="s ÷ √n"
              tone="muted"
            />
            <StatTile
              label="Coefficient of variation"
              value={d.mean === 0 || !Number.isFinite(d.sampleSd) ? '–' : `${fmtNum((d.sampleSd / Math.abs(d.mean)) * 100, 4)}%`}
              hint="s ÷ |mean|"
              tone="muted"
            />
          </StatGrid>

          <div className="flex flex-wrap gap-2">
            <CopyButton value={copyText} label="Copy all results" />
            <CopyButton
              value={rows.map((r) => `${fmtNum(r.v)}\t${fmtNum(r.dev, 8)}\t${fmtNum(r.sq, 8)}`).join('\n')}
              label="Copy deviation table"
            />
          </div>

          <DotPlot values={parsed.values} mean={d.mean} sd={Number.isFinite(sd) ? sd : d.populationSd} />

          <StepList steps={steps} />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Deviation table</h3>
            <ScrollTable caption="Each value, its deviation from the mean, and that deviation squared">
              <thead>
                <tr>
                  <th className={thClass} scope="col">#</th>
                  <th className={thClass} scope="col">x</th>
                  <th className={thClass} scope="col">x − x̄</th>
                  <th className={thClass} scope="col">(x − x̄)²</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.i}>
                    <td className={tdClass}>{r.i}</td>
                    <td className={tdClass}>{fmtNum(r.v)}</td>
                    <td className={tdClass}>{fmtNum(r.dev, 6)}</td>
                    <td className={tdClass}>{fmtNum(r.sq, 6)}</td>
                  </tr>
                ))}
                <tr>
                  <td className={tdClass} />
                  <td className={tdClass}>Σ = {fmtNum(d.mean * n, 6)}</td>
                  <td className={tdClass}>Σ ≈ 0</td>
                  <td className={tdClass}>Σ = {fmtNum(d.sumSquares, 6)}</td>
                </tr>
              </tbody>
            </ScrollTable>
            {parsed.values.length > MAX_ROWS && (
              <p className="text-xs text-muted-foreground">
                Showing the first {MAX_ROWS} of {n} rows; the totals row covers every value.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
