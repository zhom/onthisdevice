import { useId, useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula } from '@/components/shared/Formula'
import { cn } from '@/lib/utils'
import { normaliseInput } from './units-life-engine'
import { CUP_STANDARDS, INGREDIENT_BY_ID, REFERENCE_CUP_ML, US_TEASPOON_ML } from './units-life-densities'

const SAMPLE = `Serves 4

2 cups all-purpose flour
1 1/2 tsp baking powder
1/2 tsp salt
3/4 cup granulated sugar
113 g butter, softened
2 large eggs
1 cup whole milk
1 tsp vanilla extract
2-3 tbsp water, as needed
Zest of 1 lemon
Salt to taste`

/** Units the scaler understands, with the millilitres or grams they represent. */
interface UnitInfo {
  canonical: string
  plural?: string
  kind: 'volume' | 'mass' | 'count'
  ml?: number
  g?: number
  /** Round scaled values to this fraction denominator (volume/count only). */
  denominator?: number
}

const UNIT_TABLE: { match: RegExp; info: UnitInfo }[] = [
  { match: /^(cups?|c)\b/, info: { canonical: 'cup', plural: 'cups', kind: 'volume', ml: CUP_STANDARDS['us-customary'].ml, denominator: 8 } },
  { match: /^(tablespoons?|tbsps?|tbs|tb)\b/, info: { canonical: 'tbsp', kind: 'volume', ml: 14.78676478125, denominator: 4 } },
  { match: /^(teaspoons?|tsps?|ts)\b/, info: { canonical: 'tsp', kind: 'volume', ml: US_TEASPOON_ML, denominator: 8 } },
  { match: /^(fluid ounces?|fl\.? ?ozs?)\b/, info: { canonical: 'fl oz', kind: 'volume', ml: 29.5735295625, denominator: 4 } },
  { match: /^(millilit(?:er|re)s?|mls?)\b/, info: { canonical: 'ml', kind: 'volume', ml: 1 } },
  { match: /^(lit(?:er|re)s?|l)\b/, info: { canonical: 'l', kind: 'volume', ml: 1000, denominator: 4 } },
  { match: /^(grams?|gr|g)\b/, info: { canonical: 'g', kind: 'mass', g: 1 } },
  { match: /^(kilograms?|kgs?)\b/, info: { canonical: 'kg', kind: 'mass', g: 1000, denominator: 4 } },
  { match: /^(ounces?|ozs?)\b/, info: { canonical: 'oz', kind: 'mass', g: 28.349523125, denominator: 4 } },
  { match: /^(pounds?|lbs?)\b/, info: { canonical: 'lb', kind: 'mass', g: 453.59237, denominator: 4 } },
  { match: /^(sticks?)\b/, info: { canonical: 'stick', plural: 'sticks', kind: 'mass', g: 113.3980925, denominator: 4 } },
  { match: /^(pinch(?:es)?)\b/, info: { canonical: 'pinch', plural: 'pinches', kind: 'count', denominator: 4 } },
  { match: /^(cloves?)\b/, info: { canonical: 'clove', plural: 'cloves', kind: 'count', denominator: 2 } },
  { match: /^(cans?|tins?)\b/, info: { canonical: 'can', plural: 'cans', kind: 'count', denominator: 2 } },
  { match: /^(slices?)\b/, info: { canonical: 'slice', plural: 'slices', kind: 'count', denominator: 2 } },
  { match: /^(sprigs?)\b/, info: { canonical: 'sprig', plural: 'sprigs', kind: 'count', denominator: 2 } },
]

