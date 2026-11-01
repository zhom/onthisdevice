import { useMemo, useState } from 'react'

import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatNumber } from '@/components/tools/finance/format'

import { Decimal, csvMoney, d, toPositive } from './calc-money-core'
import {
  CmAssumptions,
  CmBreakdown,
  CmCurrencySelect,
  CmDataTable,
  CmExportBar,
  CmField,
  CmFieldGrid,
  CmSelectField,
  CmStat,
  CmWorking,
  useMoney,
} from './calc-money-ui'
import type { CmColumn } from './calc-money-ui'

export type MarginVariant = 'both' | 'margin' | 'markup'

type Solve = 'cost-price' | 'cost-margin' | 'cost-markup' | 'price-margin' | 'price-markup'

const SOLVE_OPTIONS: { value: Solve; label: string }[] = [
  { value: 'cost-price', label: 'I know cost and price' },
  { value: 'cost-margin', label: 'I know cost and target margin' },
  { value: 'cost-markup', label: 'I know cost and markup' },
  { value: 'price-margin', label: 'I know price and margin' },
  { value: 'price-markup', label: 'I know price and markup' },
]

interface Solved {
  cost: number
  price: number
  profit: number
  marginPct: number
  markupPct: number
  invalid?: string
}

function solve(mode: Solve, costIn: number, priceIn: number, marginIn: number, markupIn: number): Solved {
  let cost = d(costIn)
  let price = d(priceIn)

  switch (mode) {
    case 'cost-price':
      break
    case 'cost-margin': {
      if (marginIn >= 100) {
        return {
          cost: costIn,
          price: 0,
          profit: 0,
          marginPct: marginIn,
          markupPct: 0,
          invalid:
            'A margin of 100% or more is impossible. Margin is a share of the selling price, so it reaches 100% only if the item costs you nothing.',
        }
      }
      price = cost.div(d(1).minus(d(marginIn).div(100)))
      break
    }
    case 'cost-markup':
      price = cost.times(d(1).plus(d(markupIn).div(100)))
      break
    case 'price-margin': {
      if (marginIn >= 100) {
        return {
          cost: 0,
          price: priceIn,
          profit: 0,
          marginPct: marginIn,
          markupPct: 0,
          invalid: 'Margin must be below 100%. At 100% the cost would be zero.',
        }
      }
      cost = price.times(d(1).minus(d(marginIn).div(100)))
      break
    }
    case 'price-markup':
      cost = price.div(d(1).plus(d(markupIn).div(100)))
      break
  }

  const profit = price.minus(cost)
  const marginPct = price.isZero() ? d(0) : profit.div(price).times(100)
  const markupPct = cost.isZero() ? d(0) : profit.div(cost).times(100)

  return {
    cost: cost.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber(),
    price: price.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber(),
    profit: profit.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber(),
    marginPct: marginPct.toDecimalPlaces(4).toNumber(),
    markupPct: markupPct.toDecimalPlaces(4).toNumber(),
  }
}

interface BulkRow {
  label: string
  cost: number
  price: number
  profit: number
  marginPct: number
  markupPct: number
}

/**
 * Parse a pasted list of costs. Accepts "name,cost", "name<tab>cost", or a bare
 * column of numbers, with or without a header row.
 */
function parseBulk(text: string): { label: string; cost: number }[] {
  const out: { label: string; cost: number }[] = []
  const lines = text.split(/\r?\n/)
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split(/[,\t;]/).map((p) => p.trim())
    const numericPart = [...parts].reverse().find((p) => /[0-9]/.test(p))
    if (numericPart === undefined) continue
    const cost = toPositive(numericPart, Number.NaN)
    if (!Number.isFinite(cost)) continue
    // A header row has a non-numeric last cell, which the check above already
    // rejects; this catches "Item,Cost" where "Cost" contains no digit.
    const label =
      parts.length > 1 && parts[0] && !/^[\d.,\s$£€]+$/.test(parts[0])
        ? parts[0]
        : `Item ${index + 1}`
    out.push({ label, cost })
  }
  return out
}

const HEADINGS: Record<MarginVariant, { panel: string; hero: string; heroHint: string }> = {
  both: {
    panel: 'Margin and markup, side by side',
    hero: 'Selling price',
    heroHint: 'the number to put on the shelf',
  },
  margin: {
    panel: 'Gross profit margin',
    hero: 'Gross profit margin',
    heroHint: 'profit as a share of the selling price',
  },
  markup: {
    panel: 'Markup on cost',
    hero: 'Markup',
    heroHint: 'profit as a share of what you paid',
  },
}

