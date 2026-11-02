import { useEffect, useMemo, useRef, useState } from 'react'
import { CalcLayout, Choice, NumField, Result, Row, SelectField, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { AGGREGATES, MULCH_BAGS, bagsFor, bedArea, bedVolume, weightOf } from './landscape'
import type { BedShape } from './landscape'

type Units = 'imperial' | 'metric'
type Variant = 'gravel' | 'mulch'

const SHAPES = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
] as const
const UNITS = [
  { value: 'imperial', label: 'Feet, inches' },
  { value: 'metric', label: 'Metres, cm' },
] as const
/** Typical stone size in metres, for drawing the stones to scale. */
const STONE: Record<string, number> = { gravel: 0.019, river: 0.04, base: 0.019, sand: 0.002, topsoil: 0.008 }

const FT = 0.3048
const IN = 0.0254

export default function Landscape({ variant }: { variant: Variant }) {
  const gravel = variant === 'gravel'
  const f = useFields({ length: '10', width: '10', diameter: '8', depth: gravel ? '3' : '3', extra: '10' })
  const [shape, setShape] = useState<BedShape>('rect')
  const [units, setUnits] = useState<Units>('imperial')
  const [material, setMaterial] = useState('gravel')
  const [bag, setBag] = useState('2ft')

  const switchUnits = (u: Units) => {
    if (u === units) return
    const toM = u === 'metric'
    const conv = (s: string, k: number, dp: number) => {
      const n = Number(s)
      return Number.isFinite(n) && s.trim() !== '' ? String(Number((n * k).toFixed(dp))) : s
    }
    f.setMany({
      length: conv(f.raw.length, toM ? FT : 1 / FT, 2),
      width: conv(f.raw.width, toM ? FT : 1 / FT, 2),
      diameter: conv(f.raw.diameter, toM ? FT : 1 / FT, 2),
      depth: conv(f.raw.depth, toM ? 2.54 : 1 / 2.54, 1),
    })
    if (!gravel) setBag(toM ? '40l' : '2ft')
    setUnits(u)
  }

  const imp = units === 'imperial'
  const lu = imp ? 'ft' : 'm'
  const du = imp ? 'in' : 'cm'
  const L = imp ? FT : 1
  const D = imp ? IN : 0.01
  const { length, width, diameter, depth, extra } = f.num
  const pos = (v: number | null, what: string) => (v === null ? `Enter the ${what}.` : v <= 0 ? `The ${what} must be above zero.` : null)
  const err = {
    length: shape === 'rect' ? pos(length, 'length') : null,
    width: shape === 'rect' ? pos(width, 'width') : null,
    diameter: shape === 'circle' ? pos(diameter, 'diameter') : null,
    depth: pos(depth, 'depth'),
    extra: gravel ? (extra === null ? 'Enter an allowance, or 0.' : extra < 0 || extra > 100 ? 'Use 0 to 100 %.' : null) : null,
  }
  const ok = !Object.values(err).some(Boolean)
  const areaUser = ok ? bedArea(shape, shape === 'rect' ? length! : diameter!, width ?? 0) : 0
  const areaM2 = areaUser * L * L
  const depthM = ok ? depth! * D : 0
  const vol = ok ? bedVolume(areaM2, depthM) : null
  const mat = AGGREGATES.find((m) => m.value === material) ?? AGGREGATES[0]!
  const bagSpec = MULCH_BAGS.find((b) => b.value === bag) ?? MULCH_BAGS[0]!
  const extraK = gravel && extra !== null ? 1 + extra / 100 : 1
  const weight = vol ? weightOf(vol.m3, mat.density) : null
  const bags = vol ? bagsFor(vol.m3, bagSpec.m3) : 0

  const au = imp ? 'ft²' : 'm²'
  const mainVol = vol ? (imp ? vol.yd3 : vol.m3) : 0
  const vu = imp ? 'yd³' : 'm³'

  const working: string[] = vol
    ? [
        shape === 'rect'
          ? `area   = L × W = ${num(length!)} × ${num(width!)} = ${num(areaUser)} ${au}`
          : `area   = π × (d ÷ 2)² = π × (${num(diameter!)} ÷ 2)² = ${num(areaUser)} ${au}`,
        imp
          ? `volume = area × depth = ${num(areaUser)} × (${num(depth!)} ÷ 12) = ${num(vol.ft3)} ft³`
          : `volume = area × depth = ${num(areaUser)} × (${num(depth!)} ÷ 100) = ${num(vol.m3)} m³`,
        imp ? `       = ${num(vol.ft3)} ÷ 27 = ${num(vol.yd3, 4)} yd³` : `       = ${num(vol.m3)} ÷ 0.764555 = ${num(vol.yd3, 4)} yd³`,
        ...(gravel && weight
          ? [
              `weight = volume × density = ${num(vol.m3, 5)} m³ × ${fmt(mat.density)} kg/m³ = ${num(weight.kg)} kg`,
              `       = ${num(weight.kg)} ÷ 907.185 = ${num(weight.tons, 4)} US tons`,
              `order  = ${num(mainVol, 4)} × (1 + ${num(extra!)} ÷ 100) = ${num(mainVol * extraK, 4)} ${vu}`,
            ]
          : [`bags   = ⌈${num(vol.m3, 5)} m³ ÷ ${num(bagSpec.m3, 5)} m³⌉ = ⌈${num(vol.m3 / bagSpec.m3, 4)}⌉ = ${bags} (${bagSpec.label}s)`]),
      ]
    : []

  const coverEach = vol ? bagSpec.m3 / depthM / (L * L) : 0
  const summary = vol
    ? gravel
      ? `A cut through the edge of the bed, to scale: ${fmt(depth!, 4)} ${du} of ${mat.label.toLowerCase()} fills it as the stones fall at the speed gravity gives them. The bed holds ${dec(mainVol, 2)} ${vu}, about ${dec(imp ? weight!.tons : weight!.tonnes, 2)} ${imp ? 'US tons' : 'tonnes'}.`
      : `The bed drawn to scale from above. Mulch spreads across it one bag at a time: ${bags} ${bagSpec.label}s at ${fmt(depth!, 4)} ${du} deep, each covering ${dec(coverEach, 1)} ${au}.`
    : 'Enter the size and depth of the bed.'

  return (
    <CalcLayout
      inputs={
        <>
          <Choice label="Shape" value={shape} onChange={setShape} options={SHAPES} />
          <Choice label="Units" value={units} onChange={switchUnits} options={UNITS} />
          {shape === 'rect' ? (
            <Row>
              <NumField label="Length" {...f.bind('length')} unit={lu} error={err.length} />
              <NumField label="Width" {...f.bind('width')} unit={lu} error={err.width} />
            </Row>
          ) : (
            <NumField label="Diameter" {...f.bind('diameter')} unit={lu} error={err.diameter} />
          )}
          <NumField
            label="Depth"
            {...f.bind('depth')}
            unit={du}
            error={err.depth}
            slider={imp ? { min: 1, max: 12, step: 0.5 } : { min: 2, max: 30, step: 1 }}
            hint={gravel ? 'About 2 in for paths, 4 to 6 in for a driveway' : '2 to 3 in for most beds'}
          />
          {gravel ? (
            <>
              <SelectField label="Material" value={material} onChange={setMaterial} options={AGGREGATES} hint={`About ${fmt(mat.density)} kg/m³ loose; ask your supplier`} />
              <NumField label="Extra for settling" {...f.bind('extra')} unit="%" error={err.extra} />
            </>
          ) : (
            <SelectField label="Bag size" value={bag} onChange={setBag} options={MULCH_BAGS} />
          )}
        </>
      }
      result={
        gravel ? (
          <Result
            label={`${mat.label} needed`}
            value={vol ? mainVol : '–'}
            format={(n) => dec(n, 2)}
            unit={vol ? vu : undefined}
            sub={weight ? `About ${dec(imp ? weight.tons : weight.tonnes, 2)} ${imp ? 'US tons' : 'tonnes'}` : undefined}
            copy={vol && weight ? `${dec(vol.yd3, 3)} yd³ (${dec(vol.m3, 3)} m³), about ${dec(weight.tons, 2)} US tons; order ${dec(mainVol * extraK, 2)} ${vu} with ${fmt(extra!, 3)} % extra` : undefined}
          >
            {vol && weight ? (
              <>
                <Stat label={`With ${fmt(extra ?? 0, 3)} % extra`} value={mainVol * extraK} format={(n) => dec(n, 2)} unit={vu} />
                <Stat label="Cubic feet" value={vol.ft3} format={(n) => dec(n, 1)} unit="ft³" />
                <Stat label={imp ? 'Cubic metres' : 'Cubic yards'} value={imp ? vol.m3 : vol.yd3} format={(n) => dec(n, 3)} unit={imp ? 'm³' : 'yd³'} />
                <Stat label="Weight" value={weight.kg} format={(n) => fmt(Math.round(n))} unit="kg" />
                <Stat label="US tons" value={weight.tons} format={(n) => dec(n, 2)} />
                <Stat label="Area" value={areaUser} format={(n) => dec(n, 1)} unit={au} />
              </>
            ) : null}
          </Result>
        ) : (
          <Result
            label="Mulch needed"
            value={vol ? mainVol : '–'}
            format={(n) => dec(n, 2)}
            unit={vol ? vu : undefined}
            sub={vol ? `${bags} ${bagSpec.label}s` : undefined}
            copy={vol ? `${dec(vol.yd3, 3)} yd³ (${dec(vol.ft3, 2)} ft³, ${dec(vol.m3 * 1000, 0)} L); ${bags} ${bagSpec.label}s` : undefined}
          >
            {vol ? (
              <>
                <Stat label={bagSpec.label.replace(' bag', ' bags')} value={bags} format={(n) => dec(n, 0)} />
                {MULCH_BAGS.filter((b) => b.value !== bag && (imp ? b.value.endsWith('ft') : b.value.endsWith('l'))).map((b) => (
                  <Stat key={b.value} label={b.label.replace(' bag', ' bags')} value={bagsFor(vol.m3, b.m3)} format={(n) => dec(n, 0)} />
                ))}
                <Stat label="Cubic feet" value={vol.ft3} format={(n) => dec(n, 1)} unit="ft³" />
                <Stat label="Litres" value={vol.m3 * 1000} format={(n) => fmt(Math.round(n))} unit="L" />
                <Stat label="Area" value={areaUser} format={(n) => dec(n, 1)} unit={au} />
                <Stat label="One bag covers" value={coverEach} format={(n) => dec(n, 1)} unit={au} />
              </>
            ) : null}
          </Result>
        )
      }
      visual={
        vol ? (
          gravel ? (
            <GravelSection depthM={depthM} stone={STONE[material] ?? 0.019} du={du} depthText={fmt(depth!, 4)} summary={summary} />
          ) : (
            <MulchPlan shape={shape} a={shape === 'rect' ? length! : diameter!} b={width ?? 0} lu={lu} bags={bags} share={bagSpec.m3 / vol.m3} summary={summary} />
          )
        ) : (
          <Stage summary={summary}>
            <div className="aspect-[4/3] w-full" />
          </Stage>
        )
      }
      working={working.length ? <Working lines={working} caption={gravel ? 'Densities are typical for loose, dry material. Wet or compacted stone weighs more.' : 'Bags round up to whole bags.'} /> : null}
    />
  )
}

