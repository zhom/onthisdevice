import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatNumber } from '@/components/tools/finance/format'

import { csvMoney, toPositive } from '../finance/calc-money-core'
import {
  CmAssumptions,
  CmCurrencySelect,
  CmDataTable,
  CmExportBar,
  CmField,
  CmFieldGrid,
  CmSaveControl,
  CmSelectField,
  CmStat,
  CmWorking,
  useCmStorage,
  useMoney,
} from '../finance/calc-money-ui'
import type { CmColumn } from '../finance/calc-money-ui'
import {
  CU_FT_PER_CU_YD,
  LENGTH_UNITS,
  SHAPES,
  SHAPES_BY_VARIANT,
  SQ_FT_PER_SQ_YD,
  SQ_M_PER_SQ_FT,
  formatFeetInches,
  parseLengthFeet,
} from './calc-money-area'
import type { LengthUnit, ShapeId } from './calc-money-area'

export type AreaVariant = 'area' | 'paint' | 'tile' | 'flooring' | 'concrete'

interface Row {
  id: string
  name: string
  shape: ShapeId
  dims: string[]
  depth: string
  qty: string
}

interface RowResult extends Row {
  feet: number[]
  areaSqFt: number
  volumeCuFt: number
  count: number
}

const SEEDS: Record<AreaVariant, Row[]> = {
  area: [
    { id: 'r1', name: 'Living room', shape: 'rectangle', dims: ['18', '14'], depth: '4', qty: '1' },
    { id: 'r2', name: 'Hallway', shape: 'rectangle', dims: ['12', '4'], depth: '4', qty: '1' },
  ],
  flooring: [
    { id: 'r1', name: 'Lounge', shape: 'rectangle', dims: ['16', '13'], depth: '4', qty: '1' },
    { id: 'r2', name: 'Bedroom', shape: 'rectangle', dims: ['12', '11'], depth: '4', qty: '1' },
  ],
  tile: [
    { id: 'r1', name: 'Bathroom floor', shape: 'rectangle', dims: ['8', '6'], depth: '4', qty: '1' },
    { id: 'r2', name: 'Shower wall', shape: 'wall', dims: ['3', '7'], depth: '4', qty: '2' },
  ],
  paint: [
    { id: 'r1', name: 'Bedroom', shape: 'room', dims: ['14', '12', '8'], depth: '4', qty: '1' },
  ],
  concrete: [
    { id: 'r1', name: 'Patio slab', shape: 'slab', dims: ['20', '12'], depth: '4', qty: '1' },
    { id: 'r2', name: 'Post holes', shape: 'column', dims: ['1'], depth: '36', qty: '6' },
  ],
}

const TITLES: Record<AreaVariant, { rooms: string; roomsHint: string; result: string }> = {
  area: {
    rooms: 'Rooms and areas',
    roomsHint: 'Add a row per room or section. You can mix shapes, and the total adds up all of them.',
    result: 'Total area',
  },
  flooring: {
    rooms: 'Rooms to floor',
    roomsHint: 'Measure each room separately. Odd shapes are easier as two rectangles than one L.',
    result: 'Flooring needed',
  },
  tile: {
    rooms: 'Surfaces to tile',
    roomsHint: 'Floors and walls can be mixed in one job. Set a quantity for repeated walls.',
    result: 'Tiles needed',
  },
  paint: {
    rooms: 'Rooms and walls to paint',
    roomsHint: 'A room row gives you all four walls; use a wall row for a single feature wall.',
    result: 'Paint needed',
  },
  concrete: {
    rooms: 'Pours',
    roomsHint: 'Slabs take a thickness in inches; round holes take a depth. Quantity multiplies identical pours.',
    result: 'Concrete needed',
  },
}

