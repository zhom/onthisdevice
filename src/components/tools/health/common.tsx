/**
 * Shared primitives for the Health Calculators category.
 *
 * Everything here is private to `src/components/tools/health/*` — unit handling,
 * measurement inputs that convert between metric and imperial without losing what
 * the user typed, the "show your working" formula block, and the standard
 * not-medical-advice note.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/* ─────────────────────────── units ─────────────────────────── */

export type UnitSystem = 'metric' | 'imperial'
export type Sex = 'male' | 'female'

export const CM_PER_IN = 2.54
export const KG_PER_LB = 0.45359237
export const LB_PER_KG = 1 / KG_PER_LB
export const KM_PER_MI = 1.609344
export const ML_PER_FLOZ = 29.5735295625

export const cmToIn = (cm: number) => cm / CM_PER_IN
export const inToCm = (inch: number) => inch * CM_PER_IN
export const kgToLb = (kg: number) => kg * LB_PER_KG
export const lbToKg = (lb: number) => lb * KG_PER_LB

const UNIT_KEY = 'otd:health:units'
const UNIT_EVENT = 'otd:health:units'

/** Unit system shared across every health calculator, remembered per browser. */
export function useUnitSystem(): [UnitSystem, (u: UnitSystem) => void] {
  const [units, setUnits] = useState<UnitSystem>('metric')

  useEffect(() => {
    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(UNIT_KEY)
    } catch {
      stored = null
    }
    if (stored === 'metric' || stored === 'imperial') {
      setUnits(stored)
    } else if (/^en-(US|LR|MM)\b/i.test(navigator.language || '')) {
      setUnits('imperial')
    }

    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<UnitSystem>).detail
      if (detail === 'metric' || detail === 'imperial') setUnits(detail)
    }
    window.addEventListener(UNIT_EVENT, onCustom)
    return () => window.removeEventListener(UNIT_EVENT, onCustom)
  }, [])

  const update = useCallback((u: UnitSystem) => {
    setUnits(u)
    try {
      window.localStorage.setItem(UNIT_KEY, u)
    } catch {
      /* private mode — the toggle still works for this session */
    }
    window.dispatchEvent(new CustomEvent<UnitSystem>(UNIT_EVENT, { detail: u }))
  }, [])

  return [units, update]
}

/* ─────────────────────────── formatting ─────────────────────────── */

export function round(n: number, dp = 1): number {
  if (!Number.isFinite(n)) return 0
  const f = 10 ** dp
  return Math.round(n * f) / f
}

export function fmt(n: number, dp = 1): string {
  if (!Number.isFinite(n)) return '–'
  return round(n, dp).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: dp,
  })
}

/** Centimetres as feet and inches, rounded to 0.1 in first so 182.8 cm is 6 ft 0 in, not 5 ft 12 in. */
export function feetInches(cm: number): { ft: number; inch: number } {
  const total = round(cmToIn(cm), 1)
  const ft = Math.floor(total / 12)
  return { ft, inch: round(total - ft * 12, 1) }
}

/** Trim a number to a compact editable string ("175", "72.5"). */
function toText(n: number, dp: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  return String(round(n, dp))
}

/** No body measure, age or duration here comes near a million; larger input counts as empty. */
const MAX_INPUT = 1e6

function parseText(s: string): number {
  const cleaned = s.replace(/,/g, '.').trim()
  if (cleaned === '') return 0
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 && n <= MAX_INPUT ? n : 0
}

export function kcal(n: number): string {
  if (!Number.isFinite(n)) return '–'
  return `${Math.round(n).toLocaleString('en-US')} kcal`
}