/* ── random ─────────────────────────────────────────────────────── */

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ── gravel: a section through the bed, stones falling in ───────── */

interface Stone {
  x: number
  y: number
  r: number
  /** Time the stone is let go, s. */
  t0: number
  sides: number
  rot: number
}

const G = 9.80665

function GravelSection({ depthM, stone, du, depthText, summary }: { depthM: number; stone: number; du: string; depthText: string; summary: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const t = useRef(0)

  // Stones at true size unless the layer would be more than 7 stones deep.
  const size = Math.max(stone, depthM / 7)
  const enlarged = size > stone * 1.01
  const width = depthM * 5
  const drop = depthM * 1.4
  const stones = useMemo(() => {
    const rand = rng(Math.round(depthM * 1e5) + Math.round(size * 1e6))
    const out: Stone[] = []
    const dy = size * 0.84
    let row = 0
    for (let y = size / 2; y < depthM - size * 0.2; y += dy, row++) {
      for (let x = (row % 2 ? size : size / 2) + rand() * size * 0.2; x < width - size * 0.4; x += size * (0.98 + rand() * 0.12)) {
        out.push({ x, y: y + (rand() - 0.5) * size * 0.1, r: (size / 2) * (0.82 + rand() * 0.2), t0: 0, sides: 5 + Math.floor(rand() * 4), rot: rand() * Math.PI })
      }
    }
    // let them go bottom row first, in a random order within a row band
    const order = out.map((s, i) => ({ i, k: s.y + rand() * size * 1.5 })).sort((a, b) => a.k - b.k)
    const span = 2.4
    order.forEach((o, n) => (out[o.i]!.t0 = (n / Math.max(1, out.length)) * span))
    return out
  }, [depthM, size, width])
  const fallTime = Math.sqrt((2 * drop) / G)
  const end = (stones[stones.length - 1]?.t0 ?? 0) + fallTime + 0.1

  const paint = (time: number) => {
    const p = prepCanvas(canvas.current)
    if (p) drawGravel(p.ctx, p.w, p.h, ink, { depthM, width, drop, stones, time, du, depthText })
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
  }, [stones])
  useEffect(() => {
    if (reduced) t.current = end
    paint(t.current)
  })

  return (
    <Stage
      summary={`${summary}${enlarged ? ' The grains are drawn larger than life so they stay visible.' : ''}`}
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
          scale="Real time"
          reduced={reduced}
        />
      }
    >
      <canvas ref={canvas} className="block aspect-[4/3] w-full sm:aspect-[16/10]" role="img" aria-label={`Section of the bed filled to ${depthText} ${du}`} />
    </Stage>
  )
}