/** Rough ingredient recognition, only used for the optional metric column. */
const INGREDIENT_KEYWORDS: { match: RegExp; id: string }[] = [
  { match: /\bbread flour\b/, id: 'flour-bread' },
  { match: /\bcake flour\b/, id: 'flour-cake' },
  { match: /\b(whole ?wheat|wholemeal) flour\b/, id: 'flour-wholewheat' },
  { match: /\balmond flour\b/, id: 'flour-almond' },
  { match: /\bflour\b/, id: 'flour-ap-spooned' },
  { match: /\b(brown|muscovado) sugar\b/, id: 'sugar-brown-packed' },
  { match: /\b(icing|powdered|confectioner)/, id: 'sugar-powdered' },
  { match: /\bsugar\b/, id: 'sugar-granulated' },
  { match: /\bpeanut butter\b/, id: 'peanut-butter' },
  { match: /\bbutter\b/, id: 'butter' },
  { match: /\b(vegetable|canola|sunflower) oil\b/, id: 'oil-vegetable' },
  { match: /\bolive oil\b/, id: 'oil-olive' },
  { match: /\bmilk\b/, id: 'milk-whole' },
  { match: /\b(double|heavy) cream\b/, id: 'cream-heavy' },
  { match: /\byogh?urt\b/, id: 'yogurt' },
  { match: /\bwater\b/, id: 'water' },
  { match: /\bhoney\b/, id: 'honey' },
  { match: /\bmaple syrup\b/, id: 'maple-syrup' },
  { match: /\bcocoa\b/, id: 'cocoa' },
  { match: /\b(rolled )?oats\b/, id: 'oats-rolled' },
  { match: /\brice\b/, id: 'rice-white' },
  { match: /\bcornstarch|cornflour\b/, id: 'cornstarch' },
  { match: /\bchocolate chips?\b/, id: 'choc-chips' },
  { match: /\bsalt\b/, id: 'salt-table' },
  { match: /\bstock|broth\b/, id: 'stock' },
]

const VULGAR_MAP: Record<string, string> = {
  '½': '1/2',
  '⅓': '1/3',
  '⅔': '2/3',
  '¼': '1/4',
  '¾': '3/4',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
}

/** Expand "1½" into "1 1/2" so the number parser sees one token. */
function expandVulgar(line: string): string {
  return line.replace(/(\d)?([½⅓⅔¼¾⅛⅜⅝⅞])/g, (_m, digit: string | undefined, ch: string) =>
    digit ? `${digit} ${VULGAR_MAP[ch]}` : VULGAR_MAP[ch],
  )
}

interface NumberToken {
  value: number
  length: number
}

function readNumber(s: string): NumberToken | null {
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)/.exec(s)
  if (mixed && Number(mixed[3]) !== 0) {
    return { value: Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]), length: mixed[0].length }
  }
  const frac = /^(\d+)\s*\/\s*(\d+)/.exec(s)
  if (frac && Number(frac[2]) !== 0) {
    return { value: Number(frac[1]) / Number(frac[2]), length: frac[0].length }
  }
  const dec = /^(\d+(?:\.\d+)?)/.exec(s)
  if (dec) return { value: Number(dec[1]), length: dec[0].length }
  return null
}

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

/** Render a scaled amount the way a recipe would print it. */
function renderAmount(value: number, denominator: number | undefined): string {
  if (!Number.isFinite(value)) return '?'
  if (denominator === undefined) {
    // Metric weights and volumes: keep it to whole units, or one decimal if tiny.
    if (value >= 100) return String(Math.round(value))
    if (value >= 10) return String(Math.round(value))
    if (value >= 1) return String(Math.round(value * 10) / 10)
    return String(Math.round(value * 100) / 100)
  }
  const total = Math.round(value * denominator)
  if (total === 0) return value > 0 ? `a scant 1/${denominator}` : '0'
  const whole = Math.floor(total / denominator)
  let numerator = total - whole * denominator
  let den = denominator
  if (numerator > 0) {
    const g = gcd(numerator, den)
    numerator /= g
    den /= g
  }
  if (numerator === 0) return String(whole)
  if (whole === 0) return `${numerator}/${den}`
  return `${whole} ${numerator}/${den}`
}

interface ScaledLine {
  original: string
  scaled: string
  metric?: string
  changed: boolean
}

