import { useId, useMemo, useState } from 'react'
import { Flame } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula } from '@/components/shared/Formula'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { cn } from '@/lib/utils'

type Scale = 'c' | 'f' | 'gas' | 'fan-c' | 'fan-f'

interface GasRow {
  gas: string
  gasValue: number
  c: number
  f: number
  term: string
  use: string
}

/** The standard British gas-mark ladder, with the °C figures UK recipes print. */
const GAS_CHART: GasRow[] = [
  { gas: '1/4', gasValue: 0.25, c: 110, f: 225, term: 'Very cool', use: 'Meringues, drying fruit, very slow overnight braises' },
  { gas: '1/2', gasValue: 0.5, c: 120, f: 250, term: 'Very cool', use: 'Meringues, keeping food warm' },
  { gas: '1', gasValue: 1, c: 140, f: 275, term: 'Cool', use: 'Slow-cooked casseroles, rich fruit cakes' },
  { gas: '2', gasValue: 2, c: 150, f: 300, term: 'Cool', use: 'Slow roasting, custards, milk puddings' },
  { gas: '3', gasValue: 3, c: 170, f: 325, term: 'Warm', use: 'Rich fruit cakes, slow-roast pork shoulder' },
  { gas: '4', gasValue: 4, c: 180, f: 350, term: 'Moderate', use: 'The default: sponge cakes, cookies, most bakes' },
  { gas: '5', gasValue: 5, c: 190, f: 375, term: 'Moderately hot', use: 'Roast chicken, crumbles, shortcrust pastry' },
  { gas: '6', gasValue: 6, c: 200, f: 400, term: 'Moderately hot', use: 'Roast potatoes, muffins, scones' },
  { gas: '7', gasValue: 7, c: 220, f: 425, term: 'Hot', use: 'Puff pastry, roast vegetables, pizza on a tray' },
  { gas: '8', gasValue: 8, c: 230, f: 450, term: 'Hot', use: 'Bread, initial blast for a roast' },
  { gas: '9', gasValue: 9, c: 240, f: 475, term: 'Very hot', use: 'Sourdough with steam, flatbreads' },
  { gas: '10', gasValue: 10, c: 260, f: 500, term: 'Very hot', use: 'Pizza stone, the hottest most domestic ovens go' },
]

function describe(c: number): string {
  if (c < 130) return 'Very cool / very slow'
  if (c < 160) return 'Cool / slow'
  if (c < 185) return 'Moderate'
  if (c < 205) return 'Moderately hot'
  if (c < 235) return 'Hot'
  return 'Very hot'
}

/** Nearest gas mark to a conventional Celsius temperature. */
function nearestGas(c: number): GasRow {
  return GAS_CHART.reduce((best, row) => (Math.abs(row.c - c) < Math.abs(best.c - c) ? row : best), GAS_CHART[0])
}

function round5(n: number): number {
  return Math.round(n / 5) * 5
}

