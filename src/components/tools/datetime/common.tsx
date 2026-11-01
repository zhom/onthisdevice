import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatOffset, listTimeZones, localTimeZone, todayInputValue, zoneAbbreviation } from './tz'

/**
 * Re-renders on an interval so live clocks and countdowns stay current.
 * Pass `active = false` to stop the timer (paused countdowns, hidden tabs).
 */
export function useNow(intervalMs = 1000, active = true): Date {
  const [now, setNow] = useState<Date>(() => new Date(0))
  useEffect(() => {
    if (!active) return
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs, active])
  return now
}

/** True once the component has mounted on the client — guards hydration output. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

/**
 * Timezone state that starts at UTC (so server-rendered HTML matches) and
 * snaps to the device zone on mount. User edits are never overwritten.
 */
export function useZoneState(): [string, (zone: string) => void] {
  const [zone, setZone] = useState('UTC')
  useEffect(() => {
    setZone(localTimeZone())
  }, [])
  return [zone, setZone]
}

/** `<input type="date">` state that defaults to today in `zone` once mounted. */
export function useTodayInput(zone: string): [string, (value: string) => void] {
  const [value, setValue] = useState('')
  const touched = useRef(false)
  useEffect(() => {
    if (touched.current) return
    setValue(todayInputValue(zone))
  }, [zone])
  const set = useCallback((next: string) => {
    touched.current = true
    setValue(next)
  }, [])
  return [value, set]
}

/** localStorage-backed state that degrades to plain state when storage is blocked. */
export function usePersistentState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial)
  const loaded = useRef(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) setValue(JSON.parse(raw) as T)
    } catch {
      /* storage unavailable — keep the default */
    }
    loaded.current = true
  }, [key])

  useEffect(() => {
    if (!loaded.current) return
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* quota or private mode — values simply won't persist */
    }
  }, [key, value])

  return [value, setValue]
}

interface ZonePickerProps {
  value: string
  onChange: (zone: string) => void
  label?: string
  id?: string
  className?: string
  /** Replaces the default offset line under the field. */
  hint?: React.ReactNode
}

/**
 * IANA timezone picker built on a native datalist: it filters as you type,
 * works with a keyboard and screen reader, and stays usable with 400+ zones.
 * Options are only rendered after mount so they never bloat the static HTML.
 */
export function ZonePicker({ value, onChange, label = 'Timezone', id, className, hint }: ZonePickerProps) {
  const autoId = useId()
  const mounted = useMounted()
  const inputId = id ?? `zone-${autoId}`
  const listId = `${inputId}-list`
  const zones = useMemo(() => (mounted ? listTimeZones() : []), [mounted])
  const [draft, setDraft] = useState(value)

  useEffect(() => setDraft(value), [value])

  const valid = !mounted || zones.includes(draft)

  const commit = (next: string) => {
    const trimmed = next.trim()
    if (zones.includes(trimmed)) {
      onChange(trimmed)
      return
    }
    const ci = zones.find((z) => z.toLowerCase() === trimmed.toLowerCase().replace(/\s+/g, '_'))
    if (ci) {
      onChange(ci)
      setDraft(ci)
      return
    }
    setDraft(value)
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        list={listId}
        value={draft}
        spellCheck={false}
        autoComplete="off"
        aria-invalid={!valid}
        aria-describedby={`${inputId}-hint`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit(draft)
          }
        }}
      />
      <datalist id={listId}>
        {zones.map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>
      <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
        {hint ??
          (!mounted
            ? 'Loading timezone list…'
            : valid
              ? `${formatOffset(new Date(), draft)} · ${zoneAbbreviation(new Date(), draft)}`
              : 'Unknown timezone. Pick one from the list.')}
      </p>
    </div>
  )
}

/** Small labelled block used across the date tools for secondary readouts. */
export function MiniStat({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: string
}) {
  return (
    <div className="rounded-lg bg-card p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-foreground break-words">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

/** A one-line "calculated in <zone>" note so every result states its basis. */
export function ZoneNote({ zone, prefix = 'Calculated in' }: { zone: string; prefix?: string }) {
  const mounted = useMounted()
  if (!mounted) return null
  return (
    <p className="text-xs text-muted-foreground">
      {prefix} <span className="font-medium text-foreground">{zone}</span> (
      {formatOffset(new Date(), zone)}, {zoneAbbreviation(new Date(), zone)})
    </p>
  )
}
