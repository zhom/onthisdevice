import { useEffect, useId, useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula } from '@/components/shared/Formula'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { cn } from '@/lib/utils'
import { D, formatFraction, formatValue, normaliseInput } from './units-life-engine'
import {
  BUTTER_STICK_GRAMS,
  CUP_STANDARDS,
  IMPERIAL_FLUID_OUNCE_ML,
  INGREDIENTS,
  INGREDIENT_BY_ID,
  INGREDIENT_GROUPS,
  QUICK_PICKS,
  REFERENCE_CUP_ML,
  SPOONS,
  US_FLUID_OUNCE_ML,
  US_TEASPOON_ML,
  densityOf,
  type CupStandardId,
  type SpoonId,
} from './units-life-densities'

export type KitchenMode =
  | 'grams-to-cups'
  | 'cups-to-grams'
  | 'ml-to-cups'
  | 'oz-to-cups'
  | 'tablespoons-to-cups'
  | 'sticks-of-butter'

interface Props {
  mode: KitchenMode
}

const STICK_ML = 118.29411828125 // half a US customary cup
const MASS_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
  stick: BUTTER_STICK_GRAMS,
}

interface ModeConfig {
  /** Unit the main input is expressed in. */
  inputUnit: string
  inputLabel: string
  placeholder: string
  defaultValue: string
  needsIngredient: boolean
  showCupStandard: boolean
  showSpoonStandard: boolean
  defaultIngredient: string
}

const MODES: Record<KitchenMode, ModeConfig> = {
  'grams-to-cups': {
    inputUnit: 'g',
    inputLabel: 'Grams',
    placeholder: '250',
    defaultValue: '250',
    needsIngredient: true,
    showCupStandard: true,
    showSpoonStandard: false,
    defaultIngredient: 'flour-ap-spooned',
  },
  'cups-to-grams': {
    inputUnit: 'cup',
    inputLabel: 'Cups',
    placeholder: '1 1/2',
    defaultValue: '1 1/2',
    needsIngredient: true,
    showCupStandard: true,
    showSpoonStandard: false,
    defaultIngredient: 'sugar-granulated',
  },
  'ml-to-cups': {
    inputUnit: 'ml',
    inputLabel: 'Millilitres',
    placeholder: '500',
    defaultValue: '500',
    needsIngredient: false,
    showCupStandard: true,
    showSpoonStandard: false,
    defaultIngredient: 'water',
  },
  'oz-to-cups': {
    inputUnit: 'oz',
    inputLabel: 'Ounces',
    placeholder: '8',
    defaultValue: '8',
    needsIngredient: true,
    showCupStandard: true,
    showSpoonStandard: false,
    defaultIngredient: 'water',
  },
  'tablespoons-to-cups': {
    inputUnit: 'tbsp',
    inputLabel: 'Tablespoons',
    placeholder: '12',
    defaultValue: '12',
    needsIngredient: false,
    showCupStandard: true,
    showSpoonStandard: true,
    defaultIngredient: 'butter',
  },
  'sticks-of-butter': {
    inputUnit: 'stick',
    inputLabel: 'Sticks of butter',
    placeholder: '1 1/2',
    defaultValue: '1',
    needsIngredient: false,
    showCupStandard: false,
    showSpoonStandard: false,
    defaultIngredient: 'butter',
  },
}

function parseAmount(raw: string): number | null {
  const s = normaliseInput(raw)
  if (!s) return null
  const mixed = /^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s)
  if (mixed) {
    const den = Number(mixed[3])
    if (!den) return null
    return Number(mixed[1]) + Number(mixed[2]) / den
  }
  const frac = /^(-?\d+)\s*\/\s*(\d+)$/.exec(s)
  if (frac) {
    const den = Number(frac[2])
    if (!den) return null
    return Number(frac[1]) / den
  }
  const plain = /^-?(\d+\.?\d*|\.\d+)/.exec(s)
  if (!plain) return null
  const n = Number(plain[0])
  return Number.isFinite(n) ? n : null
}

function num(value: number, dp = 2): string {
  return formatValue(new D(value), dp)
}

