import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CalcLayout, NumField, Result, SimBar, Stage, Stat, Working } from './_viz/Calc'
import { label } from './_viz/draw'
import { dec, fixed, fmt, num, parseNum } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { BF_M3, boardFeet, dressed } from './boardfoot'

interface Board {
  id: number
  t: string
  w: string
  l: string
  q: string
}

const STEP_S = 0.5

export default function BoardFoot() {
  const [boards, setBoards] = useState<Board[]>([
    { id: 1, t: '2', w: '6', l: '8', q: '10' },
    { id: 2, t: '1', w: '12', l: '6', q: '4' },
  ])
  const [price, setPrice] = useState('4.50')
  const nextId = useRef(3)
  const edit = (id: number, k: keyof Omit<Board, 'id'>, v: string) => setBoards((bs) => bs.map((b) => (b.id === id ? { ...b, [k]: v } : b)))
  const rows = boards.map((b) => {
    const t = parseNum(b.t)
    const w = parseNum(b.w)
    const l = parseNum(b.l)
    const q = parseNum(b.q)
    const error =
      t === null || w === null || l === null || q === null
        ? 'Enter thickness, width, length and quantity.'
        : t <= 0 || w <= 0 || l <= 0
          ? 'Sizes must be above zero.'
          : q < 0 || !Number.isInteger(q)
            ? 'Use a whole number of boards.'
            : null
    return { b, t: t ?? 0, w: w ?? 0, l: l ?? 0, q: q ?? 0, error, bf: error ? 0 : boardFeet(t!, w!, l!, q!) }
  })
  const p = parseNum(price)
  const priceErr = p === null ? 'Enter a price, or 0.' : p < 0 ? 'Use 0 or more.' : null
  const ok = rows.every((r) => !r.error) && rows.length > 0
  const total = rows.reduce((s, r) => s + r.bf, 0)
  const first = rows.find((r) => !r.error)

  /* the first board, cut into board-foot pieces one at a time */
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const t = useRef(0)
  const per = first ? boardFeet(first.t, first.w, first.l) : 0
  const pieces = Math.ceil(per - 1e-9)
  useEffect(() => {
    t.current = 0
  }, [first?.t, first?.w, first?.l])
  const paint = (reduced: boolean) => {
    const c = prepCanvas(canvas.current)
    if (!c || !first) return
    const k = reduced ? pieces : Math.min(pieces, Math.floor(t.current / STEP_S))
    drawBoard(c.ctx, c.w, c.h, first.t, first.w, first.l * 12, k, per, ink)
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      t.current = (t.current + dt) % (pieces * STEP_S + 2.4)
      paint(false)
    },
    playing && first !== undefined,
  )
  useEffect(() => paint(reduced))

  const summary = first
    ? `A ${fmt(first.t)} × ${fmt(first.w)} in board ${fmt(first.l)} ft long is ${fmt(per, 4)} board feet: it cuts into ${fmt(per, 4)} pieces of 12 × 12 × 1 in, each ${fmt(144 / (first.t * first.w), 4)} in long. All boards together: ${fmt(total, 5)} board feet.`
    : 'Enter a board to see it cut into board feet.'

  return (
    <CalcLayout
      inputs={
        <>
          {rows.map((r, i) => (
            <fieldset key={r.b.id} className="space-y-2">
              <legend className="mb-2 flex w-full items-center justify-between text-sm font-[600]">
                <span>Board {i + 1}</span>
                {rows.length > 1 ? (
                  <Button variant="ghost" size="sm" onClick={() => setBoards((bs) => bs.filter((b) => b.id !== r.b.id))} aria-label={`Remove board ${i + 1}`}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                ) : null}
              </legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumField label="Thickness" value={r.b.t} onChange={(v) => edit(r.b.id, 't', v)} unit="in" />
                <NumField label="Width" value={r.b.w} onChange={(v) => edit(r.b.id, 'w', v)} unit="in" />
                <NumField label="Length" value={r.b.l} onChange={(v) => edit(r.b.id, 'l', v)} unit="ft" />
                <NumField label="Quantity" value={r.b.q} onChange={(v) => edit(r.b.id, 'q', v)} inputMode="numeric" />
              </div>
              {r.error ? <p className="text-[0.8125rem] font-[560]">{r.error}</p> : null}
            </fieldset>
          ))}
          <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => setBoards((bs) => [...bs, { id: nextId.current++, t: '1', w: '6', l: '8', q: '1' }])}>
            <Plus aria-hidden="true" />
            Add a board
          </Button>
          <NumField label="Price per board foot" value={price} onChange={setPrice} unit="$" error={priceErr} />
        </>
      }
      result={
        <Result
          label="Board feet"
          value={ok ? total : '–'}
          format={(n) => dec(n, 2)}
          unit="bf"
          sub={ok && !priceErr ? `$${fixed(total * p!, 2)} at $${fixed(p!, 2)} per board foot` : undefined}
          error={ok ? null : rows.find((r) => r.error)?.error}
          copy={ok ? `${dec(total, 3)} board feet${!priceErr ? `, $${fixed(total * p!, 2)}` : ''}` : undefined}
        >
          {ok ? (
            <>
              <Stat label="Cubic feet" value={fmt(total / 12, 5)} unit="ft³" />
              <Stat label="Cubic metres" value={fmt(total * BF_M3, 5)} unit="m³" />
              {first ? <Stat label={`Planed size of ${fmt(first.t)} × ${fmt(first.w)}`} value={`${fmt(dressed(first.t))} × ${fmt(dressed(first.w))} in`} /> : null}
              <Stat label="Boards" value={String(rows.reduce((s, r) => s + r.q, 0))} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={first ? <SimBar playing={playing} onPlaying={setPlaying} scale={`${STEP_S} s per board foot`} reduced={reduced} /> : undefined}>
          <canvas ref={canvas} className="block aspect-[16/10] w-full" role="img" aria-label="The board divided into board-foot pieces" />
        </Stage>
      }
      working={
        ok ? (
          <Working
            lines={[
              ...rows.map((r) => `${num(r.t)} × ${num(r.w)} × ${num(r.l)} ÷ 12 × ${r.q} = ${num(r.bf)} bf`),
              `total = ${num(total)} bf${!priceErr ? ` × $${fixed(p!, 2)} = $${fixed(total * p!, 2)}` : ''}`,
            ]}
            caption="Thickness and width in inches, length in feet. One board foot is 144 in³."
          />
        ) : null
      }
    />
  )
}

