import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Plus, Shuffle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { clamp, cn } from '@/lib/utils'
import { CodeBlock, ColorField, Field, NumberSlider, SegmentedField } from './GenUi'
import { hslToRgb, mix, parseColor, toHex } from './colorlib'

type GradientType = 'linear' | 'radial' | 'conic'
type RadialShape = 'circle' | 'ellipse'
type RadialExtent = 'farthest-corner' | 'farthest-side' | 'closest-corner' | 'closest-side'

interface Stop {
  id: number
  color: string
  /** 0–100 along the gradient line. */
  position: number
}

const TYPE_OPTIONS: { value: GradientType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'radial', label: 'Radial' },
  { value: 'conic', label: 'Conic' },
]

const SHAPE_OPTIONS: { value: RadialShape; label: string }[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'ellipse', label: 'Ellipse' },
]

const EXTENTS: { value: RadialExtent; label: string }[] = [
  { value: 'farthest-corner', label: 'farthest-corner (default)' },
  { value: 'farthest-side', label: 'farthest-side' },
  { value: 'closest-corner', label: 'closest-corner' },
  { value: 'closest-side', label: 'closest-side' },
]

interface Preset {
  name: string
  type: GradientType
  angle: number
  colors: string[]
}

const PRESETS: Preset[] = [
  { name: 'Sunset', type: 'linear', angle: 135, colors: ['#ff6a3d', '#f7b733', '#fc4a1a'] },
  { name: 'Ocean', type: 'linear', angle: 160, colors: ['#2193b0', '#6dd5ed'] },
  { name: 'Violet haze', type: 'linear', angle: 120, colors: ['#7f00ff', '#e100ff'] },
  { name: 'Mint', type: 'linear', angle: 90, colors: ['#00b09b', '#96c93d'] },
  { name: 'Ember', type: 'radial', angle: 0, colors: ['#f83600', '#f9d423'] },
  { name: 'Midnight', type: 'linear', angle: 180, colors: ['#0f2027', '#203a43', '#2c5364'] },
  { name: 'Peach', type: 'linear', angle: 45, colors: ['#ffecd2', '#fcb69f'] },
  { name: 'Colour wheel', type: 'conic', angle: 0, colors: ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'] },
  { name: 'Steel', type: 'linear', angle: 200, colors: ['#bdc3c7', '#2c3e50'] },
  { name: 'Aurora', type: 'linear', angle: 110, colors: ['#00c6ff', '#0072ff', '#7bffb2'] },
]

let nextId = 1
function makeStop(color: string, position: number): Stop {
  return { id: nextId++, color, position }
}

function stopsFromColors(colors: string[]): Stop[] {
  if (colors.length === 1) return [makeStop(colors[0], 0), makeStop(colors[0], 100)]
  return colors.map((color, index) => makeStop(color, (index / (colors.length - 1)) * 100))
}

function sortStops(stops: Stop[]): Stop[] {
  return [...stops].sort((a, b) => a.position - b.position)
}

function normaliseHex(value: string, fallback = '#888888'): string {
  const parsed = parseColor(value)
  return parsed ? toHex(parsed) : fallback
}

interface GradientConfig {
  type: GradientType
  angle: number
  shape: RadialShape
  extent: RadialExtent
  posX: number
  posY: number
  stops: Stop[]
  repeating: boolean
}

/** The standards-compliant declaration value. */
function gradientCss(config: GradientConfig, prefix = ''): string {
  const sorted = sortStops(config.stops)
  const repeat = config.repeating ? 'repeating-' : ''

  if (config.type === 'conic') {
    const list = sorted
      .map((stop) => `${normaliseHex(stop.color)} ${Math.round((stop.position / 100) * 360)}deg`)
      .join(', ')
    return `${repeat}conic-gradient(from ${Math.round(config.angle)}deg at ${config.posX}% ${config.posY}%, ${list})`
  }

  const list = sorted.map((stop) => `${normaliseHex(stop.color)} ${round(stop.position)}%`).join(', ')

  if (config.type === 'radial') {
    return `${prefix}${repeat}radial-gradient(${config.shape} ${config.extent} at ${config.posX}% ${config.posY}%, ${list})`
  }

  // The old -webkit- syntax measured angles from east, counter-clockwise;
  // the standard measures from north, clockwise.
  const angle = prefix ? (90 - config.angle + 360) % 360 : ((config.angle % 360) + 360) % 360
  return `${prefix}${repeat}linear-gradient(${round(angle)}deg, ${list})`
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function buildDeclaration(config: GradientConfig): string {
  const sorted = sortStops(config.stops)
  const first = normaliseHex(sorted[0]?.color ?? '#000000')
  const lines = [`background: ${first};`]
  if (config.type !== 'conic') {
    lines.push(`background: ${gradientCss(config, '-webkit-')};`)
  }
  lines.push(`background: ${gradientCss(config)};`)
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* Draggable stop bar                                                  */
/* ------------------------------------------------------------------ */

interface StopBarProps {
  stops: Stop[]
  selectedId: number | null
  onSelect: (id: number) => void
  onMove: (id: number, position: number) => void
  onAdd: (position: number) => void
  previewCss: string
}

function StopBar({ stops, selectedId, onSelect, onMove, onAdd, previewCss }: StopBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<number | null>(null)
  const labelId = useId()

  const positionFromEvent = useCallback((clientX: number): number => {
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return clamp(((clientX - rect.left) / rect.width) * 100, 0, 100)
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium text-foreground">
        Colour stops
      </span>
      <div
        ref={barRef}
        className="relative h-12 w-full rounded-lg border border-border"
        style={{ background: previewCss }}
        onPointerDown={(event) => {
          // A click on the bar itself (not a handle) inserts a new stop.
          if (event.target !== event.currentTarget) return
          onAdd(positionFromEvent(event.clientX))
        }}
      >
        {stops.map((stop) => (
          <button
            key={stop.id}
            type="button"
            role="slider"
            aria-label={`Stop at ${Math.round(stop.position)} percent, ${normaliseHex(stop.color)}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(stop.position)}
            aria-valuetext={`${Math.round(stop.position)}%`}
            className={cn(
              'absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 shadow-sm transition-transform',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
              selectedId === stop.id
                ? 'scale-125 border-foreground'
                : 'border-background hover:scale-110',
            )}
            style={{ left: `${stop.position}%`, backgroundColor: normaliseHex(stop.color) }}
            onPointerDown={(event) => {
              event.stopPropagation()
              onSelect(stop.id)
              dragging.current = stop.id
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              if (dragging.current !== stop.id) return
              onMove(stop.id, positionFromEvent(event.clientX))
            }}
            onPointerUp={(event) => {
              dragging.current = null
              event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onPointerCancel={() => {
              dragging.current = null
            }}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 10 : 1
              if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
                event.preventDefault()
                onMove(stop.id, clamp(stop.position - step, 0, 100))
              } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                event.preventDefault()
                onMove(stop.id, clamp(stop.position + step, 0, 100))
              } else if (event.key === 'Home') {
                event.preventDefault()
                onMove(stop.id, 0)
              } else if (event.key === 'End') {
                event.preventDefault()
                onMove(stop.id, 100)
              }
            }}
            onClick={() => onSelect(stop.id)}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Drag a handle to move it, or click anywhere on the bar to add a stop. With a handle focused,
        the arrow keys nudge by 1% and Shift + arrow by 10%.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Angle dial                                                          */
/* ------------------------------------------------------------------ */

function AngleDial({ angle, onChange }: { angle: number; onChange: (angle: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const update = (clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    // CSS gradient angles run clockwise from "up".
    const deg = (Math.atan2(clientX - cx, cy - clientY) * 180) / Math.PI
    onChange(Math.round(((deg % 360) + 360) % 360))
  }

  return (
    <div className="flex items-center gap-4">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Gradient angle"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(angle)}
        aria-valuetext={`${Math.round(angle)} degrees`}
        className="relative size-20 shrink-0 touch-none rounded-full border border-input bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        onPointerDown={(event) => {
          dragging.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          update(event.clientX, event.clientY)
        }}
        onPointerMove={(event) => {
          if (dragging.current) update(event.clientX, event.clientY)
        }}
        onPointerUp={(event) => {
          dragging.current = false
          event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 15 : 1
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault()
            onChange((((angle - step) % 360) + 360) % 360)
          } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault()
            onChange((angle + step) % 360)
          }
        }}
      >
        <span
          className="absolute top-1/2 left-1/2 h-8 w-0.5 origin-bottom rounded-full bg-primary"
          style={{ transform: `translate(-50%, -100%) rotate(${angle}deg)`, transformOrigin: 'bottom center' }}
          aria-hidden="true"
        />
        <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <NumberSlider label="Angle" value={Math.round(angle)} onChange={onChange} min={0} max={359} unit="deg" />
        <div className="flex flex-wrap gap-1">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={Math.round(angle) === value ? 'secondary' : 'outline'}
              onClick={() => onChange(value)}
            >
              {value}°
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tool                                                                */
/* ------------------------------------------------------------------ */

export default function CssGradientGenerator() {
  const [type, setType] = useState<GradientType>('linear')
  const [angle, setAngle] = useState(135)
  const [shape, setShape] = useState<RadialShape>('circle')
  const [extent, setExtent] = useState<RadialExtent>('farthest-corner')
  const [posX, setPosX] = useState(50)
  const [posY, setPosY] = useState(50)
  const [repeating, setRepeating] = useState(false)
  const [stops, setStops] = useState<Stop[]>(() => stopsFromColors(['#7f00ff', '#e100ff']))
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // `nextId` is a module-level counter, so it keeps climbing across renders on
  // the server while the browser starts from 1 again. Deriving DOM ids from
  // it produced a hydration mismatch; useId is stable across both renders.
  const fieldPrefix = useId()

  useEffect(() => {
    if (selectedId === null && stops.length > 0) setSelectedId(stops[0].id)
  }, [selectedId, stops])

  const config = useMemo<GradientConfig>(
    () => ({ type, angle, shape, extent, posX, posY, stops, repeating }),
    [type, angle, shape, extent, posX, posY, stops, repeating],
  )

  const css = useMemo(() => gradientCss(config), [config])
  const declaration = useMemo(() => buildDeclaration(config), [config])
  // The stop bar always shows a left-to-right ramp so the handles line up.
  const barCss = useMemo(
    () => gradientCss({ ...config, type: 'linear', angle: 90, repeating: false }),
    [config],
  )

  const selected = stops.find((stop) => stop.id === selectedId) ?? null

  const updateStop = (id: number, patch: Partial<Stop>) => {
    setStops((current) => current.map((stop) => (stop.id === id ? { ...stop, ...patch } : stop)))
  }

  const addStopAt = (position: number) => {
    const sorted = sortStops(stops)
    const before = [...sorted].reverse().find((stop) => stop.position <= position) ?? sorted[0]
    const after = sorted.find((stop) => stop.position >= position) ?? sorted[sorted.length - 1]
    const span = after.position - before.position
    const t = span === 0 ? 0.5 : (position - before.position) / span
    const color = toHex(
      mix(
        parseColor(before.color) ?? { r: 0, g: 0, b: 0, a: 1 },
        parseColor(after.color) ?? { r: 255, g: 255, b: 255, a: 1 },
        t,
      ),
    )
    const stop = makeStop(color, position)
    setStops((current) => [...current, stop])
    setSelectedId(stop.id)
  }

  const removeStop = (id: number) => {
    if (stops.length <= 2) return
    setStops((current) => current.filter((stop) => stop.id !== id))
    setSelectedId((current) => (current === id ? null : current))
  }

  const randomise = () => {
    const bytes = new Uint8Array(4)
    crypto.getRandomValues(bytes)
    const baseHue = (bytes[0] / 255) * 360
    const count = 2 + (bytes[1] % 2)
    const spread = 25 + (bytes[2] / 255) * 95
    const colors = Array.from({ length: count }, (_, index) => {
      const hue = (baseHue + (index * spread) / Math.max(1, count - 1)) % 360
      const sat = 55 + ((bytes[3] + index * 37) % 40)
      const light = 45 + ((bytes[1] + index * 23) % 25)
      return toHex(hslToRgb({ h: hue, s: sat, l: light }))
    })
    setStops(stopsFromColors(colors))
    setSelectedId(null)
    setAngle(Math.round((bytes[2] / 255) * 359))
  }

  const applyPreset = (preset: Preset) => {
    setType(preset.type)
    setAngle(preset.angle)
    setStops(stopsFromColors(preset.colors))
    setSelectedId(null)
    setRepeating(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <ToolPanel title="Preview">
        <div
          className="h-56 w-full rounded-xl border border-border sm:h-72"
          style={{ background: css }}
          role="img"
          aria-label={`Gradient preview: ${css}`}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={randomise}>
            <Shuffle className="size-4" aria-hidden="true" />
            Random gradient
          </Button>
          <CopyButton value={declaration} label="Copy CSS" />
          <CopyButton value={css} label="Copy value only" />
        </div>
      </ToolPanel>

      <ToolPanel title="Stops and colours">
        <StopBar
          stops={stops}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={(id, position) => updateStop(id, { position })}
          onAdd={addStopAt}
          previewCss={barCss}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => addStopAt(50)}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add stop
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setStops((current) => sortStops(current).map((s, i, all) => ({ ...s, position: (i / Math.max(1, all.length - 1)) * 100 })))}
          >
            Space evenly
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setStops((current) => current.map((s) => ({ ...s, position: 100 - s.position })))}
          >
            Reverse
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {sortStops(stops).map((stop, stopIndex) => (
            <div
              key={stop.id}
              className={cn(
                'flex flex-wrap items-end gap-3 rounded-lg border p-3 transition-colors',
                selectedId === stop.id ? 'border-primary bg-accent' : 'border-border',
              )}
              onFocusCapture={() => setSelectedId(stop.id)}
            >
              <ColorField
                label="Stop colour"
                value={stop.color}
                onChange={(value) => updateStop(stop.id, { color: value })}
                className="min-w-[12rem] flex-1"
              />
              <div className="flex items-end gap-2">
                <Field label="Position" htmlFor={`${fieldPrefix}stop-pos-${stopIndex}`}>
                  <Input
                    id={`${fieldPrefix}stop-pos-${stopIndex}`}
                    type="number"
                    min={0}
                    max={100}
                    value={String(Math.round(stop.position))}
                    onChange={(event) => {
                      const next = Number.parseFloat(event.target.value)
                      if (Number.isFinite(next)) updateStop(stop.id, { position: clamp(next, 0, 100) })
                    }}
                    className="w-20 tabular-nums"
                  />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove this stop"
                  disabled={stops.length <= 2}
                  onClick={() => removeStop(stop.id)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {selected ? (
          <p className="text-xs text-muted-foreground">
            Selected stop: {normaliseHex(selected.color)} at {Math.round(selected.position)}%.
          </p>
        ) : null}
      </ToolPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <ToolPanel title="Geometry">
          <SegmentedField label="Gradient type" value={type} options={TYPE_OPTIONS} onChange={setType} />

          {type !== 'radial' ? <AngleDial angle={angle} onChange={setAngle} /> : null}

          {type === 'radial' ? (
            <>
              <SegmentedField label="Shape" value={shape} options={SHAPE_OPTIONS} onChange={setShape} />
              <Field
                label="Size keyword"
                htmlFor="grad-extent"
                hint="Where the last stop lands: the farthest corner of the box, the nearest side, and so on."
              >
                <Select value={extent} onValueChange={(value) => setExtent(value as RadialExtent)}>
                  <SelectTrigger id="grad-extent" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXTENTS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          ) : null}

          {type !== 'linear' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberSlider label="Centre X" value={posX} onChange={setPosX} min={0} max={100} unit="%" />
              <NumberSlider label="Centre Y" value={posY} onChange={setPosY} min={0} max={100} unit="%" />
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
            <div className="min-w-0">
              <Label htmlFor="grad-repeat" className="text-sm">
                Repeating
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Tiles the stop list past the last stop. Useful for stripes, but only if your last stop
                sits well below 100%.
              </p>
            </div>
            <Switch id="grad-repeat" checked={repeating} onCheckedChange={setRepeating} />
          </div>
        </ToolPanel>

        <ToolPanel title="Presets">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset)}
                className="group flex flex-col gap-1.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
              >
                <span
                  className="block h-14 w-full rounded-lg border border-border transition-transform group-hover:scale-[1.03]"
                  style={{
                    background: gradientCss({
                      type: preset.type,
                      angle: preset.angle,
                      shape: 'circle',
                      extent: 'farthest-corner',
                      posX: 50,
                      posY: 50,
                      repeating: false,
                      stops: stopsFromColors(preset.colors),
                    }),
                  }}
                  aria-hidden="true"
                />
                <span className="text-xs text-muted-foreground">{preset.name}</span>
              </button>
            ))}
          </div>
        </ToolPanel>
      </div>

      <ToolPanel
        title="CSS"
        description="The first line is a flat fallback for anything that cannot paint a gradient at all; the -webkit- line covers old Safari and Android browsers, where the angle convention was measured from the east rather than the north."
        footer={<CopyButton value={declaration} label="Copy CSS" />}
      >
        <CodeBlock code={declaration} />
        {/* min-w-0 on each grid cell: a grid item defaults to its max-content
            width, so a long gradient declaration widened the page instead of
            scrolling inside its CodeBlock. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Tailwind arbitrary value</p>
            <CodeBlock code={`bg-[${css.replace(/\s+/g, '_')}]`} />
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium text-muted-foreground">CSS custom property</p>
            <CodeBlock code={`--gradient: ${css};`} />
          </div>
        </div>
      </ToolPanel>
    </div>
  )
}