export default function CalcMoneyMarginMarkup({ variant = 'both' }: { variant?: MarginVariant }) {
  const [currency, setCurrency] = useState('USD')
  const money = useMoney(currency)

  const [mode, setMode] = useState<Solve>(
    variant === 'markup' ? 'cost-markup' : variant === 'margin' ? 'cost-margin' : 'cost-price',
  )
  const [cost, setCost] = useState('40')
  const [price, setPrice] = useState('100')
  const [margin, setMargin] = useState('60')
  const [markup, setMarkup] = useState('150')
  const [quantity, setQuantity] = useState('1')
  const [bulkText, setBulkText] = useState('')

  const result = useMemo(
    () => solve(mode, toPositive(cost), toPositive(price), toPositive(margin), toPositive(markup)),
    [mode, cost, price, margin, markup],
  )

  const qty = Math.max(0, toPositive(quantity, 1))

  const bulk: BulkRow[] = useMemo(() => {
    const parsed = parseBulk(bulkText)
    const usesMargin = mode === 'cost-margin' || mode === 'price-margin'
    const pct = usesMargin ? toPositive(margin) : toPositive(markup)
    return parsed.slice(0, 2000).map((row) => {
      const s = solve(
        usesMargin ? 'cost-margin' : 'cost-markup',
        row.cost,
        0,
        usesMargin ? pct : 0,
        usesMargin ? 0 : pct,
      )
      return {
        label: row.label,
        cost: row.cost,
        price: s.price,
        profit: s.profit,
        marginPct: s.marginPct,
        markupPct: s.markupPct,
      }
    })
  }, [bulkText, mode, margin, markup])

  const bulkColumns: CmColumn<BulkRow>[] = [
    { key: 'label', header: 'Item', render: (r) => r.label },
    { key: 'cost', header: 'Cost', align: 'right', render: (r) => money.exact(r.cost) },
    { key: 'price', header: 'Price', align: 'right', render: (r) => money.exact(r.price) },
    { key: 'profit', header: 'Profit', align: 'right', render: (r) => money.exact(r.profit) },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      hideOnMobile: true,
      render: (r) => `${r.marginPct.toFixed(1)}%`,
    },
    {
      key: 'markup',
      header: 'Markup',
      align: 'right',
      hideOnMobile: true,
      render: (r) => `${r.markupPct.toFixed(1)}%`,
    },
  ]

  interface ConvRow {
    markup: number
    margin: number
    multiplier: number
  }
  const conversion: ConvRow[] = useMemo(
    () =>
      [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 300, 400].map((m) => ({
        markup: m,
        margin: (m / (100 + m)) * 100,
        multiplier: 1 + m / 100,
      })),
    [],
  )

  const convColumns: CmColumn<ConvRow>[] = [
    { key: 'markup', header: 'Markup on cost', render: (r) => `${r.markup}%` },
    { key: 'margin', header: 'Equals margin', align: 'right', render: (r) => `${r.margin.toFixed(1)}%` },
    {
      key: 'mult',
      header: 'Price multiplier',
      align: 'right',
      render: (r) => `× ${r.multiplier.toFixed(2)}`,
    },
  ]

  const exportSpec = useMemo(
    () => ({
      filename: variant === 'margin' ? 'profit-margin' : variant === 'markup' ? 'markup' : 'margin-and-markup',
      title:
        variant === 'margin'
          ? 'Profit margin calculation'
          : variant === 'markup'
            ? 'Markup calculation'
            : 'Margin and markup calculation',
      subtitle: `Cost ${money.exact(result.cost)} · price ${money.exact(
        result.price,
      )} · margin ${result.marginPct.toFixed(2)}% · markup ${result.markupPct.toFixed(2)}%`,
      tables: [
        ...(bulk.length > 0
          ? [
              {
                name: 'Bulk pricing',
                headers: ['Item', 'Cost', 'Price', 'Profit', 'Margin %', 'Markup %'],
                aligns: ['left', 'right', 'right', 'right', 'right', 'right'] as (
                  | 'left'
                  | 'right'
                )[],
                rows: bulk.map((r) => [
                  r.label,
                  csvMoney(r.cost),
                  csvMoney(r.price),
                  csvMoney(r.profit),
                  r.marginPct.toFixed(2),
                  r.markupPct.toFixed(2),
                ]),
              },
            ]
          : []),
        {
          name: 'Single item',
          headers: ['Field', 'Value'],
          aligns: ['left', 'right'] as ('left' | 'right')[],
          rows: [
            ['Cost', csvMoney(result.cost)],
            ['Selling price', csvMoney(result.price)],
            ['Gross profit', csvMoney(result.profit)],
            ['Margin %', result.marginPct.toFixed(2)],
            ['Markup %', result.markupPct.toFixed(2)],
            ['Quantity', qty],
            ['Total revenue', csvMoney(result.price * qty)],
            ['Total profit', csvMoney(result.profit * qty)],
          ] as (string | number)[][],
        },
        {
          name: 'Markup to margin',
          headers: ['Markup %', 'Margin %', 'Price multiplier'],
          aligns: ['right', 'right', 'right'] as ('left' | 'right')[],
          rows: conversion.map((r) => [r.markup, r.margin.toFixed(1), r.multiplier.toFixed(2)]),
        },
      ],
      notes: [
        'Margin = profit ÷ selling price. Markup = profit ÷ cost. They are never the same number above zero.',
        'These are gross figures on the unit cost of goods. Overheads, shipping, payment-processing fees, returns and tax are not deducted.',
      ],
    }),
    [bulk, conversion, money, qty, result, variant],
  )

  const usesMargin = mode === 'cost-margin' || mode === 'price-margin'
  const headings = HEADINGS[variant]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ToolPanel
          title="What you know"
          description="Pick the two numbers you have; the rest are solved for you."
        >
          <CmFieldGrid columns={2}>
            <CmSelectField
              id="mm-mode"
              label="Known values"
              value={mode}
              onChange={(v) => setMode(v as Solve)}
              options={SOLVE_OPTIONS}
              className="sm:col-span-2"
            />
            {mode !== 'price-margin' && mode !== 'price-markup' ? (
              <CmField
                id="mm-cost"
                label="Cost per unit"
                value={cost}
                onChange={setCost}
                prefix={money.symbol}
                hint="what you paid"
              />
            ) : (
              <CmStat label="Cost per unit" value={money.exact(result.cost)} hint="solved" />
            )}
            {mode === 'cost-price' || mode === 'price-margin' || mode === 'price-markup' ? (
              <CmField
                id="mm-price"
                label="Selling price"
                value={price}
                onChange={setPrice}
                prefix={money.symbol}
                hint="what the customer pays"
              />
            ) : (
              <CmStat label="Selling price" value={money.exact(result.price)} hint="solved" />
            )}
            {mode === 'cost-margin' || mode === 'price-margin' ? (
              <CmField
                id="mm-margin"
                label="Target margin"
                value={margin}
                onChange={setMargin}
                suffix="%"
                slider={{ min: 0, max: 95, step: 0.5 }}
              />
            ) : (
              <CmStat label="Margin" value={`${result.marginPct.toFixed(2)}%`} hint="solved" />
            )}
            {mode === 'cost-markup' || mode === 'price-markup' ? (
              <CmField
                id="mm-markup"
                label="Markup on cost"
                value={markup}
                onChange={setMarkup}
                suffix="%"
                slider={{ min: 0, max: 400, step: 1 }}
              />
            ) : (
              <CmStat label="Markup" value={`${result.markupPct.toFixed(2)}%`} hint="solved" />
            )}
            <CmField
              id="mm-qty"
              label="Quantity"
              value={quantity}
              onChange={setQuantity}
              hint="for the totals"
            />
            <CmCurrencySelect value={currency} onChange={setCurrency} id="mm-currency" />
          </CmFieldGrid>
        </ToolPanel>

        <div className="space-y-6">
          {result.invalid ? <ErrorNote title="That is not possible" message={result.invalid} /> : null}

          <ToolPanel title={headings.panel}>
            <ResultStat
              label={headings.hero}
              value={
                variant === 'margin'
                  ? `${result.marginPct.toFixed(2)}%`
                  : variant === 'markup'
                    ? `${result.markupPct.toFixed(2)}%`
                    : money.exact(result.price)
              }
              hint={headings.heroHint}
              emphasis
            />
            <div className="grid grid-cols-2 gap-3">
              <CmStat label="Cost" value={money.exact(result.cost)} />
              <CmStat label="Selling price" value={money.exact(result.price)} />
              <CmStat
                label="Gross profit per unit"
                value={money.exact(result.profit)}
                tone={result.profit < 0 ? 'negative' : 'positive'}
              />
              <CmStat
                label="Price multiplier"
                value={result.cost > 0 ? `× ${(result.price / result.cost).toFixed(3)}` : '–'}
                hint="price ÷ cost"
              />
              <CmStat
                label="Margin"
                value={`${result.marginPct.toFixed(2)}%`}
                hint="profit ÷ price"
              />
              <CmStat
                label="Markup"
                value={`${result.markupPct.toFixed(2)}%`}
                hint="profit ÷ cost"
              />
            </div>
            {qty !== 1 ? (
              <div className="grid grid-cols-2 gap-3">
                <CmStat
                  label={`Revenue on ${formatNumber(qty, 0)}`}
                  value={money.exact(result.price * qty)}
                />
                <CmStat
                  label={`Profit on ${formatNumber(qty, 0)}`}
                  value={money.exact(result.profit * qty)}
                  tone={result.profit < 0 ? 'negative' : 'positive'}
                />
              </div>
            ) : null}

            <CmBreakdown
              format={money.exact}
              items={[
                { label: 'Cost of goods', value: result.cost, token: 'chart-3' },
                { label: 'Gross profit', value: Math.max(0, result.profit), token: 'chart-1' },
              ]}
              caption="How the selling price splits. Margin is the gross profit slice as a share of the whole bar."
            />
          </ToolPanel>
        </div>
      </div>

      <CmWorking
        items={[
          {
            label: 'Gross profit',
            general: 'profit = price − cost',
            steps: [`= ${formatNumber(result.price, 2)} − ${formatNumber(result.cost, 2)}`],
            result: money.exact(result.profit),
          },
          {
            label: 'Margin (share of the selling price)',
            general: 'margin % = profit ÷ price × 100',
            steps: [
              `= ${formatNumber(result.profit, 2)} ÷ ${formatNumber(result.price, 2)} × 100`,
            ],
            result: `${result.marginPct.toFixed(2)}%`,
          },
          {
            label: 'Markup (share of the cost)',
            general: 'markup % = profit ÷ cost × 100',
            steps: [`= ${formatNumber(result.profit, 2)} ÷ ${formatNumber(result.cost, 2)} × 100`],
            result: `${result.markupPct.toFixed(2)}%`,
          },
          {
            label: usesMargin ? 'Price from a target margin' : 'Price from a markup',
            general: usesMargin ? 'price = cost ÷ (1 − margin)' : 'price = cost × (1 + markup)',
            steps: [
              usesMargin
                ? `= ${formatNumber(result.cost, 2)} ÷ (1 − ${(result.marginPct / 100).toFixed(4)})`
                : `= ${formatNumber(result.cost, 2)} × (1 + ${(result.markupPct / 100).toFixed(4)})`,
            ],
            result: money.exact(result.price),
          },
          {
            label: 'Converting between the two',
            general: 'margin = markup ÷ (1 + markup) · markup = margin ÷ (1 − margin)',
            steps: [
              `margin = ${(result.markupPct / 100).toFixed(4)} ÷ (1 + ${(
                result.markupPct / 100
              ).toFixed(4)}) = ${(result.marginPct / 100).toFixed(4)}`,
            ],
            result: `${result.marginPct.toFixed(2)}% margin = ${result.markupPct.toFixed(2)}% markup`,
          },
        ]}
        note="The classic mistake: adding 30% to cost gives a 23.1% margin, not 30%. Retailers quote margin, suppliers quote markup, and the gap is real money."
      />

      <ToolPanel
        title="Bulk pricing from a pasted list"
        description={`Paste one item per line as “name, cost”, or a column of costs. Every row is priced at the ${
          usesMargin ? `${toPositive(margin)}% margin` : `${toPositive(markup)}% markup`
        } set above.`}
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => setBulkText('')}>
              Clear list
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setBulkText(
                  'Widget A, 4.20\nWidget B, 11.75\nGift box, 2.10\nShipping insert, 0.45\nBundle pack, 26.00',
                )
              }
            >
              Paste an example
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="mm-bulk">Costs to price</Label>
          <Textarea
            id="mm-bulk"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={'Widget A, 4.20\nWidget B, 11.75'}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            {bulk.length > 0
              ? `${bulk.length} row${bulk.length === 1 ? '' : 's'} priced.`
              : 'Nothing pasted yet.'}
          </p>
        </div>
        {bulk.length > 0 ? (
          <CmDataTable
            ariaLabel="Bulk pricing results"
            columns={bulkColumns}
            rows={bulk}
            pageSize={15}
            minWidth={560}
          />
        ) : null}
      </ToolPanel>

      <ToolPanel
        title="Markup to margin conversion"
        description="The table to keep open when a supplier quotes markup and your accountant asks for margin."
        footer={<CmExportBar spec={exportSpec} />}
      >
        <CmDataTable
          ariaLabel="Markup percentage converted to the equivalent margin percentage"
          columns={convColumns}
          rows={conversion}
          pageSize={15}
          minWidth={380}
        />
      </ToolPanel>

      <CmAssumptions
        items={[
          'These are gross figures based on the cost of goods only. Overheads, salaries, rent, marketing, shipping, payment-processing fees, returns and write-offs all come out of the gross profit before anything reaches the bottom line.',
          'Prices are shown excluding sales tax or VAT. Add tax after pricing, because margin is calculated on the net price.',
          'Margin is capped below 100% by definition, because profit is a share of the price. Markup has no ceiling: a 900% markup is a 90% margin.',
          'Bulk mode reads the last numeric field on each line as the cost and the first non-numeric field as the name, so both "Widget, 4.20" and a bare column of numbers work.',
          'Your cost prices stay in this tab.',
        ]}
      />
    </div>
  )
}