/** Seconds → "7:42" or "3:21:05". */
export function hms(totalSeconds: number, forceHours = false): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '–'
  const t = Math.round(totalSeconds)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const pad = (v: number) => String(v).padStart(2, '0')
  return h > 0 || forceHours ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/* ─────────────────────────── controls ─────────────────────────── */

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: SegmentedOption<T>[]
  label: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex w-full flex-wrap gap-1 rounded-lg bg-muted p-1',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 rounded-md px-2.5 py-1.5 text-center text-sm font-medium whitespace-nowrap transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:outline-none',
              active
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function UnitToggle({
  units,
  onChange,
  className,
}: {
  units: UnitSystem
  onChange: (u: UnitSystem) => void
  className?: string
}) {
  return (
    <Segmented
      label="Unit system"
      className={cn('max-w-[20rem]', className)}
      value={units}
      onChange={onChange}
      options={[
        { value: 'metric', label: 'Metric' },
        { value: 'imperial', label: 'Imperial / US' },
      ]}
    />
  )
}

/** Label + control + hint, laid out consistently across every calculator. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {htmlFor ? (
        <Label htmlFor={htmlFor}>{label}</Label>
      ) : (
        <span className="text-sm font-medium leading-none">{label}</span>
      )}
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function SexToggle({
  sex,
  onChange,
  hint = 'These equations were built from male and female reference groups. Pick the one closest to your physiology.',
}: {
  sex: Sex
  onChange: (s: Sex) => void
  hint?: ReactNode
}) {
  return (
    <Field label="Sex" hint={hint}>
      <Segmented
        label="Sex"
        value={sex}
        onChange={onChange}
        options={[
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
        ]}
      />
    </Field>
  )
}

/**
 * Numeric input that keeps its own text so half-typed values ("5.", "") survive,
 * while emitting a clean number upward.
 */
function useNumericText(value: number, onChange: (n: number) => void, dp: number) {
  const [text, setText] = useState(() => toText(value, dp))
  const own = useRef(value)

  useEffect(() => {
    if (Math.abs(own.current - value) > 1e-9) {
      own.current = value
      setText(toText(value, dp))
    }
  }, [value, dp])

  const handle = useCallback(
    (s: string) => {
      setText(s)
      const n = parseText(s)
      own.current = n
      onChange(n)
    },
    [onChange],
  )

  return { text, handle }
}

interface ScalarFieldProps {
  id: string
  label: string
  value: number
  onChange: (n: number) => void
  unit?: string
  hint?: ReactNode
  min?: number
  max?: number
  step?: number
  dp?: number
  placeholder?: string
  ariaLabel?: string
  className?: string
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  unit,
  hint,
  min = 0,
  max,
  step = 1,
  dp = 1,
  placeholder,
  ariaLabel,
  className,
}: ScalarFieldProps) {
  const { text, handle } = useNumericText(value, onChange, dp)
  return (
    <Field label={label} htmlFor={id} hint={hint} className={className}>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onChange={(e) => handle(e.target.value)}
          className={cn(unit && 'pr-14')}
        />
        {unit ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
          >
            {unit}
          </span>
        ) : null}
      </div>
    </Field>
  )
}

/**
 * A field whose canonical value is metric but which may be displayed in another
 * unit. Remounted (via `key`) whenever the unit system flips, so the text always
 * re-seeds from the canonical value.
 */
function ConvertedField({
  id,
  label,
  canonical,
  onChange,
  toDisplay,
  fromDisplay,
  unit,
  hint,
  step,
  max,
  dp = 1,
  placeholder,
}: {
  id: string
  label: string
  canonical: number
  onChange: (c: number) => void
  toDisplay: (c: number) => number
  fromDisplay: (d: number) => number
  unit: string
  hint?: ReactNode
  step: number
  max?: number
  dp?: number
  placeholder?: string
}) {
  const [text, setText] = useState(() => toText(toDisplay(canonical), dp))
  const own = useRef(canonical)

  useEffect(() => {
    if (Math.abs(own.current - canonical) > 1e-9) {
      own.current = canonical
      setText(toText(toDisplay(canonical), dp))
    }
  }, [canonical, dp, toDisplay])

  const handle = (s: string) => {
    setText(s)
    const c = fromDisplay(parseText(s))
    own.current = c
    onChange(c)
  }

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          min={0}
          max={max}
          step={step}
          placeholder={placeholder}
          onChange={(e) => handle(e.target.value)}
          className="pr-12"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
        >
          {unit}
        </span>
      </div>
    </Field>
  )
}

