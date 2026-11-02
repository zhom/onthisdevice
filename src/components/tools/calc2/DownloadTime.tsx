import { useEffect, useRef, useState } from 'react'
import { BarList } from '@/components/viz'
import { CalcLayout, NumField, Result, SimBar, Stage, Stat, UnitField, Working, useFields } from './_viz/Calc'
import { duration, fmt, num } from './_viz/format'
import { useSimLoop } from './_viz/hooks'
import { timeScale } from './_viz/sim'
import { SIZE, SPEED, transferTime } from './download'
import type { SizeUnit, SpeedUnit } from './download'

const SIZES = (['MB', 'GB', 'TB', 'MiB', 'GiB', 'TiB'] as const).map((u) => ({ value: u, label: u }))
const SPEEDS = (['kbit/s', 'Mbit/s', 'Gbit/s', 'MB/s'] as const).map((u) => ({ value: u, label: u }))
const COMPARE = [10, 50, 100, 300, 1000]

export default function DownloadTime() {
  const f = useFields({ size: '50', speed: '100', overhead: '10' })
  const [zu, setZu] = useState<SizeUnit>('GB')
  const [su, setSu] = useState<SpeedUnit>('Mbit/s')
  const { size, speed, overhead } = f.num
  const err = {
    size: size === null || size <= 0 ? 'Enter a file size above zero.' : null,
    speed: speed === null || speed <= 0 ? 'Enter a speed above zero.' : null,
    overhead: overhead === null || overhead < 0 || overhead >= 100 ? 'Use 0 to 99%.' : null,
  }
  const ok = !Object.values(err).some(Boolean)
  const bytes = ok ? size! * SIZE[zu] : 0
  const bps = ok ? speed! * SPEED[su] : 0
  const secs = ok ? transferTime(bytes, bps, overhead! / 100) : 0
  const scale = timeScale(secs, 2, 8)

  /* a pixel progress row that fills at the transfer rate, sped up when long */
  const fill = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLSpanElement>(null)
  const [playing, setPlaying] = useState(true)
  const t = useRef(0)
  useEffect(() => {
    t.current = 0
  }, [secs])
  const show = (p: number) => {
    if (fill.current) fill.current.style.transform = `scaleX(${p})`
    if (label.current) label.current.textContent = `${duration(Math.min(secs, p * secs))} of ${duration(secs)}`
  }
  const { reduced, live } = useSimLoop(
    fill,
    (dt) => {
      t.current += dt * scale.factor
      if (t.current > secs * 1.25) t.current = 0
      show(Math.min(1, t.current / secs))
    },
    playing && ok,
  )
  useEffect(() => {
    if (!live && ok) show(1)
  })

  const summary = ok
    ? `${fmt(size!)} ${zu} at ${fmt(speed!)} ${su} with ${fmt(overhead!)}% overhead takes ${duration(secs)}. The bar fills at that rate${scale.factor === 1 ? ' in real time' : `, ${scale.label.toLowerCase()}`}. The chart compares common connection speeds.`
    : 'Enter a size and a speed.'

  return (
    <CalcLayout
      inputs={
        <>
          <UnitField label="File size" {...f.bind('size')} unit={zu} units={SIZES} onUnit={setZu} error={err.size} />
          <UnitField label="Connection speed" {...f.bind('speed')} unit={su} units={SPEEDS} onUnit={setSu} error={err.speed} />
          <NumField label="Overhead" {...f.bind('overhead')} unit="%" error={err.overhead} hint="Protocol headers and resends; 5 to 10% is typical." />
        </>
      }
      result={
        <Result
          label="Download time"
          value={ok ? duration(secs) : '–'}
          sub={ok ? `${fmt(secs, 6)} seconds` : undefined}
          error={ok ? null : Object.values(err).find(Boolean)}
          copy={ok ? `${fmt(size!)} ${zu} at ${fmt(speed!)} ${su}: ${duration(secs)}` : undefined}
        >
          {ok ? (
            <>
              <Stat label="Data" value={fmt((bytes * 8) / 1e9, 5)} unit="Gbit" />
              <Stat label="Effective speed" value={fmt((bps * (1 - overhead! / 100)) / 8e6, 5)} unit="MB/s" />
            </>
          ) : null}
        </Result>
      }
      visual={
        <div className="space-y-6">
          <Stage summary={summary} bar={ok ? <SimBar playing={playing} onPlaying={setPlaying} onReplay={() => (t.current = 0)} scale={scale.label} reduced={reduced} clock={label} /> : undefined}>
            <div className="px-5 py-12">
              <div className="px-row w-full">
                <div ref={fill} className="px-fill" style={{ transform: 'scaleX(1)', transition: 'none' }} />
              </div>
            </div>
          </Stage>
          {ok ? (
            <div className="rounded-xl bg-card p-4 sm:p-5">
              <BarList
                items={[
                  ...COMPARE.map((mb) => ({ label: mb >= 1000 ? `${mb / 1000} Gbit/s` : `${mb} Mbit/s`, value: transferTime(bytes, mb * 1e6, overhead! / 100) })),
                  { label: `Yours, ${fmt(speed!)} ${su}`, value: secs, highlight: true },
                ]}
                formatValue={(v) => duration(v)}
                summary={`Time for ${fmt(size!)} ${zu} at common speeds.`}
              />
            </div>
          ) : null}
        </div>
      }
      working={
        ok ? (
          <Working
            lines={[
              `bits = ${fmt(size!)} ${zu} × ${SIZE[zu].toLocaleString('en-US')} bytes × 8 = ${num(bytes * 8)} bit`,
              `speed = ${fmt(speed!)} ${su} × ${(1 - overhead! / 100).toFixed(2)} = ${num(bps * (1 - overhead! / 100))} bit/s`,
              `time = ${num(bytes * 8)} ÷ ${num(bps * (1 - overhead! / 100))} = ${num(secs)} s = ${duration(secs)}`,
            ]}
            caption="Sizes in MB and GB are decimal (1 GB = 10⁹ bytes); MiB and GiB are binary (1 GiB = 2³⁰ bytes). Speeds are in bits per second unless they say bytes (B)."
          />
        ) : null
      }
    />
  )
}