export default function CalcMoneyArea({ variant = 'area' }: { variant?: AreaVariant }) {
  const shapes = SHAPES_BY_VARIANT[variant] ?? SHAPES_BY_VARIANT.area!
  const titles = TITLES[variant]

  const [currency, setCurrency] = useState('USD')
  const money = useMoney(currency)
  const [unit, setUnit] = useState<LengthUnit>('ft')

  const [saveOn, setSaveOn] = useState(false)
  const [rows, setRows, clearStored] = useCmStorage<Row[]>(
    `otd:calc-money:area:${variant}`,
    SEEDS[variant],
    saveOn,
  )

  const [waste, setWaste] = useState(variant === 'tile' ? '10' : variant === 'flooring' ? '10' : '5')
  const [costPerUnit, setCostPerUnit] = useState('0')

  /* paint */
  const [coats, setCoats] = useState('2')
  const [coverage, setCoverage] = useState('350')
  const [doors, setDoors] = useState('1')
  const [windows, setWindows] = useState('2')
  const [ceilings, setCeilings] = useState('0')

  /* tile */
  const [tileW, setTileW] = useState('12')
  const [tileH, setTileH] = useState('12')
  const [grout, setGrout] = useState('0.125')
  const [tilesPerBox, setTilesPerBox] = useState('10')

  /* flooring */
  const [sqftPerBox, setSqftPerBox] = useState('20')

  /* concrete */
  const [bagSize, setBagSize] = useState('80')

  const results: RowResult[] = useMemo(
    () =>
      rows.map((row) => {
        const def = SHAPES[row.shape]
        const feet = def.fields.map((_, i) => parseLengthFeet(row.dims[i] ?? '', unit))
        const count = Math.max(0, Math.round(toPositive(row.qty, 1) || 1))
        const areaSqFt = Math.max(0, def.area(feet)) * count
        const depthFeet = def.depthField ? Math.max(0, toPositive(row.depth)) / 12 : 0
        return {
          ...row,
          feet,
          areaSqFt,
          volumeCuFt: areaSqFt * depthFeet,
          count,
        }
      }),
    [rows, unit],
  )

  const calc = useMemo(() => {
    const grossArea = results.reduce((sum, r) => sum + r.areaSqFt, 0)
    const volume = results.reduce((sum, r) => sum + r.volumeCuFt, 0)

    const doorArea = Math.max(0, toPositive(doors)) * 21 // 3' × 7'
    const windowArea = Math.max(0, toPositive(windows)) * 15 // 3' × 5'
    const ceilingArea = results.reduce(
      (sum, r) =>
        r.shape === 'room'
          ? sum + (r.feet[0] ?? 0) * (r.feet[1] ?? 0) * r.count * Math.max(0, toPositive(ceilings))
          : sum,
      0,
    )
    const openings = variant === 'paint' ? doorArea + windowArea : 0
    const netArea = Math.max(0, grossArea - openings + (variant === 'paint' ? ceilingArea : 0))

    const wastePct = Math.max(0, toPositive(waste))
    const areaWithWaste = netArea * (1 + wastePct / 100)

    /* paint */
    const coatCount = Math.max(1, Math.round(toPositive(coats, 2) || 2))
    const coveragePerGallon = Math.max(1, toPositive(coverage, 350) || 350)
    const paintArea = netArea * coatCount
    const gallons = paintArea / coveragePerGallon
    const cansNeeded = Math.ceil(gallons - 1e-9)
    const litres = gallons * 3.785411784

    /* tile */
    const tileWidthIn = Math.max(0.1, toPositive(tileW, 12) || 12) + Math.max(0, toPositive(grout))
    const tileHeightIn = Math.max(0.1, toPositive(tileH, 12) || 12) + Math.max(0, toPositive(grout))
    const tileAreaSqFt = (tileWidthIn * tileHeightIn) / 144
    const tilesNeeded = tileAreaSqFt > 0 ? Math.ceil(areaWithWaste / tileAreaSqFt - 1e-9) : 0
    const perBox = Math.max(1, Math.round(toPositive(tilesPerBox, 10) || 10))
    const tileBoxes = Math.ceil(tilesNeeded / perBox - 1e-9)

    /* flooring */
    const boxCoverage = Math.max(0.1, toPositive(sqftPerBox, 20) || 20)
    const floorBoxes = Math.ceil(areaWithWaste / boxCoverage - 1e-9)

    /* concrete */
    const volumeWithWaste = volume * (1 + wastePct / 100)
    const cubicYards = volumeWithWaste / CU_FT_PER_CU_YD
    const cubicMetres = volumeWithWaste * 0.3048 ** 3
    const bagYield: Record<string, number> = { '40': 0.3, '50': 0.375, '60': 0.45, '80': 0.6 }
    const yieldPerBag = bagYield[bagSize] ?? 0.6
    const bags = Math.ceil(volumeWithWaste / yieldPerBag - 1e-9)

    const unitCost = toPositive(costPerUnit)
    let cost = 0
    let costBasis = ''
    switch (variant) {
      case 'paint':
        cost = unitCost * cansNeeded
        costBasis = `${cansNeeded} × ${money.exact(unitCost)} per gallon`
        break
      case 'tile':
        cost = unitCost * tileBoxes
        costBasis = `${tileBoxes} × ${money.exact(unitCost)} per box`
        break
      case 'flooring':
        cost = unitCost * floorBoxes
        costBasis = `${floorBoxes} × ${money.exact(unitCost)} per box`
        break
      case 'concrete':
        cost = unitCost * bags
        costBasis = `${bags} × ${money.exact(unitCost)} per bag`
        break
      default:
        cost = unitCost * areaWithWaste
        costBasis = `${formatNumber(areaWithWaste, 1)} sq ft × ${money.exact(unitCost)}`
    }

    return {
      grossArea,
      openings,
      ceilingArea,
      netArea,
      wastePct,
      areaWithWaste,
      volume,
      volumeWithWaste,
      cubicYards,
      cubicMetres,
      bags,
      yieldPerBag,
      coatCount,
      coveragePerGallon,
      paintArea,
      gallons,
      cansNeeded,
      litres,
      tileAreaSqFt,
      tileWidthIn,
      tileHeightIn,
      tilesNeeded,
      tileBoxes,
      perBox,
      floorBoxes,
      boxCoverage,
      cost,
      costBasis,
      sqM: areaWithWaste * SQ_M_PER_SQ_FT,
      sqYd: areaWithWaste / SQ_FT_PER_SQ_YD,
      netSqM: netArea * SQ_M_PER_SQ_FT,
    }
  }, [
    results,
    waste,
    doors,
    windows,
    ceilings,
    coats,
    coverage,
    tileW,
    tileH,
    grout,
    tilesPerBox,
    sqftPerBox,
    bagSize,
    costPerUnit,
    variant,
    money,
  ])

  const update = (id: string, patch: Partial<Row>) =>
    setRows((list) => list.map((row) => (row.id === id ? { ...row, ...patch } : row)))

  const updateDim = (id: string, index: number, value: string) =>
    setRows((list) =>
      list.map((row) => {
        if (row.id !== id) return row
        const dims = [...row.dims]
        dims[index] = value
        return { ...row, dims }
      }),
    )

  const columns: CmColumn<RowResult>[] = [
    { key: 'name', header: 'Area', render: (r) => r.name || '–' },
    { key: 'shape', header: 'Shape', render: (r) => SHAPES[r.shape].label },
    {
      key: 'dims',
      header: 'Dimensions',
      render: (r) =>
        r.feet
          .filter((f) => f > 0)
          .map((f) => formatFeetInches(f))
          .join(' × ') || '–',
    },
    { key: 'qty', header: 'Qty', align: 'right', hideOnMobile: true, render: (r) => r.count },
    { key: 'sqft', header: 'Sq ft', align: 'right', render: (r) => formatNumber(r.areaSqFt, 2) },
    {
      key: 'sqm',
      header: 'Sq m',
      align: 'right',
      hideOnMobile: true,
      render: (r) => formatNumber(r.areaSqFt * SQ_M_PER_SQ_FT, 2),
    },
    ...(variant === 'concrete'
      ? [
          {
            key: 'vol',
            header: 'Cu ft',
            align: 'right' as const,
            render: (r: RowResult) => formatNumber(r.volumeCuFt, 2),
          },
        ]
      : []),
  ]

  const exportSpec = useMemo(
    () => ({
      filename: `${variant}-calculation`,
      title:
        variant === 'area'
          ? 'Square footage calculation'
          : variant === 'paint'
            ? 'Paint quantity calculation'
            : variant === 'tile'
              ? 'Tile quantity calculation'
              : variant === 'flooring'
                ? 'Flooring quantity calculation'
                : 'Concrete volume calculation',
      subtitle: `${formatNumber(calc.netArea, 2)} sq ft (${formatNumber(
        calc.netSqM,
        2,
      )} m²) across ${results.length} areas, ${calc.wastePct}% waste allowance`,
      tables: [
        {
          name: 'Areas',
          headers: ['Area', 'Shape', 'Dimensions', 'Qty', 'Sq ft', 'Sq m', 'Cu ft'],
          aligns: ['left', 'left', 'left', 'right', 'right', 'right', 'right'] as (
            | 'left'
            | 'right'
          )[],
          rows: results.map((r) => [
            r.name,
            SHAPES[r.shape].label,
            r.feet
              .filter((f) => f > 0)
              .map((f) => f.toFixed(3))
              .join(' x '),
            r.count,
            r.areaSqFt.toFixed(2),
            (r.areaSqFt * SQ_M_PER_SQ_FT).toFixed(2),
            r.volumeCuFt > 0 ? r.volumeCuFt.toFixed(2) : '',
          ]),
        },
        {
          name: 'Totals',
          headers: ['Field', 'Value'],
          aligns: ['left', 'right'] as ('left' | 'right')[],
          rows: [
            ['Gross area (sq ft)', calc.grossArea.toFixed(2)],
            ...(variant === 'paint'
              ? ([
                  ['Openings deducted (sq ft)', calc.openings.toFixed(2)],
                  ['Ceilings added (sq ft)', calc.ceilingArea.toFixed(2)],
                  ['Coats', calc.coatCount],
                  ['Coverage per gallon (sq ft)', calc.coveragePerGallon],
                  ['Gallons needed', calc.gallons.toFixed(2)],
                  ['Cans to buy', calc.cansNeeded],
                  ['Litres', calc.litres.toFixed(2)],
                ] as (string | number)[][])
              : []),
            ['Net area (sq ft)', calc.netArea.toFixed(2)],
            ['Waste allowance %', calc.wastePct],
            ['Area to buy (sq ft)', calc.areaWithWaste.toFixed(2)],
            ['Area to buy (sq m)', calc.sqM.toFixed(2)],
            ...(variant === 'tile'
              ? ([
                  ['Tile size incl. grout (in)', `${calc.tileWidthIn} x ${calc.tileHeightIn}`],
                  ['Tiles needed', calc.tilesNeeded],
                  ['Boxes', calc.tileBoxes],
                ] as (string | number)[][])
              : []),
            ...(variant === 'flooring'
              ? ([
                  ['Coverage per box (sq ft)', calc.boxCoverage],
                  ['Boxes', calc.floorBoxes],
                ] as (string | number)[][])
              : []),
            ...(variant === 'concrete'
              ? ([
                  ['Volume (cu ft)', calc.volumeWithWaste.toFixed(2)],
                  ['Cubic yards', calc.cubicYards.toFixed(3)],
                  ['Cubic metres', calc.cubicMetres.toFixed(3)],
                  [`Bags (${bagSize} lb)`, calc.bags],
                ] as (string | number)[][])
              : []),
            ['Estimated cost', csvMoney(calc.cost)],
          ] as (string | number)[][],
        },
      ],
      notes: [
        `Dimensions entered in ${LENGTH_UNITS.find((u) => u.value === unit)?.label.toLowerCase()}; feet-and-inches notation is accepted in any field.`,
        `A ${calc.wastePct}% waste allowance is applied to the net area before quantities are worked out.`,
        'Quantities are rounded up to whole boxes, cans or bags, because you cannot buy two thirds of a tin.',
      ],
    }),
    [bagSize, calc, results, unit, variant],
  )

  return (
    <div className="space-y-6">
      <ToolPanel
        title={titles.rooms}
        description={titles.roomsHint}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setRows((list) => [
                  ...list,
                  {
                    id: `row-${Date.now()}`,
                    name: `Area ${list.length + 1}`,
                    shape: shapes[0]!,
                    dims: [],
                    depth: '4',
                    qty: '1',
                  },
                ])
              }
            >
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              Add an area
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRows(SEEDS[variant].map((row) => ({ ...row, dims: [...row.dims] })))}
            >
              Reset to the example
            </Button>
            <div className="w-40">
              <CmSelectField
                id="ar-unit"
                label="Measured in"
                value={unit}
                onChange={(v) => setUnit(v as LengthUnit)}
                options={LENGTH_UNITS.map((u) => ({ value: u.value, label: u.label }))}
              />
            </div>
          </>
        }
      >
        <div className="space-y-3">
          {rows.map((row, index) => {
            const def = SHAPES[row.shape]
            const result = results[index]
            return (
              <div key={row.id} className="space-y-3 rounded-lg bg-muted p-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${row.id}-name`} className="text-sm">
                      Name
                    </Label>
                    <Input
                      id={`${row.id}-name`}
                      value={row.name}
                      autoComplete="off"
                      onChange={(e) => update(row.id, { name: e.target.value })}
                    />
                  </div>
                  <CmSelectField
                    id={`${row.id}-shape`}
                    label="Shape"
                    value={row.shape}
                    onChange={(v) => update(row.id, { shape: v as ShapeId })}
                    options={shapes.map((s) => ({ value: s, label: SHAPES[s].label }))}
                  />
                  <CmField
                    id={`${row.id}-qty`}
                    label="Quantity"
                    value={row.qty}
                    onChange={(v) => update(row.id, { qty: v })}
                    hint="identical copies"
                  />
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Area</p>
                      <p className="text-base font-semibold tabular-nums">
                        {formatNumber(result?.areaSqFt ?? 0, 2)} sq ft
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${row.name || `area ${index + 1}`}`}
                      disabled={rows.length <= 1}
                      onClick={() => setRows((list) => list.filter((r) => r.id !== row.id))}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {def.fields.map((field, i) => (
                    <CmField
                      key={field}
                      id={`${row.id}-dim-${i}`}
                      label={field}
                      value={row.dims[i] ?? ''}
                      onChange={(v) => updateDim(row.id, i, v)}
                      suffix={unit}
                      placeholder={unit === 'ft' ? `12' 6"` : '0'}
                    />
                  ))}
                  {def.depthField ? (
                    <CmField
                      id={`${row.id}-depth`}
                      label={def.depthField}
                      value={row.depth}
                      onChange={(v) => update(row.id, { depth: v })}
                      suffix="in"
                    />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        <CmSaveControl
          id="ar-save"
          what="this measurement list"
          enabled={saveOn}
          onToggle={setSaveOn}
          onClear={() => {
            clearStored()
            setRows(SEEDS[variant].map((row) => ({ ...row, dims: [...row.dims] })))
          }}
        />
      </ToolPanel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ToolPanel
          title="Allowances and materials"
          description="Buy a little more than you measure. Off-cuts, breakages and pattern matching all eat material."
        >
          <CmFieldGrid columns={2}>
            <CmField
              id="ar-waste"
              label="Waste allowance"
              value={waste}
              onChange={setWaste}
              suffix="%"
              hint={variant === 'tile' ? '10% plain, 15% diagonal' : '5–10% is typical'}
              slider={{ min: 0, max: 30, step: 1 }}
            />
            <CmCurrencySelect value={currency} onChange={setCurrency} id="ar-currency" />

            {variant === 'paint' ? (
              <>
                <CmField id="ar-coats" label="Coats" value={coats} onChange={setCoats} />
                <CmField
                  id="ar-coverage"
                  label="Coverage per gallon"
                  value={coverage}
                  onChange={setCoverage}
                  suffix="sq ft"
                  hint="350 is typical"
                />
                <CmField
                  id="ar-doors"
                  label="Doors to deduct"
                  value={doors}
                  onChange={setDoors}
                  hint="21 sq ft each"
                />
                <CmField
                  id="ar-windows"
                  label="Windows to deduct"
                  value={windows}
                  onChange={setWindows}
                  hint="15 sq ft each"
                />
                <CmField
                  id="ar-ceilings"
                  label="Paint the ceiling too?"
                  value={ceilings}
                  onChange={setCeilings}
                  hint="1 = yes, 0 = no"
                />
                <CmField
                  id="ar-cost"
                  label="Price per gallon"
                  value={costPerUnit}
                  onChange={setCostPerUnit}
                  prefix={money.symbol}
                />
              </>
            ) : null}

            {variant === 'tile' ? (
              <>
                <CmField id="ar-tilew" label="Tile width" value={tileW} onChange={setTileW} suffix="in" />
                <CmField id="ar-tileh" label="Tile height" value={tileH} onChange={setTileH} suffix="in" />
                <CmField
                  id="ar-grout"
                  label="Grout joint"
                  value={grout}
                  onChange={setGrout}
                  suffix="in"
                  hint="1/8 in = 0.125"
                />
                <CmField
                  id="ar-perbox"
                  label="Tiles per box"
                  value={tilesPerBox}
                  onChange={setTilesPerBox}
                />
                <CmField
                  id="ar-cost"
                  label="Price per box"
                  value={costPerUnit}
                  onChange={setCostPerUnit}
                  prefix={money.symbol}
                />
              </>
            ) : null}

            {variant === 'flooring' ? (
              <>
                <CmField
                  id="ar-boxcov"
                  label="Coverage per box"
                  value={sqftPerBox}
                  onChange={setSqftPerBox}
                  suffix="sq ft"
                  hint="printed on the carton"
                />
                <CmField
                  id="ar-cost"
                  label="Price per box"
                  value={costPerUnit}
                  onChange={setCostPerUnit}
                  prefix={money.symbol}
                />
              </>
            ) : null}

            {variant === 'concrete' ? (
              <>
                <CmSelectField
                  id="ar-bag"
                  label="Bag size"
                  value={bagSize}
                  onChange={setBagSize}
                  options={[
                    { value: '40', label: '40 lb (0.30 cu ft)' },
                    { value: '50', label: '50 lb (0.375 cu ft)' },
                    { value: '60', label: '60 lb (0.45 cu ft)' },
                    { value: '80', label: '80 lb (0.60 cu ft)' },
                  ]}
                />
                <CmField
                  id="ar-cost"
                  label="Price per bag"
                  value={costPerUnit}
                  onChange={setCostPerUnit}
                  prefix={money.symbol}
                />
              </>
            ) : null}

            {variant === 'area' ? (
              <CmField
                id="ar-cost"
                label="Cost per square foot"
                value={costPerUnit}
                onChange={setCostPerUnit}
                prefix={money.symbol}
                hint="materials, rent, whatever you are pricing"
              />
            ) : null}
          </CmFieldGrid>
        </ToolPanel>

        <ToolPanel title={titles.result}>
          {variant === 'area' || variant === 'flooring' ? (
            <ResultStat
              label="Total square footage"
              value={`${formatNumber(calc.netArea, 2)} sq ft`}
              hint={`${formatNumber(calc.netSqM, 2)} m² · ${formatNumber(
                calc.netArea / SQ_FT_PER_SQ_YD,
                2,
              )} sq yd`}
              emphasis
            />
          ) : null}
          {variant === 'paint' ? (
            <ResultStat
              label="Paint to buy"
              value={`${calc.cansNeeded} ${calc.cansNeeded === 1 ? 'gallon' : 'gallons'}`}
              hint={`${calc.gallons.toFixed(2)} gallons (${calc.litres.toFixed(
                1,
              )} litres) for ${calc.coatCount} coats over ${formatNumber(calc.netArea, 0)} sq ft`}
              emphasis
            />
          ) : null}
          {variant === 'tile' ? (
            <ResultStat
              label="Tiles to buy"
              value={formatNumber(calc.tilesNeeded, 0)}
              hint={`${calc.tileBoxes} ${calc.tileBoxes === 1 ? 'box' : 'boxes'} of ${
                calc.perBox
              }, including ${calc.wastePct}% waste`}
              emphasis
            />
          ) : null}
          {variant === 'concrete' ? (
            <ResultStat
              label="Concrete needed"
              value={`${calc.cubicYards.toFixed(2)} cu yd`}
              hint={`${formatNumber(calc.volumeWithWaste, 2)} cu ft · ${calc.cubicMetres.toFixed(
                3,
              )} m³ · ${calc.bags} bags of ${bagSize} lb`}
              emphasis
            />
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <CmStat label="Measured area" value={`${formatNumber(calc.grossArea, 2)} sq ft`} />
            {variant === 'paint' ? (
              <CmStat
                label="Openings deducted"
                value={`${formatNumber(calc.openings, 0)} sq ft`}
                hint={`${toPositive(doors)} doors, ${toPositive(windows)} windows`}
              />
            ) : (
              <CmStat
                label={`With ${calc.wastePct}% waste`}
                value={`${formatNumber(calc.areaWithWaste, 2)} sq ft`}
              />
            )}
            <CmStat label="In square metres" value={`${formatNumber(calc.sqM, 2)} m²`} />
            <CmStat label="In square yards" value={`${formatNumber(calc.sqYd, 2)} sq yd`} />
            {variant === 'flooring' ? (
              <CmStat
                label="Boxes to buy"
                value={formatNumber(calc.floorBoxes, 0)}
                hint={`${calc.boxCoverage} sq ft each`}
              />
            ) : null}
            {variant === 'concrete' ? (
              <CmStat
                label="Bags of concrete"
                value={formatNumber(calc.bags, 0)}
                hint={`${calc.yieldPerBag} cu ft each`}
              />
            ) : null}
            <CmStat
              label="Estimated cost"
              value={money.exact(calc.cost)}
              hint={toPositive(costPerUnit) > 0 ? calc.costBasis : 'enter a price to see this'}
              tone={calc.cost > 0 ? 'positive' : 'default'}
            />
          </div>
        </ToolPanel>
      </div>

      <ToolPanel
        title="Every area, listed"
        description="Take this to the merchant. It has the list, the maths and the total on one page."
        footer={<CmExportBar spec={exportSpec} />}
      >
        <CmDataTable
          ariaLabel="Measured areas and their square footage"
          columns={columns}
          rows={results}
          pageSize={20}
          minWidth={620}
        />
      </ToolPanel>

      <CmWorking
        items={[
          {
            label: 'Area of each shape',
            general: results
              .slice(0, 3)
              .map((r) => `${SHAPES[r.shape].label}: ${SHAPES[r.shape].formula}`)
              .join('  ·  '),
            steps: results
              .slice(0, 4)
              .map(
                (r) =>
                  `${r.name || 'Area'}: ${r.feet
                    .filter((f) => f > 0)
                    .map((f) => f.toFixed(2))
                    .join(' × ')} ft${r.count > 1 ? ` × ${r.count}` : ''} = ${r.areaSqFt.toFixed(2)} sq ft`,
              ),
            result: `${formatNumber(calc.grossArea, 2)} sq ft total`,
          },
          ...(variant === 'paint'
            ? [
                {
                  label: 'Paintable area',
                  general: 'net = wall area − doors − windows + ceilings',
                  steps: [
                    `= ${calc.grossArea.toFixed(2)} − ${calc.openings.toFixed(2)} + ${calc.ceilingArea.toFixed(2)}`,
                  ],
                  result: `${formatNumber(calc.netArea, 2)} sq ft`,
                },
                {
                  label: 'Paint required',
                  general: 'gallons = net area × coats ÷ coverage per gallon',
                  steps: [
                    `= ${calc.netArea.toFixed(2)} × ${calc.coatCount} ÷ ${calc.coveragePerGallon}`,
                    `= ${calc.gallons.toFixed(3)} gallons, rounded up to ${calc.cansNeeded}`,
                  ],
                  result: `${calc.cansNeeded} gallons (${calc.litres.toFixed(1)} litres)`,
                },
              ]
            : []),
          ...(variant === 'tile'
            ? [
                {
                  label: 'Effective tile size',
                  general: 'tile area = (width + grout) × (height + grout) ÷ 144',
                  steps: [
                    `= ${calc.tileWidthIn} × ${calc.tileHeightIn} ÷ 144 = ${calc.tileAreaSqFt.toFixed(4)} sq ft`,
                  ],
                  result: `${calc.tileAreaSqFt.toFixed(4)} sq ft per tile`,
                },
                {
                  label: 'Tiles required',
                  general: 'tiles = area × (1 + waste) ÷ tile area, rounded up',
                  steps: [
                    `= ${calc.netArea.toFixed(2)} × ${(1 + calc.wastePct / 100).toFixed(2)} ÷ ${calc.tileAreaSqFt.toFixed(4)}`,
                  ],
                  result: `${calc.tilesNeeded} tiles · ${calc.tileBoxes} boxes`,
                },
              ]
            : []),
          ...(variant === 'flooring'
            ? [
                {
                  label: 'Boxes required',
                  general: 'boxes = area × (1 + waste) ÷ coverage per box, rounded up',
                  steps: [
                    `= ${calc.netArea.toFixed(2)} × ${(1 + calc.wastePct / 100).toFixed(2)} ÷ ${calc.boxCoverage}`,
                    `= ${(calc.areaWithWaste / calc.boxCoverage).toFixed(2)} boxes`,
                  ],
                  result: `${calc.floorBoxes} boxes`,
                },
              ]
            : []),
          ...(variant === 'concrete'
            ? [
                {
                  label: 'Volume',
                  general: 'cubic feet = area × thickness ÷ 12',
                  steps: [
                    `total = ${calc.volume.toFixed(2)} cu ft, plus ${calc.wastePct}% waste = ${calc.volumeWithWaste.toFixed(2)} cu ft`,
                    `cubic yards = ${calc.volumeWithWaste.toFixed(2)} ÷ 27`,
                  ],
                  result: `${calc.cubicYards.toFixed(3)} cu yd (${calc.cubicMetres.toFixed(3)} m³)`,
                },
                {
                  label: 'Bags',
                  general: 'bags = cubic feet ÷ yield per bag, rounded up',
                  steps: [`= ${calc.volumeWithWaste.toFixed(2)} ÷ ${calc.yieldPerBag}`],
                  result: `${calc.bags} bags of ${bagSize} lb`,
                },
              ]
            : []),
          {
            label: 'Metric conversion',
            general: '1 sq ft = 0.09290304 m² exactly (1 ft = 0.3048 m)',
            steps: [`${calc.netArea.toFixed(2)} × 0.09290304`],
            result: `${formatNumber(calc.netSqM, 3)} m²`,
          },
          ...(toPositive(costPerUnit) > 0
            ? [
                {
                  label: 'Cost',
                  general: 'cost = quantity × unit price',
                  steps: [calc.costBasis],
                  result: money.exact(calc.cost),
                },
              ]
            : []),
        ]}
        note={"Feet-and-inches entries such as 12′ 6″ are read exactly, and the conversion to metres uses the international foot of 0.3048 m, which is exact by definition."}
      />

      <CmAssumptions
        items={[
          'Measure the longest and widest points of each space, and split awkward rooms into two rectangles rather than trying to describe them with one shape.',
          variant === 'paint'
            ? 'A door is deducted at 21 sq ft (3 × 7 ft) and a window at 15 sq ft (3 × 5 ft). Coverage of 350 sq ft per US gallon is typical for a smooth, previously painted wall; bare drywall, textured surfaces and deep colour changes all use more.'
            : 'Waste allowance covers off-cuts, breakages and mistakes. Ten per cent is the usual figure; go to fifteen for diagonal layouts, herringbone patterns or a room with many angles.',
          variant === 'tile'
            ? 'Tile counts assume a straight grid layout with the grout joint added to each tile. Diagonal, herringbone and brick-bond layouts cut more tiles and need a bigger allowance.'
            : 'Quantities are always rounded up to whole units, because cans, boxes and bags are not sold in fractions.',
          variant === 'concrete'
            ? 'Bag yields are the manufacturer-stated figures for standard ready-mix: 0.30, 0.375, 0.45 and 0.60 cubic feet for 40, 50, 60 and 80 lb bags. Ready-mix delivered by truck is ordered in cubic yards or cubic metres, usually with a quarter-yard minimum.'
            : 'Square footage is a plan area. It does not account for skirting, thresholds, or the direction a plank or tile will run.',
          'Nothing is uploaded. Saving is off by default and writes only to this browser, with a delete button next to the switch.',
        ]}
      />
    </div>
  )
}