function FeetInchesField({
  id,
  label,
  cm,
  onChange,
  hint,
}: {
  id: string
  label: string
  cm: number
  onChange: (cm: number) => void
  hint?: ReactNode
}) {
  const seed = (v: number) => {
    if (!(v > 0)) return { ft: '', inch: '' }
    const { ft, inch } = feetInches(v)
    return { ft: String(ft), inch: String(inch) }
  }
  const [{ ft, inch }, setParts] = useState(() => seed(cm))
  const own = useRef(cm)

  useEffect(() => {
    if (Math.abs(own.current - cm) > 1e-9) {
      own.current = cm
      setParts(seed(cm))
    }
  }, [cm])

  const emit = (nextFt: string, nextIn: string) => {
    setParts({ ft: nextFt, inch: nextIn })
    const total = parseText(nextFt) * 12 + parseText(nextIn)
    const next = total > 0 ? inToCm(total) : 0
    own.current = next
    onChange(next)
  }

  return (
    <Field label={label} htmlFor={`${id}-ft`} hint={hint}>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <Input
            id={`${id}-ft`}
            type="number"
            inputMode="numeric"
            min={0}
            max={8}
            step={1}
            value={ft}
            placeholder="5"
            aria-label={`${label} in feet`}
            onChange={(e) => emit(e.target.value, inch)}
            className="pr-10"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
          >
            ft
          </span>
        </div>
        <div className="relative">
          <Input
            id={`${id}-in`}
            type="number"
            inputMode="decimal"
            min={0}
            max={11.9}
            step={0.5}
            value={inch}
            placeholder="9"
            aria-label={`${label} in inches`}
            onChange={(e) => emit(ft, e.target.value)}
            className="pr-10"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
          >
            in
          </span>
        </div>
      </div>
    </Field>
  )
}

/** Height, stored in cm. Shows ft + in in imperial. */
export function HeightField({
  id,
  cm,
  onChange,
  units,
  label = 'Height',
}: {
  id: string
  cm: number
  onChange: (cm: number) => void
  units: UnitSystem
  label?: string
}) {
  const alt =
    cm > 0
      ? units === 'metric'
        ? `${feetInches(cm).ft} ft ${fmt(feetInches(cm).inch, 1)} in`
        : `${fmt(cm, 1)} cm`
      : undefined

  if (units === 'imperial') {
    return <FeetInchesField key="imperial" id={id} label={label} cm={cm} onChange={onChange} hint={alt} />
  }
  return (
    <ConvertedField
      key="metric"
      id={id}
      label={label}
      canonical={cm}
      onChange={onChange}
      toDisplay={(c) => c}
      fromDisplay={(d) => d}
      unit="cm"
      step={0.5}
      max={280}
      placeholder="175"
      hint={alt}
    />
  )
}

/** Weight, stored in kg. Shows lb in imperial. */
export function WeightField({
  id,
  kg,
  onChange,
  units,
  label = 'Weight',
  hint,
}: {
  id: string
  kg: number
  onChange: (kg: number) => void
  units: UnitSystem
  label?: string
  hint?: ReactNode
}) {
  const metric = units === 'metric'
  const lb = kgToLb(kg)
  const alt =
    kg > 0
      ? metric
        ? `${fmt(lb, 1)} lb · ${Math.floor(lb / 14)} st ${fmt(lb % 14, 1)} lb`
        : `${fmt(kg, 1)} kg · ${Math.floor(lb / 14)} st ${fmt(lb % 14, 1)} lb`
      : undefined

  return (
    <ConvertedField
      key={units}
      id={id}
      label={label}
      canonical={kg}
      onChange={onChange}
      toDisplay={(c) => (metric ? c : kgToLb(c))}
      fromDisplay={(d) => (metric ? d : lbToKg(d))}
      unit={metric ? 'kg' : 'lb'}
      step={metric ? 0.1 : 0.5}
      max={metric ? 500 : 1100}
      placeholder={metric ? '70' : '154'}
      hint={hint ?? alt}
    />
  )
}