function drawGravel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ink: Ink,
  s: { depthM: number; width: number; drop: number; stones: Stone[]; time: number; du: string; depthText: string },
) {
  const left = 56
  const right = 16
  const k = (w - left - right) / (s.width * 1.12)
  const ground = h * 0.42 + Math.min(h * 0.25, (s.depthM * k) / 2) - (s.depthM * k) / 2
  const x0 = left + s.width * 0.12 * k
  const X = (x: number) => x0 + x * k
  const Y = (y: number) => ground + s.depthM * k - y * k // y is height above the bed floor

  // soil around the bed, hatched
  ctx.save()
  ctx.beginPath()
  ctx.rect(left - 40, ground, w, h - ground)
  ctx.rect(X(0), ground, s.width * k + 40, s.depthM * k)
  ctx.clip('evenodd')
  ctx.strokeStyle = ink.hairline
  ctx.lineWidth = 1
  for (let i = -h; i < w + h; i += 9) {
    ctx.beginPath()
    ctx.moveTo(i, ground)
    ctx.lineTo(i + h, ground + h)
    ctx.stroke()
  }
  ctx.restore()
  // bed outline and ground line
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(left - 40, ground)
  ctx.lineTo(X(0), ground)
  ctx.lineTo(X(0), Y(0))
  ctx.lineTo(w + 4, Y(0))
  ctx.stroke()

  // stones
  for (const st of s.stones) {
    const tt = s.time - st.t0
    if (tt < 0) continue
    const fall = Math.max(0, s.drop + s.depthM - st.y - 0.5 * G * tt * tt)
    const y = st.y + fall
    const cx = X(st.x)
    const cy = Y(y)
    const r = st.r * k
    ctx.beginPath()
    for (let i = 0; i < st.sides; i++) {
      const a = st.rot + (i / st.sides) * Math.PI * 2
      const rr = r * (0.86 + 0.14 * Math.cos(i * 2.3 + st.rot))
      const px = cx + Math.cos(a) * rr
      const py = cy + Math.sin(a) * rr
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = ink.paper
    ctx.fill()
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = r > 3 ? 1 : 0.6
    ctx.stroke()
  }

  // depth dimension
  const dx = left - 22
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(dx, Y(s.depthM))
  ctx.lineTo(dx, Y(0))
  ctx.moveTo(dx - 4, Y(s.depthM))
  ctx.lineTo(dx + 4, Y(s.depthM))
  ctx.moveTo(dx - 4, Y(0))
  ctx.lineTo(dx + 4, Y(0))
  ctx.stroke()
  label(ctx, `${s.depthText} ${s.du}`, dx + 8, (Y(0) + Y(s.depthM)) / 2 + 4, { color: ink.ink, halo: ink.fill, font: ink.font, size: 12, weight: 650 })
}

/* ── mulch: the bed from above, covered one bag at a time ───────── */

interface Chip {
  x: number
  y: number
  a: number
  l: number
  /** 0..1 position in the spreading order. */
  k: number
}

function MulchPlan({ shape, a, b, lu, bags, share, summary }: { shape: BedShape; a: number; b: number; lu: string; bags: number; share: number; summary: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const ink = useInk()
  const resized = useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const t = useRef(0)
  const perBag = Math.min(0.45, 4.5 / Math.max(1, bags))
  const end = bags * perBag + 0.2

  const chips = useMemo(() => {
    const c = canvas.current
    const w = c?.clientWidth || 480
    const h = c?.clientHeight || 300
    const rand = rng(bags * 7919 + Math.round(a * 100) + Math.round(b * 10))
    const out: Chip[] = []
    const n = Math.min(6000, Math.round((w * h) / 16))
    for (let i = 0; i < n; i++) {
      const x = rand()
      const y = rand()
      if (shape === 'circle' && (x - 0.5) ** 2 + (y - 0.5) ** 2 > 0.25) continue
      out.push({ x, y, a: rand() * Math.PI, l: 2 + rand() * 3, k: Math.min(1, Math.max(0, x * 0.85 + y * 0.1 + rand() * 0.05)) })
    }
    return out
    // a new set when the canvas is resized
  }, [shape, a, b, bags, resized])

  const paint = (time: number) => {
    const p = prepCanvas(canvas.current)
    if (p) drawMulch(p.ctx, p.w, p.h, ink, { shape, a, b, lu, chips, covered: Math.min(1, (time / perBag) * share) })
    if (clock.current) clock.current.textContent = `Bag ${Math.min(bags, Math.max(1, Math.ceil(time / perBag)))} of ${bags}`
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
  }, [chips])
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
          scale="One bag at a time"
          reduced={reduced}
          clock={clock}
        />
      }
    >
      <canvas ref={canvas} className="block aspect-[4/3] w-full sm:aspect-[16/10]" role="img" aria-label={`Bed covered by ${bags} bags of mulch`} />
    </Stage>
  )
}

