import { useEffect, useRef, useState } from 'react'
import { CalcLayout, NumField, Result, Row, SelectField, SimBar, Stage, Stat, UnitField, Working, useFields } from './_viz/Calc'
import { label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { aspect, screen } from './screen'
import type { Screen } from './screen'

type DiagU = 'in' | 'cm'
const PRESETS = [
  { value: 'custom', label: 'Enter a screen', w: 0, h: 0, d: 0 },
  { value: 'fhd24', label: '24 in monitor, 1920 × 1080', w: 1920, h: 1080, d: 24 },
  { value: 'qhd27', label: '27 in monitor, 2560 × 1440', w: 2560, h: 1440, d: 27 },
  { value: 'uhd27', label: '27 in monitor, 3840 × 2160', w: 3840, h: 2160, d: 27 },
  { value: 'uhd32', label: '32 in monitor, 3840 × 2160', w: 3840, h: 2160, d: 32 },
  { value: 'tv55', label: '55 in TV, 3840 × 2160', w: 3840, h: 2160, d: 55 },
  { value: 'lap14', label: '14 in laptop, 1920 × 1200', w: 1920, h: 1200, d: 14 },
  { value: 'lap16', label: '16 in laptop, 3456 × 2234', w: 3456, h: 2234, d: 16.2 },
  { value: 'phone61', label: '6.1 in phone, 1170 × 2532', w: 1170, h: 2532, d: 6.1 },
  { value: 'tab11', label: '11 in tablet, 2388 × 1668', w: 2388, h: 1668, d: 11 },
] as const
const DIAG = [
  { value: 'in' as const, label: 'in' },
  { value: 'cm' as const, label: 'cm' },
]
/** Lens magnification: one CSS pixel of the drawing per this many millimetres. */
const LENS_MM = 0.025

export default function Ppi() {
  const f = useFields({ w: '2560', h: '1440', d: '27' })
  const [du, setDu] = useState<DiagU>('in')
  const [preset, setPreset] = useState('qhd27')
  const pick = (v: string) => {
    setPreset(v)
    const p = PRESETS.find((x) => x.value === v)
    if (p && p.w) {
      f.setMany({ w: String(p.w), h: String(p.h), d: String(du === 'in' ? p.d : Number((p.d * 2.54).toFixed(1))) })
    }
  }
  const { w, h, d } = f.num
  const err = {
    w: w === null || w < 1 || !Number.isInteger(w) ? 'Use a whole number of pixels.' : null,
    h: h === null || h < 1 || !Number.isInteger(h) ? 'Use a whole number of pixels.' : null,
    d: d === null || d <= 0 ? 'Enter the diagonal.' : null,
  }
  const ok = !err.w && !err.h && !err.d
  const diagIn = ok ? (du === 'in' ? d! : d! / 2.54) : 0
  const s = ok ? screen(w!, h!, diagIn) : null
  const edit = (k: 'w' | 'h' | 'd') => (v: string) => {
    setPreset('custom')
    f.set(k, v)
  }

  /* a lens moves over the screen and shows its pixels */
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const t = useRef(0)
  const paint = () => {
    const p = prepCanvas(canvas.current)
    if (p && s) drawScreen(p.ctx, p.w, p.h, w!, h!, s, t.current, ink)
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      t.current += dt
      paint()
    },
    playing && s !== null,
  )
  useEffect(() => paint())

  const summary = s
    ? `${w} × ${h} pixels on a ${fmt(diagIn, 4)} in diagonal is ${dec(s.ppi, 2)} pixels per inch: each pixel is ${dec(s.pitch, 4)} mm wide. The lens enlarges the screen ${fmt(0.2646 / LENS_MM, 2)} times; the denser the screen, the finer its grid. From ${dec(s.retina, 1)} in (${dec(s.retina * 2.54, 0)} cm) away, a single pixel is too small for normal sight to pick out.`
    : 'Enter the resolution and the diagonal.'

  return (
    <CalcLayout
      inputs={
        <>
          <SelectField label="Screen" value={preset} onChange={pick} options={PRESETS} />
          <Row>
            <NumField label="Width" value={f.raw.w} onChange={edit('w')} unit="px" inputMode="numeric" error={err.w} />
            <NumField label="Height" value={f.raw.h} onChange={edit('h')} unit="px" inputMode="numeric" error={err.h} />
          </Row>
          <UnitField label="Diagonal" value={f.raw.d} onChange={edit('d')} unit={du} units={DIAG} onUnit={setDu} error={err.d} />
        </>
      }
      result={
        <Result
          label="Pixel density"
          value={s ? s.ppi : '–'}
          format={(n) => dec(n, 2)}
          unit="PPI"
          sub={s ? `${dec(s.ppi / 2.54, 2)} pixels per cm` : undefined}
          error={ok ? null : Object.values(err).find(Boolean)}
          copy={s ? `${w} × ${h} at ${fmt(diagIn, 4)} in: ${dec(s.ppi, 2)} PPI, pitch ${dec(s.pitch, 4)} mm` : undefined}
        >
          {s ? (
            <>
              <Stat label="Pixel pitch" value={dec(s.pitch, 4)} unit="mm" />
              <Stat label="Screen size" value={`${dec(s.width, 2)} × ${dec(s.height, 2)} in`} />
              <Stat label="Aspect ratio" value={aspect(w!, h!)} />
              <Stat label="Megapixels" value={dec(s.megapixels, 2)} unit="MP" />
              <Stat label="Pixels blend from" value={`${dec(s.retina, 1)} in`} />
              <Stat label="Total pixels" value={(w! * h!).toLocaleString('en-US')} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={s ? <SimBar playing={playing} onPlaying={setPlaying} scale={`Lens enlarged ${fmt(0.2646 / LENS_MM, 2)}×`} reduced={reduced} /> : undefined}>
          <canvas ref={canvas} className="block aspect-[16/10] w-full" role="img" aria-label="The screen to scale with a lens that shows its pixel grid" />
        </Stage>
      }
      working={
        s ? (
          <Working
            lines={[
              `diagonal in pixels = √(${w}² + ${h}²) = ${num(Math.hypot(w!, h!))} px`,
              `PPI = ${num(Math.hypot(w!, h!))} ÷ ${num(diagIn)} in = ${num(s.ppi)}`,
              `pitch = 25.4 mm ÷ ${num(s.ppi)} = ${num(s.pitch)} mm`,
              `size = ${w} ÷ ${num(s.ppi)} by ${h} ÷ ${num(s.ppi)} = ${num(s.width)} × ${num(s.height)} in`,
              `blend distance = 1 ÷ (PPI × tan 1′) = ${num(s.retina)} in`,
            ]}
            caption="Square pixels assumed. 1′ is one minute of arc, the detail normal eyesight resolves."
          />
        ) : null
      }
    />
  )
}

function drawScreen(ctx: CanvasRenderingContext2D, cw: number, ch: number, pw: number, ph: number, s: Screen, t: number, ink: Ink) {
  const k = Math.min((cw - 40) / s.width, (ch - 50) / s.height)
  const sw = s.width * k
  const sh = s.height * k
  const x0 = (cw - sw) / 2
  const y0 = (ch - 24 - sh) / 2
  ctx.fillStyle = ink.paper
  ctx.fillRect(x0, y0, sw, sh)
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 3
  ctx.strokeRect(x0, y0, sw, sh)
  label(ctx, `${pw} × ${ph}, ${dec(s.width, 1)} × ${dec(s.height, 1)} in`, cw / 2, ch - 8, { color: ink.ink, halo: ink.fill, font: ink.font, size: 12, align: 'center' })
  // lens path
  const lr = Math.min(sw, sh, 150) * 0.32
  const lx = x0 + sw / 2 + Math.sin(t * 0.5) * (sw / 2 - lr * 0.7)
  const ly = y0 + sh / 2 + Math.sin(t * 0.77) * (sh / 2 - lr * 0.7)
  // pixels in the lens: pitch in mm shown at LENS_MM per px
  const step = s.pitch / LENS_MM
  ctx.save()
  ctx.beginPath()
  ctx.arc(lx, ly, lr, 0, Math.PI * 2)
  ctx.fillStyle = ink.fill
  ctx.fill()
  ctx.clip()
  ctx.fillStyle = ink.ink
  const gapPx = Math.max(0.6, step * 0.18)
  // the grid stays fixed to the screen while the lens moves over it
  const ox = ((lx - x0) / k) * 25.4 / LENS_MM
  const oy = ((ly - y0) / k) * 25.4 / LENS_MM
  const startX = lx - lr - ((ox - lr) % step) - step
  const startY = ly - lr - ((oy - lr) % step) - step
  if (step >= 1.5) {
    for (let y = startY; y < ly + lr; y += step) for (let x = startX; x < lx + lr; x += step) ctx.fillRect(x, y, step - gapPx, step - gapPx)
  } else {
    ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2)
  }
  ctx.restore()
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(lx, ly, lr, 0, Math.PI * 2)
  ctx.stroke()
  // 1 mm scale bar inside the lens
  const mm = 1 / LENS_MM
  if (mm < lr * 1.4) {
    ctx.fillStyle = ink.paper
    ctx.fillRect(lx - mm / 2 - 4, ly + lr - 22, mm + 8, 16)
    ctx.fillStyle = ink.ink
    ctx.fillRect(lx - mm / 2, ly + lr - 14, mm, 2)
    ctx.font = `600 10px ${ink.font}`
    ctx.textAlign = 'center'
    ctx.fillText('1 mm', lx, ly + lr - 16)
  }
}
