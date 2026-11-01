import { useEffect, useMemo, useRef, useState } from 'react'
import { Lock, LockOpen, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { clamp, cn } from '@/lib/utils'
import { CodeBlock, ColorField, SegmentedField } from './GenUi'
import type { Hsl } from './colorlib'
import {
  BLACK,
  WHITE,
  contrastRatio,
  hslToRgb,
  parseColor,
  readableTextOn,
  rgbToHsl,
  toHex,
  toHslString,
  wcagGrade,
} from './colorlib'

type Harmony =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'tetradic'
  | 'monochromatic'
  | 'split-complementary'

const HARMONY_OPTIONS: { value: Harmony; label: string }[] = [
  { value: 'complementary', label: 'Complementary' },
  { value: 'analogous', label: 'Analogous' },
  { value: 'triadic', label: 'Triadic' },
  { value: 'tetradic', label: 'Tetradic' },
  { value: 'split-complementary', label: 'Split' },
  { value: 'monochromatic', label: 'Monochromatic' },
]

const HARMONY_NOTES: Record<Harmony, string> = {
  complementary:
    'Two hues opposite each other on the wheel. The highest possible contrast between colours, which is why it is the default for a call-to-action against a brand colour. It also looks shouty if you use both at full saturation.',
  analogous:
    'Neighbouring hues within about 60°. Calm and cohesive, with no colour fighting another; pick one as the dominant and let the rest support it.',
  triadic:
    'Three hues evenly spaced 120° apart. Vibrant and balanced, but it needs one clear lead colour and two accents or it turns into a circus.',
  tetradic:
    'Two complementary pairs, 90° apart. The richest scheme and the hardest to control. Keep three of the four muted.',
  'split-complementary':
    'The base plus the two hues either side of its complement. Nearly all the contrast of a complementary scheme with far less tension.',
  monochromatic:
    'One hue at several lightness levels. Impossible to get wrong, and the reason so many product interfaces read as calm. Add a single accent hue if it feels flat.',
}

/** Hue, saturation and lightness deltas from the base for each of the five slots. */
const RECIPES: Record<Harmony, { hue: number; sat: number; light: number }[]> = {
  complementary: [
    { hue: 0, sat: 0, light: 0 },
    { hue: 180, sat: -4, light: 0 },
    { hue: 0, sat: -14, light: 24 },
    { hue: 180, sat: -10, light: -20 },
    { hue: 0, sat: 6, light: -30 },
  ],
  analogous: [
    { hue: 0, sat: 0, light: 0 },
    { hue: -30, sat: -4, light: 12 },
    { hue: 30, sat: -4, light: -12 },
    { hue: -60, sat: -12, light: 24 },
    { hue: 60, sat: 4, light: -26 },
  ],
  triadic: [
    { hue: 0, sat: 0, light: 0 },
    { hue: 120, sat: -6, light: 6 },
    { hue: 240, sat: -6, light: -8 },
    { hue: 120, sat: -18, light: 26 },
    { hue: 240, sat: 4, light: -28 },
  ],
  tetradic: [
    { hue: 0, sat: 0, light: 0 },
    { hue: 90, sat: -6, light: 10 },
    { hue: 180, sat: -6, light: -6 },
    { hue: 270, sat: -10, light: 18 },
    { hue: 0, sat: 8, light: -30 },
  ],
  'split-complementary': [
    { hue: 0, sat: 0, light: 0 },
    { hue: 150, sat: -6, light: 10 },
    { hue: 210, sat: -6, light: -10 },
    { hue: 150, sat: -16, light: 26 },
    { hue: 0, sat: 6, light: -30 },
  ],
  monochromatic: [
    { hue: 0, sat: 0, light: 0 },
    { hue: 0, sat: -8, light: 26 },
    { hue: 0, sat: -14, light: 40 },
    { hue: 0, sat: 4, light: -18 },
    { hue: 0, sat: 10, light: -34 },
  ],
}

const SLOTS = 5

interface Swatch {
  hex: string
  locked: boolean
}

/** A rough colour-family name, used for the generated variable names. */
function hueName(hsl: Hsl): string {
  if (hsl.s < 8) return hsl.l > 60 ? 'light' : hsl.l < 25 ? 'dark' : 'grey'
  const h = ((hsl.h % 360) + 360) % 360
  if (h < 15 || h >= 345) return 'red'
  if (h < 40) return 'orange'
  if (h < 65) return 'yellow'
  if (h < 95) return 'lime'
  if (h < 150) return 'green'
  if (h < 185) return 'teal'
  if (h < 215) return 'sky'
  if (h < 255) return 'blue'
  if (h < 285) return 'violet'
  if (h < 320) return 'purple'
  return 'pink'
}

function randomInt(max: number): number {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return bytes[0] % max
}

/**
 * A stable ±7° hue wobble for slot `index` under `seed`. Deterministic so the
 * palette does not change again on every re-render — only when you reshuffle.
 */
function jitterFor(seed: number, index: number): number {
  if (seed === 0) return 0
  const hash = Math.imul(seed ^ (index + 1), 2654435761) >>> 0
  return (hash % 15) - 7
}

function buildSlot(base: Hsl, harmony: Harmony, index: number, jitter: number): string {
  const recipe = RECIPES[harmony][index]
  const hue = base.h + recipe.hue + jitter
  const sat = clamp(base.s + recipe.sat, 6, 100)
  const light = clamp(base.l + recipe.light, 8, 94)
  return toHex(hslToRgb({ h: hue, s: sat, l: light }))
}

/** Nine steps from near-white to near-black, keeping the hue and saturation. */
function scaleOf(hex: string): { step: number; hex: string }[] {
  const rgb = parseColor(hex) ?? { r: 0, g: 0, b: 0, a: 1 }
  const hsl = rgbToHsl(rgb)
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
  const lightness = [96, 91, 82, 71, 60, 50, 42, 33, 24, 15]
  return steps.map((step, index) => ({
    step,
    hex: toHex(hslToRgb({ h: hsl.h, s: clamp(hsl.s * (step <= 100 ? 0.72 : 1), 4, 100), l: lightness[index] })),
  }))
}

const DEFAULT_BASE = '#6d28d9'

function rebuild(base: Hsl, kind: Harmony, previous: Swatch[], seed: number): Swatch[] {
  const next: Swatch[] = []
  for (let i = 0; i < SLOTS; i++) {
    const existing = previous[i]
    if (existing?.locked) {
      next.push(existing)
      continue
    }
    next.push({ hex: buildSlot(base, kind, i, jitterFor(seed, i)), locked: false })
  }
  return next
}

export default function ColorPaletteGenerator() {
  const [baseInput, setBaseInput] = useState(DEFAULT_BASE)
  const [harmony, setHarmony] = useState<Harmony>('complementary')
  const [seed, setSeed] = useState(0)
  const [swatches, setSwatches] = useState<Swatch[]>(() =>
    rebuild(rgbToHsl(parseColor(DEFAULT_BASE) ?? { r: 109, g: 40, b: 217, a: 1 }), 'complementary', [], 0),
  )
  const [selected, setSelected] = useState(0)

  const baseRgb = useMemo(() => parseColor(baseInput) ?? { r: 109, g: 40, b: 217, a: 1 }, [baseInput])
  const baseHsl = useMemo(() => rgbToHsl(baseRgb), [baseRgb])

  // Recompute whenever the base colour, the harmony or the shuffle seed changes.
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    setSwatches((previous) => rebuild(baseHsl, harmony, previous, seed))
  }, [baseHsl, harmony, seed])

  const regenerate = () => {
    if (!(swatches[0]?.locked ?? false)) {
      setBaseInput(toHex(hslToRgb({ h: randomInt(360), s: 45 + randomInt(45), l: 38 + randomInt(28) })))
    }
    setSeed(1 + randomInt(2_000_000_000))
  }

  const toggleLock = (index: number) => {
    setSwatches((previous) =>
      previous.map((swatch, i) => (i === index ? { ...swatch, locked: !swatch.locked } : swatch)),
    )
  }

  const setSwatchHex = (index: number, hex: string) => {
    const parsed = parseColor(hex)
    if (!parsed) return
    setSwatches((previous) =>
      previous.map((swatch, i) => (i === index ? { hex: toHex(parsed), locked: true } : swatch)),
    )
  }

  const names = useMemo(() => {
    const used = new Map<string, number>()
    return swatches.map((swatch) => {
      const hsl = rgbToHsl(parseColor(swatch.hex) ?? { r: 0, g: 0, b: 0, a: 1 })
      const base = hueName(hsl)
      const count = (used.get(base) ?? 0) + 1
      used.set(base, count)
      return count === 1 ? base : `${base}-${count}`
    })
  }, [swatches])

  const cssExport = useMemo(() => {
    const lines = swatches.map((swatch, i) => `  --color-${names[i]}: ${swatch.hex};`)
    const scale = swatches[selected]
      ? scaleOf(swatches[selected].hex).map((step) => `  --color-${names[selected]}-${step.step}: ${step.hex};`)
      : []
    return [':root {', ...lines, '', `  /* ${names[selected]} scale */`, ...scale, '}', ''].join('\n')
  }, [swatches, names, selected])

  const tailwindExport = useMemo(() => {
    const entries = swatches
      .map((swatch, i) => `    '${names[i]}': '${swatch.hex}',`)
      .join('\n')
    const scale = swatches[selected]
      ? scaleOf(swatches[selected].hex)
          .map((step) => `      ${step.step}: '${step.hex}',`)
          .join('\n')
      : ''
    return [
      '// tailwind.config.js (Tailwind 3 style)',
      'module.exports = {',
      '  theme: {',
      '    extend: {',
      '      colors: {',
      entries.replace(/^ {4}/gm, '        '),
      `        '${names[selected]}-scale': {`,
      scale.replace(/^ {6}/gm, '          '),
      '        },',
      '      },',
      '    },',
      '  },',
      '}',
      '',
      '/* Tailwind 4: put this in your CSS instead */',
      '@theme {',
      ...swatches.map((swatch, i) => `  --color-${names[i]}: ${swatch.hex};`),
      '}',
      '',
    ].join('\n')
  }, [swatches, names, selected])

  const jsonExport = useMemo(() => {
    const payload = {
      harmony,
      base: toHex(baseRgb),
      colors: swatches.map((swatch, i) => {
        const rgb = parseColor(swatch.hex) ?? { r: 0, g: 0, b: 0, a: 1 }
        return {
          name: names[i],
          hex: swatch.hex,
          rgb: { r: rgb.r, g: rgb.g, b: rgb.b },
          hsl: toHslString(rgb),
          contrastWithWhite: Number(contrastRatio(rgb, WHITE).toFixed(2)),
          contrastWithBlack: Number(contrastRatio(rgb, BLACK).toFixed(2)),
        }
      }),
    }
    return `${JSON.stringify(payload, null, 2)}\n`
  }, [swatches, names, harmony, baseRgb])

  const activeScale = swatches[selected] ? scaleOf(swatches[selected].hex) : []

  /** Every ordered pair that clears 3:1, strongest first. */
  const contrastPairs = useMemo(() => {
    const rows: { key: string; fg: string; bg: string; ratio: number; grade: string }[] = []
    for (let i = 0; i < swatches.length; i++) {
      for (let j = 0; j < swatches.length; j++) {
        if (i === j) continue
        const fg = parseColor(swatches[i].hex) ?? { r: 0, g: 0, b: 0, a: 1 }
        const bg = parseColor(swatches[j].hex) ?? { r: 255, g: 255, b: 255, a: 1 }
        const ratio = contrastRatio(fg, bg)
        if (ratio < 3) continue
        rows.push({
          key: `${i}-${j}`,
          fg: swatches[i].hex,
          bg: swatches[j].hex,
          ratio,
          grade: wcagGrade(ratio),
        })
      }
    }
    return rows.sort((a, b) => b.ratio - a.ratio)
  }, [swatches])

  return (
    <div className="flex flex-col gap-6">
      <ToolPanel title="Base colour and harmony">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          <ColorField label="Base colour" value={baseInput} onChange={setBaseInput} />
          <SegmentedField
            label="Harmony"
            value={harmony}
            options={HARMONY_OPTIONS}
            onChange={setHarmony}
            hint={HARMONY_NOTES[harmony]}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="gap-2" onClick={regenerate}>
            <Shuffle className="size-4" aria-hidden="true" />
            Regenerate unlocked
          </Button>
          <CopyButton value={swatches.map((s) => s.hex).join(', ')} label="Copy all hex values" />
        </div>
      </ToolPanel>

      <ToolPanel
        title="Palette"
        description="Lock a swatch to keep it while the rest reshuffle. Click a swatch to load its shade scale below."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {swatches.map((swatch, index) => {
            const rgb = parseColor(swatch.hex) ?? { r: 0, g: 0, b: 0, a: 1 }
            const text = readableTextOn(rgb)
            const ratioWhite = contrastRatio(rgb, WHITE)
            const ratioBlack = contrastRatio(rgb, BLACK)
            return (
              <div
                key={index}
                className={cn(
                  'overflow-hidden rounded-xl border transition-colors',
                  selected === index ? 'border-primary' : 'border-border',
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelected(index)}
                  aria-pressed={selected === index}
                  className="block h-24 w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:-outline-offset-2 focus-visible:outline-none"
                  style={{ backgroundColor: swatch.hex }}
                >
                  <span className="sr-only">
                    Select swatch {index + 1}, {names[index]} {swatch.hex}
                  </span>
                  <span className="block px-2 text-left text-[11px] font-medium" style={{ color: text }}>
                    {names[index]}
                  </span>
                </button>
                <div className="flex flex-col gap-1.5 border-t border-border bg-card p-2">
                  <div className="flex items-center justify-between gap-1">
                    <code className="font-mono text-[12px] text-foreground">{swatch.hex}</code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={swatch.locked ? `Unlock ${names[index]}` : `Lock ${names[index]}`}
                      aria-pressed={swatch.locked}
                      onClick={() => toggleLock(index)}
                    >
                      {swatch.locked ? (
                        <Lock className="size-3.5 text-primary" aria-hidden="true" />
                      ) : (
                        <LockOpen className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                  <p className="font-mono text-[10.5px] text-muted-foreground">
                    {toHslString(rgb)}
                  </p>
                  <p className="text-[10.5px] tabular-nums text-muted-foreground">
                    ⬜ {ratioWhite.toFixed(1)} · ⬛ {ratioBlack.toFixed(1)}
                  </p>
                  <input
                    type="color"
                    value={swatch.hex}
                    aria-label={`Edit swatch ${index + 1}`}
                    onChange={(event) => setSwatchHex(index, event.target.value)}
                    className="h-7 w-full cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </ToolPanel>

      <ToolPanel
        title={`Shades and tints: ${names[selected] ?? 'swatch'}`}
        description="A ten-step scale at fixed lightness values, the way design systems normally name them. Handy for hover states, borders and disabled text."
      >
        <div className="overflow-x-auto">
          <div className="flex min-w-max">
            {activeScale.map((step) => (
              <div key={step.step} className="w-[10%] min-w-16 shrink-0">
                <div className="h-16" style={{ backgroundColor: step.hex }} />
                <div className="px-1 py-1.5 text-center">
                  <div className="text-[11px] font-medium text-foreground tabular-nums">{step.step}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{step.hex}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <CopyButton
          value={activeScale.map((step) => `${step.step}: ${step.hex}`).join('\n')}
          label="Copy the scale"
          className="self-start"
        />
      </ToolPanel>

      <ToolPanel
        title="Contrast pairs"
        description="Every combination of two palette colours as text on background, graded against WCAG 2.1. 4.5:1 passes AA for body text, 3:1 for large text and interface elements."
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-border px-2 py-2 text-left font-semibold">Text</th>
                <th className="border-b border-border px-2 py-2 text-left font-semibold">Background</th>
                <th className="border-b border-border px-2 py-2 text-right font-semibold">Ratio</th>
                <th className="border-b border-border px-2 py-2 text-left font-semibold">Grade</th>
                <th className="border-b border-border px-2 py-2 text-left font-semibold">Sample</th>
              </tr>
            </thead>
            <tbody>
              {contrastPairs.map((pair) => (
                <tr key={pair.key}>
                  <td className="border-b border-border px-2 py-2 font-mono text-xs">{pair.fg}</td>
                  <td className="border-b border-border px-2 py-2 font-mono text-xs">{pair.bg}</td>
                  <td className="border-b border-border px-2 py-2 text-right tabular-nums">
                    {pair.ratio.toFixed(2)}
                  </td>
                  <td className="border-b border-border px-2 py-2">{pair.grade}</td>
                  <td className="border-b border-border px-2 py-2">
                    <span
                      className="inline-block rounded px-2 py-1 text-xs whitespace-nowrap"
                      style={{ color: pair.fg, backgroundColor: pair.bg }}
                    >
                      Sample text
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Only pairs reaching 3:1 are listed. If nothing appears, the palette is too uniform in
          lightness to use one colour on another. Pair the swatches with white or near-black
          instead.
        </p>
      </ToolPanel>

      <ToolPanel title="Export">
        <Tabs defaultValue="css">
          <TabsList>
            <TabsTrigger value="css">CSS variables</TabsTrigger>
            <TabsTrigger value="tailwind">Tailwind</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="css" className="mt-4 flex flex-col gap-3">
            <CodeBlock code={cssExport} />
            <CopyButton value={cssExport} label="Copy CSS" className="self-start" />
          </TabsContent>
          <TabsContent value="tailwind" className="mt-4 flex flex-col gap-3">
            <CodeBlock code={tailwindExport} />
            <CopyButton value={tailwindExport} label="Copy config" className="self-start" />
          </TabsContent>
          <TabsContent value="json" className="mt-4 flex flex-col gap-3">
            <CodeBlock code={jsonExport} />
            <CopyButton value={jsonExport} label="Copy JSON" className="self-start" />
          </TabsContent>
        </Tabs>
      </ToolPanel>
    </div>
  )
}
