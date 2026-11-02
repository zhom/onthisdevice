import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export interface RangeOption<T extends string> {
  id: T
  label: string
}

/** Segmented control for a chart's time range (or any small choice). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: RangeOption<T>[]
  label: string
  className?: string
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)} className={className}>
      <TabsList aria-label={label} className="w-full sm:w-fit">
        {options.map((o) => (
          <TabsTrigger key={o.id} value={o.id} className="px-2.5 sm:px-3">
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

export type Loaded<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: T }

/** Runs an async loader when `key` changes; ignores results of superseded calls. */
export function useLoaded<T>(key: string | null, load: () => Promise<T>): Loaded<T> {
  const [result, setResult] = useState<Loaded<T>>({ state: 'loading' })
  useEffect(() => {
    if (key === null) return
    let live = true
    setResult((r) => (r.state === 'ready' ? r : { state: 'loading' }))
    load().then(
      (data) => live && setResult({ state: 'ready', data }),
      (e: unknown) => live && setResult({ state: 'error', message: e instanceof Error ? e.message : String(e) }),
    )
    return () => {
      live = false
    }
    // `load` is recreated each render; `key` names what it loads.
  }, [key])
  return result
}

/** A label/value row list without borders (definition list). */
export function Facts({ rows, className }: { rows: [string, ReactNode][]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm', className)}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words font-[560] text-foreground tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Shown while a lazy data file loads: a row of pixels that scans (ProgressPanel's look, inline). */
export function Loading({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2 py-2">
      <div className="px-row w-full max-w-[16rem]">
        <div className="px-scan" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
