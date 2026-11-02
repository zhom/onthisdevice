import { useEffect, useRef, useState } from 'react'
import { CalcLayout, Choice, NumField, Result, Row, SelectField, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { ROLLS, wallpaper } from './wallpaper'
import type { WallpaperOut } from './wallpaper'

type Units = 'ft' | 'm'
const FT = 0.3048
const IN = 0.0254
const HANG_S = 0.45
const HOLD_S = 2.2

export default function Wallpaper() {
  const f = useFields({ length: '12', width: '10', height: '8', repeat: '21', doors: '1' })
  const [units, setUnits] = useState<Units>('ft')
  const [rollId, setRollId] = useState('us27')
  const switchUnits = (u: Units) => {
    if (u === units) return
    const conv = (s: string, k: number, dp: number) => {
      const n = Number(s)
      return Number.isFinite(n) && s.trim() !== '' ? String(Number((n * k).toFixed(dp))) : s
    }
    const k = u === 'm' ? FT : 1 / FT
    f.setMany({ length: conv(f.raw.length, k, 2), width: conv(f.raw.width, k, 2), height: conv(f.raw.height, k, 2), repeat: conv(f.raw.repeat, u === 'm' ? 2.54 : 1 / 2.54, 1) })
    setRollId(u === 'm' ? 'euro' : 'us27')
    setUnits(u)
  }
  const { length, width, height, repeat, doors } = f.num
  const pos = (v: number | null, what: string) => (v === null ? `Enter the ${what}.` : v <= 0 ? `The ${what} must be above zero.` : null)
  const err = {
    length: pos(length, 'length'),
    width: pos(width, 'width'),
    height: pos(height, 'wall height'),
    repeat: repeat === null ? 'Enter the pattern repeat, or 0.' : repeat < 0 ? 'Use 0 or more.' : null,
    doors: doors === null || doors < 0 || !Number.isInteger(doors) ? 'Use a whole number.' : null,
  }
  const roll = ROLLS.find((r) => r.value === rollId) ?? ROLLS[0]!
  const L = units === 'ft' ? FT : 1
  const small = units === 'ft' ? IN : 0.01
  const okIn = !Object.values(err).some(Boolean)
  const r: WallpaperOut | null = okIn
    ? wallpaper({
        perimeter: 2 * (length! + width!) * L,
        height: height! * L,
        repeat: repeat! * small,
        trim: units === 'ft' ? 4 * IN : 0.1,
        rollWidth: roll.width,
        rollLength: roll.length,
        doors: doors!,
        doorWidth: units === 'ft' ? 3 * FT : 0.9,
      })
    : null
  const tooTall = r !== null && r.perRoll === 0
  const ok = r !== null && !tooTall
  const lenU = (m: number) => (units === 'ft' ? `${dec(m / IN, 1)} in` : `${dec(m * 100, 1)} cm`)

  /* one wall: strips hang one by one */
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const t = useRef(0)
  const wallStrips = ok ? Math.ceil((length! * L) / roll.width - 1e-9) : 0
  const cycle = wallStrips * HANG_S + 0.6 + HOLD_S
  useEffect(() => {
    t.current = 0
  }, [wallStrips, rollId, repeat, height])
  const paint = (reduced: boolean) => {
    const p = prepCanvas(canvas.current)
    if (!p || !ok) return
    drawWall(p.ctx, p.w, p.h, length! * L, height! * L, roll.width, repeat! * small, r!.drop, reduced ? 1e9 : t.current, ink, units)
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      t.current = (t.current + dt) % cycle
      paint(false)
    },
    playing && ok,
  )
  useEffect(() => paint(reduced))

  const unitL = units === 'ft' ? 'ft' : 'm'
  const summary = ok
    ? `The walls are ${fmt(2 * (length! + width!), 4)} ${unitL} around and ${fmt(height!, 4)} ${unitL} high. Each strip is cut to ${lenU(r!.drop)} so the pattern lines up, one roll (${roll.label}) gives ${r!.perRoll} strips, and ${r!.strips} strips need ${r!.rolls} rolls. The drawing hangs the strips on the ${fmt(length!, 4)} ${unitL} wall; grey is the paper trimmed off.`
    : 'Enter the room size and the roll to see the strips.'

  return (
    <CalcLayout
      inputs={
        <>
          <Choice label="Units" value={units} onChange={switchUnits} options={[{ value: 'ft', label: 'Feet, inches' }, { value: 'm', label: 'Metres, cm' }]} />
          <Row>
            <NumField label="Room length" {...f.bind('length')} unit={unitL} error={err.length} />
            <NumField label="Room width" {...f.bind('width')} unit={unitL} error={err.width} />
          </Row>
          <NumField label="Wall height" {...f.bind('height')} unit={unitL} error={err.height} />
          <SelectField label="Roll" value={rollId} onChange={setRollId} options={ROLLS} />
          <Row>
            <NumField label="Pattern repeat" {...f.bind('repeat')} unit={units === 'ft' ? 'in' : 'cm'} error={err.repeat} />
            <NumField label="Doors" {...f.bind('doors')} inputMode="numeric" error={err.doors} />
          </Row>
        </>
      }
      result={
        <Result
          label="Rolls of wallpaper"
          value={ok ? r!.rolls : '–'}
          format={(n) => String(Math.round(n))}
          unit={ok ? 'rolls' : undefined}
          sub={ok ? `${r!.strips} strips, ${r!.perRoll} from each roll` : undefined}
          error={okIn ? (tooTall ? 'A strip is longer than the roll. Choose a longer roll.' : null) : Object.values(err).find(Boolean)}
          copy={ok ? `${r!.rolls} rolls (${r!.strips} strips of ${lenU(r!.drop)}, ${r!.perRoll} per roll)` : undefined}
        >
          {ok ? (
            <>
              <Stat label="Strip length" value={lenU(r!.drop)} />
              <Stat label="Strips per roll" value={String(r!.perRoll)} />
              <Stat label="Left on each roll" value={lenU(r!.offcut)} />
              <Stat label="Wall area" value={fmt(2 * (length! + width!) * height!, 5)} unit={`${unitL}²`} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={ok ? <SimBar playing={playing} onPlaying={setPlaying} onReplay={() => (t.current = 0)} scale={`${HANG_S} s per strip`} reduced={reduced} /> : undefined}>
          <canvas ref={canvas} className="block aspect-[4/3] w-full sm:aspect-[16/10]" role="img" aria-label="Wallpaper strips hung on one wall" />
        </Stage>
      }
      working={
        ok ? (
          <Working
            lines={[
              `wall width to cover = 2 × (${num(length!)} + ${num(width!)}) ${unitL}${doors! > 0 ? ` − ${doors} door${doors === 1 ? '' : 's'}` : ''}`,
              `strips   = ⌈wall width ÷ roll width⌉ = ${r!.strips}`,
              `strip    = height + trim, rounded up to whole repeats = ${lenU(r!.drop)}`,
              `per roll = ⌊roll length ÷ strip⌋ = ⌊${lenU(roll.length)} ÷ ${lenU(r!.drop)}⌋ = ${r!.perRoll}`,
              `rolls    = ⌈${r!.strips} ÷ ${r!.perRoll}⌉ = ${r!.rolls}`,
            ]}
            caption={`Trim allowance ${units === 'ft' ? '4 in' : '10 cm'} per strip; each door saves ${units === 'ft' ? '3 ft' : '0.9 m'} of wall width.`}
          />
        ) : null
      }
    />
  )
}

function drawWall(ctx: CanvasRenderingContext2D, w: number, h: number, wallW: number, wallH: number, stripW: number, repeat: number, drop: number, t: number, ink: Ink, units: Units) {
  const extra = drop - wallH
  const k = Math.min((w - 40) / wallW, (h - 60) / (wallH + extra))
  const x0 = (w - wallW * k) / 2
  const floor = h - 32 - (extra * k) / 2
  const top = floor - wallH * k
  ctx.fillStyle = ink.paper
  ctx.fillRect(x0, top, wallW * k, wallH * k)
  const n = Math.ceil(wallW / stripW - 1e-9)
  for (let i = 0; i < n; i++) {
    const start = i * HANG_S
    const e = Math.min(1, Math.max(0, (t - start) / HANG_S))
    if (e <= 0) continue
    const ease = 1 - Math.pow(1 - e, 3)
    const sx = x0 + i * stripW * k
    const sw = Math.min(stripW, wallW - i * stripW) * k
    // the strip slides down from above the ceiling; the part past the wall is trimmed waste
    const sy = top - extra * k * 0.5 - (1 - ease) * (wallH * k + 30)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, w, h)
    ctx.clip()
    ctx.fillStyle = ink.grey
    ctx.fillRect(sx + 0.5, sy, sw - 1, drop * k)
    ctx.fillStyle = ink.fill
    ctx.fillRect(sx + 0.5, Math.max(sy, top), sw - 1, Math.max(0, Math.min(sy + drop * k, floor) - Math.max(sy, top)))
    // pattern: one motif per repeat, the same height on every strip (straight match)
    if (repeat > 0) {
      ctx.fillStyle = ink.ink
      const phase = sy - (top - extra * k * 0.5)
      for (let y = top - extra * k * 0.5; y < top + wallH * k + extra * k; y += repeat * k) {
        const yy = y + phase + (repeat * k) / 2
        if (yy < Math.max(sy, top) + 4 || yy > Math.min(sy + drop * k, floor) - 4) continue
        const cx = sx + sw / 2
        const s = Math.min(6, sw / 5, (repeat * k) / 4)
        ctx.beginPath()
        ctx.moveTo(cx, yy - s)
        ctx.lineTo(cx + s, yy)
        ctx.lineTo(cx, yy + s)
        ctx.lineTo(cx - s, yy)
        ctx.closePath()
        ctx.fill()
      }
    }
    ctx.restore()
  }
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x0 - 10, top)
  ctx.lineTo(x0 + wallW * k + 10, top)
  ctx.moveTo(x0 - 10, floor)
  ctx.lineTo(x0 + wallW * k + 10, floor)
  ctx.stroke()
  const u = units === 'ft' ? 1 / FT : 1
  label(ctx, `${fmt(wallW * u, 4)} ${units} wall, ${n} strips`, w / 2, h - 8, { color: ink.ink, halo: ink.fill, font: ink.font, size: 12, align: 'center' })
}
