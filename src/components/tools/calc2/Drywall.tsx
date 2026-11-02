import { useEffect, useMemo, useRef, useState } from 'react'
import { CalcLayout, Choice, NumField, Result, Row, SelectField, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { DOOR_FT2, SHEETS, WINDOW_FT2, drywall } from './drywall'

type Units = 'ft' | 'm'
const UNITS = [
  { value: 'ft', label: 'Feet' },
  { value: 'm', label: 'Metres' },
] as const
const SURFACES = [
  { value: 'walls', label: 'Walls' },
  { value: 'both', label: 'Walls and ceiling' },
] as const
const FT = 0.3048
const FT2_M2 = 0.09290304

export default function Drywall() {
  const f = useFields({ length: '12', width: '12', height: '8', doors: '1', windows: '1', waste: '10' })
  const [units, setUnits] = useState<Units>('ft')
  const [surface, setSurface] = useState<'walls' | 'both'>('walls')
  const [sheetId, setSheetId] = useState('4x8')

  const switchUnits = (u: Units) => {
    if (u === units) return
    const k = u === 'm' ? FT : 1 / FT
    const conv = (s: string) => {
      const n = Number(s)
      return Number.isFinite(n) && s.trim() !== '' ? String(Number((n * k).toFixed(2))) : s
    }
    f.setMany({ length: conv(f.raw.length), width: conv(f.raw.width), height: conv(f.raw.height) })
    setSheetId(u === 'm' ? '1200x2400' : '4x8')
    setUnits(u)
  }

  const { length, width, height, doors, windows, waste } = f.num
  const pos = (v: number | null, what: string) => (v === null ? `Enter the ${what}.` : v <= 0 ? `The ${what} must be above zero.` : null)
  const count = (v: number | null) => (v === null ? 'Enter a number, or 0.' : v < 0 || !Number.isInteger(v) ? 'Use a whole number.' : null)
  const err = {
    length: pos(length, 'length'),
    width: pos(width, 'width'),
    height: pos(height, 'wall height'),
    doors: count(doors),
    windows: count(windows),
    waste: waste === null ? 'Enter a waste allowance, or 0.' : waste < 0 || waste > 100 ? 'Use 0 to 100 %.' : null,
  }
  const ok = !Object.values(err).some(Boolean)
  const sheet = SHEETS.find((s) => s.value === sheetId) ?? SHEETS[0]!
  const toFt = units === 'm' ? 1 / FT : 1
  const r = ok
    ? drywall({
        length: length! * toFt,
        width: width! * toFt,
        height: height! * toFt,
        ceiling: surface === 'both',
        doors: doors!,
        windows: windows!,
        sheetArea: sheet.w * sheet.l,
        waste: waste!,
      })
    : null
  const A = (ft2: number) => (units === 'm' ? ft2 * FT2_M2 : ft2)
  const au = units === 'm' ? 'm²' : 'ft²'
  const sheetArea = A(sheet.w * sheet.l)

  const working = r
    ? [
        `walls   = 2 × (L + W) × H = 2 × (${num(length!)} + ${num(width!)}) × ${num(height!)} = ${num(A(r.walls))} ${au}`,
        ...(surface === 'both' ? [`ceiling = L × W = ${num(length!)} × ${num(width!)} = ${num(A(r.ceiling))} ${au}`] : []),
        `openings = ${doors} × ${num(A(DOOR_FT2), 4)} + ${windows} × ${num(A(WINDOW_FT2), 4)} = ${num(A(r.openings))} ${au}`,
        `board   = ${num(A(r.walls))}${surface === 'both' ? ` + ${num(A(r.ceiling))}` : ''} − ${num(A(r.openings))} = ${num(A(r.net))} ${au}`,
        `sheets  = ⌈${num(A(r.net))} × (1 + ${num(waste!)} ÷ 100) ÷ ${num(sheetArea, 4)}⌉ = ⌈${num((A(r.net) * (1 + waste! / 100)) / sheetArea, 4)}⌉ = ${r.sheets}`,
        `screws  ≈ 1 per ft² of board = ${fmt(r.screws)}`,
        `compound ≈ ${num(r.net)} ft² × 9.4 gal ÷ 1,000 = ${num(r.compoundGal, 3)} US gal`,
        `tape    ≈ ${num(r.net)} ft² × 370 ft ÷ 1,000 = ${num(r.tapeFt, 4)} ft`,
      ]
    : []

  return (
    <CalcLayout
      inputs={
        <>
          <Choice label="Units" value={units} onChange={switchUnits} options={UNITS} />
          <Row>
            <NumField label="Room length" {...f.bind('length')} unit={units} error={err.length} />
            <NumField label="Room width" {...f.bind('width')} unit={units} error={err.width} />
          </Row>
          <NumField label="Wall height" {...f.bind('height')} unit={units} error={err.height} />
          <Choice label="Cover" value={surface} onChange={setSurface} options={SURFACES} />
          <Row>
            <NumField label="Doors" {...f.bind('doors')} inputMode="numeric" error={err.doors} hint={units === 'm' ? '1.95 m² each' : '21 ft² each'} />
            <NumField label="Windows" {...f.bind('windows')} inputMode="numeric" error={err.windows} hint={units === 'm' ? '1.39 m² each' : '15 ft² each'} />
          </Row>
          <Row>
            <SelectField label="Sheet size" value={sheetId} onChange={setSheetId} options={SHEETS} />
            <NumField label="Waste" {...f.bind('waste')} unit="%" error={err.waste} />
          </Row>
        </>
      }
      result={
        <Result
          label={`Sheets of ${sheet.label}`}
          value={r ? r.sheets : '–'}
          format={(n) => dec(n, 0)}
          sub={r ? `${dec(A(r.net), 1)} ${au} of board after openings, plus ${fmt(waste!, 3)} % waste` : undefined}
          copy={
            r
              ? `${r.sheets} sheets of ${sheet.label}; ${dec(A(r.net), 1)} ${au} of board; about ${fmt(r.screws)} screws, ${dec(r.compoundGal, 1)} gal of joint compound and ${fmt(Math.round(r.tapeFt))} ft of tape`
              : undefined
          }
        >
          {r ? (
            <>
              <Stat label="Wall area" value={A(r.walls)} format={(n) => dec(n, 1)} unit={au} />
              <Stat label="Ceiling area" value={A(r.ceiling)} format={(n) => dec(n, 1)} unit={au} />
              <Stat label="Openings" value={A(r.openings)} format={(n) => dec(n, 1)} unit={au} />
              <Stat label="Screws" value={r.screws} format={(n) => fmt(Math.round(n))} />
              <Stat label="Joint compound" value={`${dec(r.compoundGal, 1)} gal, ${r.pails} pail${r.pails === 1 ? '' : 's'}`} />
              <Stat label="Joint tape" value={`${fmt(Math.round(r.tapeFt))} ft, ${r.tapeRolls} roll${r.tapeRolls === 1 ? '' : 's'}`} />
            </>
          ) : null}
        </Result>
      }
      visual={
        r ? (
          <WallSheets
            L={length! * toFt}
            W={width! * toFt}
            H={height! * toFt}
            ceiling={surface === 'both'}
            doors={doors!}
            windows={windows!}
            sheetW={sheet.w}
            sheetL={sheet.l}
            units={units}
            summary={`The four walls unfolded${surface === 'both' ? ' and the ceiling' : ''}, drawn to scale. Sheets of ${sheet.label} go up one at a time, hung horizontally with the joints staggered; doors and windows are cut out. The count in the result comes from the area, so it covers offcuts; a layout of whole sheets can differ by a sheet or two.`}
          />
        ) : (
          <Stage summary="Enter the room size to see the walls.">
            <div className="aspect-[4/3] w-full" />
          </Stage>
        )
      }
      working={working.length ? <Working lines={working} caption="Doors count as 21 ft² (3 × 7 ft), windows as 15 ft² (3 × 5 ft). Finishing quantities are for three coats." /> : null}
    />
  )
}

/* ── the walls unfolded, sheets hung one by one ─────────────────── */

interface Panel {
  name: string
  w: number
  h: number
  /** Openings: x, y from the bottom left, width, height (ft). */
  holes: [number, number, number, number][]
  /** Stud or joist spacing direction: studs are vertical lines. */
  ceiling: boolean
}

interface Piece {
  panel: number
  x: number
  y: number
  w: number
  h: number
}

function layout(L: number, W: number, H: number, ceiling: boolean, doors: number, windows: number, sw: number, sl: number, u: Units) {
  const show = (ft: number) => `${fmt(u === 'm' ? ft * FT : ft, 4)} ${u}`
  const walls: Panel[] = [L, W, L, W].map((len, i) => ({ name: `Wall ${i + 1}, ${show(len)}`, w: len, h: H, holes: [], ceiling: false }))
  for (let d = 0; d < doors; d++) {
    const p = walls[d % 4]!
    const n = Math.floor(d / 4)
    const x = Math.min(p.w - 3, 1 + n * 4)
    if (x >= 0 && p.h >= 7) p.holes.push([x, 0, 3, 7])
  }
  for (let i = 0; i < windows; i++) {
    const p = walls[(i + 1) % 4]!
    const n = Math.floor(i / 4)
    const x = Math.max(0, p.w - 4 - n * 4)
    if (x >= 0 && p.h >= 6) p.holes.push([x, Math.min(2.5, p.h - 5.5), 3, 5])
  }
  const panels = ceiling ? [...walls, { name: `Ceiling, ${show(L)} × ${show(W)}`, w: L, h: W, holes: [], ceiling: true }] : walls
  const pieces: Piece[] = []
  panels.forEach((p, pi) => {
    // sheets run horizontally; rows from the top down, joints staggered by half a sheet
    const rows = Math.ceil(p.h / sw - 1e-9)
    for (let r = 0; r < rows; r++) {
      const y1 = p.h - r * sw
      const y0 = Math.max(0, y1 - sw)
      let x = 0
      let first = r % 2 === 1 ? sl / 2 : sl
      while (x < p.w - 1e-9) {
        const len = Math.min(first, p.w - x)
        pieces.push({ panel: pi, x, y: y0, w: len, h: y1 - y0 })
        x += len
        first = sl
      }
    }
  })
  return { panels, pieces }
}

function WallSheets(props: { L: number; W: number; H: number; ceiling: boolean; doors: number; windows: number; sheetW: number; sheetL: number; units: Units; summary: string }) {
  const { L, W, H, ceiling, doors, windows, sheetW, sheetL, units, summary } = props
  const canvas = useRef<HTMLCanvasElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const t = useRef(0)
  const plan = useMemo(() => layout(L, W, H, ceiling, doors, windows, sheetW, sheetL, units), [L, W, H, ceiling, doors, windows, sheetW, sheetL, units])
  const step = Math.min(0.16, 4 / Math.max(1, plan.pieces.length))
  const end = plan.pieces.length * step + 0.3

  const paint = (time: number) => {
    const p = prepCanvas(canvas.current)
    if (p) drawWalls(p.ctx, p.w, p.h, ink, plan.panels, plan.pieces, time / step)
    if (clock.current) clock.current.textContent = `${Math.min(plan.pieces.length, Math.max(0, Math.floor(time / step)))} of ${plan.pieces.length} pieces`
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      t.current = Math.min(end, t.current + dt)
      paint(t.current)
      if (t.current >= end) setPlaying(false)
    },
    playing,
  )
  useEffect(() => {
    t.current = 0
    setPlaying(true)
  }, [plan])
  useEffect(() => {
    if (reduced) t.current = end
    paint(t.current)
  })

  return (
    <Stage
      summary={summary}
      bar={
        <SimBar
          playing={playing}
          onPlaying={(p) => {
            if (p && t.current >= end) t.current = 0
            setPlaying(p)
          }}
          onReplay={() => {
            t.current = 0
            setPlaying(true)
            paint(0)
          }}
          scale="One sheet at a time"
          reduced={reduced}
          clock={clock}
        />
      }
    >
      <canvas ref={canvas} className="block aspect-[4/3] w-full" role="img" aria-label="The room's walls with drywall sheets laid out" />
    </Stage>
  )
}

