import { useMemo, useState } from 'react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ACTIVITY_LEVELS,
  CalcLayout,
  EmptyState,
  EstimateNote,
  FormulaBlock,
  HeightField,
  Interpretation,
  NumberField,
  Segmented,
  SexToggle,
  StatGrid,
  UnitToggle,
  WeightField,
  activityById,
  fmt,
  kcal,
  mifflinStJeor,
  useUnitSystem,
  type Sex,
} from './common'

type PresetId = 'balanced' | 'low-carb' | 'high-protein' | 'keto' | 'custom'

interface Preset {
  id: PresetId
  label: string
  protein: number
  carb: number
  fat: number
  blurb: string
}

const PRESETS: Preset[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    protein: 30,
    carb: 40,
    fat: 30,
    blurb:
      'The default for general health and mixed training. Enough carbohydrate to fuel hard sessions, enough fat for hormones and satiety.',
  },
  {
    id: 'low-carb',
    label: 'Low carb',
    protein: 35,
    carb: 25,
    fat: 40,
    blurb:
      'Useful if you find carbs hard to stop eating, or if steady blood sugar suits your day better. Not inherently better for fat loss at matched calories.',
  },
  {
    id: 'high-protein',
    label: 'High protein',
    protein: 40,
    carb: 35,
    fat: 25,
    blurb:
      'Best in a calorie deficit: protein is the most satiating macro and does the most to protect muscle while you lose fat.',
  },
  {
    id: 'keto',
    label: 'Keto',
    protein: 20,
    carb: 5,
    fat: 75,
    blurb:
      'Very low carbohydrate (usually under 50 g a day) to keep ketone production going. Expect a flat week or two while you adapt.',
  },
  {
    id: 'custom',
    label: 'Custom',
    protein: 30,
    carb: 40,
    fat: 30,
    blurb: 'Set your own split with the sliders. Carbohydrate takes whatever is left over.',
  },
]

const KCAL_PER_G = { protein: 4, carb: 4, fat: 9 }

const MACRO_META = [
  { key: 'protein' as const, label: 'Protein', tone: 'bg-chart-1', stroke: 'stroke-chart-1' },
  { key: 'carb' as const, label: 'Carbohydrate', tone: 'bg-chart-2', stroke: 'stroke-chart-2' },
  { key: 'fat' as const, label: 'Fat', tone: 'bg-chart-4', stroke: 'stroke-chart-4' },
]

function Donut({ protein, carb, fat }: { protein: number; carb: number; fat: number }) {
  const r = 54
  const c = 2 * Math.PI * r
  const parts = [protein, carb, fat]
  // A small gap between slices, so neighbouring greys never touch.
  const gap = parts.filter((p) => p > 0).length > 1 ? 2 : 0
  let offset = 0
  return (
    <svg
      viewBox="0 0 140 140"
      className="mx-auto size-40 shrink-0"
      role="img"
      aria-label={`Macro split: ${protein} percent protein, ${carb} percent carbohydrate, ${fat} percent fat.`}
    >
      <circle cx="70" cy="70" r={r} fill="none" strokeWidth="18" className="stroke-muted" />
      {parts.map((p, i) => {
        const len = (p / 100) * c
        const el = (
          <circle
            key={MACRO_META[i]!.key}
            cx="70"
            cy="70"
            r={r}
            fill="none"
            strokeWidth="18"
            strokeDasharray={`${Math.max(0, len - gap).toFixed(2)} ${(c - len + gap).toFixed(2)}`}
            strokeDashoffset={(-offset).toFixed(2)}
            transform="rotate(-90 70 70)"
            className={MACRO_META[i]!.stroke}
          />
        )
        offset += len
        return el
      })}
      <text x="70" y="66" textAnchor="middle" className="fill-muted-foreground text-[10px]">
        split
      </text>
      <text x="70" y="82" textAnchor="middle" className="fill-foreground text-[15px] font-semibold">
        {protein}/{carb}/{fat}
      </text>
    </svg>
  )
}