function scaleLine(line: string, factor: number, wantMetric: boolean): ScaledLine {
  const raw = line
  if (!line.trim()) return { original: raw, scaled: '', changed: false }

  const bullet = /^(\s*[-•*]\s*)/.exec(line)
  const prefix = bullet ? bullet[1] : ''
  const body = expandVulgar(line.slice(prefix.length))

  let first = readNumber(body)
  if (!first) return { original: raw, scaled: prefix + body, changed: false }

  let cursor = first.length
  let second: NumberToken | null = null
  // "1-1/2 cups" is the mixed number 1 1/2, not the range 1 to 1/2.
  const mixed = /^-(\d+\/\d+)/.exec(body.slice(cursor))
  const part = mixed ? readNumber(mixed[1] ?? '') : null
  if (mixed && part && part.value < 1 && Number.isInteger(first.value)) {
    first = { ...first, value: first.value + part.value, length: first.length + mixed[0].length }
    cursor = first.length
  }
  const rangeSep = /^\s*(?:-|–|—|to)\s*/.exec(body.slice(cursor))
  if (rangeSep) {
    const candidate = readNumber(body.slice(cursor + rangeSep[0].length))
    if (candidate) {
      second = candidate
      cursor += rangeSep[0].length + candidate.length
    }
  }

  const rest = body.slice(cursor).replace(/^\s+/, '')
  const restLower = rest.toLowerCase()

  let unit: UnitInfo | null = null
  let unitTextLength = 0
  for (const entry of UNIT_TABLE) {
    const m = entry.match.exec(restLower)
    if (m) {
      unit = entry.info
      unitTextLength = m[0].length
      break
    }
  }

  const tail = rest.slice(unitTextLength).replace(/^[\s.]+/, '')
  const scaledFirst = first.value * factor
  const scaledSecond = second ? second.value * factor : null
  const denominator = unit ? unit.denominator : 4

  const amountText = scaledSecond
    ? `${renderAmount(scaledFirst, denominator)}–${renderAmount(scaledSecond, denominator)}`
    : renderAmount(scaledFirst, denominator)

  let unitText = ''
  if (unit) {
    const plural = unit.plural ?? unit.canonical
    unitText = ` ${scaledFirst === 1 && !scaledSecond ? unit.canonical : plural}`
  }

  const scaled = `${prefix}${amountText}${unitText}${tail ? ` ${tail}` : ''}`

  let metric: string | undefined
  if (wantMetric && unit) {
    const ingredient = INGREDIENT_KEYWORDS.find((k) => k.match.test(restLower))
    const ing = ingredient ? INGREDIENT_BY_ID[ingredient.id] : undefined
    if (unit.kind === 'volume' && unit.ml !== undefined) {
      const ml = scaledFirst * unit.ml
      if (ing) {
        const grams = (ml * ing.gramsPerCup) / REFERENCE_CUP_ML
        metric = `${Math.round(grams)} g (${Math.round(ml)} ml)`
      } else if (unit.canonical !== 'ml' && unit.canonical !== 'l') {
        metric = `${Math.round(ml)} ml`
      }
    } else if (unit.kind === 'mass' && unit.g !== undefined && unit.canonical !== 'g') {
      metric = `${Math.round(scaledFirst * unit.g)} g`
    }
  }

  return { original: raw, scaled, metric, changed: true }
}

