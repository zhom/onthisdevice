import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { fmt } from './_viz/format'
import { useSimLoop } from './_viz/hooks'

/** Grids of matrix cells for the matrix and system calculators. */

export function MatrixInput({
  name,
  rows,
  cols,
  values,
  onChange,
  bar,
}: {
  name: string
  rows: number
  cols: number
  values: string[][]
  onChange: (r: number, c: number, v: string) => void
  /** Column index before which a bar is drawn (augmented matrix). */
  bar?: number
}) {
  return (
    <div className="overflow-x-auto">
      <div
        className="grid w-max gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(3.25rem, 4rem))` }}
        role="group"
        aria-label={`Matrix ${name}, ${rows} by ${cols}`}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => (
            <Input
              key={`${r}-${c}`}
              value={values[r]?.[c] ?? ''}
              onChange={(e) => onChange(r, c, e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              aria-label={`${name} row ${r + 1} column ${c + 1}`}
              className={cn('px-1.5 text-center tabular-nums', bar !== undefined && c === bar && 'ml-2')}
            />
          )),
        )}
      </div>
    </div>
  )
}

export interface Cell {
  pane: number
  r: number
  c: number
}

export interface SweepStep {
  /** Cells to mark in this step. */
  mark: Cell[]
  /** How many cells of the last pane are shown, in row-major order. */
  shown: number
  /** One line that says what this step does. */
  note: string
}

/**
 * Matrices side by side; a sweep marks the input cells used for each result
 * cell and then reveals that cell. Reduced motion: the finished result.
 */
export function MatrixSweep({ panes, steps, ops }: { panes: { label: string; m: number[][] }[]; steps: SweepStep[]; ops: string[] }) {
  const box = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(0)
  const acc = useRef(0)
  const total = steps.length
  const key = JSON.stringify(panes.map((p) => p.m))
  useEffect(() => {
    setI(0)
    acc.current = 0
  }, [key])
  const { reduced } = useSimLoop(
    box,
    (dt) => {
      acc.current += dt
      const per = i >= total - 1 ? 2.4 : 0.8
      if (acc.current > per) {
        acc.current = 0
        setI((v) => (v + 1) % Math.max(1, total))
      }
    },
    total > 0,
  )
  const step: SweepStep | undefined = reduced ? undefined : steps[i]
  const last = panes.length - 1
  const shownCount = reduced || !step ? Infinity : step.shown
  return (
    <div ref={box} className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-4">
        {panes.map((p, k) => (
          <div key={p.label} className="flex items-center gap-3">
            {k > 0 ? <span className="text-lg font-[620] text-muted-foreground">{ops[k - 1]}</span> : null}
            <div className="min-w-0">
              <p className="mb-1 text-[0.8125rem] font-[600] text-muted-foreground">{p.label}</p>
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${p.m[0]?.length ?? 1}, auto)` }}>
                {p.m.map((row, r) =>
                  row.map((v, c) => {
                    const idx = r * row.length + c
                    const marked = !!step?.mark.some((m) => m.pane === k && m.r === r && m.c === c)
                    const hidden = k === last && idx >= shownCount
                    return (
                      <span key={`${r}-${c}`} className="relative grid min-w-10 place-items-center rounded-md px-1.5 py-1 text-[0.875rem] tabular-nums">
                        <span
                          aria-hidden="true"
                          className={cn('absolute inset-0 rounded-md bg-foreground transition-opacity duration-200', marked ? 'opacity-100' : 'opacity-0')}
                        />
                        <span
                          className={cn(
                            'relative transition-opacity duration-300',
                            marked ? 'text-background' : 'text-foreground',
                            hidden ? 'opacity-0' : 'opacity-100',
                          )}
                        >
                          {fmt(v, 5)}
                        </span>
                      </span>
                    )
                  }),
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="min-h-[2.5em] font-mono text-[0.8125rem] break-words text-muted-foreground" aria-hidden="true">
        {step?.note ?? ''}
      </p>
    </div>
  )
}
