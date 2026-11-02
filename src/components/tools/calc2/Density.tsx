import { useEffect, useRef, useState } from 'react'
import { CalcLayout, Choice, Result, SelectField, SimBar, Stage, Stat, UnitField, Working, useFields } from './_viz/Calc'
import { dec, fmt, num } from './_viz/format'
import { useSimLoop } from './_viz/hooks'
import { MASS, VOLUME, unitOptions } from './_viz/units'
import { DENSITY, MATERIALS, density, massOf, submerged, volumeOf } from './density'
import type { DensityUnit } from './density'

type Find = 'rho' | 'm' | 'V'
type MassU = 'g' | 'kg' | 'lb' | 'oz'
type VolU = 'cm³' | 'mL' | 'L' | 'm³' | 'in³' | 'ft³'
const MASS_U = unitOptions(MASS, ['g', 'kg', 'lb', 'oz'])
const VOL_U = unitOptions(VOLUME, ['cm³', 'mL', 'L', 'm³', 'in³', 'ft³'])
const RHO_U = unitOptions(DENSITY, ['kg/m³', 'g/cm³', 'g/mL', 'lb/ft³', 'lb/in³'])
const WATER = 1000

const W = 440
const H = 260
const SURFACE = 96
const FLOOR = 238
const SIDE = 74
const G = 700
const DRAG = 4.2