export default function UnitsLifeOvenTemp() {
  const uid = useId()
  const [scale, setScale] = useState<Scale>('f')
  const [text, setText] = useState('350')

  const raw = text.trim()
  const parsedGas = useMemo(() => {
    if (scale !== 'gas') return null
    const s = raw.replace(/\s+/g, '').toLowerCase().replace(/^gas(mark)?/, '')
    if (s === '1/4' || s === '0.25' || s === '¼') return 0.25
    if (s === '1/2' || s === '0.5' || s === '½') return 0.5
    const n = Number(s)
    return Number.isFinite(n) && s !== '' ? n : null
  }, [raw, scale])

  const value = useMemo(() => {
    if (scale === 'gas') return parsedGas
    if (!raw) return null
    const n = Number(raw.replace(/[^0-9.\-]/g, ''))
    return Number.isFinite(n) && /\d/.test(raw) ? n : null
  }, [parsedGas, raw, scale])

  /** Everything is normalised to a conventional (non-fan) Celsius temperature. */
  const conventionalC = useMemo(() => {
    if (value === null) return null
    switch (scale) {
      case 'c':
        return value
      case 'f':
        return ((value - 32) * 5) / 9
      case 'fan-c':
        return value + 20
      case 'fan-f':
        return ((value - 32) * 5) / 9 + 20
      case 'gas': {
        const exact = GAS_CHART.find((g) => g.gasValue === value)
        if (exact) return exact.c
        if (value >= 1 && value <= 10) return ((25 * (value + 10) - 32) * 5) / 9
        return null
      }
    }
  }, [scale, value])

  const out = useMemo(() => {
    if (conventionalC === null) return null
    // A value on the gas-mark chart keeps the chart's pair, as recipes print
    // it: 350 °F is 180 °C (176.7 exactly), not 175.
    const row = GAS_CHART.find(
      (g) => (scale === 'f' && g.f === value) || (scale === 'c' && g.c === value) || (scale === 'gas' && g.gasValue === value),
    )
    const c = row ? row.c : conventionalC
    const f = row ? row.f : (c * 9) / 5 + 32
    const fanC = c - 20
    const fanF = (fanC * 9) / 5 + 32
    const gas = nearestGas(c)
    return { c, f, fanC, fanF, gas, term: describe(c) }
  }, [conventionalC, scale, value])

  const sliderC = out ? Math.min(280, Math.max(90, out.c)) : 180

  const copyText = out
    ? `${round5(out.c)} °C conventional · ${round5(out.fanC)} °C fan · ${round5(out.f)} °F · gas mark ${out.gas.gas}`
    : ''

  return (
    <div className="space-y-6">
      <ToolPanel
        title="Oven temperature"
        description="Enter the temperature your recipe gives, then read every other scale off. Fan ovens included."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-scale`}>My recipe says</Label>
            <Select value={scale} onValueChange={(v) => setScale(v as Scale)}>
              <SelectTrigger id={`${uid}-scale`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="f">Degrees Fahrenheit (US recipes)</SelectItem>
                <SelectItem value="c">Degrees Celsius (conventional oven)</SelectItem>
                <SelectItem value="fan-c">Degrees Celsius (fan / convection)</SelectItem>
                <SelectItem value="fan-f">Degrees Fahrenheit (convection)</SelectItem>
                <SelectItem value="gas">Gas mark (UK)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-value`}>
              {scale === 'gas' ? 'Gas mark' : 'Temperature'}
            </Label>
            <Input
              id={`${uid}-value`}
              inputMode="decimal"
              autoComplete="off"
              className="text-lg tabular-nums"
              placeholder={scale === 'gas' ? '4' : '350'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              {scale === 'gas'
                ? 'Marks 1/4, 1/2 and 1 to 10 are all understood.'
                : 'Whole numbers are fine. Ovens are not more precise than that.'}
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <div className="text-sm font-medium text-foreground">Or drag through the range</div>
          <Slider
            min={90}
            max={280}
            step={5}
            value={[sliderC]}
            onValueChange={(v) => {
              setScale('c')
              setText(String(v[0]))
            }}
            aria-label="Conventional oven temperature in Celsius"
          />
          <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
            <span>90°C</span>
            <span>140°C</span>
            <span>180°C</span>
            <span>220°C</span>
            <span>280°C</span>
          </div>
        </div>
      </ToolPanel>

      {raw && value === null ? (
        <ErrorNote
          title="Check that temperature"
          message={
            scale === 'gas'
              ? `“${raw}” isn’t a gas mark. Try 4, 6, 1/2 or 1/4.`
              : `“${raw}” isn’t a temperature we can read. Try 350, 180 or 200.`
          }
        />
      ) : null}

      <div role="status" aria-live="polite" className="space-y-4">
        {out ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat
                label="Conventional oven"
                value={`${round5(out.c)} °C / ${round5(out.f)} °F`}
                hint="A standard oven with the fan off, the setting most recipes assume."
                emphasis
              />
              <ResultStat
                label="Fan / convection oven"
                value={`${round5(out.fanC)} °C / ${round5(out.fanF)} °F`}
                hint="20 °C lower. Moving air transfers heat faster, so the same setting cooks hotter."
                emphasis
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <ResultStat label="Gas mark" value={out.gas.gas} hint={`Nearest mark to ${round5(out.c)} °C.`} />
              <ResultStat label="Described as" value={out.term} hint="The wording older cookbooks use instead of a number." />
              <ResultStat
                label="Exact conversion"
                value={`${out.c.toFixed(1)} °C`}
                hint="Before rounding to the nearest 5 degrees, which is all an oven dial can do."
              />
            </div>
            <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground text-pretty">
              <strong className="text-foreground">Typically used for:</strong> {out.gas.use}.
            </p>
            <CopyButton value={copyText} label="Copy all four settings" />
          </>
        ) : (
          <p className="rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
            Enter a temperature or gas mark to see every equivalent.
          </p>
        )}
      </div>

      {out ? (
        <ToolPanel title="The working" description="Two conversions, both shown with your number in them.">
          <Formula caption="The 20 °C fan rule is the manufacturer convention used across the UK, EU and Australia. Some US convection ovens are quoted at 25 °F instead, which is the same idea rounded differently.">
            {[
              '°F = (°C × 9/5) + 32',
              `°F = (${out.c.toFixed(1)} × 9/5) + 32 = ${out.f.toFixed(1)} °F`,
              '',
              'fan °C = conventional °C − 20',
              `fan °C = ${out.c.toFixed(1)} − 20 = ${out.fanC.toFixed(1)} °C`,
              '',
              'gas mark → °F = 25 × (mark + 10)   for marks 1 to 9',
              `nearest mark to ${round5(out.c)} °C is ${out.gas.gas} (${out.gas.c} °C / ${out.gas.f} °F)`,
            ].join('\n')}
          </Formula>
        </ToolPanel>
      ) : null}

      <ToolPanel
        title="Full oven temperature chart"
        description="Gas mark, conventional Celsius, fan Celsius, Fahrenheit and the old descriptive terms."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gas mark</TableHead>
                <TableHead>Conventional °C</TableHead>
                <TableHead>Fan °C</TableHead>
                <TableHead>°F</TableHead>
                <TableHead>Described as</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {GAS_CHART.map((row) => (
                <TableRow
                  key={row.gas}
                  className={cn(out && out.gas.gas === row.gas && 'bg-background font-semibold')}
                >
                  <TableCell className="font-medium tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      {out && out.gas.gas === row.gas ? (
                        <Flame className="size-3.5 text-primary" aria-hidden="true" />
                      ) : null}
                      {row.gas}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">{row.c} °C</TableCell>
                  <TableCell className="tabular-nums">{row.c - 20} °C</TableCell>
                  <TableCell className="tabular-nums">{row.f} °F</TableCell>
                  <TableCell className="text-muted-foreground">{row.term}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ToolPanel>
    </div>
  )
}