function drawBoard(ctx: CanvasRenderingContext2D, w: number, h: number, T: number, W: number, L: number, cut: number, per: number, ink: Ink) {
  // isometric: x along the length, z across the width, y up
  const c = Math.cos(Math.PI / 6)
  const s = Math.sin(Math.PI / 6)
  const P = (x: number, y: number, z: number) => [(x - z) * c, (x + z) * s - y] as const
  const corners = [P(0, 0, 0), P(L, 0, 0), P(0, 0, W), P(L, 0, W), P(0, T, 0), P(L, T, 0), P(0, T, W), P(L, T, W)]
  const xs = corners.map((q) => q[0])
  const ys = corners.map((q) => q[1])
  const k = Math.min((w - 40) / (Math.max(...xs) - Math.min(...xs)), (h - 60) / (Math.max(...ys) - Math.min(...ys)))
  const ox = (w - (Math.max(...xs) + Math.min(...xs)) * k) / 2
  const oy = (h - 20 - (Math.max(...ys) + Math.min(...ys)) * k) / 2
  const S = (x: number, y: number, z: number) => {
    const [a, b] = P(x, y, z)
    return [ox + a * k, oy + b * k] as const
  }
  const face = (pts: (readonly [number, number])[], fill: string) => {
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 1.25
    ctx.stroke()
  }
  const seg = 144 / (T * W)
  const n = Math.ceil(per - 1e-9)
  for (let i = 0; i < n; i++) {
    const x0 = i * seg
    const x1 = Math.min(L, (i + 1) * seg)
    const on = i < cut
    // top and the two visible sides of this piece
    face([S(x0, T, 0), S(x1, T, 0), S(x1, T, W), S(x0, T, W)], on ? ink.grey : ink.paper)
    face([S(x0, 0, W), S(x1, 0, W), S(x1, T, W), S(x0, T, W)], on ? ink.ink : ink.fill)
  }
  face([S(L, 0, 0), S(L, 0, W), S(L, T, W), S(L, T, 0)], ink.paper)
  label(ctx, `${Math.min(cut, n)} of ${fmt(per, 4)} board feet`, w / 2, h - 8, { color: ink.ink, halo: ink.fill, font: ink.font, size: 13, weight: 650, align: 'center' })
}
