import { useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { CalcLayout, Choice, DateField as DateInput, NumField, Result, SelectField as SelectInput, Stat, Working } from '@/components/tools/calc2/_viz/Calc'
import { parseNum } from '@/components/tools/calc2/_viz/format'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ChartView } from './ChartView'
import { CalcError } from './types'
import type { Field, NumberField, Out, Raw, Spec } from './types'

/* ── today, after hydration ─────────────────────────────────────── */

let today: Date | null = null
const noop = () => () => {}
const readToday = () => {
  if (!today) {
    const d = new Date()
    today = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  return today
}
/** Null on the server and during hydration, so the static HTML never holds a stale date. */
function useToday(): Date | null {
  return useSyncExternalStore(noop, readToday, () => null)
}

/* ── validation ─────────────────────────────────────────────────── */

const text = (v: string | ((s: Raw) => string) | undefined, s: Raw) => (typeof v === 'function' ? v(s) : v)
const isNum = (f: Field): f is NumberField => f.kind === undefined || f.kind === 'num'

function check(f: NumberField, raw: string, s: Raw): { value: number; error: string | null } {
  const name = text(f.label, s) ?? ''
  const lower = name.charAt(0).toLowerCase() + name.slice(1)
  const v = parseNum(raw)
  if (v === null) {
    if (raw.trim() === '' && f.optional) return { value: NaN, error: null }
    return { value: NaN, error: raw.trim() === '' ? `Enter the ${lower}.` : `The ${lower} must be a number.` }
  }
  if (f.int && !Number.isInteger(v)) return { value: v, error: `The ${lower} must be a whole number.` }
  if (f.above !== undefined && !(v > f.above)) return { value: v, error: `The ${lower} must be above ${f.above.toLocaleString('en-US')}.` }
  if (f.min !== undefined && v < f.min) return { value: v, error: `The ${lower} must be at least ${f.min.toLocaleString('en-US')}.` }
  if (f.max !== undefined && v > f.max) return { value: v, error: `The ${lower} must be at most ${f.max.toLocaleString('en-US')}.` }
  return { value: v, error: null }
}

/* ── the engine ─────────────────────────────────────────────────── */

const WIDE = new Set(['line', 'stacked', 'timeline'])

export function Calculator({ spec }: { spec: Spec }) {
  const [raw, setRaw] = useState<Raw>(() => Object.fromEntries(spec.inputs.map((f) => [f.id, f.value])))
  const set = (id: string, v: string) => setRaw((r) => ({ ...r, [id]: v }))
  const now = useToday()
  const shown = spec.inputs.filter((f) => !f.when || f.when(raw))

  const errors: Record<string, string | null> = {}
  const n: Record<string, number> = {}
  for (const f of spec.inputs) if (isNum(f)) n[f.id] = NaN
  for (const f of shown) {
    if (!isNum(f)) continue
    const c = check(f, raw[f.id] ?? '', raw)
    n[f.id] = c.value
    errors[f.id] = c.error
  }
  const fieldError = shown.map((f) => errors[f.id]).find((e) => e) ?? null

  const waiting = spec.usesToday === true && now === null
  let out: Out | null = null
  let problem = fieldError
  if (!problem && !waiting) {
    try {
      out = spec.compute({ n, s: raw, today: now ?? new Date(2026, 0, 1) })
    } catch (e) {
      problem = e instanceof CalcError ? e.message : 'These values do not give a result. Check each field.'
    }
  }
  // Keep the last good chart on screen while a field is being edited.
  const last = useRef<Out | null>(null)
  if (out) last.current = out
  const shownOut = out ?? last.current

  const copy = out
    ? [`${out.main.label}: ${valueText(out.main.value, out.main.format)}${out.main.unit ? ` ${out.main.unit}` : ''}`, ...(out.stats ?? []).map((s) => `${s.label}: ${valueText(s.value, s.format)}${s.unit ? ` ${s.unit}` : ''}`)].join('\n')
    : undefined

  const csv = out?.csv
  const blob = useMemo(() => {
    if (!csv) return null
    const cell = (v: string | number) => {
      const t = String(v)
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
    }
    return new Blob([[csv.columns, ...csv.rows].map((r) => r.map(cell).join(',')).join('\n') + '\n'], { type: 'text/csv' })
  }, [csv])

  const kind = shownOut?.chart.kind
  return (
    <CalcLayout
      layout={kind && WIDE.has(kind) ? 'stack' : 'split'}
      inputs={
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          {shown.map((f) => (
            <FieldView key={f.id} field={f} raw={raw} value={raw[f.id] ?? ''} error={errors[f.id] ?? null} onChange={(v) => set(f.id, v)} />
          ))}
        </div>
      }
      result={
        waiting ? (
          <section role="status" aria-live="polite" className="px-1 text-[0.9375rem] text-muted-foreground">
            Reading today’s date on this device.
          </section>
        ) : (
          <Result
            label={out?.main.label ?? shownOut?.main.label ?? 'Result'}
            value={out ? out.main.value : '–'}
            format={out?.main.format}
            unit={out?.main.unit}
            sub={out?.main.sub}
            copy={copy}
            error={problem}
          >
            {out?.stats?.length
              ? out.stats.map((s, i) => <Stat key={`${i}-${s.label}`} label={s.label} value={s.value} format={s.format} unit={s.unit} />)
              : null}
          </Result>
        )
      }
      visual={
        shownOut ? (
          <div className={cn('min-w-0 rounded-xl bg-card p-4 sm:p-5', !out && 'pointer-events-none')} aria-hidden={out ? undefined : true}>
            <ChartView chart={shownOut.chart} />
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-xl bg-card p-6 text-center text-[0.9375rem] text-muted-foreground">
            {waiting ? 'The chart appears in a moment.' : 'The chart appears when every field has a valid value.'}
          </div>
        )
      }
      working={
        out ? (
          <div className="space-y-4">
            <Working lines={out.working} caption={out.note} />
            {csv && blob ? <DownloadButton blob={blob} filename={csv.filename} label="Download CSV" variant="secondary" /> : null}
          </div>
        ) : null
      }
    />
  )
}

function valueText(v: number | string, format?: (n: number) => string): string {
  return typeof v === 'number' ? (format ? format(v) : String(v)) : v
}

function FieldView({ field: f, raw, value, error, onChange }: { field: Field; raw: Raw; value: string; error: string | null; onChange: (v: string) => void }) {
  const label = text(f.label, raw) ?? ''
  const span = f.half ? 'col-span-1' : 'col-span-2'
  if (isNum(f)) {
    return (
      <NumField
        className={span}
        label={label}
        value={value}
        onChange={onChange}
        unit={text(f.unit, raw)}
        hint={f.hint}
        error={error}
        slider={f.slider ? { min: f.slider[0], max: f.slider[1], step: f.slider[2] } : undefined}
        inputMode={f.int && (f.min ?? 0) >= 0 ? 'numeric' : 'decimal'}
      />
    )
  }
  if (f.kind === 'select' || f.kind === 'choice') {
    const options = f.options.map(([v, l]) => ({ value: v, label: l }))
    return (
      <div className={cn('min-w-0', span)}>
        {f.kind === 'choice' ? (
          <Choice label={label} value={value} onChange={onChange} options={options} />
        ) : (
          <SelectInput label={label} value={value} onChange={onChange} options={options} hint={f.hint} />
        )}
      </div>
    )
  }
  if (f.kind === 'date') {
    return (
      <div className={cn('min-w-0', span)}>
        <DateInput label={label} value={value} onChange={onChange} />
      </div>
    )
  }
  if (f.kind !== 'text') return null
  return <TextInput className={span} label={label} value={value} onChange={onChange} rows={f.rows} placeholder={f.placeholder} hint={f.hint} />
}

function TextInput({ label, value, onChange, rows = 4, placeholder, hint, className }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; hint?: string; className?: string }) {
  const id = useId()
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono tabular-nums"
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-[0.8125rem] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
