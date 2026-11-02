import { useRef, useState } from 'react'
import { useTweenArray } from '@/components/viz/tween'
import { CalcLayout, Choice, NumField, Result, Row, Stage, Stat, Working, useFields } from './_viz/Calc'
import { label } from './_viz/draw'
import { dec, fixed, fmt, num } from './_viz/format'
import { useCanvasPaint } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { degreesFromRise, riseFromDegrees, roof, roofMaterials } from './roof'
import type { RoofType } from './roof'

type Units = 'ft' | 'm'
type PitchMode = 'in12' | 'deg'

const TYPES = [
  { value: 'gable', label: 'Gable' },
  { value: 'hip', label: 'Hip' },
  { value: 'shed', label: 'Shed' },
] as const
const UNITS = [
  { value: 'ft', label: 'Feet' },
  { value: 'm', label: 'Metres' },
] as const
const MODES = [
  { value: 'in12', label: 'Rise in 12' },
  { value: 'deg', label: 'Degrees' },
] as const

const M2_FT2 = 1 / 0.09290304
/** Wall height used only to draw the house: 8 ft or 2.44 m. */
const WALL = { ft: 8, m: 2.44 }

export default function Roofing() {
  const f = useFields({ length: '40', width: '30', pitch: '6', overhang: '1', waste: '10' })
  const [type, setType] = useState<RoofType>('gable')
  const [units, setUnits] = useState<Units>('ft')
  const [mode, setMode] = useState<PitchMode>('in12')

  const switchUnits = (u: Units) => {
    if (u === units) return
    const k = u === 'm' ? 0.3048 : 1 / 0.3048
    const conv = (s: string, dp: number) => {
      const n = Number(s)
      return Number.isFinite(n) && s.trim() !== '' ? String(Number((n * k).toFixed(dp))) : s
    }
    f.setMany({ length: conv(f.raw.length, 2), width: conv(f.raw.width, 2), overhang: conv(f.raw.overhang, 2) })
    setUnits(u)
  }
  const switchMode = (m: PitchMode) => {
    if (m === mode) return
    const p = f.num.pitch
    if (p !== null) f.set('pitch', String(Number((m === 'deg' ? degreesFromRise(p) : riseFromDegrees(p)).toFixed(m === 'deg' ? 1 : 2))))
    setMode(m)
  }

  const { length, width, pitch, overhang, waste } = f.num
  const err = {
    length: length === null ? 'Enter the length.' : length <= 0 ? 'The length must be above zero.' : null,
    width: width === null ? 'Enter the width.' : width <= 0 ? 'The width must be above zero.' : null,
    pitch:
      pitch === null
        ? 'Enter the pitch.'
        : pitch < 0
          ? 'The pitch cannot be below zero.'
          : mode === 'deg' && pitch >= 80
            ? 'Use an angle below 80°.'
            : mode === 'in12' && pitch > 72
              ? 'Use a rise of 72 in 12 or less.'
              : null,
    overhang: overhang === null ? 'Enter the overhang, or 0.' : overhang < 0 ? 'The overhang cannot be below zero.' : null,
    waste: waste === null ? 'Enter a waste allowance, or 0.' : waste < 0 || waste > 100 ? 'Use 0 to 100 %.' : null,
  }
  const ok = !Object.values(err).some(Boolean)
  const rise = ok ? (mode === 'deg' ? riseFromDegrees(pitch!) : pitch!) : 0
  const r = ok ? roof({ length: length!, width: width!, rise, overhang: overhang!, type }) : null
  const toFt2 = units === 'm' ? M2_FT2 : 1
  const mat = r ? roofMaterials(r.area * toFt2, waste!) : null
  const au = units === 'ft' ? 'ft²' : 'm²'

  /* drawing */
  const canvas = useRef<HTMLCanvasElement>(null)
  const target = r ? [r.long - 2 * overhang!, r.short - 2 * overhang!, rise, overhang!] : [40, 30, 6, 1]
  const shown = useTweenArray(target, { duration: 520, from: [target[0]!, target[1]!, 0, target[3]!] })
  useCanvasPaint(
    canvas,
    ({ ctx, w, h }, ink) => {
      if (!r) return
      drawRoof(ctx, w, h, ink, { A: shown[0]!, B: shown[1]!, rise: shown[2]!, o: shown[3]!, type, units, wall: WALL[units] })
    },
    [shown, type, units, r === null],
  )

  const pitchText = r ? `${dec(rise, 2)} in 12 (${dec(r.angle, 1)}°)` : ''
  const summary = r
    ? `A ${fmt(length!, 5)} × ${fmt(width!, 5)} ${units} ${type} roof at ${pitchText} with a ${fmt(overhang!, 4)} ${units} overhang has ${dec(r.area, 1)} ${au} of roof. ${
        type === 'shed' ? `The high edge is ${dec(r.height, 2)} ${units} above the eaves.` : `The ridge is ${dec(r.ridge, 2)} ${units} long and ${dec(r.height, 2)} ${units} above the eaves.`
      } The house is drawn to scale on ${WALL[units]} ${units} walls; the triangle at the top left is the pitch, rise over a run of 12.`
    : 'Enter the footprint and the pitch to draw the roof.'

  const working =
    r && mat
      ? [
          ...(mode === 'deg' ? [`rise   = 12 × tan ${num(pitch!)}° = ${num(rise, 5)} in 12`] : []),
          `factor = √(1 + (rise ÷ 12)²) = √(1 + (${num(rise, 5)} ÷ 12)²) = ${num(r.factor, 5)}`,
          `plan   = (L + 2o) × (W + 2o) = (${num(length!)} + 2 × ${num(overhang!)}) × (${num(width!)} + 2 × ${num(overhang!)}) = ${num(r.plan)} ${au}`,
          `area   = plan × factor = ${num(r.plan)} × ${num(r.factor, 5)} = ${num(r.area)} ${au}`,
          ...(units === 'm' ? [`       = ${num(r.area)} m² × 10.7639 = ${num(r.area * toFt2)} ft²`] : []),
          `waste  = ${num(r.area * toFt2)} × (1 + ${num(waste!)} ÷ 100) = ${num(mat.withWaste)} ft²`,
          `squares = ${num(mat.withWaste)} ÷ 100 = ${num(mat.squares, 4)}`,
          `bundles = ⌈${num(mat.squares, 4)} × 3⌉ = ${mat.bundles}`,
          `underlayment = ⌈${num(mat.withWaste)} ÷ 1,000⌉ = ${mat.underlayment} rolls`,
        ]
      : []

  return (
    <CalcLayout
      inputs={
        <>
          <Choice label="Roof shape" value={type} onChange={setType} options={TYPES} />
          <Choice label="Units" value={units} onChange={switchUnits} options={UNITS} />
          <Row>
            <NumField label="House length" {...f.bind('length')} unit={units} error={err.length} />
            <NumField label="House width" {...f.bind('width')} unit={units} error={err.width} />
          </Row>
          <Choice label="Pitch as" value={mode} onChange={switchMode} options={MODES} />
          <NumField
            label={mode === 'in12' ? 'Pitch, rise per 12 of run' : 'Pitch angle'}
            {...f.bind('pitch')}
            unit={mode === 'in12' ? '/12' : '°'}
            slider={mode === 'in12' ? { min: 0, max: 18, step: 0.5 } : { min: 0, max: 60, step: 1 }}
            error={err.pitch}
          />
          <Row>
            <NumField label="Overhang" {...f.bind('overhang')} unit={units} error={err.overhang} hint="Past each wall" />
            <NumField label="Waste" {...f.bind('waste')} unit="%" error={err.waste} hint="10 % gable, 15 % hip" />
          </Row>
        </>
      }
      result={
        <Result
          label="Roof area"
          value={r ? r.area : '–'}
          format={(n) => dec(n, 1)}
          unit={r ? au : undefined}
          sub={mat ? `${dec(mat.squares, 2)} squares and ${mat.bundles} bundles with ${fmt(waste!, 3)} % waste` : undefined}
          copy={
            r && mat
              ? `Roof area ${dec(r.area, 1)} ${au}; ${dec(mat.squares, 2)} squares with ${fmt(waste!, 3)} % waste; ${mat.bundles} bundles; ${mat.underlayment} underlayment rolls`
              : undefined
          }
        >
          {r && mat ? (
            <>
              <Stat label="Squares with waste" value={mat.squares} format={(n) => fixed(n, 2)} />
              <Stat label="Shingle bundles" value={mat.bundles} format={(n) => dec(n, 0)} />
              <Stat label="Underlayment rolls" value={mat.underlayment} format={(n) => dec(n, 0)} />
              <Stat label="Pitch" value={pitchText} />
              <Stat label="Rafter length" value={r.rafter} format={(n) => dec(n, 2)} unit={units} />
              <Stat label={type === 'shed' ? 'High edge length' : 'Ridge length'} value={type === 'shed' ? r.long : r.ridge} format={(n) => dec(n, 2)} unit={units} />
              {type === 'hip' ? <Stat label="Hips, all four" value={r.hips} format={(n) => dec(n, 2)} unit={units} /> : null}
              <Stat label="Rise to the ridge" value={r.height} format={(n) => dec(n, 2)} unit={units} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary}>
          <canvas
            ref={canvas}
            className="block aspect-[4/3] w-full"
            role="img"
            aria-label={r ? `${type} roof drawn to scale, ${dec(r.area, 1)} ${au}` : 'Roof drawing'}
          />
        </Stage>
      }
      working={
        working.length ? (
          <Working
            lines={working}
            caption="L and W are the house length and width, o the overhang. Bundles assume three bundles of shingles per square (100 ft²); underlayment rolls cover 10 squares."
          />
        ) : null
      }
    />
  )
}

/* ── isometric drawing ──────────────────────────────────────────── */

type P3 = [number, number, number]
interface Scene {
  A: number
  B: number
  rise: number
  o: number
  type: RoofType
  units: Units
  wall: number
}

const C30 = Math.cos(Math.PI / 6)

function drawRoof(ctx: CanvasRenderingContext2D, w: number, h: number, ink: Ink, s: Scene) {
  // x runs along the long side, y across, z up. The viewer looks from +x, +y, above.
  const A = Math.max(s.A, s.B)
  const B = Math.min(s.A, s.B)
  const o = s.o
  const p = s.rise / 12
  const Hw = s.wall
  const ze = Hw - o * p
  const X0 = -o
  const X1 = A + o
  const Y0 = -o
  const Y1 = B + o
  const half = (Y1 - Y0) / 2
  const zr = ze + half * p
  const zShed = ze + (Y1 - Y0) * p

  const proj = (q: P3): [number, number] => [(q[0] - q[1]) * C30, (q[0] + q[1]) * 0.5 - q[2]]
  const pts: P3[] = [
    [X0, Y0, 0],
    [X1, Y1, 0],
    [X1, Y0, 0],
    [X0, Y1, 0],
    [X0, Y0, s.type === 'shed' ? zShed : zr],
    [X1, Y0, s.type === 'shed' ? zShed : zr],
    [X1, Y1, ze],
    [X0, Y1, ze],
  ]
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const q of pts) {
    const [x, y] = proj(q)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  const pad = { l: 16, r: 16, t: 76, b: 34 }
  const k = Math.min((w - pad.l - pad.r) / (maxX - minX), (h - pad.t - pad.b) / (maxY - minY))
  const ox = pad.l + (w - pad.l - pad.r - (maxX - minX) * k) / 2 - minX * k
  const oy = pad.t + (h - pad.t - pad.b - (maxY - minY) * k) / 2 - minY * k
  const S = (q: P3): [number, number] => {
    const [x, y] = proj(q)
    return [ox + x * k, oy + y * k]
  }

  const poly = (qs: P3[], fill: string, stroke: string, lw = 1.25) => {
    ctx.beginPath()
    qs.forEach((q, i) => {
      const [x, y] = S(q)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
  const line = (a: P3, b: P3, color: string, lw = 0.75) => {
    const [x1, y1] = S(a)
    const [x2, y2] = S(b)
    ctx.strokeStyle = color
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  // Shingle courses: one line per exposure (5 in or 127 mm) measured up the slope.
  const exposure = s.units === 'ft' ? 5 / 12 : 0.127
  const factor = Math.sqrt(1 + p * p)
  const planStep = exposure / factor
  let every = 1
  while (planStep * every * k < 4) every *= 2
  const step = planStep * every

  const roofFill = ink.paper
  const wallFill = ink.paper
  const edge = ink.ink

  // walls (x = A face, y = B face) under the eaves
  const wallTop = (y: number) => (s.type === 'shed' ? Hw + (B - y) * p : Hw)
  const backFaces = () => {
    if (s.type === 'gable') poly([[X0, Y0, ze], [X1, Y0, ze], [X1, B / 2, zr], [X0, B / 2, zr]], roofFill, edge)
    if (s.type === 'hip') {
      const r1: P3 = [X0 + half, B / 2, zr]
      const r2: P3 = [X1 - half, B / 2, zr]
      poly([[X0, Y0, ze], [X1, Y0, ze], r2, r1], roofFill, edge)
      poly([[X0, Y0, ze], [X0, Y1, ze], r1], roofFill, edge)
    }
  }
  backFaces()
  poly([[A, 0, 0], [A, B, 0], [A, B, wallTop(B)], [A, 0, wallTop(0)]], wallFill, ink.grey, 1)
  poly([[0, B, 0], [A, B, 0], [A, B, Hw], [0, B, Hw]], wallFill, ink.grey, 1)

  if (s.type === 'gable') {
    poly([[A, 0, Hw], [A, B, Hw], [A, B / 2, zr]], wallFill, ink.grey, 1)
    // the back slope's overhang past the gable end sits in front of the gable wall
    if (o > 0) poly([[A, Y0, ze], [X1, Y0, ze], [X1, B / 2, zr], [A, B / 2, zr]], roofFill, edge)
    poly([[X0, Y1, ze], [X1, Y1, ze], [X1, B / 2, zr], [X0, B / 2, zr]], roofFill, edge, 1.5)
    for (let d = step; d < half - 1e-9; d += step) line([X0, Y1 - d, ze + d * p], [X1, Y1 - d, ze + d * p], ink.grey)
  } else if (s.type === 'hip') {
    const r1: P3 = [X0 + half, B / 2, zr]
    const r2: P3 = [X1 - half, B / 2, zr]
    poly([[X1, Y0, ze], [X1, Y1, ze], r2], roofFill, edge, 1.5)
    for (let d = step; d < half - 1e-9; d += step) line([X1 - d, Y0 + d, ze + d * p], [X1 - d, Y1 - d, ze + d * p], ink.grey)
    poly([[X0, Y1, ze], [X1, Y1, ze], r2, r1], roofFill, edge, 1.5)
    for (let d = step; d < half - 1e-9; d += step) line([X0 + d, Y1 - d, ze + d * p], [X1 - d, Y1 - d, ze + d * p], ink.grey)
  } else {
    poly([[X0, Y0, zShed], [X1, Y0, zShed], [X1, Y1, ze], [X0, Y1, ze]], roofFill, edge, 1.5)
    for (let d = step; d < Y1 - Y0 - 1e-9; d += step) line([X0, Y1 - d, ze + d * p], [X1, Y1 - d, ze + d * p], ink.grey)
  }

  // dimensions along the two visible walls
  const font = ink.font
  const [ax, ay] = S([A / 2, B, 0])
  label(ctx, `${fmt(A, 4)} ${s.units}`, ax - 6, ay + 18, { color: ink.ink, halo: ink.fill, font, size: 12, align: 'center' })
  const [bx, by] = S([A, B / 2, 0])
  label(ctx, `${fmt(B, 4)} ${s.units}`, bx + 8, by + 18, { color: ink.ink, halo: ink.fill, font, size: 12, align: 'center' })

  // pitch triangle: rise over a run of 12
  const run = 44
  const tri = Math.min(54, run * p)
  const tx = 16
  const ty = 66
  ctx.strokeStyle = ink.ink
  ctx.fillStyle = ink.paper
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(tx, ty)
  ctx.lineTo(tx + run, ty)
  ctx.lineTo(tx + run, ty - tri)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  label(ctx, '12', tx + run / 2, ty + 14, { color: ink.grey, halo: ink.fill, font, size: 11, align: 'center' })
  label(ctx, dec(s.rise, 1), tx + run + 6, ty - Math.max(tri, 14) / 2 + 4, { color: ink.ink, halo: ink.fill, font, size: 12, weight: 650 })
  label(ctx, `${dec(degreesFromRise(s.rise), 1)}°`, tx + run + 6, ty + 14, { color: ink.grey, halo: ink.fill, font, size: 11 })
}
