import { useEffect, useMemo, useRef, useState } from 'react'
import { useTweenArray } from '@/components/viz/tween'
import { CalcLayout, Choice, NumField, Result, Row, Stage, Stat, Working } from './_viz/Calc'
import { label } from './_viz/draw'
import { sup } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import { arrangements, bigSci, count, groupBig } from './combinatorics'
import type { CountKind } from './combinatorics'

const KINDS: { kind: CountKind; name: string; formula: string }[] = [
  { kind: 'nPr', name: 'Permutations', formula: 'n! ÷ (n − r)!' },
  { kind: 'nCr', name: 'Combinations', formula: 'n! ÷ (r! (n − r)!)' },
  { kind: 'repPerm', name: 'Permutations with repetition', formula: 'nʳ' },
  { kind: 'repComb', name: 'Combinations with repetition', formula: '(n + r − 1)! ÷ (r! (n − 1)!)' },
]
const LETTERS = 'ABCDEFGHIJ'

function show(v: bigint): string {
  const s = v.toString()
  if (s.length <= 18) return groupBig(v)
  const { mant, exp } = bigSci(v, 6)
  return `${mant} × 10${sup(exp)}`
}

export default function PermutationCombination() {
  const [nRaw, setN] = useState('5')
  const [rRaw, setR] = useState('3')
  const [order, setOrder] = useState<'yes' | 'no'>('yes')
  const [rep, setRep] = useState<'no' | 'yes'>('no')
  const kind: CountKind = order === 'yes' ? (rep === 'yes' ? 'repPerm' : 'nPr') : rep === 'yes' ? 'repComb' : 'nCr'
  const n = /^\d+$/.test(nRaw.trim()) ? Number(nRaw) : null
  const r = /^\d+$/.test(rRaw.trim()) ? Number(rRaw) : null
  const errN = n === null ? 'Enter a whole number.' : n > 100000 ? 'Use at most 100,000.' : null
  const errR = r === null ? 'Enter a whole number.' : r > 10000 ? 'Use at most 10,000.' : rep === 'no' && n !== null && r > n ? 'Without repetition, r cannot be more than n.' : null
  const ok = !errN && !errR
  const all = useMemo(() => (ok ? KINDS.map((k) => count(k.kind, n!, r!)) : null), [ok, n, r])
  const idx = KINDS.findIndex((k) => k.kind === kind)
  const value = all ? all[idx]! : null
  const k = KINDS[idx]!

  const working = ok && value !== null ? workingFor(kind, n!, r!, value) : []
  const digits = value?.toString().length ?? 0

  return (
    <CalcLayout
      inputs={
        <>
          <Row>
            <NumField label="Items to choose from (n)" value={nRaw} onChange={setN} inputMode="numeric" error={errN} />
            <NumField label="Items chosen (r)" value={rRaw} onChange={setR} inputMode="numeric" error={errR} />
          </Row>
          <Choice
            label="Does the order matter?"
            value={order}
            onChange={setOrder}
            options={[
              { value: 'yes', label: 'Yes: permutations' },
              { value: 'no', label: 'No: combinations' },
            ]}
          />
          <Choice
            label="Can an item be chosen twice?"
            value={rep}
            onChange={setRep}
            options={[
              { value: 'no', label: 'No' },
              { value: 'yes', label: 'Yes: repetition' },
            ]}
          />
        </>
      }
      result={
        <Result
          label={k.name}
          value={value !== null ? show(value) : '–'}
          sub={value !== null && digits > 18 ? `${digits.toLocaleString('en-US')} digits. Copy gives every digit.` : `${k.formula} with n = ${n ?? '?'}, r = ${r ?? '?'}`}
          error={ok ? null : 'Enter n and r.'}
          copy={value !== null ? value.toString() : undefined}
        >
          {all
            ? KINDS.filter((x) => x.kind !== kind).map((x) => (
                <Stat key={x.kind} label={x.name} value={show(all[KINDS.indexOf(x)]!)} />
              ))
            : null}
        </Result>
      }
      visual={
        all && n !== null && r !== null ? (
          <Stage
            summary={`${small(kind, n, r) ? `Each frame puts one of the ${show(value!)} ${order === 'yes' ? 'ordered arrangements' : 'selections'} of ${r} from ${n} items into the slots. ` : ''}The bars compare the four counts for n = ${n} and r = ${r} on a scale of digits: ${KINDS.map((x, i) => `${x.name.toLowerCase()} ${show(all[i]!)}`).join(', ')}.`}
          >
            {small(kind, n, r) ? <Tokens kind={kind} n={n} r={r} total={value!} /> : null}
            <Bars values={all} active={idx} />
          </Stage>
        ) : null
      }
      working={working.length ? <Working lines={working} caption="Exact whole-number arithmetic: no rounding at any step." /> : null}
    />
  )
}

const small = (kind: CountKind, n: number, r: number) => n >= 1 && n <= 10 && r >= 1 && r <= 6 && (kind === 'repPerm' || kind === 'repComb' || r <= n)

