import { useEffect, useMemo, useRef, useState } from 'react'
import { CalcLayout, NumField, Result, SelectField, SimBar, Stage, Stat, Working } from './_viz/Calc'
import { fmt, parseNum } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import { model, net, paintFill, paintNet } from './solid-view'
import { SHAPES, checkDims, surface, surfaceParts, surfaceWork, volume, volumeWork } from './solids'
import type { Dims, Param, Shape } from './solids'

type Unit = 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'yd'
const UNITS: { value: Unit; label: string }[] = [
  { value: 'mm', label: 'Millimetres' },
  { value: 'cm', label: 'Centimetres' },
  { value: 'm', label: 'Metres' },
  { value: 'in', label: 'Inches' },
  { value: 'ft', label: 'Feet' },
  { value: 'yd', label: 'Yards' },
]
/** Metres per unit. */
const M: Record<Unit, number> = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048, yd: 0.9144 }
const SHAPE_LIST = (Object.keys(SHAPES) as Shape[]).map((s) => ({ value: s, label: SHAPES[s].label }))

const TAU = 0.42
const FILL_S = 2.6
const UNFOLD_S = 2.2

/** Volume or surface area of a solid, with a turning 3D view. */
export default function Solids({ measure }: { measure: 'volume' | 'surface' }) {
  const shapes = measure === 'surface' ? SHAPE_LIST.filter((s) => s.value !== 'capsule') : SHAPE_LIST
  const [shape, setShape] = useState<Shape>(measure === 'volume' ? 'cone' : 'cylinder')
  const [unit, setUnit] = useState<Unit>('cm')
  const [raw, setRaw] = useState<Record<string, string>>({})
  const params = SHAPES[shape].params
  const text = (k: Param) => raw[`${shape}.${k}`] ?? params.find((p) => p.key === k)?.def ?? ''
  const dims: Dims = {}
  for (const p of params) dims[p.key] = parseNum(text(p.key)) ?? Number.NaN
  const err = checkDims(shape, dims)
  const V = err ? 0 : volume(shape, dims)
  const A = err ? 0 : surface(shape, dims)
  const parts = err ? [] : surfaceParts(shape, dims)
  const key = `${shape}:${params.map((p) => dims[p.key]).join(',')}`

  const litres = V * M[unit] ** 3 * 1000
  const usGal = litres / 3.785411784

  /* animation */
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const st = useRef({ t: 0, phi: 0.7 })
  const m = useMemo(() => (err ? null : model(shape, dims)), [key, err])
  const faces = useMemo(() => (err || measure !== 'surface' ? null : net(shape, dims)), [key, err, measure])
  useEffect(() => {
    st.current.t = 0
  }, [key])

  const cycle = UNFOLD_S * 2 + 3.2
  const paint = (reduced: boolean) => {
    const p = prepCanvas(canvas.current)
    if (!p || !m) return
    const s = st.current
    if (measure === 'volume') {
      const f = reduced ? 1 : Math.min(1, s.t / FILL_S)
      paintFill(p.ctx, p.w, p.h, m, { phi: s.phi, tau: TAU }, f, ink)
    } else if (faces) {
      // unfold, hold the net, fold back, hold the solid
      const t = reduced ? UNFOLD_S : s.t % cycle
      const u = t < UNFOLD_S ? t / UNFOLD_S : t < UNFOLD_S + 2.2 ? 1 : t < UNFOLD_S * 2 + 2.2 ? 1 - (t - UNFOLD_S - 2.2) / UNFOLD_S : 0
      paintNet(p.ctx, p.w, p.h, faces, m.height, { phi: s.phi, tau: TAU }, u, ink, (a) => `${fmt(a, 3)} ${unit}²`)
    }
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      const s = st.current
      s.t += dt
      const folded = measure === 'volume' || s.t % cycle > UNFOLD_S * 2 + 2.2
      if (folded) s.phi += dt * 0.45
      paint(false)
    },
    playing && m !== null,
  )
  useEffect(() => paint(reduced))

  const cu = `${unit}³`
  const sq = `${unit}²`
  const name = SHAPES[shape].label.toLowerCase()
  const summary = err
    ? 'Enter the dimensions to see the shape.'
    : measure === 'volume'
      ? `A ${name} of ${params.map((p) => `${p.label.replace(/ \w$/, '').toLowerCase()} ${fmt(dims[p.key]!)} ${unit}`).join(', ')} holds ${fmt(V, 5)} ${cu}${litres >= 0.001 ? `, ${fmt(litres, 4)} litres` : ''}. The drawing turns slowly and fills at a steady rate, so the level rises faster where the shape is narrow.`
      : `The ${name} unfolds into its net: ${parts.map((q) => `${q.name.toLowerCase()} ${fmt(q.area, 4)} ${sq}`).join(', ')}. Together that is ${fmt(A, 5)} ${sq}.`

  const lines = err ? [] : measure === 'volume' ? volumeWork(shape, dims) : surfaceWork(shape, dims)
  const working = lines.map((l, i) => (i === lines.length - 1 ? `${l} ${measure === 'volume' ? cu : sq}` : l))

  return (
    <CalcLayout
      inputs={
        <>
          <SelectField label="Shape" value={shape} onChange={setShape} options={shapes} />
          <div className="grid grid-cols-2 gap-3">
            {params.map((p) => (
              <NumField
                key={`${shape}.${p.key}`}
                label={p.label}
                value={text(p.key)}
                onChange={(v) => setRaw((r) => ({ ...r, [`${shape}.${p.key}`]: v }))}
                unit={unit}
              />
            ))}
          </div>
          <SelectField label="Unit" value={unit} onChange={setUnit} options={UNITS} />
        </>
      }
      result={
        <Result
          label={measure === 'volume' ? 'Volume' : 'Total surface area'}
          value={err ? '–' : measure === 'volume' ? V : A}
          format={(n) => fmt(n, 6)}
          unit={measure === 'volume' ? cu : sq}
          error={err}
          copy={err ? undefined : measure === 'volume' ? `Volume ${fmt(V, 8)} ${cu} (${fmt(litres, 6)} L)` : `Surface area ${fmt(A, 8)} ${sq}`}
        >
          {err ? null : measure === 'volume' ? (
            <>
              <Stat label="Litres" value={fmt(litres, 5)} unit="L" />
              <Stat label="US gallons" value={fmt(usGal, 5)} unit="gal" />
              <Stat label="Cubic metres" value={fmt(V * M[unit] ** 3, 5)} unit="m³" />
              <Stat label="Surface area" value={fmt(A, 5)} unit={sq} />
            </>
          ) : (
            <>
              {parts.map((q) => (
                <Stat key={q.name} label={q.name} value={fmt(q.area, 5)} unit={sq} />
              ))}
              <Stat label="Volume" value={fmt(V, 5)} unit={cu} />
            </>
          )}
        </Result>
      }
      visual={
        <Stage
          summary={summary}
          bar={
            <SimBar
              playing={playing}
              onPlaying={setPlaying}
              onReplay={() => {
                st.current.t = 0
              }}
              scale={measure === 'volume' ? 'Fills in 2.6 s' : 'Unfolds in 2.2 s'}
              reduced={reduced}
            />
          }
        >
          <canvas ref={canvas} className="block aspect-square w-full sm:aspect-[4/3]" role="img" aria-label={`${SHAPES[shape].label}, ${measure === 'volume' ? 'filling with liquid' : 'unfolding into its net'}`} />
        </Stage>
      }
      working={working.length ? <Working lines={working} caption={`Lengths in ${unit}; π = 3.14159265…`} /> : null}
    />
  )
}