function cupsText(cups: number): string {
  const rounded = formatFraction(new D(cups), 8)
  const decimal = formatValue(new D(cups), 2)
  return `${rounded} cup${Math.abs(cups) === 1 ? '' : 's'} (${decimal})`
}

export default function UnitsLifeKitchenConverter({ mode }: Props) {
  const cfg = MODES[mode]
  const uid = useId()

  const [ingredientId, setIngredientId] = useState(cfg.defaultIngredient)
  const [cupStandard, setCupStandard] = useState<CupStandardId>('us-customary')
  const [spoonStandard, setSpoonStandard] = useState<SpoonId>('us-tbsp')
  const [amountText, setAmountText] = useState(cfg.defaultValue)

  useEffect(() => {
    setIngredientId(cfg.defaultIngredient)
    setAmountText(cfg.defaultValue)
  }, [cfg])

  const ingredient = INGREDIENT_BY_ID[ingredientId] ?? INGREDIENTS[0]
  const density = densityOf(ingredient)
  const cupMl = CUP_STANDARDS[cupStandard].ml
  const tbspMl = SPOONS[spoonStandard].ml
  // Teaspoons are 5 mL with metric and Australian spoons (so 4 to an Australian tablespoon).
  const tspMl = !cfg.showSpoonStandard ? US_TEASPOON_ML : spoonStandard === 'us-tbsp' ? tbspMl / 3 : 5

  const amount = useMemo(() => parseAmount(amountText), [amountText])

  const result = useMemo(() => {
    if (amount === null) return null
    const unit = cfg.inputUnit
    let volumeMl: number
    let massG: number
    if (unit === 'stick') {
      massG = amount * BUTTER_STICK_GRAMS
      volumeMl = amount * STICK_ML
    } else if (unit in MASS_G) {
      massG = amount * MASS_G[unit]
      volumeMl = massG / density
    } else {
      const perMl: Record<string, number> = {
        ml: 1,
        l: 1000,
        cup: cupMl,
        tbsp: tbspMl,
        tsp: tspMl,
        floz: US_FLUID_OUNCE_ML,
      }
      volumeMl = amount * (perMl[unit] ?? 1)
      massG = volumeMl * density
    }
    return {
      volumeMl,
      massG,
      cups: volumeMl / cupMl,
      tbsp: volumeMl / tbspMl,
      tsp: volumeMl / tspMl,
      flozUs: volumeMl / US_FLUID_OUNCE_ML,
      flozUk: volumeMl / IMPERIAL_FLUID_OUNCE_ML,
      oz: massG / 28.349523125,
      lb: massG / 453.59237,
      sticks: massG / BUTTER_STICK_GRAMS,
    }
  }, [amount, cfg.inputUnit, cupMl, density, tbspMl, tspMl])

  /* `oz-to-cups` answers two different questions at once. */
  const ozBoth = useMemo(() => {
    if (mode !== 'oz-to-cups' || amount === null) return null
    const fluidMl = amount * US_FLUID_OUNCE_ML
    const weightG = amount * 28.349523125
    return {
      fluidCups: fluidMl / cupMl,
      fluidMl,
      weightG,
      weightCups: weightG / density / cupMl,
    }
  }, [amount, cupMl, density, mode])

  const ingredientSelect = (
    <div className="space-y-1.5">
      <Label htmlFor={`${uid}-ingredient`}>
        Ingredient{cfg.needsIngredient ? '' : ' (optional, only needed for grams)'}
      </Label>
      <Select value={ingredientId} onValueChange={setIngredientId}>
        <SelectTrigger id={`${uid}-ingredient`} className="w-full">
          <SelectValue placeholder="Choose an ingredient" />
        </SelectTrigger>
        <SelectContent className="max-h-[340px]">
          {INGREDIENT_GROUPS.map((group) => (
            <SelectGroup key={group}>
              <SelectLabel>{group}</SelectLabel>
              {INGREDIENTS.filter((i) => i.group === group).map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {QUICK_PICKS.map((id) => {
          const q = INGREDIENT_BY_ID[id]
          if (!q) return null
          const short = q.name.split(',')[0]
          return (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={ingredientId === id ? 'default' : 'outline'}
              onClick={() => setIngredientId(id)}
              aria-pressed={ingredientId === id}
            >
              {short}
            </Button>
          )
        })}
      </div>
      <p className="pt-1 text-sm text-muted-foreground text-pretty">
        {ingredient.name}: <strong className="text-foreground">{ingredient.gramsPerCup} g</strong> per
        US cup (236.6 mL), a density of {num(density, 3)} g/mL.
        {ingredient.note ? ` ${ingredient.note}` : ''}
      </p>
    </div>
  )

  const stats: { label: string; value: string; hint?: string }[] = []
  if (result) {
    switch (mode) {
      case 'grams-to-cups':
        stats.push(
          { label: 'Cups', value: cupsText(result.cups), hint: `Rounded to the nearest eighth of a ${CUP_STANDARDS[cupStandard].label.toLowerCase()}.` },
          { label: 'Tablespoons', value: `${num(result.tbsp, 1)} tbsp`, hint: '16 US tablespoons make a US cup.' },
          { label: 'Teaspoons', value: `${num(result.tsp, 1)} tsp`, hint: 'Useful for small amounts of raising agents and spices.' },
          { label: 'Volume', value: `${num(result.volumeMl, 0)} mL`, hint: 'The space this weight of the ingredient occupies.' },
          { label: 'Ounces (weight)', value: `${num(result.oz, 2)} oz`, hint: 'Avoirdupois ounces, not fluid ounces.' },
          { label: 'Pounds', value: `${num(result.lb, 3)} lb`, hint: '16 ounces to the pound.' },
        )
        break
      case 'cups-to-grams':
        stats.push(
          { label: 'Grams', value: `${num(result.massG, 1)} g`, hint: 'The number to punch into your scale.' },
          { label: 'Ounces (weight)', value: `${num(result.oz, 2)} oz`, hint: 'For scales set to imperial.' },
          { label: 'Millilitres', value: `${num(result.volumeMl, 0)} mL`, hint: `Using the ${CUP_STANDARDS[cupStandard].label}.` },
          { label: 'Tablespoons', value: `${num(result.tbsp, 1)} tbsp`, hint: 'Handy when you are short one cup measure.' },
          { label: 'Teaspoons', value: `${num(result.tsp, 0)} tsp`, hint: 'Three teaspoons per US tablespoon.' },
          { label: 'Pounds', value: `${num(result.lb, 3)} lb`, hint: 'For bulk baking.' },
        )
        break
      case 'ml-to-cups':
        stats.push(
          { label: 'US customary cups', value: cupsText(result.volumeMl / CUP_STANDARDS['us-customary'].ml), hint: '236.6 mL, the cup in most American recipes.' },
          { label: 'US legal cups', value: cupsText(result.volumeMl / CUP_STANDARDS['us-legal'].ml), hint: '240 mL, used on nutrition labels.' },
          { label: 'Metric cups (AU/NZ)', value: cupsText(result.volumeMl / CUP_STANDARDS.metric.ml), hint: '250 mL, in Australian and New Zealand recipes.' },
          { label: 'Imperial cups (old UK)', value: cupsText(result.volumeMl / CUP_STANDARDS.imperial.ml), hint: '284.1 mL, in pre-metric British cookbooks.' },
          { label: 'US fluid ounces', value: `${num(result.flozUs, 2)} fl oz`, hint: '29.57 mL each.' },
          { label: 'Imperial fluid ounces', value: `${num(result.flozUk, 2)} fl oz`, hint: '28.41 mL each, the UK measure.' },
          { label: 'Tablespoons', value: `${num(result.tbsp, 1)} tbsp`, hint: 'US tablespoons of 14.79 mL.' },
          { label: `Weight as ${ingredient.name.toLowerCase()}`, value: `${num(result.massG, 1)} g`, hint: 'Change the ingredient below to weigh something other than water.' },
        )
        break
      case 'oz-to-cups':
        stats.push(
          { label: 'Tablespoons', value: `${num(result.tbsp, 1)} tbsp`, hint: 'By weight, using the selected ingredient.' },
          { label: 'Millilitres (by weight)', value: `${num(result.volumeMl, 0)} mL`, hint: 'The volume this weight occupies.' },
          { label: 'Grams', value: `${num(result.massG, 1)} g`, hint: 'One weight ounce is 28.35 g.' },
        )
        break
      case 'tablespoons-to-cups':
        stats.push(
          { label: 'Cups', value: cupsText(result.cups), hint: `${num(cupMl / tbspMl, 2)} tablespoons make one cup at these standards.` },
          { label: 'Teaspoons', value: `${num(result.tsp, 1)} tsp`, hint: 'Three teaspoons per tablespoon.' },
          { label: 'Millilitres', value: `${num(result.volumeMl, 1)} mL`, hint: `Using the ${SPOONS[spoonStandard].label}.` },
          { label: 'US fluid ounces', value: `${num(result.flozUs, 2)} fl oz`, hint: 'Two US tablespoons per fluid ounce.' },
          { label: 'Grams', value: `${num(result.massG, 1)} g`, hint: `As ${ingredient.name.toLowerCase()}.` },
          { label: 'Sticks of butter', value: `${num(result.sticks, 2)} sticks`, hint: 'Only meaningful if you picked butter.' },
        )
        break
      case 'sticks-of-butter':
        stats.push(
          { label: 'Grams', value: `${num(result.massG, 1)} g`, hint: 'One stick is exactly a quarter pound: 113.4 g.' },
          { label: 'Ounces', value: `${num(result.oz, 2)} oz`, hint: 'Four ounces per stick.' },
          { label: 'US cups', value: cupsText(result.volumeMl / CUP_STANDARDS['us-customary'].ml), hint: 'Half a cup per stick.' },
          { label: 'Tablespoons', value: `${num(result.tbsp, 1)} tbsp`, hint: 'Eight per stick. The wrapper has a mark for each.' },
          { label: 'Teaspoons', value: `${num(result.tsp, 0)} tsp`, hint: '24 teaspoons per stick.' },
          { label: 'Pounds', value: `${num(result.lb, 3)} lb`, hint: 'Four sticks make a pound block.' },
        )
        break
    }
  }

  const formulaLines = useMemo(() => {
    if (!result || amount === null) return null
    switch (mode) {
      case 'grams-to-cups':
        return [
          'cups = grams ÷ (grams per cup)',
          `grams per cup = ${ingredient.gramsPerCup} g × (${num(cupMl, 2)} mL ÷ ${num(REFERENCE_CUP_ML, 1)} mL) = ${num((ingredient.gramsPerCup * cupMl) / REFERENCE_CUP_ML, 2)} g`,
          `cups = ${num(amount, 2)} ÷ ${num((ingredient.gramsPerCup * cupMl) / REFERENCE_CUP_ML, 2)}`,
          `cups = ${num(result.cups, 3)}`,
        ]
      case 'cups-to-grams':
        return [
          'grams = cups × (grams per cup)',
          `grams per cup = ${ingredient.gramsPerCup} g × (${num(cupMl, 2)} mL ÷ ${num(REFERENCE_CUP_ML, 1)} mL) = ${num((ingredient.gramsPerCup * cupMl) / REFERENCE_CUP_ML, 2)} g`,
          `grams = ${num(amount, 3)} × ${num((ingredient.gramsPerCup * cupMl) / REFERENCE_CUP_ML, 2)}`,
          `grams = ${num(result.massG, 1)} g`,
        ]
      case 'ml-to-cups':
        return [
          'cups = millilitres ÷ (millilitres per cup)',
          `cups = ${num(amount, 1)} ÷ ${num(cupMl, 4)}`,
          `cups = ${num(result.cups, 3)}   (${CUP_STANDARDS[cupStandard].label})`,
        ]
      case 'oz-to-cups':
        return [
          'As a fluid ounce (volume):',
          `  cups = ${num(amount, 2)} × ${num(US_FLUID_OUNCE_ML, 4)} mL ÷ ${num(cupMl, 4)} mL = ${num(ozBoth?.fluidCups ?? 0, 3)}`,
          '',
          'As a weight ounce (mass):',
          `  grams = ${num(amount, 2)} × 28.349523125 = ${num(ozBoth?.weightG ?? 0, 1)} g`,
          `  cups  = ${num(ozBoth?.weightG ?? 0, 1)} g ÷ ${num((ingredient.gramsPerCup * cupMl) / REFERENCE_CUP_ML, 2)} g per cup = ${num(ozBoth?.weightCups ?? 0, 3)}`,
        ]
      case 'tablespoons-to-cups':
        return [
          'cups = tablespoons × (mL per tablespoon) ÷ (mL per cup)',
          `cups = ${num(amount, 2)} × ${num(tbspMl, 4)} ÷ ${num(cupMl, 4)}`,
          `cups = ${num(result.cups, 3)}`,
        ]
      case 'sticks-of-butter':
        return [
          'One US stick = 1/4 lb = 113.3980925 g = 1/2 US cup = 8 tbsp',
          `grams = ${num(amount, 3)} × 113.3980925`,
          `grams = ${num(result.massG, 1)} g`,
          `cups  = ${num(amount, 3)} × 0.5 = ${num(result.volumeMl / CUP_STANDARDS['us-customary'].ml, 3)}`,
        ]
    }
  }, [amount, cupMl, cupStandard, ingredient, mode, ozBoth, result, tbspMl])

  /* ---- reference tables ---- */
  const gramRows = [10, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000]
  const cupRows = [0.125, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4]
  const mlRows = [5, 15, 30, 50, 60, 100, 118, 125, 150, 200, 236.6, 240, 250, 300, 473, 500, 750, 1000]
  const tbspRows = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 32]
  const stickRows = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8]

  const gramsPerCupHere = (ingredient.gramsPerCup * cupMl) / REFERENCE_CUP_ML

  const copyValue = result
    ? mode === 'grams-to-cups'
      ? `${num(amount ?? 0, 1)} g ${ingredient.name} = ${formatFraction(new D(result.cups), 8)} cups`
      : mode === 'cups-to-grams'
        ? `${amountText.trim()} cups ${ingredient.name} = ${num(result.massG, 1)} g`
        : mode === 'sticks-of-butter'
          ? `${amountText.trim()} sticks butter = ${num(result.massG, 1)} g`
          : `${amountText.trim()} ${cfg.inputLabel.toLowerCase()} = ${num(result.volumeMl, 1)} mL`
    : ''

  return (
    <div className="space-y-6">
      <ToolPanel
        title="Convert"
        description="Everything is worked out in this page. No recipe, ingredient or measurement is sent anywhere."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-amount`}>{cfg.inputLabel}</Label>
            <Input
              id={`${uid}-amount`}
              inputMode="decimal"
              autoComplete="off"
              className="text-lg tabular-nums"
              placeholder={cfg.placeholder}
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Fractions are fine: type 1 1/2, 3/4 or 1.5.
            </p>
          </div>

          {cfg.showCupStandard ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-cup`}>Which cup?</Label>
              <Select value={cupStandard} onValueChange={(v) => setCupStandard(v as CupStandardId)}>
                <SelectTrigger id={`${uid}-cup`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CUP_STANDARDS).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Cups are not standardised. Picking the wrong one is a 5–20% error.
              </p>
            </div>
          ) : null}

          {cfg.showSpoonStandard ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-spoon`}>Which tablespoon?</Label>
              <Select value={spoonStandard} onValueChange={(v) => setSpoonStandard(v as SpoonId)}>
                <SelectTrigger id={`${uid}-spoon`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SPOONS) as SpoonId[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {SPOONS[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Australia's tablespoon is 20 mL, a third bigger than the 15 mL tablespoon used elsewhere.
              </p>
            </div>
          ) : null}
        </div>

        {mode !== 'sticks-of-butter' ? ingredientSelect : null}
      </ToolPanel>

      {amount === null && amountText.trim() ? (
        <ErrorNote
          title="Check that amount"
          message={`“${amountText.trim()}” isn’t a number we can read. Try 250, 1.5 or 1 1/2.`}
        />
      ) : null}

      <div role="status" aria-live="polite" className="space-y-4">
        {mode === 'oz-to-cups' && ozBoth ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultStat
              label="If you mean fluid ounces (volume)"
              value={cupsText(ozBoth.fluidCups)}
              hint={`${num(amount ?? 0, 2)} fl oz = ${num(ozBoth.fluidMl, 1)} mL. This is what a US recipe means when it says "8 oz of milk".`}
              emphasis
            />
            <ResultStat
              label="If you mean weight ounces (mass)"
              value={cupsText(ozBoth.weightCups)}
              hint={`${num(amount ?? 0, 2)} oz = ${num(ozBoth.weightG, 1)} g of ${ingredient.name.toLowerCase()}. This is what a recipe means when it says "8 oz of flour".`}
              emphasis
            />
          </div>
        ) : null}

        {result && mode !== 'oz-to-cups' ? (
          <ResultStat
            label={
              mode === 'cups-to-grams'
                ? 'Weight'
                : mode === 'sticks-of-butter'
                  ? 'Butter'
                  : 'In cups'
            }
            value={
              mode === 'cups-to-grams'
                ? `${num(result.massG, 1)} g`
                : mode === 'sticks-of-butter'
                  ? `${num(result.massG, 1)} g`
                  : cupsText(result.cups)
            }
            hint={
              mode === 'cups-to-grams'
                ? `${amountText.trim()} cups of ${ingredient.name.toLowerCase()} at ${num(gramsPerCupHere, 1)} g per cup.`
                : mode === 'sticks-of-butter'
                  ? `${amountText.trim()} stick(s). The wrapper markings are 8 tablespoons per stick.`
                  : `Measured with the ${CUP_STANDARDS[cupStandard].label}.`
            }
            emphasis
          />
        ) : null}

        {result ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((s) => (
              <ResultStat key={s.label} label={s.label} value={s.value} hint={s.hint} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
            Enter an amount above to see the conversion.
          </p>
        )}

        {copyValue ? <CopyButton value={copyValue} label="Copy the answer" /> : null}
      </div>

      {formulaLines ? (
        <ToolPanel title="The working" description="Your numbers, substituted into the arithmetic.">
          <Formula caption="Densities are typical values for a normally handled ingredient. The note above shows how much handling changes them.">
            {formulaLines.join('\n')}
          </Formula>
        </ToolPanel>
      ) : null}

      {mode === 'grams-to-cups' ? (
        <ToolPanel
          title={`Grams to cups for ${ingredient.name.toLowerCase()}`}
          description={`At ${num(gramsPerCupHere, 1)} g per ${CUP_STANDARDS[cupStandard].label.toLowerCase()}.`}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grams</TableHead>
                  <TableHead>Cups</TableHead>
                  <TableHead>Tablespoons</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gramRows.map((g) => (
                  <TableRow key={g}>
                    <TableCell className="font-medium tabular-nums">{g} g</TableCell>
                    <TableCell className="tabular-nums">{formatFraction(new D(g / gramsPerCupHere), 8)}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {num((g / density / tbspMl), 1)} tbsp
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      ) : null}

      {mode === 'grams-to-cups' && amount !== null ? (
        <ToolPanel
          title={`${num(amount, 0)} g in cups, by ingredient`}
          description="The same weight is a very different number of cups depending on what it is."
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Cups</TableHead>
                  <TableHead>g per cup</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {QUICK_PICKS.map((id) => {
                  const ing = INGREDIENT_BY_ID[id]
                  if (!ing) return null
                  const perCup = (ing.gramsPerCup * cupMl) / REFERENCE_CUP_ML
                  return (
                    <TableRow key={id} className={cn(id === ingredientId && 'bg-background font-semibold')}>
                      <TableCell className="font-medium">{ing.name}</TableCell>
                      <TableCell className="tabular-nums">{formatFraction(new D(amount / perCup), 8)}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{num(perCup, 0)} g</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      ) : null}

      {mode === 'cups-to-grams' ? (
        <ToolPanel
          title={`Cups to grams for ${ingredient.name.toLowerCase()}`}
          description={`Using the ${CUP_STANDARDS[cupStandard].label}.`}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cups</TableHead>
                  <TableHead>Grams</TableHead>
                  <TableHead>Ounces</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cupRows.map((c) => (
                  <TableRow key={c}>
                    <TableCell className="font-medium tabular-nums">{formatFraction(new D(c), 24)}</TableCell>
                    <TableCell className="tabular-nums">{num(c * gramsPerCupHere, 1)} g</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {num((c * gramsPerCupHere) / 28.349523125, 2)} oz
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      ) : null}

      {mode === 'ml-to-cups' ? (
        <ToolPanel title="Millilitres to cups in every standard" description="One table, four different cups.">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>mL</TableHead>
                  <TableHead>US cups</TableHead>
                  <TableHead>Metric cups</TableHead>
                  <TableHead>UK imperial cups</TableHead>
                  <TableHead>US fl oz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mlRows.map((ml) => (
                  <TableRow key={ml}>
                    <TableCell className="font-medium tabular-nums">{ml} mL</TableCell>
                    <TableCell className="tabular-nums">
                      {formatFraction(new D(ml / CUP_STANDARDS['us-customary'].ml), 8)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatFraction(new D(ml / CUP_STANDARDS.metric.ml), 8)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatFraction(new D(ml / CUP_STANDARDS.imperial.ml), 8)}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {num(ml / US_FLUID_OUNCE_ML, 2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      ) : null}

      {mode === 'oz-to-cups' ? (
        <ToolPanel
          title="Fluid ounces and weight ounces, side by side"
          description="The two columns agree only for water, which is where the confusion comes from."
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ounces</TableHead>
                  <TableHead>As fluid oz → US cups</TableHead>
                  <TableHead>As weight oz → grams</TableHead>
                  <TableHead>As weight oz → cups</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24, 32].map((oz) => (
                  <TableRow key={oz}>
                    <TableCell className="font-medium tabular-nums">{oz} oz</TableCell>
                    <TableCell className="tabular-nums">
                      {formatFraction(new D((oz * US_FLUID_OUNCE_ML) / cupMl), 8)}
                    </TableCell>
                    <TableCell className="tabular-nums">{num(oz * 28.349523125, 0)} g</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatFraction(new D((oz * 28.349523125) / gramsPerCupHere), 8)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      ) : null}

      {mode === 'tablespoons-to-cups' ? (
        <ToolPanel
          title="Tablespoons to cups"
          description={`Using the ${SPOONS[spoonStandard].label} and the ${CUP_STANDARDS[cupStandard].label}.`}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tablespoons</TableHead>
                  <TableHead>Cups</TableHead>
                  <TableHead>Teaspoons</TableHead>
                  <TableHead>Millilitres</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tbspRows.map((t) => (
                  <TableRow key={t}>
                    <TableCell className="font-medium tabular-nums">{t} tbsp</TableCell>
                    <TableCell className="tabular-nums">
                      {formatFraction(new D((t * tbspMl) / cupMl), 16)}
                    </TableCell>
                    <TableCell className="tabular-nums">{num((t * tbspMl) / tspMl, 2)} tsp</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {num(t * tbspMl, 1)} mL
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      ) : null}

      {mode === 'sticks-of-butter' ? (
        <ToolPanel title="Butter conversion chart" description="Sticks, grams, ounces, cups and tablespoons.">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sticks</TableHead>
                  <TableHead>Grams</TableHead>
                  <TableHead>Ounces</TableHead>
                  <TableHead>US cups</TableHead>
                  <TableHead>Tablespoons</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stickRows.map((s) => (
                  <TableRow key={s}>
                    <TableCell className="font-medium tabular-nums">{formatFraction(new D(s), 4)}</TableCell>
                    <TableCell className="tabular-nums">{num(s * BUTTER_STICK_GRAMS, 1)} g</TableCell>
                    <TableCell className="tabular-nums">{num(s * 4, 2)} oz</TableCell>
                    <TableCell className="tabular-nums">{formatFraction(new D(s * 0.5), 8)}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{num(s * 8, 1)} tbsp</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      ) : null}

      <p className="flex items-start gap-2 rounded-lg bg-muted p-4 text-sm text-muted-foreground text-pretty">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Volume measures are an approximation of weight. If a recipe matters (bread, pastry,
          macarons), weigh it. A cheap digital scale removes every source of error on this page.
        </span>
      </p>
    </div>
  )
}
