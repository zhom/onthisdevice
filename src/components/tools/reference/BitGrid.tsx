import type { CSSProperties } from 'react'

/**
 * Bits as rows of pixels: a 1 is a filled square, a 0 is empty, 32 per row in groups of 8.
 * Bits inside the prefix are ink; the rest are grey. A changed bit grows or shrinks in place,
 * left to right.
 */
export function BitGrid({ bits, prefix }: { bits: number[]; prefix: number | null }) {
  const rows: number[][] = []
  for (let i = 0; i < bits.length; i += 32) rows.push(bits.slice(i, i + 32))
  return (
    <div className="space-y-1.5" aria-hidden="true">
      {rows.map((row, r) => (
        <div key={r} className="grid w-full max-w-[26rem] grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].filter((g) => g * 8 < row.length).map((g) => (
            <div key={g} className="grid grid-cols-8 gap-[2px]">
              {row.slice(g * 8, g * 8 + 8).map((b, k) => {
                const c = g * 8 + k
                const i = r * 32 + c
                const net = prefix !== null && i < prefix
                return (
                  <span key={c} className="relative aspect-square rounded-[1px] bg-background" style={{ '--i': c } as CSSProperties}>
                    <span
                      className="absolute inset-0 rounded-[1px] transition-transform duration-300 ease-[var(--ease-out)] motion-reduce:transition-none"
                      style={{
                        background: net ? 'var(--foreground)' : 'var(--chart-3)',
                        transform: b ? 'scale(1)' : 'scale(0)',
                        transitionDelay: 'calc(var(--i) * 12ms)',
                      }}
                    />
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Where an address sits inside its range: a bar with a marker that slides to the new place. */
export function RangeBar({ position, startLabel, endLabel }: { position: number; startLabel: string; endLabel: string }) {
  const p = Math.max(0, Math.min(1, position))
  return (
    <div className="space-y-1.5" aria-hidden="true">
      <div className="relative h-3 rounded-full bg-background">
        <div className="absolute inset-0 overflow-x-clip">
        <div className="absolute inset-y-0 left-1.5 right-1.5">
          <div className="h-full w-full transition-transform duration-500 ease-[var(--ease-out)] motion-reduce:transition-none" style={{ transform: `translateX(${p * 100}%)` }}>
            <span className="absolute top-1/2 left-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
          </div>
        </div>
        </div>
      </div>
      <div className="flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
        <span className="min-w-0 truncate">{startLabel}</span>
        <span className="min-w-0 truncate text-right">{endLabel}</span>
      </div>
    </div>
  )
}