function drawMulch(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ink: Ink,
  s: { shape: BedShape; a: number; b: number; lu: string; chips: Chip[]; covered: number },
) {
  const bw = s.shape === 'rect' ? s.a : s.a
  const bh = s.shape === 'rect' ? s.b : s.a
  const pad = 30
  const k = Math.min((w - pad * 2) / bw, (h - pad * 2 - 6) / bh)
  const W = bw * k
  const H = bh * k
  const x0 = (w - W) / 2
  const y0 = (h - H) / 2 - 4

  ctx.save()
  ctx.beginPath()
  if (s.shape === 'rect') ctx.rect(x0, y0, W, H)
  else ctx.arc(x0 + W / 2, y0 + H / 2, W / 2, 0, Math.PI * 2)
  ctx.fillStyle = ink.paper
  ctx.fill()
  ctx.clip()
  // chips scale in as the edge of the layer passes them
  ctx.strokeStyle = ink.ink
  ctx.lineCap = 'round'
  ctx.lineWidth = 1.3
  ctx.beginPath()
  const edge = s.covered
  for (const c of s.chips) {
    if (c.k > edge) continue
    const grow = Math.min(1, (edge - c.k) / 0.03)
    const l = c.l * grow
    const x = x0 + c.x * W
    const y = y0 + c.y * H
    const dx = Math.cos(c.a) * l * 0.5
    const dy = Math.sin(c.a) * l * 0.5
    ctx.moveTo(x - dx, y - dy)
    ctx.lineTo(x + dx, y + dy)
  }
  ctx.stroke()
  ctx.restore()

  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 1.5
  ctx.beginPath()
  if (s.shape === 'rect') ctx.rect(x0, y0, W, H)
  else ctx.arc(x0 + W / 2, y0 + H / 2, W / 2, 0, Math.PI * 2)
  ctx.stroke()

  const font = ink.font
  if (s.shape === 'rect') {
    label(ctx, `${fmt(s.a, 4)} ${s.lu}`, x0 + W / 2, y0 + H + 18, { color: ink.ink, halo: ink.fill, font, size: 12, align: 'center' })
    ctx.save()
    ctx.translate(x0 - 10, y0 + H / 2)
    ctx.rotate(-Math.PI / 2)
    label(ctx, `${fmt(s.b, 4)} ${s.lu}`, 0, 0, { color: ink.ink, halo: ink.fill, font, size: 12, align: 'center' })
    ctx.restore()
  } else {
    label(ctx, `${fmt(s.a, 4)} ${s.lu} across`, x0 + W / 2, y0 + H + 18, { color: ink.ink, halo: ink.fill, font, size: 12, align: 'center' })
  }
}
