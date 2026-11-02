/** A step of 1, 2, 2.5 or 5 times a power of ten near range / count. */
export function niceStep(range: number, count: number): number {
  const raw = Math.abs(range) / Math.max(1, count)
  if (!Number.isFinite(raw) || raw === 0) return 1
  const pow = 10 ** Math.floor(Math.log10(raw))
  const n = raw / pow
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return m * pow
}

/** Round a domain out to nice ticks. Returns the domain and the ticks in it. */
export function niceDomain(min: number, max: number, count = 4): { min: number; max: number; ticks: number[] } {
  let lo = Number.isFinite(min) ? min : 0
  let hi = Number.isFinite(max) ? max : 1
  if (hi < lo) [lo, hi] = [hi, lo]
  if (hi === lo) {
    hi = lo === 0 ? 1 : lo + Math.abs(lo) * 0.1
    if (lo !== 0 && lo > 0) lo = 0
  }
  const step = niceStep(hi - lo, count)
  const a = Math.floor(lo / step + 1e-9) * step
  const b = Math.ceil(hi / step - 1e-9) * step
  const ticks: number[] = []
  for (let v = a; v <= b + step * 1e-6; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v)
  return { min: a, max: b, ticks }
}

/** Round a pixel position to 0.01 px, so the server and browser render the same attribute text. */
export function px(v: number): number {
  return Math.round(v * 100) / 100
}

/** Linear map from a domain to a range, rounded to 0.01 px. */
export function linear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const span = d1 - d0
  if (span === 0) return () => px((r0 + r1) / 2)
  const k = (r1 - r0) / span
  return (v: number) => px(r0 + (v - d0) * k)
}

/** Short axis label: 950, 1.2k, 3.4M, 1.1B. */
export function compact(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return ''
  const a = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const f = (v: number) => {
    const s = v.toFixed(digits)
    return s.includes('.') ? s.replace(/\.?0+$/, '') : s
  }
  if (a >= 1e9) return `${sign}${f(a / 1e9)}B`
  if (a >= 1e6) return `${sign}${f(a / 1e6)}M`
  if (a >= 1e3) return `${sign}${f(a / 1e3)}k`
  return `${sign}${f(a)}`
}

/** Pick about `want` evenly spaced indexes from 0..n-1, always with the ends. */
export function pickIndexes(n: number, want: number): number[] {
  if (n <= 0) return []
  if (n <= want) return Array.from({ length: n }, (_, i) => i)
  const step = Math.ceil((n - 1) / Math.max(1, want - 1))
  const out: number[] = []
  for (let i = 0; i < n - 1; i += step) out.push(i)
  const last = out[out.length - 1] ?? 0
  if (n - 1 - last < step / 2 && out.length > 1) out.pop()
  out.push(n - 1)
  return out
}

/** Nice x tick values inside [x0, x1], never closer than the data spacing. */
export function niceTicksIn(x0: number, x1: number, want: number, minStep = 0): number[] {
  if (!(x1 > x0)) return [x0]
  let step = niceStep(x1 - x0, Math.max(1, want))
  if (minStep > 0 && step < minStep) step = Math.ceil(minStep)
  const out: number[] = []
  const first = Math.ceil(x0 / step - 1e-9) * step
  for (let v = first; v <= x1 + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)))
  return out
}

/** Indexes to label in a run of n bars: the first, then every nice step (1-based). */
export function barLabelIndexes(n: number, want: number): number[] {
  if (n <= want) return Array.from({ length: n }, (_, i) => i)
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500]
  const step = steps.find((s) => Math.ceil(n / s) <= want) ?? Math.ceil(n / want)
  const out = [0]
  for (let i = step - 1; i < n; i += step) if (i > 0) out.push(i)
  return out
}