/** A body circumference (waist, neck, hip), stored in cm. */
export function LengthField({
  id,
  cm,
  onChange,
  units,
  label,
  hint,
}: {
  id: string
  cm: number
  onChange: (cm: number) => void
  units: UnitSystem
  label: string
  hint?: ReactNode
}) {
  const metric = units === 'metric'
  const alt = cm > 0 ? (metric ? `${fmt(cmToIn(cm), 1)} in` : `${fmt(cm, 1)} cm`) : undefined
  return (
    <ConvertedField
      key={units}
      id={id}
      label={label}
      canonical={cm}
      onChange={onChange}
      toDisplay={(c) => (metric ? c : cmToIn(c))}
      fromDisplay={(d) => (metric ? d : inToCm(d))}
      unit={metric ? 'cm' : 'in'}
      step={metric ? 0.5 : 0.25}
      max={metric ? 300 : 120}
      hint={hint ?? alt}
    />
  )
}

/* ─────────────────────────── output blocks ─────────────────────────── */

export interface FormulaLine {
  label?: string
  expr: string
  result?: string
}

/** "Show the working": the equation with the user's own numbers substituted in. */
export function FormulaBlock({
  lines,
  title = 'The formula, with your numbers',
  note,
}: {
  lines: FormulaLine[]
  title?: string
  note?: ReactNode
}) {
  return (
    <section className="rounded-xl bg-muted p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 overflow-x-auto">
        <dl className="min-w-max space-y-2 font-mono text-[13px] leading-relaxed">
          {lines.map((l, i) => (
            <div key={i} className="flex flex-wrap items-baseline gap-x-2">
              {l.label ? (
                <dt className="font-sans text-xs font-medium text-muted-foreground">{l.label}</dt>
              ) : null}
              <dd className="text-foreground">
                <span>{l.expr}</span>
                {l.result ? (
                  <>
                    <span className="text-muted-foreground"> = </span>
                    <span className="font-semibold">{l.result}</span>
                  </>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {note ? <p className="mt-3 font-sans text-xs text-muted-foreground">{note}</p> : null}
    </section>
  )
}

/** Plain-language reading of the result. */
export function Interpretation({
  title = 'What this means',
  children,
}: {
  title?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 space-y-2 text-sm text-muted-foreground [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  )
}

export function EstimateNote({ children }: { children?: ReactNode }) {
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground"
    >
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        {children ?? (
          <>
            This is a population-average estimate, not medical advice. Real numbers vary with
            genetics, training history, medication and health conditions. Check anything important
            with a doctor or a registered dietitian.
          </>
        )}
      </span>
    </p>
  )
}

export interface Band {
  label: string
  /** Inclusive lower bound. */
  min: number
  /** Exclusive upper bound; use Infinity for the top band. */
  max: number
  /** Tailwind background class from the token palette. */
  tone: string
  note?: string
}

export function bandFor(bands: Band[], value: number): Band | undefined {
  if (!Number.isFinite(value)) return undefined
  return bands.find((b) => value >= b.min && value < b.max)
}

export function BandTable({
  bands,
  active,
  unit,
  caption,
  head = 'Range',
  dp = 1,
}: {
  bands: Band[]
  active?: string
  unit?: string
  caption?: string
  head?: string
  dp?: number
}) {
  const range = (b: Band) => {
    const suffix = unit ? ` ${unit}` : ''
    if (!Number.isFinite(b.max)) return `${fmt(b.min, dp)}${suffix} and above`
    if (b.min <= 0) return `under ${fmt(b.max, dp)}${suffix}`
    return `${fmt(b.min, dp)} – ${fmt(b.max, dp)}${suffix}`
  }
  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="w-full min-w-[20rem] text-sm">
        {caption ? (
          <caption className="px-4 pt-3 pb-2 text-left text-xs text-muted-foreground">
            {caption}
          </caption>
        ) : null}
        <thead>
          <tr className="border-b border-border bg-muted text-left">
            <th scope="col" className="px-4 py-2 font-medium">
              Category
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              {head}
            </th>
          </tr>
        </thead>
        <tbody>
          {bands.map((b) => {
            const isActive = b.label === active
            return (
              <tr
                key={b.label}
                className={cn('border-b border-border last:border-0', isActive && 'bg-background')}
              >
                <th scope="row" className="px-4 py-2 text-left font-normal">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn(isActive && 'font-semibold')}>{b.label}</span>
                    {isActive ? (
                      <span className="text-xs font-medium text-muted-foreground">You</span>
                    ) : null}
                  </span>
                  {b.note ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{b.note}</span>
                  ) : null}
                </th>
                <td className="px-4 py-2 whitespace-nowrap tabular-nums">{range(b)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Standard layout: inputs on the left, results on the right. */
export function CalcLayout({ inputs, results }: { inputs: ReactNode; results: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
      <div className="space-y-4">{inputs}</div>
      <div className="min-w-0 space-y-4">{results}</div>
    </div>
  )
}

export function StatGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div
      className={cn(
        'grid gap-3 sm:grid-cols-2',
        cols === 3 && 'lg:grid-cols-3',
        cols === 4 && 'lg:grid-cols-4',
      )}
    >
      {children}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[8rem] items-center justify-center rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

/* ─────────────────────────── physiology ─────────────────────────── */

export function bmiOf(kg: number, cm: number): number {
  const m = cm / 100
  if (!(m > 0) || !(kg > 0)) return NaN
  return kg / (m * m)
}

export function mifflinStJeor(sex: Sex, kg: number, cm: number, age: number): number {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161)
}

export function harrisBenedict(sex: Sex, kg: number, cm: number, age: number): number {
  return sex === 'male'
    ? 88.362 + 13.397 * kg + 4.799 * cm - 5.677 * age
    : 447.593 + 9.247 * kg + 3.098 * cm - 4.33 * age
}

/** Needs body fat %, because it works from lean body mass. */
export function katchMcArdle(kg: number, bodyFatPct: number): number {
  return 370 + 21.6 * kg * (1 - bodyFatPct / 100)
}

export interface ActivityLevel {
  id: string
  label: string
  multiplier: number
  description: string
}

export const ACTIVITY_LEVELS: ActivityLevel[] = [
  {
    id: 'sedentary',
    label: 'Sedentary',
    multiplier: 1.2,
    description: 'Desk job, mostly sitting, no deliberate exercise beyond moving around the house.',
  },
  {
    id: 'light',
    label: 'Lightly active',
    multiplier: 1.375,
    description:
      'Light exercise 1–3 days a week, or a job that keeps you on your feet for part of the day.',
  },
  {
    id: 'moderate',
    label: 'Moderately active',
    multiplier: 1.55,
    description:
      'Moderate exercise 3–5 days a week: gym sessions, running, team sport, hard cycling commutes.',
  },
  {
    id: 'very',
    label: 'Very active',
    multiplier: 1.725,
    description: 'Hard exercise 6–7 days a week, or a physical job on top of regular training.',
  },
  {
    id: 'extra',
    label: 'Extra active',
    multiplier: 1.9,
    description: 'Twice-a-day training, manual labour, or an athlete in a heavy training block.',
  },
]

export function activityById(id: string): ActivityLevel {
  return ACTIVITY_LEVELS.find((a) => a.id === id) ?? ACTIVITY_LEVELS[0]!
}

/** Sensible floors so a calculator never suggests something silly. */
export const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 }

/** Energy stored in one kilogram / pound of body-fat tissue. */
export const KCAL_PER_KG_FAT = 7700
export const KCAL_PER_LB_FAT = 3500
