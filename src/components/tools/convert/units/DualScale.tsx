/**
 * Two rulers on one track: the top one counts in the source unit, the bottom one in the
 * target unit, and an ink bar runs to the value. The spacing of the ticks shows how big each
 * unit is. Ticks move with transform and fade in; the bar scales. Reduced motion: no transitions.
 */
import { useMemo } from 'react'
import { useWidth } from '@/components/viz'
import { cn } from '@/lib/utils'
import { D, convert, formatValue, type Dec, type UnitLite } from '@/lib/convert/units/engine'

interface Props {
  from: UnitLite
  to: UnitLite
  value: Dec | null
  binary: boolean
}

/** 1, 2 or 5 times a power of ten, at or above `x`. */
function niceCeil(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return 1
  const p = 10 ** Math.floor(Math.log10(x))
  for (const m of [1, 2, 5, 10]) if (m * p >= x - 1e-12 * p) return m * p
  return 10 * p
}

function niceStep(span: number, count: number): number {
  const raw = span / (Math.max(1, count) + 1)
  const p = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p
  return 10 * p
}

function ticksIn(lo: number, hi: number, count: number): number[] {
  if (!(hi > lo)) return []
  const step = niceStep(hi - lo, count)
  const out: number[] = []
  const start = Math.ceil(lo / step - 1e-9) * step
  for (let v = start; v <= hi + step * 1e-9 && out.length < 40; v += step) out.push(Number(v.toPrecision(12)))
  return out
}

function short(v: number): string {
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs >= 1e6 || abs < 0.001) return formatValue(new D(v.toPrecision(6)), 'auto', 3)
  return formatValue(new D(v.toPrecision(6)), 'auto', 6)
}

interface Tick {
  key: string
  x: number
  label: string
}

export function DualScale({ from, to, value, binary }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>(600)

  const model = useMemo(() => {
    const v = value && value.isFinite() ? value.toNumber() : 1
    // Domain in source units. Inverse units have no zero, so the scale starts above it.
    const inverse = Boolean(from.inverse) !== Boolean(to.inverse)
    const hiRaw = Math.abs(v) * 1.25
    let lo = v < 0 ? -niceCeil(Math.abs(v) * 1.25) : 0
    let hi = v > 0 ? niceCeil(hiRaw) : v < 0 ? 0 : 1
    if (from.offset || to.offset) {
      // Temperatures: keep both zero points of the two scales in view when they are near.
      const zeroOther = convert(new D(0), to, from, binary).toNumber()
      if (zeroOther < 0 && zeroOther > -1000) lo = Math.min(lo, -niceCeil(-zeroOther))
      if (zeroOther > 0 && zeroOther < 1000) hi = Math.max(hi, niceCeil(zeroOther * 1.1))
    }
    if (inverse) lo = hi / 20
    const span = hi - lo
    const pos = (a: number) => (a - lo) / span
    const count = Math.max(3, Math.min(8, Math.floor(width / 90)))

    const top: Tick[] = ticksIn(lo, hi, count)
      .filter((t) => t >= lo && t <= hi)
      .map((t) => ({ key: `a${t}`, x: pos(t), label: short(t) }))

    const toOf = (a: number) => convert(new D(a.toPrecision(15)), from, to, binary).toNumber()
    const fromOf = (b: number) => convert(new D(b.toPrecision(15)), to, from, binary).toNumber()
    const bLo = toOf(lo)
    const bHi = toOf(hi)
    const minGap = 70 / Math.max(width, 1)
    const bottom: Tick[] = []
    for (const t of ticksIn(Math.min(bLo, bHi), Math.max(bLo, bHi), count)) {
      if (inverse && t === 0) continue
      const x = pos(fromOf(t))
      if (!(x >= -0.001 && x <= 1.001)) continue
      if (bottom.some((b) => Math.abs(b.x - x) < minGap)) continue
      bottom.push({ key: `b${t}`, x, label: short(t) })
    }

    const zero = Math.min(1, Math.max(0, pos(Math.max(lo, Math.min(0, hi)))))
    const at = Math.min(1, Math.max(0, pos(v)))
    return { top, bottom, start: Math.min(zero, at), end: Math.max(zero, at), at }
  }, [value, from, to, binary, width])

  const tick = (t: Tick, below: boolean) => (
    <span
      key={t.key}
      className={cn(
        'absolute top-0 left-0 flex flex-col items-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300',
        'transition-transform duration-300 ease-[var(--ease-out)] motion-reduce:transition-none',
      )}
      style={{ transform: `translateX(${t.x * width}px) translateX(-50%)` }}
    >
      {below ? <span className="h-2 w-px bg-foreground" aria-hidden="true" /> : null}
      <span className="num whitespace-nowrap text-[0.75rem] text-muted-foreground">{t.label}</span>
      {below ? null : <span className="h-2 w-px bg-foreground" aria-hidden="true" />}
    </span>
  )

  return (
    <figure className="w-full">
      <div ref={ref} className="relative mx-auto w-[calc(100%-2.5rem)]" aria-hidden="true">
        <div className="relative h-7">{model.top.map((t) => tick(t, false))}</div>
        <div className="relative h-3 overflow-hidden rounded-sm bg-background">
          <div
            className="absolute inset-y-0 left-0 w-full origin-left bg-foreground transition-transform duration-300 ease-[var(--ease-out)] motion-reduce:transition-none"
            style={{ transform: `translateX(${model.start * width}px) scaleX(${Math.max(0, model.end - model.start)})` }}
          />
        </div>
        <div className="relative h-7">{model.bottom.map((t) => tick(t, true))}</div>
      </div>
      <figcaption className="mt-2 flex justify-between gap-4 text-[0.8125rem] text-muted-foreground">
        <span>Top: {from.plural}</span>
        <span>Bottom: {to.plural}</span>
      </figcaption>
    </figure>
  )
}
