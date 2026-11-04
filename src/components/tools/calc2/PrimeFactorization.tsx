import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { fitsEngine, powers } from '@/lib/engine/factor'
import { useFactors } from '@/lib/engine/useFactors'
import { CalcLayout, NumField, Result, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import type { Ink } from './_viz/hooks'
import { clamp01, phase, useTimeline } from './geo-anim'
import { MAX_FACTOR, divisorCount, divisors, factorize, flatFactors, isPrime, parseWhole, powerForm } from './primes'
import type { PrimePower } from './primes'

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (e: number) => String(e).replace(/\d/g, (c) => SUP[Number(c)] ?? c)
const STEP = 0.45
const MAX_SPLITS = 12
/** Longest number drawn in full in the tree. */
const MAX_LABEL = 22

const label = (v: bigint) => {
  const s = String(v)
  return s.length <= MAX_LABEL ? s : `${s.slice(0, 8)}…${s.slice(-8)}`
}

interface Tree {
  /** The composite numbers down the right-hand side of the tree. */
  chain: string[]
  /** Prime (or prime power) leaves, one per split, plus the last one. */
  leaves: string[]
  levels: number
}

function buildTree(n: bigint, f: PrimePower[]): Tree {
  const flat = flatFactors(f)
  const items: { label: string; value: bigint }[] =
    flat.length - 1 <= MAX_SPLITS ? flat.map((p) => ({ label: label(p), value: p })) : f.map(({ p, e }) => ({ label: e === 1 ? label(p) : `${label(p)}${sup(e)}`, value: p ** BigInt(e) }))
  if (flat.length === 1) return { chain: [], leaves: [label(n)], levels: 0 }
  // A single prime power with too many repeats to draw: one branch to "pᵉ".
  if (items.length === 1) return { chain: [label(n)], leaves: [items[0]!.label], levels: 1 }
  const chain: string[] = []
  let c = n
  for (let i = 0; i < items.length - 1; i++) {
    chain.push(label(c))
    c /= items[i]!.value
  }
  return { chain, leaves: items.map((i) => i.label), levels: items.length - 1 }
}

export default function PrimeFactorization() {
  const f = useFields({ n: '360' })
  const n = parseWhole(f.raw.n)
  const error =
    f.raw.n.trim() === ''
      ? 'Enter a whole number.'
      : n === null
        ? 'Use a whole number with digits only, such as 360.'
        : n < 2n
          ? 'Prime factorization starts at 2.'
          : !fitsEngine(n)
            ? 'Use a number of up to 300 digits.'
            : null

  // Up to 10¹⁸ BigInt answers before the next frame. Above that the engine takes over.
  const big = !error && n !== null && n > MAX_FACTOR
  const run = useFactors(big ? n : null)
  const finished = big && !run.running && run.rest === 1n && run.primes.length > 0
  const partial = big && !finished

  const data = useMemo(() => {
    if (error || n === null || partial) return null
    const fac = big ? powers(run.primes) : factorize(n)
    const prime = big ? fac.length === 1 && fac[0]!.e === 1 : isPrime(n)
    return { n, fac, flat: flatFactors(fac), tree: buildTree(n, fac), count: divisorCount(fac), divs: divisors(fac, 64), prime }
  }, [error, n, big, partial, run.primes])

  const end = data ? 0.25 + (data.tree.levels + 1) * STEP + 0.3 : 1
  const tl = useTimeline((p, ink, t) => data && paintTree(p.ctx, p.w, data.tree, t, ink), { key: `${f.raw.n}:${data ? 1 : 0}`, still: end, end })

  const working = data
    ? [
        ...divisionLines(data.n, data.flat),
        `${data.n} = ${data.flat.join(' × ')}`,
        `${' '.repeat(String(data.n).length)} = ${powerForm(data.fac)}`,
        `divisors = ${data.fac.map(({ e }) => `(${e} + 1)`).join(' × ')} = ${data.count}`,
        ...(data.divs ? [`divisors: ${data.divs.join(', ')}`] : []),
      ]
    : []

  const height = data ? 44 + data.tree.levels * 52 + 34 : 200

  return (
    <CalcLayout
      inputs={<NumField label="Whole number" {...f.bind('n')} inputMode="numeric" error={error} hint="From 2 up to 300 digits." />}
      result={
        <Result
          label={data?.prime ? 'Prime factorization (the number is prime)' : partial ? 'Prime factors found so far' : 'Prime factorization'}
          value={data ? powerForm(data.fac) : partial ? partialForm(run.primes, run.rest) : '–'}
          sub={
            partial
              ? run.error ?? searchNote(run.running, run.digits)
              : data && data.flat.length > 1
                ? `${data.n} = ${data.flat.length <= 24 ? data.flat.join(' × ') : `${data.flat.length} prime factors`}`
                : undefined
          }
          error={error}
          copy={data ? `${data.n} = ${powerForm(data.fac)}` : undefined}
        >
          {partial && run.running ? (
            <Button variant="secondary" size="sm" onClick={run.stop}>
              Stop
            </Button>
          ) : null}
          {data ? (
            <>
              <Stat label="Prime factors" value={data.flat.length} format={(v) => String(Math.round(v))} />
              <Stat label="Distinct primes" value={data.fac.length} format={(v) => String(Math.round(v))} />
              <Stat label="Number of divisors" value={data.count.toString()} />
              <Stat label="Is it prime?" value={data.prime ? 'Yes' : 'No'} />
              {big && run.elapsed !== null ? <Stat label="Time on this device" value={`${(run.elapsed / 1000).toFixed(run.elapsed < 10_000 ? 2 : 0)} s`} /> : null}
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage
          summary={
            data
              ? data.prime
                ? `${data.n} is prime, so its tree is a single leaf.`
                : `Factor tree of ${data.n}: each step splits off the smallest prime (filled box) and carries the rest down to the right, until only primes are left. The leaves multiply back to ${data.n}.`
              : 'Enter a whole number to grow its factor tree.'
          }
          bar={<SimBar playing={tl.playing} onPlaying={tl.setPlaying} onReplay={tl.replay} reduced={tl.reduced} />}
        >
          <canvas ref={tl.canvas} className="block w-full" style={{ height }} role="img" aria-label={data ? `Factor tree: ${data.n} = ${powerForm(data.fac)}` : 'Factor tree'} />
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="Divide by the smallest prime that goes in, again and again, until the quotient is prime." /> : null}
    />
  )
}

function partialForm(primes: bigint[], rest: bigint): string {
  const known = primes.length ? powerForm(powers(primes)) : ''
  if (rest === 1n) return known
  const unsplit = `(a ${String(rest).length}-digit number)`
  return known ? `${known} × ${unsplit}` : unsplit
}

function searchNote(running: boolean, digits: number): string {
  if (!running) return 'Stopped. The number in brackets is not split yet.'
  return digits ? `Looking for a factor of about ${digits} digits in parallel. Each larger size takes several times longer.` : 'Working…'
}

function divisionLines(n: bigint, flat: bigint[]): string[] {
  if (flat.length === 1) return [`${n} has no divisor between 2 and √${n}, so it is prime`]
  const out: string[] = []
  let c = n
  const shown = flat.length > 30 ? 30 : flat.length - 1
  for (let i = 0; i < shown; i++) {
    const p = flat[i]!
    out.push(`${c} ÷ ${p} = ${c / p}`)
    c /= p
  }
  if (shown < flat.length - 1) out.push(`… ${flat.length - 1 - shown} more divisions`)
  out.push(`${flat[flat.length - 1]} is prime`)
  return out
}

/** Scale of a node that pops in after its edge: 0, a small overshoot, then 1. */
function pop(t: number, t0: number): number {
  const p = clamp01((t - t0 - 0.18) / 0.24)
  return p <= 0 ? 0 : Math.min(1, p * 1.6) + 0.1 * Math.sin(Math.PI * p)
}

function paintTree(ctx: CanvasRenderingContext2D, w: number, tree: Tree, t: number, ink: Ink) {
  const dy = 52
  const top = 30
  const font = (wt: number, size: number) => `${wt} ${size}px ${ink.font}`
  ctx.font = font(650, 14)
  const rootW = ctx.measureText(tree.chain[0] ?? tree.leaves[0] ?? '').width
  const firstW = ctx.measureText(tree.leaves[0] ?? '').width + 14
  const lastW = ctx.measureText(tree.leaves[tree.leaves.length - 1] ?? '').width + 14
  const pad = 14
  const n = tree.levels + 1
  const dx = tree.levels ? Math.max(10, Math.min(48, (w - 2 * pad - firstW / 2 - lastW / 2) / n)) : 0
  const span = n * dx + firstW / 2 + lastW / 2
  const x0 = Math.max(pad + rootW / 2, (w - span) / 2 + firstW / 2 + dx)
  const chainPos = (i: number) => ({ x: x0 + i * dx, y: top + i * dy })

  const prime = (label: string, x: number, y: number, s: number) => {
    if (s <= 0) return
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    ctx.font = font(700, 14)
    const tw = ctx.measureText(label).width
    const bw = Math.max(26, tw + 14)
    ctx.fillStyle = ink.ink
    ctx.beginPath()
    ctx.roundRect(-bw / 2, -13, bw, 26, 5)
    ctx.fill()
    ctx.fillStyle = ink.paper
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 0, 1)
    ctx.restore()
  }
  const composite = (label: string, x: number, y: number, s: number) => {
    if (s <= 0) return
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    ctx.font = font(650, 14)
    ctx.fillStyle = ink.ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 0, 1)
    ctx.restore()
  }
  const edge = (a: { x: number; y: number }, b: { x: number; y: number }, p: number) => {
    if (p <= 0) return
    const sx = a.x + (b.x - a.x) * 0.22
    const sy = a.y + 15
    const ex = b.x - (b.x - a.x) * 0.22
    const ey = b.y - 15
    ctx.strokeStyle = ink.grey
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx + (ex - sx) * p, sy + (ey - sy) * p)
    ctx.stroke()
  }

  if (tree.levels === 0) {
    prime(tree.leaves[0] ?? '', w / 2, top + 10, phase(t, 0.1, 0.3))
    return
  }
  // root
  composite(tree.chain[0]!, chainPos(0).x, chainPos(0).y, phase(t, 0.05, 0.25))
  if (tree.leaves.length === 1) {
    const from = chainPos(0)
    const to = { x: from.x, y: from.y + dy }
    edge(from, to, phase(t, 0.25, 0.25))
    prime(tree.leaves[0]!, to.x, to.y, pop(t, 0.25))
    return
  }
  for (let i = 0; i < tree.levels; i++) {
    const t0 = 0.25 + i * STEP
    const e = phase(t, t0, 0.25)
    const s = pop(t, t0)
    const from = chainPos(i)
    const left = { x: from.x - dx, y: from.y + dy }
    const right = { x: from.x + dx, y: from.y + dy }
    edge(from, left, e)
    edge(from, right, e)
    prime(tree.leaves[i]!, left.x, left.y, s)
    if (i === tree.levels - 1) prime(tree.leaves[i + 1]!, right.x, right.y, s)
    else composite(tree.chain[i + 1]!, right.x, right.y, Math.min(1, s))
  }
}
