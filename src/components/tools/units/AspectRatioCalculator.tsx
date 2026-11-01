import { useMemo, useState } from 'react'
import { ArrowLeftRight, Monitor, Proportions } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula } from '@/components/shared/Formula'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber } from '@/components/tools/finance/format'

interface RatioPreset {
  id: string
  label: string
  w: number
  h: number
  note: string
}

const PRESETS: RatioPreset[] = [
  { id: '16:9', label: '16:9', w: 16, h: 9, note: 'HD and 4K video, most monitors and TVs' },
  { id: '4:3', label: '4:3', w: 4, h: 3, note: 'Classic TV, iPad, most compact cameras' },
  { id: '3:2', label: '3:2', w: 3, h: 2, note: '35 mm film, most DSLR and mirrorless sensors' },
  { id: '21:9', label: '21:9', w: 64, h: 27, note: 'Ultrawide monitors (truly 64:27)' },
  { id: '9:16', label: '9:16', w: 9, h: 16, note: 'Reels, Shorts, TikTok, Stories' },
  { id: '1:1', label: '1:1', w: 1, h: 1, note: 'Square posts and profile pictures' },
  { id: '4:5', label: '4:5', w: 4, h: 5, note: 'Instagram portrait, the tallest in-feed size' },
  { id: '2.39:1', label: '2.39:1', w: 239, h: 100, note: 'Anamorphic cinema scope' },
  { id: '5:4', label: '5:4', w: 5, h: 4, note: '1280 × 1024 legacy monitors, 8 × 10 in prints' },
  { id: 'A4', label: '√2:1 (A-series paper)', w: 1414, h: 1000, note: 'A4, A3, A5 and every other ISO paper size' },
]

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a))
  let y = Math.abs(Math.round(b))
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

/** Reduce to the neatest integer ratio, falling back to decimals for odd sizes. */
function simplify(w: number, h: number): { text: string; exact: boolean } {
  if (!w || !h) return { text: '–', exact: false }
  const g = gcd(w, h)
  const rw = Math.round(w) / g
  const rh = Math.round(h) / g
  if (Number.isInteger(rw) && Number.isInteger(rh) && rw <= 400 && rh <= 400) {
    return { text: `${rw}:${rh}`, exact: true }
  }
  return { text: `${(w / h).toFixed(3)}:1`, exact: false }
}

/** Sizes and pixel counts above a billion are not real screens; treat them as empty. */
function num(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) && Math.abs(n) <= 1e9 ? n : 0
}

export interface AspectRatioCalculatorProps {
  mode?: 'aspect' | 'screen'
}