export default function MacroCalculator() {
  const [units, setUnits] = useUnitSystem()
  const [mode, setMode] = useState('known')
  const [calories, setCalories] = useState(2200)
  const [presetId, setPresetId] = useState<PresetId>('balanced')
  const [customP, setCustomP] = useState(30)
  const [customF, setCustomF] = useState(30)
  const [meals, setMeals] = useState(3)

  // Optional calorie estimator
  const [sex, setSex] = useState<Sex>('male')
  const [cm, setCm] = useState(178)
  const [kg, setKg] = useState(78)
  const [age, setAge] = useState(30)
  const [activity, setActivity] = useState('moderate')
  const [goalPct, setGoalPct] = useState('0')

  const level = activityById(activity)
  const estimateValid = cm >= 90 && cm <= 260 && kg > 0 && age >= 15 && age <= 100
  const estimated = estimateValid
    ? mifflinStJeor(sex, kg, cm, age) * level.multiplier * (1 + Number(goalPct) / 100)
    : NaN

  const effectiveCalories = mode === 'estimate' ? estimated : calories
  const valid = Number.isFinite(effectiveCalories) && effectiveCalories >= 800 && effectiveCalories <= 8000

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]
  const split = useMemo(() => {
    if (presetId !== 'custom') return { protein: preset.protein, carb: preset.carb, fat: preset.fat }
    const p = Math.round(customP)
    const f = Math.min(Math.round(customF), 100 - p)
    return { protein: p, carb: Math.max(0, 100 - p - f), fat: f }
  }, [presetId, preset, customP, customF])

  const grams = {
    protein: (effectiveCalories * (split.protein / 100)) / KCAL_PER_G.protein,
    carb: (effectiveCalories * (split.carb / 100)) / KCAL_PER_G.carb,
    fat: (effectiveCalories * (split.fat / 100)) / KCAL_PER_G.fat,
  }
  const cals = {
    protein: effectiveCalories * (split.protein / 100),
    carb: effectiveCalories * (split.carb / 100),
    fat: effectiveCalories * (split.fat / 100),
  }

  // Weight is only entered on the estimate tab; a hidden value must not be used.
  const proteinPerKg = mode === 'estimate' && kg > 0 ? grams.protein / kg : NaN
  const fibre = (effectiveCalories / 1000) * 14

  const summary = valid
    ? [
        `Daily calories: ${Math.round(effectiveCalories)} kcal`,
        `Split (${preset.label}): ${split.protein}% protein / ${split.carb}% carbs / ${split.fat}% fat`,
        '',
        `Protein: ${Math.round(grams.protein)} g  (${Math.round(cals.protein)} kcal)`,
        `Carbs:   ${Math.round(grams.carb)} g  (${Math.round(cals.carb)} kcal)`,
        `Fat:     ${Math.round(grams.fat)} g  (${Math.round(cals.fat)} kcal)`,
        `Fibre target: ${Math.round(fibre)} g`,
        '',
        `Per meal across ${meals} meals: ${Math.round(grams.protein / meals)} g P / ${Math.round(grams.carb / meals)} g C / ${Math.round(grams.fat / meals)} g F`,
        '',
        'Calculated at onthisdevice.com/macro-calculator',
      ].join('\n')
    : ''

  return (
    <CalcLayout
      inputs={
        <ToolPanel title="Calories and split">
          <div className="space-y-4">
            <UnitToggle units={units} onChange={setUnits} className="max-w-none" />

            <Tabs value={mode} onValueChange={setMode}>
              <TabsList className="w-full">
                <TabsTrigger value="known" className="flex-1">
                  I know my calories
                </TabsTrigger>
                <TabsTrigger value="estimate" className="flex-1">
                  Estimate them
                </TabsTrigger>
              </TabsList>
              <TabsContent value="known" className="mt-4">
                <NumberField
                  id="macro-cals"
                  label="Daily calorie target"
                  value={calories}
                  onChange={setCalories}
                  unit="kcal"
                  min={800}
                  max={8000}
                  step={50}
                  dp={0}
                  hint="Not sure? Switch to the estimate tab, or use the TDEE calculator."
                />
              </TabsContent>
              <TabsContent value="estimate" className="mt-4 space-y-4">
                <SexToggle sex={sex} onChange={setSex} />
                <HeightField id="macro-height" cm={cm} onChange={setCm} units={units} />
                <WeightField id="macro-weight" kg={kg} onChange={setKg} units={units} />
                <NumberField
                  id="macro-age"
                  label="Age"
                  value={age}
                  onChange={setAge}
                  unit="years"
                  min={15}
                  max={100}
                  dp={0}
                />
                <div className="space-y-1.5">
                  <Label htmlFor="macro-activity">Activity level</Label>
                  <select
                    id="macro-activity"
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {ACTIVITY_LEVELS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label} (×{a.multiplier})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">{level.description}</p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Goal</span>
                  <Segmented
                    label="Calorie goal"
                    value={goalPct}
                    onChange={setGoalPct}
                    options={[
                      { value: '-20', label: 'Cut −20%' },
                      { value: '0', label: 'Maintain' },
                      { value: '10', label: 'Bulk +10%' },
                    ]}
                  />
                  {estimateValid ? (
                    <p className="text-xs text-muted-foreground">
                      Estimated target: <strong>{kcal(estimated)}</strong> a day.
                    </p>
                  ) : null}
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <span className="text-sm font-medium">Diet preset</span>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={p.id === presetId}
                    onClick={() => {
                      setPresetId(p.id)
                      if (p.id !== 'custom') {
                        setCustomP(p.protein)
                        setCustomF(p.fat)
                      }
                    }}
                    className={`rounded-lg p-2.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                      p.id === presetId
                        ? 'font-medium ring-2 ring-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <span className="block">{p.label}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {p.id === 'custom'
                        ? `${split.protein}/${split.carb}/${split.fat}`
                        : `${p.protein}/${p.carb}/${p.fat}`}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{preset.blurb}</p>
            </div>

            {presetId === 'custom' ? (
              <div className="space-y-4 rounded-lg bg-muted p-3">
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="macro-p">Protein</Label>
                    <span className="text-sm tabular-nums">{split.protein}%</span>
                  </div>
                  <Slider
                    id="macro-p"
                    min={5}
                    max={60}
                    step={1}
                    value={[customP]}
                    onValueChange={(v) => setCustomP(v[0] ?? 30)}
                    aria-label="Protein percentage"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="macro-f">Fat</Label>
                    <span className="text-sm tabular-nums">{split.fat}%</span>
                  </div>
                  <Slider
                    id="macro-f"
                    min={10}
                    max={80}
                    step={1}
                    value={[customF]}
                    onValueChange={(v) => setCustomF(v[0] ?? 30)}
                    aria-label="Fat percentage"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Carbohydrate takes the remainder: <strong>{split.carb}%</strong>.
                </p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Meals per day</span>
              <Segmented
                label="Meals per day"
                value={String(meals)}
                onChange={(v) => setMeals(Number(v))}
                options={[
                  { value: '3', label: '3' },
                  { value: '4', label: '4' },
                  { value: '5', label: '5' },
                  { value: '6', label: '6' },
                ]}
              />
            </div>

            <EstimateNote>
              Macro targets are a planning tool, not a prescription. Anyone with kidney disease,
              diabetes, or a history of disordered eating should agree a split with a clinician
              before following one.
            </EstimateNote>
          </div>
        </ToolPanel>
      }
      results={
        valid ? (
          <>
            <ToolPanel
              title="Your daily macros"
              footer={<CopyButton value={summary} label="Copy macros" />}
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <Donut protein={split.protein} carb={split.carb} fat={split.fat} />
                <div className="min-w-0 flex-1 space-y-2">
                  {MACRO_META.map((m) => (
                    <div key={m.key} className="rounded-lg bg-muted p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span aria-hidden="true" className={`size-2.5 rounded-full ${m.tone}`} />
                          {m.label}
                        </span>
                        <span className="text-lg font-semibold tabular-nums">
                          {Math.round(grams[m.key])} g
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        {split[m.key]}% of calories · {Math.round(cals[m.key])} kcal ·{' '}
                        {KCAL_PER_G[m.key]} kcal per gram
                      </p>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${m.tone}`}
                          style={{ width: `${split[m.key]}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <StatGrid cols={3}>
                  <ResultStat
                    label="Daily calories"
                    value={kcal(effectiveCalories)}
                    hint={`${split.protein}/${split.carb}/${split.fat} split`}
                    emphasis
                  />
                  <ResultStat
                    label="Protein per kg"
                    value={Number.isFinite(proteinPerKg) ? `${fmt(proteinPerKg, 2)} g/kg` : '–'}
                    hint={
                      !Number.isFinite(proteinPerKg)
                        ? 'use “Estimate them” with your weight to check this'
                        : proteinPerKg < 1.2
                          ? 'below the 1.2–2.2 g/kg range most active people aim for'
                          : proteinPerKg > 2.5
                            ? 'more than most people need; the calories may be better spent elsewhere'
                            : 'inside the range that supports training and satiety'
                    }
                  />
                  <ResultStat
                    label="Fibre target"
                    value={`${Math.round(fibre)} g`}
                    hint="14 g per 1,000 kcal (US Dietary Guidelines)"
                  />
                </StatGrid>
              </div>
            </ToolPanel>

            <ToolPanel
              title={`Per meal across ${meals} meals`}
              description="An even split, to use as a rough template."
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[24rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Macro
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Per meal
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Per day
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Calories / day
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {MACRO_META.map((m) => (
                      <tr key={m.key} className="border-b border-border last:border-0">
                        <th scope="row" className="py-2 pr-3 text-left font-normal">
                          {m.label}
                        </th>
                        <td className="py-2 pr-3 font-medium tabular-nums">
                          {Math.round(grams[m.key] / meals)} g
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{Math.round(grams[m.key])} g</td>
                        <td className="py-2 tabular-nums text-muted-foreground">
                          {Math.round(cals[m.key])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ToolPanel>

            <FormulaBlock
              lines={[
                {
                  label: 'Protein',
                  expr: `${Math.round(effectiveCalories)} kcal × ${split.protein}% ÷ 4 kcal/g`,
                  result: `${Math.round(grams.protein)} g`,
                },
                {
                  label: 'Carbohydrate',
                  expr: `${Math.round(effectiveCalories)} kcal × ${split.carb}% ÷ 4 kcal/g`,
                  result: `${Math.round(grams.carb)} g`,
                },
                {
                  label: 'Fat',
                  expr: `${Math.round(effectiveCalories)} kcal × ${split.fat}% ÷ 9 kcal/g`,
                  result: `${Math.round(grams.fat)} g`,
                },
                {
                  label: 'Check',
                  expr: `(${Math.round(grams.protein)}×4) + (${Math.round(grams.carb)}×4) + (${Math.round(grams.fat)}×9)`,
                  result: `${Math.round(
                    Math.round(grams.protein) * 4 +
                      Math.round(grams.carb) * 4 +
                      Math.round(grams.fat) * 9,
                  )} kcal`,
                },
              ]}
              note="The Atwater factors (4 kcal per gram of protein and carbohydrate, 9 for fat) convert a percentage split into grams you can weigh."
            />

            <Interpretation>
              <p>
                <strong>
                  {Math.round(grams.protein)} g protein, {Math.round(grams.carb)} g carbs and{' '}
                  {Math.round(grams.fat)} g fat
                </strong>{' '}
                make up your {kcal(effectiveCalories)} day on the {preset.label.toLowerCase()}{' '}
                split.
              </p>
              <p>
                In practice, treat protein as a floor and calories as a ceiling. Hitting protein
                protects muscle and keeps you full; carbs and fat can move around each other freely
                to fit real meals, because at matched calories and protein the ratio between them
                has little effect on fat loss.
              </p>
              <p>
                Fat should rarely drop below about 0.5 g per kg of body weight. It carries
                fat-soluble vitamins and supports hormone production. Carbohydrate is the one that
                most affects how good hard training feels.
              </p>
            </Interpretation>
          </>
        ) : (
          <EmptyState message="Enter a daily calorie target between 800 and 8,000 kcal, or switch to the estimate tab, to see your macros." />
        )
      }
    />
  )
}