export default function UnitsLifeRecipeScaler() {
  const uid = useId()
  const [text, setText] = useState(SAMPLE)
  const [fromServings, setFromServings] = useState('4')
  const [toServings, setToServings] = useState('6')
  const [metric, setMetric] = useState(false)

  const servings = (s: string) => {
    const n = Number(normaliseInput(s))
    return Number.isFinite(n) && n <= 1e6 ? n : 0
  }
  const from = servings(fromServings)
  const to = servings(toServings)
  const factor = from > 0 && to > 0 ? to / from : 1

  const lines = useMemo(
    () => text.split(/\r?\n/).map((l) => scaleLine(l, factor, metric)),
    [factor, metric, text],
  )

  const output = useMemo(
    () => lines.map((l) => (l.metric ? `${l.scaled}  [${l.metric}]` : l.scaled)).join('\n'),
    [lines],
  )

  const scaledCount = lines.filter((l) => l.changed).length

  const presets: { label: string; f: number }[] = [
    { label: 'Half', f: 0.5 },
    { label: 'Two thirds', f: 2 / 3 },
    { label: 'Same', f: 1 },
    { label: 'One and a half', f: 1.5 },
    { label: 'Double', f: 2 },
    { label: 'Triple', f: 3 },
  ]

  return (
    <div className="space-y-6">
      <ToolPanel
        title="Scale a whole ingredient list at once"
        description="Paste the ingredients and set the servings. Each quantity is rewritten for the new servings."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-from`}>Recipe serves</Label>
            <Input
              id={`${uid}-from`}
              inputMode="decimal"
              className="tabular-nums"
              value={fromServings}
              onChange={(e) => setFromServings(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-to`}>I want to serve</Label>
            <Input
              id={`${uid}-to`}
              inputMode="decimal"
              className="tabular-nums"
              value={toServings}
              onChange={(e) => setToServings(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-foreground">Scaling factor</span>
            <div className="flex h-9 items-center rounded-md bg-muted px-3 text-sm font-semibold tabular-nums">
              ×{Math.round(factor * 1000) / 1000}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <Button
              key={p.label}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setFromServings('1')
                setToServings(String(Math.round(p.f * 1000) / 1000))
              }}
            >
              {p.label} (×{Math.round(p.f * 100) / 100})
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Switch id={`${uid}-metric`} checked={metric} onCheckedChange={setMetric} />
          <Label htmlFor={`${uid}-metric`} className="cursor-pointer">
            Also show metric weights for cup and spoon measures
          </Label>
        </div>
      </ToolPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <ToolPanel title="Your recipe" description="One ingredient per line. Headings and notes pass through untouched.">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-in`}>Ingredients</Label>
            <Textarea
              id={`${uid}-in`}
              rows={16}
              spellCheck={false}
              className="font-mono text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="2 cups flour&#10;1 tsp salt&#10;250 g butter"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setText('')}>
              Clear
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setText(SAMPLE)}>
              Load the example
            </Button>
          </div>
        </ToolPanel>

        <ToolPanel title="Scaled recipe" description="Rounded to fractions a measuring cup can actually hit.">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-out`}>Result</Label>
            <Textarea
              id={`${uid}-out`}
              rows={16}
              readOnly
              spellCheck={false}
              className="font-mono text-sm"
              value={output}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CopyButton value={output} label="Copy scaled recipe" />
            <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {scaledCount} line{scaledCount === 1 ? '' : 's'} rescaled
            </span>
          </div>
        </ToolPanel>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ResultStat label="Original servings" value={from > 0 ? String(from) : '–'} />
        <ResultStat label="New servings" value={to > 0 ? String(to) : '–'} />
        <ResultStat
          label="Every quantity is multiplied by"
          value={`×${Math.round(factor * 1000) / 1000}`}
          emphasis
        />
      </div>

      <ToolPanel title="The working" description="The scaling factor, with your numbers in it.">
        <Formula caption="Line by line, each recognised quantity is multiplied by this factor and then snapped to the nearest practical fraction: eighths for cups and teaspoons, quarters for tablespoons and ounces.">
          {[
            'factor = new servings ÷ original servings',
            `factor = ${to || '?'} ÷ ${from || '?'} = ${Math.round(factor * 10000) / 10000}`,
            '',
            `example: 2 cups × ${Math.round(factor * 10000) / 10000} = ${
              Math.round(2 * factor * 10000) / 10000
            } cups → ${renderAmount(2 * factor, 8)} cups`,
          ].join('\n')}
        </Formula>
      </ToolPanel>

      <div
        className={cn(
          'flex items-start gap-2 rounded-lg bg-muted p-4 text-sm text-muted-foreground text-pretty',
        )}
      >
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Scaling quantities is linear. Cooking is not. Baking times barely change when you double a
          traybake but do change when you switch tin size; salt, raising agents and strong spices are
          usually scaled slightly under; and a doubled pan of anything you are searing needs to be
          cooked in two batches or it will steam. Treat the numbers as the starting point, not the
          recipe.
        </span>
      </div>
    </div>
  )
}