function drawWalls(ctx: CanvasRenderingContext2D, w: number, h: number, ink: Ink, panels: Panel[], pieces: Piece[], shown: number) {
  const pad = 14
  const gap = 14
  const lab = 18
  const L = panels[0]!.w
  const W = panels[1]!.w
  const H = panels[0]!.h
  const ceil = panels[4]
  const rowsH = 2 * H + (ceil ? ceil.h : 0)
  const rowCount = ceil ? 3 : 2
  const k = Math.min((w - 2 * pad - gap) / (L + W), (h - 2 * pad - rowCount * lab - (rowCount - 1) * gap) / rowsH)
  const totalW = (L + W) * k + gap
  const x0 = (w - totalW) / 2
  const pos = (i: number): [number, number] => {
    if (i < 4) {
      const col = i % 2
      const row = Math.floor(i / 2)
      return [x0 + (col === 0 ? 0 : L * k + gap), pad + lab + row * (H * k + gap + lab)]
    }
    return [x0, pad + lab + 2 * (H * k + gap + lab)]
  }
  const font = ink.font

  panels.forEach((p, i) => {
    const [px, py] = pos(i)
    const pw = p.w * k
    const ph = p.h * k
    label(ctx, p.name, px, py - 6, { color: ink.grey, halo: ink.fill, font, size: 11 })
    ctx.fillStyle = ink.fill
    ctx.fillRect(px, py, pw, ph)
    // studs or joists at 16 in centres
    ctx.strokeStyle = ink.hairline
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let s = 0; s <= p.w + 1e-9; s += 16 / 12) {
      const x = px + Math.min(s, p.w) * k
      ctx.moveTo(x, py)
      ctx.lineTo(x, py + ph)
    }
    ctx.stroke()
  })

  pieces.forEach((pc, i) => {
    const a = Math.min(1, Math.max(0, shown - i) / 1.6)
    if (a <= 0) return
    const [px, py] = pos(pc.panel)
    const p = panels[pc.panel]!
    const e = 1 - (1 - a) ** 3
    const x = px + pc.x * k
    const y = py + (p.h - pc.y - pc.h) * k - (1 - e) * 14
    ctx.globalAlpha = e
    ctx.fillStyle = ink.paper
    ctx.fillRect(x, y, pc.w * k, pc.h * k)
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, y + 0.5, pc.w * k - 1, pc.h * k - 1)
    ctx.globalAlpha = 1
  })

  panels.forEach((p, i) => {
    const [px, py] = pos(i)
    for (const [hx, hy, hw, hh] of p.holes) {
      const x = px + hx * k
      const y = py + (p.h - hy - hh) * k
      ctx.fillStyle = ink.fill
      ctx.fillRect(x, y, hw * k, hh * k)
      ctx.strokeStyle = ink.ink
      ctx.lineWidth = 1.5
      ctx.strokeRect(x, y, hw * k, hh * k)
    }
    ctx.strokeStyle = ink.grey
    ctx.lineWidth = 1
    ctx.strokeRect(px, py, p.w * k, p.h * k)
  })
}
