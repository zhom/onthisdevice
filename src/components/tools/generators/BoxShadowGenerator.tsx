import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { CodeBlock, ColorField, NumberSlider } from './GenUi'
import { parseColor, readableTextOn, toRgbString } from './colorlib'

interface Layer {
  id: number
  x: number
  y: number
  blur: number
  spread: number
  color: string
  alpha: number
  inset: boolean
}

let nextId = 1
function makeLayer(partial: Partial<Layer> = {}): Layer {
  return {
    id: nextId++,
    x: 0,
    y: 4,
    blur: 6,
    spread: -1,
    color: '#000000',
    alpha: 0.1,
    inset: false,
    ...partial,
  }
}

const STARTER: Layer[] = [
  makeLayer({ x: 0, y: 4, blur: 6, spread: -1, alpha: 0.1 }),
  makeLayer({ x: 0, y: 2, blur: 4, spread: -2, alpha: 0.1 }),
]

interface TailwindPreset {
  name: string
  css: string
}

/** Tailwind CSS v4's stock elevation scale, for the closest-match readout. */
const TAILWIND: TailwindPreset[] = [
  { name: 'shadow-2xs', css: '0 1px 0 0 rgb(0 0 0 / 0.05)' },
  { name: 'shadow-xs', css: '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
  { name: 'shadow-sm', css: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' },
  { name: 'shadow-md', css: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' },
  { name: 'shadow-lg', css: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' },
  { name: 'shadow-xl', css: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' },
  { name: 'shadow-2xl', css: '0 25px 50px -12px rgb(0 0 0 / 0.25)' },
  { name: 'inset-shadow-sm', css: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)' },
]

/** The first layer of each Tailwind preset, for the closest-match distance. */
const TAILWIND_HEADS: {
  name: string
  x: number
  y: number
  blur: number
  spread: number
  inset: boolean
}[] = [
  { name: 'shadow-2xs', x: 0, y: 1, blur: 0, spread: 0, inset: false },
  { name: 'shadow-xs', x: 0, y: 1, blur: 2, spread: 0, inset: false },
  { name: 'shadow-sm', x: 0, y: 1, blur: 3, spread: 0, inset: false },
  { name: 'shadow-md', x: 0, y: 4, blur: 6, spread: -1, inset: false },
  { name: 'shadow-lg', x: 0, y: 10, blur: 15, spread: -3, inset: false },
  { name: 'shadow-xl', x: 0, y: 20, blur: 25, spread: -5, inset: false },
  { name: 'shadow-2xl', x: 0, y: 25, blur: 50, spread: -12, inset: false },
  { name: 'inset-shadow-sm', x: 0, y: 2, blur: 4, spread: 0, inset: true },
]

function layerCss(layer: Layer): string {
  const rgb = parseColor(layer.color) ?? { r: 0, g: 0, b: 0, a: 1 }
  const color = toRgbString({ ...rgb, a: layer.alpha })
  const parts = [`${layer.x}px`, `${layer.y}px`, `${layer.blur}px`, `${layer.spread}px`, color]
  return `${layer.inset ? 'inset ' : ''}${parts.join(' ')}`
}

function shadowValue(layers: Layer[]): string {
  if (layers.length === 0) return 'none'
  return layers.map(layerCss).join(', ')
}

function closestTailwind(layers: Layer[]): { name: string; distance: number } | null {
  const head = layers[0]
  if (!head) return { name: 'shadow-none', distance: 0 }
  let best: { name: string; distance: number } | null = null
  for (const preset of TAILWIND_HEADS) {
    if (preset.inset !== head.inset) continue
    const distance =
      Math.abs(preset.x - head.x) +
      Math.abs(preset.y - head.y) +
      Math.abs(preset.blur - head.blur) * 0.6 +
      Math.abs(preset.spread - head.spread) * 0.8
    if (!best || distance < best.distance) best = { name: preset.name, distance }
  }
  return best
}

export default function BoxShadowGenerator() {
  const [layers, setLayers] = useState<Layer[]>(STARTER)
  const [preview, setPreview] = useState('#f1f5f9')
  const [cardColor, setCardColor] = useState('#ffffff')
  const [radius, setRadius] = useState(12)

  const value = useMemo(() => shadowValue(layers), [layers])
  const declaration = `box-shadow: ${value};`
  const match = useMemo(() => closestTailwind(layers), [layers])
  const exact = `shadow-[${value.replace(/,\s+/g, ',').replace(/\s+/g, '_')}]`

  const update = (id: number, patch: Partial<Layer>) => {
    setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)))
  }

  const move = (index: number, delta: number) => {
    setLayers((current) => {
      const target = index + delta
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <ToolPanel title="Preview">
        <div
          className="flex min-h-64 items-center justify-center rounded-xl border border-border p-8 sm:min-h-80"
          style={{ backgroundColor: preview }}
        >
          <div
            className="flex h-32 w-full max-w-xs items-center justify-center px-4 text-center"
            style={{
              backgroundColor: cardColor,
              borderRadius: radius,
              boxShadow: value,
            }}
          >
            <span
              className="text-sm font-medium"
              style={{ color: readableTextOn(parseColor(cardColor) ?? { r: 255, g: 255, b: 255, a: 1 }) }}
            >
              Sample card
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <ColorField label="Page background" value={preview} onChange={setPreview} />
          <ColorField label="Card colour" value={cardColor} onChange={setCardColor} />
          <NumberSlider label="Card radius" value={radius} onChange={setRadius} min={0} max={64} unit="px" />
        </div>
      </ToolPanel>

      <ToolPanel
        title="Shadow layers"
        description="Real depth almost always needs two layers: a tight, darker one for contact and a wide, softer one for ambient light."
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setLayers((current) => [...current, makeLayer()])}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add layer
            </Button>
            <Button type="button" variant="ghost" onClick={() => setLayers(STARTER.map((l) => ({ ...l, id: nextId++ })))}>
              Reset
            </Button>
          </>
        }
      >
        {layers.length === 0 ? (
          <p className="rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
            No layers. The element has <code className="font-mono">box-shadow: none</code>. Add a
            layer to start.
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
          {layers.map((layer, index) => (
            <div key={layer.id} className="rounded-lg bg-muted p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  Layer {index + 1}
                  <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                    {layerCss(layer)}
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Move layer ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ChevronUp className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Move layer ${index + 1} down`}
                    disabled={index === layers.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ChevronDown className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Duplicate layer ${index + 1}`}
                    onClick={() =>
                      setLayers((current) => [
                        ...current.slice(0, index + 1),
                        { ...layer, id: nextId++ },
                        ...current.slice(index + 1),
                      ])
                    }
                  >
                    <Copy className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove layer ${index + 1}`}
                    onClick={() => setLayers((current) => current.filter((item) => item.id !== layer.id))}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <NumberSlider
                  label="Horizontal offset"
                  value={layer.x}
                  onChange={(x) => update(layer.id, { x })}
                  min={-100}
                  max={100}
                  unit="px"
                />
                <NumberSlider
                  label="Vertical offset"
                  value={layer.y}
                  onChange={(y) => update(layer.id, { y })}
                  min={-100}
                  max={100}
                  unit="px"
                />
                <NumberSlider
                  label="Blur radius"
                  value={layer.blur}
                  onChange={(blur) => update(layer.id, { blur })}
                  min={0}
                  max={200}
                  unit="px"
                />
                <NumberSlider
                  label="Spread"
                  value={layer.spread}
                  onChange={(spread) => update(layer.id, { spread })}
                  min={-100}
                  max={100}
                  unit="px"
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <ColorField
                  label="Shadow colour"
                  value={layer.color}
                  onChange={(color) => update(layer.id, { color })}
                  hint="Tinting the shadow with a dark version of the background reads far better than pure black."
                />
                <NumberSlider
                  label="Opacity"
                  value={Math.round(layer.alpha * 100)}
                  onChange={(alpha) => update(layer.id, { alpha: alpha / 100 })}
                  min={0}
                  max={100}
                  unit="%"
                />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
                <div className="min-w-0">
                  <Label htmlFor={`shadow-inset-${layer.id}`} className="text-sm">
                    Inset
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Draws the shadow inside the box instead of behind it. This is the standard way to make
                    an input look recessed.
                  </p>
                </div>
                <Switch
                  id={`shadow-inset-${layer.id}`}
                  checked={layer.inset}
                  onCheckedChange={(inset) => update(layer.id, { inset })}
                />
              </div>
            </div>
          ))}
        </div>
      </ToolPanel>

      <ToolPanel title="CSS" footer={<CopyButton value={declaration} label="Copy CSS" />}>
        <CodeBlock code={declaration} />

        {/* min-w-0 on each grid cell: without it a cell is at least as wide as
            its longest line, so the arbitrary-value class stretched the grid
            past the viewport instead of scrolling inside its CodeBlock. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Tailwind: exact arbitrary value</p>
            <CodeBlock code={exact} />
            <CopyButton value={exact} label="Copy class" className="self-start" />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Tailwind: closest built-in</p>
            <CodeBlock code={match?.name ?? 'shadow-none'} />
            <p className="text-xs text-pretty text-muted-foreground">
              {match && match.distance === 0
                ? 'An exact match for the stock scale.'
                : match
                  ? `Nearest stock value, off by about ${match.distance.toFixed(1)} px across offset, blur and spread. Use the arbitrary value if the difference matters.`
                  : 'No shadow is applied.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium text-foreground">Layer breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border px-2 py-2 text-left font-semibold">#</th>
                  <th className="border-b border-border px-2 py-2 text-right font-semibold">X</th>
                  <th className="border-b border-border px-2 py-2 text-right font-semibold">Y</th>
                  <th className="border-b border-border px-2 py-2 text-right font-semibold">Blur</th>
                  <th className="border-b border-border px-2 py-2 text-right font-semibold">Spread</th>
                  <th className="border-b border-border px-2 py-2 text-left font-semibold">Colour</th>
                </tr>
              </thead>
              <tbody>
                {layers.map((layer, index) => (
                  <tr key={layer.id}>
                    <td className="border-b border-border px-2 py-2 tabular-nums">{index + 1}</td>
                    <td className="border-b border-border px-2 py-2 text-right tabular-nums">{layer.x}</td>
                    <td className="border-b border-border px-2 py-2 text-right tabular-nums">{layer.y}</td>
                    <td className="border-b border-border px-2 py-2 text-right tabular-nums">{layer.blur}</td>
                    <td className="border-b border-border px-2 py-2 text-right tabular-nums">{layer.spread}</td>
                    <td className="border-b border-border px-2 py-2 font-mono text-xs">
                      {toRgbString({ ...(parseColor(layer.color) ?? { r: 0, g: 0, b: 0, a: 1 }), a: layer.alpha })}
                      {layer.inset ? ' · inset' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ToolPanel>
    </div>
  )
}