export default function Density() {
  const [find, setFind] = useState<Find>('rho')
  const f = useFields({ m: '750', V: '1', rho: '750' })
  const [mu, setMu] = useState<MassU>('g')
  const [vu, setVu] = useState<VolU>('L')
  const [ru, setRu] = useState<DensityUnit>('kg/m³')
  const [material, setMaterial] = useState('custom')

  const pos = (v: number | null, what: string) => (v === null ? `Enter the ${what}.` : v <= 0 ? `The ${what} must be above zero.` : null)
  const err = {
    m: find === 'm' ? null : pos(f.num.m, 'mass'),
    V: find === 'V' ? null : pos(f.num.V, 'volume'),
    rho: find === 'rho' ? null : pos(f.num.rho, 'density'),
  }
  const ok = !err.m && !err.V && !err.rho
  // SI: kg, m³, kg/m³
  const mSI = find === 'm' ? 0 : (f.num.m ?? 0) * MASS[mu]
  const VSI = find === 'V' ? 0 : (f.num.V ?? 0) * VOLUME[vu]
  const rSI = find === 'rho' ? 0 : (f.num.rho ?? 0) * DENSITY[ru]
  const rho = !ok ? 0 : find === 'rho' ? density(mSI, VSI) : rSI
  const m = !ok ? 0 : find === 'm' ? massOf(rSI, VSI) : mSI
  const V = !ok ? 0 : find === 'V' ? volumeOf(mSI, rSI) : VSI
  const frac = ok ? submerged(rho, WATER) : 0
  const floats = ok && rho < WATER
  const near = ok ? MATERIALS.reduce((a, b) => (Math.abs(Math.log(b.rho / rho)) < Math.abs(Math.log(a.rho / rho)) ? b : a)) : null

  const pickMaterial = (id: string) => {
    setMaterial(id)
    const mat = MATERIALS.find((x) => x.id === id)
    if (mat) f.set('rho', String(Number((mat.rho / DENSITY[ru]).toPrecision(6))))
  }

  /* the block settles in water */
  const block = useRef<SVGGElement>(null)
  const [playing, setPlaying] = useState(true)
  const sim = useRef({ y: SURFACE - 40 - SIDE, v: 0, settled: false })
  const [settled, setSettled] = useState(false)
  const restY = floats ? SURFACE - SIDE * (1 - frac) : FLOOR - SIDE
  const place = (y: number) => block.current?.setAttribute('transform', `translate(${(W - SIDE) / 2},${y})`)
  const drop = () => {
    sim.current = { y: SURFACE - 50 - SIDE, v: 0, settled: false }
    setSettled(false)
  }
  useEffect(drop, [rho])
  const { reduced } = useSimLoop(
    block,
    (dt) => {
      const s = sim.current
      const ratio = Math.max(rho / WATER, 1e-3)
      const d = Math.min(SIDE, Math.max(0, s.y + SIDE - SURFACE))
      const a = G - (G * (d / SIDE)) / ratio - DRAG * s.v * (d > 0 ? 1 : 0.05)
      s.v += a * dt
      s.y += s.v * dt
      if (s.y >= FLOOR - SIDE) {
        s.y = FLOOR - SIDE
        s.v = 0
      }
      place(s.y)
      if (Math.abs(s.v) < 1 && Math.abs(s.y - restY) < 0.5) {
        s.settled = true
        setSettled(true)
      }
    },
    playing && ok && !settled,
  )
  useEffect(() => {
    if (reduced && ok) place(restY)
  })

  const R = (x: number) => x / DENSITY[ru]
  const Mv = (x: number) => x / MASS[mu]
  const Vv = (x: number) => x / VOLUME[vu]
  const main = find === 'rho' ? `${fmt(R(rho), 6)}` : find === 'm' ? fmt(Mv(m), 6) : fmt(Vv(V), 6)
  const mainUnit = find === 'rho' ? ru : find === 'm' ? mu : vu
  const summary = ok
    ? `${fmt(Mv(m), 5)} ${mu} in ${fmt(Vv(V), 5)} ${vu} is a density of ${fmt(R(rho), 5)} ${ru} (${fmt(rho / 1000, 4)} g/cm³)${near ? `, close to ${near.label.toLowerCase()}` : ''}. In fresh water the block ${floats ? `floats with ${dec(frac * 100, 1)}% of it under the surface` : rho === WATER ? 'hangs at any depth' : 'sinks'}.`
    : 'Enter two of mass, volume and density.'

  const working = ok
    ? find === 'rho'
      ? [`ρ = m ÷ V = ${num(mSI)} kg ÷ ${num(VSI)} m³ = ${num(rho)} kg/m³`]
      : find === 'm'
        ? [`m = ρ × V = ${num(rSI)} kg/m³ × ${num(VSI)} m³ = ${num(m)} kg`]
        : [`V = m ÷ ρ = ${num(mSI)} kg ÷ ${num(rSI)} kg/m³ = ${num(V)} m³`]
    : []
  if (ok) working.push(`specific gravity = ρ ÷ ρwater = ${num(rho)} ÷ ${WATER} = ${num(rho / WATER)}`, floats ? `fraction under water = ${num(rho)} ÷ ${WATER} = ${num(frac)}` : 'denser than water: it sinks')

  return (
    <CalcLayout
      inputs={
        <>
          <Choice label="Find" value={find} onChange={setFind} options={[{ value: 'rho', label: 'Density' }, { value: 'm', label: 'Mass' }, { value: 'V', label: 'Volume' }]} />
          {find !== 'm' ? <UnitField label="Mass" {...f.bind('m')} unit={mu} units={MASS_U} onUnit={setMu} error={err.m} /> : null}
          {find !== 'V' ? <UnitField label="Volume" {...f.bind('V')} unit={vu} units={VOL_U} onUnit={setVu} error={err.V} /> : null}
          {find !== 'rho' ? (
            <>
              <SelectField
                label="Material"
                value={material}
                onChange={pickMaterial}
                options={[{ value: 'custom', label: 'Enter a density' }, ...MATERIALS.map((x) => ({ value: x.id, label: `${x.label}, ${x.rho.toLocaleString('en-US')} kg/m³` }))]}
              />
              <UnitField label="Density" {...f.bind('rho')} unit={ru} units={RHO_U} onUnit={setRu} error={err.rho} />
            </>
          ) : null}
        </>
      }
      result={
        <Result
          label={find === 'rho' ? 'Density' : find === 'm' ? 'Mass' : 'Volume'}
          value={ok ? main : '–'}
          unit={ok ? mainUnit : undefined}
          error={ok ? null : Object.values(err).find(Boolean)}
          copy={ok ? `${main} ${mainUnit}` : undefined}
        >
          {ok ? (
            <>
              <Stat label="Density" value={fmt(rho, 5)} unit="kg/m³" />
              <Stat label="Density" value={fmt(rho / 1000, 5)} unit="g/cm³" />
              <Stat label="Specific gravity" value={fmt(rho / WATER, 5)} />
              <Stat label="In fresh water" value={floats ? `Floats, ${dec(frac * 100, 1)}% under` : rho === WATER ? 'Neutral' : 'Sinks'} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={ok ? <SimBar playing={playing} onPlaying={setPlaying} onReplay={drop} scale="Settling, not to time scale" reduced={reduced} /> : undefined}>
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={ok ? `A block of density ${fmt(rho, 4)} kg/m³ in water: it ${floats ? 'floats' : 'sinks'}` : 'Block in water'}>
            <rect x={40} y={SURFACE} width={W - 80} height={FLOOR - SURFACE} className="fill-background" />
            <line x1={40} x2={W - 40} y1={SURFACE} y2={SURFACE} className="stroke-foreground" strokeWidth={1.5} />
            <line x1={40} x2={W - 40} y1={FLOOR} y2={FLOOR} className="stroke-foreground" strokeWidth={2} />
            <text x={W - 44} y={SURFACE - 8} textAnchor="end" className="fill-muted-foreground text-[12px] font-[560]">
              water, 1,000 kg/m³
            </text>
            {ok ? (
              <g ref={block} transform={`translate(${(W - SIDE) / 2},${restY})`}>
                <rect width={SIDE} height={SIDE} rx={3} className="fill-foreground" />
                <text x={SIDE / 2} y={SIDE / 2 + 5} textAnchor="middle" className="fill-background text-[13px] font-[650]">
                  {fmt(rho / 1000, 3)}
                </text>
              </g>
            ) : null}
            {ok && floats ? (
              <text x={(W + SIDE) / 2 + 10} y={SURFACE + 18} className="fill-muted-foreground text-[12px] font-[560]">
                {dec(frac * 100, 0)}% under
              </text>
            ) : null}
          </svg>
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="ρ is density, m mass and V volume. A floating body displaces its own mass of water." /> : null}
    />
  )
}