function workingFor(kind: CountKind, n: number, r: number, v: bigint): string[] {
  const prod = (from: number, len: number) => {
    const t = Array.from({ length: Math.min(len, 6) }, (_, i) => String(from - i))
    return len > 6 ? `${t.join(' × ')} × … × ${from - len + 1}` : t.join(' × ') || '1'
  }
  switch (kind) {
    case 'nPr':
      return [`nPr = n! ÷ (n − r)!`, `${n}P${r} = ${n}! ÷ ${n - r}!`, `     = ${prod(n, r)}`, `     = ${show(v)}`]
    case 'nCr':
      return [
        `nCr = n! ÷ (r! (n − r)!) = nPr ÷ r!`,
        `${n}C${r} = (${prod(n, r)}) ÷ (${prod(r, r)})`,
        `     = ${show(count('nPr', n, r))} ÷ ${show(count('nPr', r, r))}`,
        `     = ${show(v)}`,
      ]
    case 'repPerm':
      return [`n to the power r: each of the ${r} places can hold any of the ${n} items`, `${n}${sup(r)} = ${show(v)}`]
    case 'repComb':
      return [
        `C(n + r − 1, r) = (n + r − 1)! ÷ (r! (n − 1)!)`,
        `C(${n} + ${r} − 1, ${r}) = C(${n + r - 1}, ${r})`,
        `     = (${prod(n + r - 1, r)}) ÷ (${prod(r, r)})`,
        `     = ${show(v)}`,
      ]
  }
}

/* ── tokens flying into slots ────────────────────────────────────── */

const CYCLE = 1.25

function Tokens({ kind, n, r, total }: { kind: CountKind; n: number; r: number; total: bigint }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const counter = useRef<HTMLParagraphElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const list = useMemo(() => arrangements(kind, n, r, 400), [kind, n, r])
  const at = useRef({ i: 0, u: 0 })
  useEffect(() => {
    at.current = { i: 0, u: 0 }
  }, [list])
  const paint = (still: boolean) => {
    const p = prepCanvas(canvas.current)
    if (!p || !list.length) return
    const { ctx, w } = p
    const R = Math.min(17, (w - 24) / n / 2 - 3)
    const pool = (j: number) => ({ x: w / 2 + (j - (n - 1) / 2) * (R * 2 + 6), y: 32 })
    const gap = Math.min(R * 2 + 22, (w - 24) / r)
    const slot = (k: number) => ({ x: w / 2 + (k - (r - 1) / 2) * gap, y: 112 })
    const arr = list[at.current.i % list.length]!
    const opts = { color: ink.ink, halo: ink.fill, font: ink.font, size: 13, weight: 650, align: 'center' as const, base: 'middle' as const }
    // pool
    for (let j = 0; j < n; j++) {
      const q = pool(j)
      ctx.fillStyle = ink.paper
      ctx.beginPath()
      ctx.arc(q.x, q.y, R, 0, Math.PI * 2)
      ctx.fill()
      label(ctx, LETTERS[j]!, q.x, q.y + 1, { ...opts, color: ink.grey, halo: ink.paper })
    }
    // slots
    ctx.strokeStyle = ink.grey
    ctx.lineWidth = 2
    for (let k = 0; k < r; k++) {
      const s = slot(k)
      ctx.beginPath()
      ctx.moveTo(s.x - R, s.y + R + 6)
      ctx.lineTo(s.x + R, s.y + R + 6)
      ctx.stroke()
    }
    // moving tokens
    const u = still ? 1 : at.current.u
    for (let k = 0; k < r; k++) {
      const from = pool(arr[k]!)
      const to = slot(k)
      const raw = Math.min(1, Math.max(0, (u - k * 0.09) / 0.45))
      const e = 1 - Math.pow(1 - raw, 3)
      const x = from.x + (to.x - from.x) * e
      const y = from.y + (to.y - from.y) * e - Math.sin(e * Math.PI) * 18
      ctx.fillStyle = ink.ink
      ctx.beginPath()
      ctx.arc(x, y, R, 0, Math.PI * 2)
      ctx.fill()
      label(ctx, LETTERS[arr[k]!]!, x, y + 1, { ...opts, color: ink.paper, halo: ink.ink })
    }
    if (counter.current) {
      const shown = list.length
      counter.current.textContent = `${(at.current.i % shown) + 1} of ${groupBig(total)}${BigInt(shown) < total ? `; the first ${shown} play in a loop` : ''}`
    }
  }
  const { reduced } = useSimLoop(canvas, (dt) => {
    at.current.u += dt / CYCLE
    if (at.current.u >= 1.4) {
      at.current.u = 0
      at.current.i = (at.current.i + 1) % list.length
    }
    paint(false)
  })
  useEffect(() => paint(reduced))
  return (
    <div className="px-4 pt-4 sm:px-5">
      <canvas ref={canvas} className="block h-40 w-full" role="img" aria-label={`Arrangements of ${r} from ${n} items`} />
      <p ref={counter} className="text-center text-[0.8125rem] font-[560] text-muted-foreground tabular-nums" aria-hidden="true" />
    </div>
  )
}

/* ── the four counts on a digits scale ───────────────────────────── */

function Bars({ values, active }: { values: bigint[]; active: number }) {
  const logs = values.map((v) => (v <= 0n ? 0 : Math.log10(Number(v.toString().slice(0, 15))) + Math.max(0, v.toString().length - 15)))
  const max = Math.max(1, ...logs)
  const t = useTweenArray(logs.map((l) => l / max), { duration: 420 })
  return (
    <div className="space-y-2.5 p-4 sm:p-5">
      {KINDS.map((k, i) => (
        <div key={k.kind} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
            <span className={i === active ? 'font-[650] text-foreground' : 'text-muted-foreground'}>{k.name}</span>
            <span className="font-[600] text-foreground tabular-nums">{show(values[i]!)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-background">
            <div
              className={i === active ? 'h-full origin-left rounded-full bg-foreground' : 'h-full origin-left rounded-full bg-muted-foreground'}
              style={{ transform: `scaleX(${Math.max(0.01, t[i] ?? 0)})` }}
            />
          </div>
        </div>
      ))}
      <p className="text-[0.8125rem] text-muted-foreground">Bar length is the number of digits (a log scale).</p>
    </div>
  )
}
