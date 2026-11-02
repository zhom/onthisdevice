import { useEffect, useRef, useState } from 'react'
import { CalcLayout, Choice, NumField, Result, SimBar, Stage, Stat, UnitField, Working, useFields } from './_viz/Calc'
import { dot } from './_viz/draw'
import { dec, fmt, num, parseNum } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { parseFormula } from './chem'
import { LIQUID, dilute, massNeeded, molarity } from './molarity'
import type { LiquidUnit } from './molarity'

type Mode = 'conc' | 'mass' | 'dilute'
const LIQ = [
  { value: 'mL' as const, label: 'mL' },
  { value: 'L' as const, label: 'L' },
]

/** Molar mass from a number or a formula. */
function solute(raw: string): { mw: number; name: string } | { error: string } {
  const n = parseNum(raw)
  if (n !== null) return n > 0 ? { mw: n, name: `${fmt(n)} g/mol` } : { error: 'The molar mass must be above zero.' }
  const p = parseFormula(raw)
  return p.ok ? { mw: p.total, name: raw.trim() } : { error: p.error }
}

const PER_MOLAR = 60
const MAX_DOTS = 420

export default function Molarity() {
  const [mode, setMode] = useState<Mode>('conc')
  const f = useFields({ solute: 'NaCl', mass: '5.844', vol: '100', M: '0.5', M1: '2', M2: '0.5', V2: '250' })
  const [vu, setVu] = useState<LiquidUnit>('mL')
  const [v2u, setV2u] = useState<LiquidUnit>('mL')
  const s = solute(f.raw.solute)
  const mw = 'mw' in s ? s.mw : null
  const { mass, vol, M, M1, M2, V2 } = f.num
  const pos = (v: number | null, what: string) => (v === null ? `Enter the ${what}.` : v <= 0 ? `The ${what} must be above zero.` : null)
  const err: Record<string, string | null> =
    mode === 'conc'
      ? { solute: 'error' in s ? s.error : null, mass: pos(mass, 'mass'), vol: pos(vol, 'volume') }
      : mode === 'mass'
        ? { solute: 'error' in s ? s.error : null, M: pos(M, 'molarity'), vol: pos(vol, 'volume') }
        : { M1: pos(M1, 'stock molarity'), M2: pos(M2, 'final molarity'), V2: pos(V2, 'final volume') }
  if (mode === 'dilute' && !err.M1 && !err.M2 && M2! > M1!) err.M2 = 'The final molarity must be below the stock molarity.'
  const ok = !Object.values(err).some(Boolean)
  const L = vol !== null ? vol * LIQUID[vu] : 0
  const conc = ok && mode === 'conc' ? molarity(mass!, mw!, L) : null
  const grams = ok && mode === 'mass' ? massNeeded(M!, mw!, L) : null
  const dil = ok && mode === 'dilute' ? dilute('V1', { M1: M1!, V1: 0, M2: M2!, V2: V2! * LIQUID[v2u] }) : null

  /* beaker: solute particles; a dilution adds water and spreads them */
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const finalM = conc ?? (grams !== null ? M! : (dil?.M2 ?? 0))
  const startM = dil ? dil.M1 : finalM
  const level0 = dil ? dil.V1 / dil.V2 : 1
  const count = Math.max(4, Math.min(MAX_DOTS, Math.round(startM * level0 * PER_MOLAR * 2)))
  const sim = useRef({ t: 0, pts: [] as { x: number; y: number; vx: number; vy: number }[] })
  useEffect(() => {
    sim.current.t = 0
    sim.current.pts = Array.from({ length: count }, () => ({ x: Math.random(), y: Math.random(), vx: 0, vy: 0 }))
  }, [count, level0])
  const paint = (reduced: boolean) => {
    const p = prepCanvas(canvas.current)
    if (!p || !ok) return
    const t = reduced ? 9 : sim.current.t % 6.5
    const k = dil ? Math.min(1, Math.max(0, (t - 1.2) / 2.2)) : 1
    const e = k * k * (3 - 2 * k)
    drawBeaker(p.ctx, p.w, p.h, sim.current.pts, dil ? level0 + (1 - level0) * e : 0.85, ink, dil ? `${fmt(M1! + (M2! - M1!) * e, 3)} M` : `${fmt(finalM, 4)} M`)
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      const S = sim.current
      S.t += dt
      for (const q of S.pts) {
        q.vx = q.vx * 0.9 + (Math.random() - 0.5) * 0.04
        q.vy = q.vy * 0.9 + (Math.random() - 0.5) * 0.04
        q.x = Math.min(1, Math.max(0, q.x + q.vx * dt * 6))
        q.y = Math.min(1, Math.max(0, q.y + q.vy * dt * 6))
      }
      paint(false)
    },
    playing && ok,
  )
  useEffect(() => paint(reduced))

  const vText = (v: number, u: LiquidUnit) => `${fmt(v / LIQUID[u], 5)} ${u}`
  const summary = !ok
    ? 'Enter the values to see the solution.'
    : conc !== null
      ? `${fmt(mass!)} g of ${'name' in s ? s.name : ''} (${fmt(mw!, 5)} g/mol) is ${fmt(mass! / mw!, 4)} mol. In ${vText(L, vu)} of solution that is ${fmt(conc, 4)} mol/L. Each dot stands for a fixed amount of solute.`
      : grams !== null
        ? `${fmt(M!)} M in ${vText(L, vu)} needs ${fmt(M! * L, 4)} mol, which is ${fmt(grams, 4)} g of ${'name' in s ? s.name : ''}.`
        : dil
          ? `Take ${vText(dil.V1, v2u)} of the ${fmt(M1!)} M stock and add water to ${vText(dil.V2, v2u)}. The amount of solute stays the same, so the dots spread out as the level rises and the concentration falls to ${fmt(M2!)} M.`
          : ''

  const working =
    conc !== null
      ? [`n = m ÷ Mw = ${num(mass!)} g ÷ ${num(mw!)} g/mol = ${num(mass! / mw!)} mol`, `M = n ÷ V = ${num(mass! / mw!)} mol ÷ ${num(L)} L = ${num(conc)} mol/L`]
      : grams !== null
        ? [`n = M × V = ${num(M!)} mol/L × ${num(L)} L = ${num(M! * L)} mol`, `m = n × Mw = ${num(M! * L)} mol × ${num(mw!)} g/mol = ${num(grams)} g`]
        : dil
          ? [`M₁V₁ = M₂V₂`, `V₁ = M₂V₂ ÷ M₁ = ${num(M2!)} × ${num(dil.V2)} L ÷ ${num(M1!)} = ${num(dil.V1)} L`, `water to add = V₂ − V₁ = ${num(dil.V2 - dil.V1)} L`, `dilution factor = M₁ ÷ M₂ = ${num(M1! / M2!)}`]
          : []

  return (
    <CalcLayout
      inputs={
        <>
          <Choice label="Work out" value={mode} onChange={setMode} options={[{ value: 'conc', label: 'Molarity' }, { value: 'mass', label: 'Mass' }, { value: 'dilute', label: 'Dilution' }]} />
          {mode !== 'dilute' ? (
            <>
              <NumField label="Solute: formula or molar mass" {...f.bind('solute')} inputMode="text" error={err.solute} hint={mw ? `${fmt(mw, 6)} g/mol` : undefined} />
              {mode === 'conc' ? <NumField label="Mass of solute" {...f.bind('mass')} unit="g" error={err.mass} /> : <NumField label="Molarity wanted" {...f.bind('M')} unit="mol/L" error={err.M} />}
              <UnitField label="Volume of solution" {...f.bind('vol')} unit={vu} units={LIQ} onUnit={setVu} error={err.vol} />
            </>
          ) : (
            <>
              <NumField label="Stock molarity (M₁)" {...f.bind('M1')} unit="mol/L" error={err.M1} />
              <NumField label="Final molarity (M₂)" {...f.bind('M2')} unit="mol/L" error={err.M2} />
              <UnitField label="Final volume (V₂)" {...f.bind('V2')} unit={v2u} units={LIQ} onUnit={setV2u} error={err.V2} />
            </>
          )}
        </>
      }
      result={
        <Result
          label={conc !== null ? 'Molarity' : grams !== null ? 'Mass of solute' : 'Stock to take (V₁)'}
          value={conc !== null ? conc : grams !== null ? grams : dil ? dil.V1 / LIQUID[v2u] : '–'}
          format={(n) => fmt(n, 5)}
          unit={conc !== null ? 'mol/L' : grams !== null ? 'g' : dil ? v2u : undefined}
          sub={dil ? `then add water to ${vText(dil.V2, v2u)}` : conc !== null ? `${fmt(conc * 1000, 4)} mmol/L` : undefined}
          error={ok ? null : Object.values(err).find(Boolean)}
          copy={conc !== null ? `${fmt(conc, 6)} mol/L` : grams !== null ? `${fmt(grams, 6)} g` : dil ? `${vText(dil.V1, v2u)} of stock, water to ${vText(dil.V2, v2u)}` : undefined}
        >
          {conc !== null ? (
            <>
              <Stat label="Moles of solute" value={fmt(mass! / mw!, 5)} unit="mol" />
              <Stat label="Mass concentration" value={fmt(mass! / L, 5)} unit="g/L" />
            </>
          ) : grams !== null ? (
            <>
              <Stat label="Moles of solute" value={fmt(M! * L, 5)} unit="mol" />
              <Stat label="Molar mass" value={fmt(mw!, 6)} unit="g/mol" />
            </>
          ) : dil ? (
            <>
              <Stat label="Water to add" value={vText(dil.V2 - dil.V1, v2u)} />
              <Stat label="Dilution factor" value={`${fmt(M1! / M2!, 5)}×`} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={ok ? <SimBar playing={playing} onPlaying={setPlaying} scale={dil ? 'Water is added in 2.2 s' : 'Particles drawn to scale by count'} reduced={reduced} /> : undefined}>
          <canvas ref={canvas} className="block aspect-[4/3] w-full" role="img" aria-label="A beaker of solution with solute particles" />
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="M is molarity (mol/L), n moles, m mass, Mw molar mass and V the volume of the finished solution in litres." /> : null}
    />
  )
}

function drawBeaker(ctx: CanvasRenderingContext2D, w: number, h: number, pts: { x: number; y: number }[], level: number, ink: Ink, tag: string) {
  const bw = Math.min(w * 0.5, h * 0.62)
  const bh = bw * 1.15
  const x0 = (w - bw) / 2
  const y1 = (h + bh) / 2
  const y0 = y1 - bh
  const liquidTop = y1 - bh * 0.9 * level
  ctx.fillStyle = ink.paper
  ctx.fillRect(x0, liquidTop, bw, y1 - liquidTop)
  ctx.strokeStyle = ink.grey
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x0, liquidTop)
  ctx.lineTo(x0 + bw, liquidTop)
  ctx.stroke()
  // glass
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(x0 - 6, y0)
  ctx.lineTo(x0, y0 + 6)
  ctx.lineTo(x0, y1)
  ctx.lineTo(x0 + bw, y1)
  ctx.lineTo(x0 + bw, y0)
  ctx.stroke()
  // particles fill the liquid, so they spread out as water is added
  const hLiquid = y1 - liquidTop
  for (const q of pts) {
    const y = y1 - 4 - q.y * Math.max(0, hLiquid - 8)
    dot(ctx, x0 + 5 + q.x * (bw - 10), y, 2.6, ink.ink)
  }
  ctx.font = `650 13px ${ink.font}`
  ctx.fillStyle = ink.ink
  ctx.textAlign = 'center'
  ctx.fillText(tag, x0 + bw / 2, y0 - 10)
}