export default function AspectRatioCalculator({ mode = 'aspect' }: AspectRatioCalculatorProps) {
  /* ── aspect-ratio state ── */
  const [rw, setRw] = useState('16')
  const [rh, setRh] = useState('9')
  const [newW, setNewW] = useState('1280')
  const [newH, setNewH] = useState('720')
  const [lastEdited, setLastEdited] = useState<'w' | 'h'>('w')

  /* ── screen-size state ── */
  const [diagonal, setDiagonal] = useState('27')
  const [diagUnit, setDiagUnit] = useState<'in' | 'cm'>('in')
  const [pixelW, setPixelW] = useState('2560')
  const [pixelH, setPixelH] = useState('1440')

  const ratioW = num(rw)
  const ratioH = num(rh)
  const ratio = ratioH !== 0 ? ratioW / ratioH : 0

  const solved = useMemo(() => {
    if (ratio <= 0) return { w: 0, h: 0 }
    if (lastEdited === 'w') {
      const w = num(newW)
      return { w, h: w / ratio }
    }
    const h = num(newH)
    return { w: h * ratio, h }
  }, [ratio, lastEdited, newW, newH])

  const shownW = lastEdited === 'w' ? num(newW) : Math.round(solved.w * 100) / 100
  const shownH = lastEdited === 'w' ? Math.round(solved.h * 100) / 100 : num(newH)
  const simplified = simplify(shownW, shownH)
  const megapixels = (shownW * shownH) / 1_000_000

  function applyPreset(preset: RatioPreset) {
    setRw(String(preset.w))
    setRh(String(preset.h))
    const r = preset.w / preset.h
    if (lastEdited === 'w') setNewH(String(Math.round((num(newW) / r) * 100) / 100))
    else setNewW(String(Math.round(num(newH) * r * 100) / 100))
  }

  function swap() {
    setRw(rh)
    setRh(rw)
    // Swap what is on screen (one side is solved, not typed), and keep the typed side typed.
    setNewW(String(shownH))
    setNewH(String(shownW))
    setLastEdited(lastEdited === 'w' ? 'h' : 'w')
  }

  /* ── screen maths ── */
  const screen = useMemo(() => {
    const d = num(diagonal)
    const r = ratio
    if (d <= 0 || r <= 0) return null
    const inches = diagUnit === 'in' ? d : d / 2.54
    const w = (inches * r) / Math.sqrt(r * r + 1)
    const h = inches / Math.sqrt(r * r + 1)
    const px = num(pixelW)
    const py = num(pixelH)
    const ppi = px > 0 && py > 0 ? Math.sqrt(px * px + py * py) / inches : 0
    return {
      inches,
      w,
      h,
      areaIn: w * h,
      areaCm: w * 2.54 * (h * 2.54),
      ppi,
      dotPitch: ppi > 0 ? 25.4 / ppi : 0,
      px,
      py,
    }
  }, [diagonal, diagUnit, ratio, pixelW, pixelH])

  /* ── preview box ── */
  const previewRatio = ratio > 0 ? ratio : 16 / 9
  const boxW = previewRatio >= 1 ? 260 : 260 * previewRatio
  const boxH = previewRatio >= 1 ? 260 / previewRatio : 260

  const summary =
    mode === 'aspect'
      ? `${formatNumber(shownW)} × ${formatNumber(shownH)} (${simplified.text})`
      : screen
        ? `${screen.w.toFixed(2)} in × ${screen.h.toFixed(2)} in, ${screen.ppi ? `${screen.ppi.toFixed(1)} PPI` : 'no resolution given'}`
        : ''

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <ToolPanel
            title={mode === 'aspect' ? 'Aspect ratio' : 'Screen'}
            description={
              mode === 'aspect'
                ? 'Type a ratio and one dimension. The other is solved as you type.'
                : 'Screens are sold by diagonal, which tells you almost nothing on its own. Enter the diagonal and the shape to get the real width and height.'
            }
          >
            <div className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Ratio</legend>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ar-rw">Width part</Label>
                    <Input
                      id="ar-rw"
                      className="w-24"
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={rw}
                      onChange={(e) => setRw(e.target.value)}
                    />
                  </div>
                  <span aria-hidden="true" className="pb-2 text-lg font-semibold">
                    :
                  </span>
                  <div className="space-y-1.5">
                    <Label htmlFor="ar-rh">Height part</Label>
                    <Input
                      id="ar-rh"
                      className="w-24"
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={rh}
                      onChange={(e) => setRh(e.target.value)}
                    />
                  </div>
                  <Button type="button" variant="outline" size="icon" aria-label="Swap width and height" onClick={swap}>
                    <ArrowLeftRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      size="sm"
                      variant={
                        Math.abs(preset.w / preset.h - ratio) < 0.0005 ? 'default' : 'outline'
                      }
                      title={preset.note}
                      onClick={() => applyPreset(preset)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </fieldset>

              {mode === 'aspect' ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Dimensions in pixels</legend>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="ar-w">Width</Label>
                      <Input
                        id="ar-w"
                        className="w-32"
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        value={lastEdited === 'w' ? newW : String(shownW)}
                        onChange={(e) => {
                          setLastEdited('w')
                          setNewW(e.target.value)
                        }}
                      />
                    </div>
                    <span aria-hidden="true" className="pb-2 text-lg">
                      ×
                    </span>
                    <div className="space-y-1.5">
                      <Label htmlFor="ar-h">Height</Label>
                      <Input
                        id="ar-h"
                        className="w-32"
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        value={lastEdited === 'h' ? newH : String(shownH)}
                        onChange={(e) => {
                          setLastEdited('h')
                          setNewH(e.target.value)
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Whichever box you type in is treated as fixed; the other one is recalculated
                    from the ratio.
                  </p>
                </fieldset>
              ) : (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Diagonal and resolution</legend>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="ss-diag">Diagonal</Label>
                      <Input
                        id="ss-diag"
                        className="w-28"
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        value={diagonal}
                        onChange={(e) => setDiagonal(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ss-unit">Unit</Label>
                      <Select value={diagUnit} onValueChange={(v) => setDiagUnit(v as 'in' | 'cm')}>
                        <SelectTrigger id="ss-unit" className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in">inches</SelectItem>
                          <SelectItem value="cm">centimetres</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-2 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="ss-px">Horizontal pixels</Label>
                      <Input
                        id="ss-px"
                        className="w-32"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={pixelW}
                        onChange={(e) => setPixelW(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ss-py">Vertical pixels</Label>
                      <Input
                        id="ss-py"
                        className="w-32"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={pixelH}
                        onChange={(e) => setPixelH(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Resolution is optional. Without it you still get the physical width and
                    height.
                  </p>
                </fieldset>
              )}
            </div>
          </ToolPanel>

          {mode === 'aspect' ? (
            <ToolPanel title="Result">
              <div className="grid gap-3 sm:grid-cols-3">
                <ResultStat label="Width" value={formatNumber(shownW)} hint="pixels" emphasis />
                <ResultStat label="Height" value={formatNumber(shownH)} hint="pixels" emphasis />
                <ResultStat
                  label="Simplified ratio"
                  value={simplified.text}
                  hint={simplified.exact ? 'exact integer ratio' : 'not a neat integer ratio'}
                />
                <ResultStat label="Decimal ratio" value={ratio ? ratio.toFixed(4) : '–'} hint="width ÷ height" />
                <ResultStat label="Megapixels" value={megapixels ? megapixels.toFixed(2) : '–'} hint="width × height ÷ 1,000,000" />
                <ResultStat
                  label="Orientation"
                  value={ratio > 1 ? 'Landscape' : ratio < 1 ? 'Portrait' : 'Square'}
                  hint={`${ratio ? ratio.toFixed(3) : '0'} : 1`}
                />
              </div>

              <Formula
                caption="The same proportion, rearranged. An aspect-ratio calculator does only this."
              >
                {lastEdited === 'w'
                  ? `height = width × (ratio height ÷ ratio width)
       = ${formatNumber(shownW)} × (${formatNumber(ratioH)} ÷ ${formatNumber(ratioW)})
       = ${formatNumber(shownW)} × ${ratioW ? (ratioH / ratioW).toFixed(6) : '–'}
       = ${formatNumber(shownH)} px`
                  : `width = height × (ratio width ÷ ratio height)
      = ${formatNumber(shownH)} × (${formatNumber(ratioW)} ÷ ${formatNumber(ratioH)})
      = ${formatNumber(shownH)} × ${ratioH ? (ratioW / ratioH).toFixed(6) : '–'}
      = ${formatNumber(shownW)} px`}
              </Formula>

              <Formula caption={`Greatest common divisor of ${Math.round(shownW)} and ${Math.round(shownH)} is ${gcd(shownW, shownH)}.`}>
                {`${Math.round(shownW)} : ${Math.round(shownH)}
  ÷ ${gcd(shownW, shownH)} both sides
= ${simplified.text}`}
              </Formula>

              <CopyButton value={`${formatNumber(shownW)} × ${formatNumber(shownH)} (${simplified.text})`} label="Copy the result" />
            </ToolPanel>
          ) : (
            <ToolPanel title="Result">
              {screen ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ResultStat label="Width" value={`${screen.w.toFixed(2)} in`} hint={`${(screen.w * 2.54).toFixed(1)} cm`} emphasis />
                    <ResultStat label="Height" value={`${screen.h.toFixed(2)} in`} hint={`${(screen.h * 2.54).toFixed(1)} cm`} emphasis />
                    <ResultStat label="Viewing area" value={`${screen.areaIn.toFixed(0)} in²`} hint={`${screen.areaCm.toFixed(0)} cm²`} />
                    <ResultStat
                      label="Pixel density"
                      value={screen.ppi ? `${screen.ppi.toFixed(1)} PPI` : '–'}
                      hint={screen.ppi ? 'pixels per inch' : 'enter a resolution'}
                    />
                    <ResultStat
                      label="Dot pitch"
                      value={screen.dotPitch ? `${screen.dotPitch.toFixed(3)} mm` : '–'}
                      hint="distance between pixel centres"
                    />
                    <ResultStat
                      label="Sharpness"
                      value={
                        !screen.ppi
                          ? '–'
                          : screen.ppi >= 200
                            ? 'Retina-class'
                            : screen.ppi >= 140
                              ? 'Sharp'
                              : screen.ppi >= 100
                                ? 'Normal'
                                : 'Visibly pixelated'
                      }
                      hint="at a typical desk viewing distance"
                    />
                  </div>

                  <Formula caption="Pythagoras applied to the screen rectangle: the diagonal is the hypotenuse.">
                    {`r = ${formatNumber(ratioW)} ÷ ${formatNumber(ratioH)} = ${ratio.toFixed(4)}

width  = diagonal × r ÷ √(r² + 1)
       = ${screen.inches.toFixed(2)} × ${ratio.toFixed(4)} ÷ ${Math.sqrt(ratio * ratio + 1).toFixed(4)}
       = ${screen.w.toFixed(2)} in

height = diagonal ÷ √(r² + 1)
       = ${screen.inches.toFixed(2)} ÷ ${Math.sqrt(ratio * ratio + 1).toFixed(4)}
       = ${screen.h.toFixed(2)} in`}
                  </Formula>

                  {screen.ppi > 0 && (
                    <Formula caption="Pixel density uses the diagonal in pixels over the diagonal in inches.">
                      {`PPI = √(${screen.px}² + ${screen.py}²) ÷ ${screen.inches.toFixed(2)}
    = ${Math.sqrt(screen.px * screen.px + screen.py * screen.py).toFixed(1)} ÷ ${screen.inches.toFixed(2)}
    = ${screen.ppi.toFixed(2)} pixels per inch`}
                    </Formula>
                  )}

                  <CopyButton value={summary} label="Copy the result" />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Enter a diagonal above and pick a ratio to see the real width and height.
                </p>
              )}
            </ToolPanel>
          )}
        </div>

        <ToolPanel
          title={
            <span className="flex items-center gap-2">
              {mode === 'aspect' ? (
                <Proportions className="size-4" aria-hidden="true" />
              ) : (
                <Monitor className="size-4" aria-hidden="true" />
              )}
              Shape preview
            </span>
          }
        >
          <div className="flex min-h-64 items-center justify-center rounded-lg bg-muted p-3">
            <svg
              viewBox={`0 0 ${Math.max(1, boxW)} ${Math.max(1, boxH)}`}
              width={boxW}
              height={boxH}
              className="max-w-full"
              role="img"
              aria-label={`Preview of a ${simplify(ratioW, ratioH).text} rectangle`}
            >
              <rect
                x="1"
                y="1"
                width={Math.max(1, boxW - 2)}
                height={Math.max(1, boxH - 2)}
                fill="var(--background)"
                stroke="var(--primary)"
                strokeWidth="2"
                rx="4"
              />
              <line
                x1="1"
                y1={Math.max(1, boxH - 1)}
                x2={Math.max(1, boxW - 1)}
                y2="1"
                stroke="var(--muted-foreground)"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
            </svg>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {simplify(ratioW, ratioH).text}
            {mode === 'aspect' ? ` · ${formatNumber(shownW)} × ${formatNumber(shownH)} px` : ''}
          </p>
          <div className="space-y-1 text-xs text-muted-foreground">
            {PRESETS.filter((p) => Math.abs(p.w / p.h - ratio) < 0.0005).map((p) => (
              <p key={p.id}>
                <strong className="text-foreground">{p.label}</strong>: {p.note}
              </p>
            ))}
          </div>
        </ToolPanel>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {summary}
      </p>
    </div>
  )
}
