import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  CmSegmented,
  CmSelectField,
  CmStat,
  CmWorking,
  useMoney,
} from './calc-money-ui'
import type { CmColumn } from './calc-money-ui'

export type TaxVariant = 'vat' | 'gst'

/**
 * Static rate tables. These are data, not a live feed — the site makes no
 * network requests, so the "as of" date is shown on the page and the user can
 * always type their own rate.
 */
const RATES_AS_OF = '1 July 2026'

interface RatePreset {
  value: string
  label: string
  rate: number
  currency?: string
}

const VAT_PRESETS: RatePreset[] = [
  { value: 'uk-20', label: 'United Kingdom: standard 20%', rate: 20, currency: 'GBP' },
  { value: 'uk-5', label: 'United Kingdom: reduced 5%', rate: 5, currency: 'GBP' },
  { value: 'ie-23', label: 'Ireland: standard 23%', rate: 23, currency: 'EUR' },
  { value: 'ie-13.5', label: 'Ireland: reduced 13.5%', rate: 13.5, currency: 'EUR' },
  { value: 'de-19', label: 'Germany: standard 19%', rate: 19, currency: 'EUR' },
  { value: 'de-7', label: 'Germany: reduced 7%', rate: 7, currency: 'EUR' },
  { value: 'fr-20', label: 'France: standard 20%', rate: 20, currency: 'EUR' },
  { value: 'fr-5.5', label: 'France: reduced 5.5%', rate: 5.5, currency: 'EUR' },
  { value: 'nl-21', label: 'Netherlands: standard 21%', rate: 21, currency: 'EUR' },
  { value: 'es-21', label: 'Spain: standard 21%', rate: 21, currency: 'EUR' },
  { value: 'it-22', label: 'Italy: standard 22%', rate: 22, currency: 'EUR' },
  { value: 'be-21', label: 'Belgium: standard 21%', rate: 21, currency: 'EUR' },
  { value: 'pl-23', label: 'Poland: standard 23%', rate: 23, currency: 'PLN' },
  { value: 'se-25', label: 'Sweden: standard 25%', rate: 25, currency: 'SEK' },
  { value: 'dk-25', label: 'Denmark: standard 25%', rate: 25, currency: 'DKK' },
  { value: 'pt-23', label: 'Portugal: standard 23%', rate: 23, currency: 'EUR' },
  { value: 'at-20', label: 'Austria: standard 20%', rate: 20, currency: 'EUR' },
  { value: 'ch-8.1', label: 'Switzerland: standard 8.1%', rate: 8.1, currency: 'CHF' },
  { value: 'za-15', label: 'South Africa: standard 15%', rate: 15, currency: 'ZAR' },
  { value: 'custom', label: 'Custom rate', rate: 20 },
]

const GST_PRESETS: RatePreset[] = [
  { value: 'au-10', label: 'Australia: GST 10%', rate: 10, currency: 'AUD' },
  { value: 'nz-15', label: 'New Zealand: GST 15%', rate: 15, currency: 'NZD' },
  { value: 'sg-9', label: 'Singapore: GST 9%', rate: 9, currency: 'SGD' },
  { value: 'in-5', label: 'India: GST 5%', rate: 5, currency: 'INR' },
  { value: 'in-18', label: 'India: GST 18%', rate: 18, currency: 'INR' },
  { value: 'in-40', label: 'India: GST 40%', rate: 40, currency: 'INR' },
  { value: 'ca-5', label: 'Canada: GST 5% (AB, NT, NU, YT)', rate: 5, currency: 'CAD' },
  { value: 'ca-13', label: 'Canada: HST 13% (Ontario)', rate: 13, currency: 'CAD' },
  { value: 'ca-14', label: 'Canada: HST 14% (Nova Scotia)', rate: 14, currency: 'CAD' },
  { value: 'ca-15', label: 'Canada: HST 15% (NB, NL, PE)', rate: 15, currency: 'CAD' },
  { value: 'my-8', label: 'Malaysia: service tax 8%', rate: 8, currency: 'MYR' },
  { value: 'custom', label: 'Custom rate', rate: 10 },
]

interface LineRow {
  id: string
  description: string
  amount: string
  rate: string
}

type Direction = 'add' | 'remove'

/**
 * Net, tax and gross to the cent. The tax is rounded once and the third
 * figure is derived from it, so net + tax always equals gross on screen.
 * Removing tax: tax = gross × r / (100 + r).
 */
function splitTax(value: Decimal, r: number, direction: Direction) {
  const cents = (x: Decimal) => x.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  const amount = cents(value)
  if (direction === 'add') {
    const tax = cents(amount.times(r).div(100))
    return { net: amount, tax, gross: amount.plus(tax) }
  }
  const tax = cents(amount.times(r).div(100 + r))
  return { net: amount.minus(tax), tax, gross: amount }
}

const LABELS: Record<TaxVariant, { tax: string; long: string; net: string; gross: string }> = {
  vat: { tax: 'VAT', long: 'value added tax', net: 'Net (excluding VAT)', gross: 'Gross (including VAT)' },
  gst: { tax: 'GST', long: 'goods and services tax', net: 'Net (excluding GST)', gross: 'Gross (including GST)' },
}

export default function CalcMoneyVat({ variant = 'vat' }: { variant?: TaxVariant }) {
  const presets = variant === 'vat' ? VAT_PRESETS : GST_PRESETS
  const labels = LABELS[variant]
  const firstPreset = presets[0]!

  const [currency, setCurrency] = useState(firstPreset.currency ?? 'USD')
  const money = useMoney(currency)

  const [preset, setPreset] = useState(firstPreset.value)
  const [rate, setRate] = useState(String(firstPreset.rate))
  const [direction, setDirection] = useState<Direction>('add')
  const [amount, setAmount] = useState('1000')

  const [lines, setLines] = useState<LineRow[]>([
    { id: 'l1', description: 'Consultancy, 10 hours', amount: '850', rate: String(firstPreset.rate) },
    { id: 'l2', description: 'Materials', amount: '124.50', rate: String(firstPreset.rate) },
  ])

  const applyPreset = (value: string) => {
    setPreset(value)
    const found = presets.find((p) => p.value === value)
    if (found && value !== 'custom') {
      setRate(String(found.rate))
      if (found.currency) setCurrency(found.currency)
      setLines((rows) => rows.map((row) => ({ ...row, rate: String(found.rate) })))
    }
  }

  const calc = useMemo(() => {
    const r = Math.max(0, toPositive(rate))
    const factor = d(1).plus(d(r).div(100))
    const input = d(toPositive(amount))

    const { net, tax, gross } = splitTax(input, r, direction)

    return {
      r,
      net: net.toNumber(),
      tax: tax.toNumber(),
      gross: gross.toNumber(),
      factor: factor.toNumber(),
      /** Divisor used when working backwards from a gross amount. */
      divisor: factor.toNumber(),
      /** The "VAT fraction" HMRC-style: 20% → 1/6. */
      fraction: r > 0 ? `${r} / ${100 + r}` : '0',
      fractionValue: r > 0 ? r / (100 + r) : 0,
    }
  }, [rate, amount, direction])

  interface LineResult extends LineRow {
    net: number
    tax: number
    gross: number
    rateN: number
  }

  const lineResults: LineResult[] = useMemo(
    () =>
      lines.map((row) => {
        const r = Math.max(0, toPositive(row.rate))
        const { net, tax, gross } = splitTax(d(toPositive(row.amount)), r, direction)
        return { ...row, rateN: r, net: net.toNumber(), tax: tax.toNumber(), gross: gross.toNumber() }
      }),
    [lines, direction],
  )

  const totals = useMemo(
    () =>
      lineResults.reduce(
        (acc, row) => ({
          net: acc.net + row.net,
          tax: acc.tax + row.tax,
          gross: acc.gross + row.gross,
        }),
        { net: 0, tax: 0, gross: 0 },
      ),
    [lineResults],
  )

  const update = (id: string, patch: Partial<LineRow>) =>
    setLines((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))

  const lineColumns: CmColumn<LineResult>[] = [
    { key: 'desc', header: 'Description', render: (r) => r.description || '–' },
    { key: 'rate', header: 'Rate', align: 'right', render: (r) => `${r.rateN}%` },
    { key: 'net', header: labels.net, align: 'right', render: (r) => money.exact(r.net) },
    { key: 'tax', header: labels.tax, align: 'right', render: (r) => money.exact(r.tax) },
    { key: 'gross', header: labels.gross, align: 'right', render: (r) => money.exact(r.gross) },
  ]

  interface QuickRow {
    rate: number
    net: number
    tax: number
    gross: number
  }
  const quick: QuickRow[] = useMemo(() => {
    const base = toPositive(amount) || 100
    const rates = variant === 'vat' ? [5, 7, 9, 10, 12, 15, 19, 20, 21, 23, 25] : [5, 6, 9, 10, 12, 13, 15, 18, 28]
    return rates.map((r) => {
      const factor = 1 + r / 100
      const net = direction === 'add' ? base : base / factor
      const tax = direction === 'add' ? (base * r) / 100 : base - net
      return { rate: r, net, tax, gross: net + tax }
    })
  }, [amount, direction, variant])

  const quickColumns: CmColumn<QuickRow>[] = [
    { key: 'rate', header: 'Rate', render: (r) => `${r.rate}%` },
    { key: 'net', header: 'Net', align: 'right', render: (r) => money.exact(r.net) },
    { key: 'tax', header: labels.tax, align: 'right', render: (r) => money.exact(r.tax) },
    { key: 'gross', header: 'Gross', align: 'right', render: (r) => money.exact(r.gross) },
  ]

  const exportSpec = useMemo(
    () => ({
      filename: variant === 'vat' ? 'vat-calculation' : 'gst-calculation',
      title: `${labels.tax} calculation`,
      subtitle: `${direction === 'add' ? 'Adding' : 'Removing'} ${calc.r}% ${labels.tax} · ${currency}`,
      tables: [
        {
          name: 'Invoice lines',
          headers: ['Description', 'Rate %', 'Net', labels.tax, 'Gross'],
          aligns: ['left', 'right', 'right', 'right', 'right'] as ('left' | 'right')[],
          rows: [
            ...lineResults.map((r) => [
              r.description,
              r.rateN,
              csvMoney(r.net),
              csvMoney(r.tax),
              csvMoney(r.gross),
            ]),
            ['TOTAL', '', csvMoney(totals.net), csvMoney(totals.tax), csvMoney(totals.gross)],
          ] as (string | number)[][],
        },
        {
          name: 'Single amount',
          headers: ['Field', 'Value'],
          aligns: ['left', 'right'] as ('left' | 'right')[],
          rows: [
            ['Direction', direction === 'add' ? `Add ${labels.tax}` : `Remove ${labels.tax}`],
            ['Rate %', calc.r],
            ['Net', csvMoney(calc.net)],
            [labels.tax, csvMoney(calc.tax)],
            ['Gross', csvMoney(calc.gross)],
          ] as (string | number)[][],
        },
      ],
      notes: [
        `Rates shown are the published standard and reduced rates as of ${RATES_AS_OF}. They are stored in the page, never fetched, so check the current rate with your tax authority before filing.`,
        'Each line is rounded to two decimals independently, which is how most invoicing software behaves. Rounding the total instead can differ by a cent.',
      ],
    }),
    [calc, currency, direction, labels, lineResults, totals, variant],
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ToolPanel
          title={`${labels.tax} on one amount`}
          description={`Add ${labels.tax} to a net figure, or strip it back out of a gross one.`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              Direction
            </span>
            <CmSegmented
              label={`Add or remove ${labels.tax}`}
              value={direction}
              onChange={setDirection}
              options={[
                { value: 'add', label: `Add ${labels.tax}` },
                { value: 'remove', label: `Remove ${labels.tax}` },
              ]}
            />
          </div>

          <CmFieldGrid columns={2}>
            <CmField
              id="vat-amount"
              label={direction === 'add' ? 'Amount excluding tax' : 'Amount including tax'}
              value={amount}
              onChange={setAmount}
              prefix={money.symbol}
            />
            <CmField
              id="vat-rate"
              label={`${labels.tax} rate`}
              value={rate}
              onChange={(v) => {
                setRate(v)
                setPreset('custom')
              }}
              suffix="%"
              slider={{ min: 0, max: 30, step: 0.1 }}
            />
            <CmSelectField
              id="vat-preset"
              label="Country preset"
              value={preset}
              onChange={applyPreset}
              options={presets.map((p) => ({ value: p.value, label: p.label }))}
              hint={`as of ${RATES_AS_OF}`}
            />
            <CmCurrencySelect value={currency} onChange={setCurrency} id="vat-currency" />
          </CmFieldGrid>
        </ToolPanel>

        <ToolPanel title="Result">
          <ResultStat
            label={direction === 'add' ? labels.gross : labels.net}
            value={money.exact(direction === 'add' ? calc.gross : calc.net)}
            hint={
              direction === 'add'
                ? `${money.exact(calc.net)} + ${money.exact(calc.tax)} ${labels.tax}`
                : `${money.exact(calc.gross)} − ${money.exact(calc.tax)} ${labels.tax}`
            }
            emphasis
          />
          <div className="grid grid-cols-3 gap-3">
            <CmStat label="Net" value={money.exact(calc.net)} />
            <CmStat label={labels.tax} value={money.exact(calc.tax)} hint={`at ${calc.r}%`} />
            <CmStat label="Gross" value={money.exact(calc.gross)} />
          </div>
          <CmBreakdown
            format={money.exact}
            items={[
              { label: `Net ${labels.long}-free amount`, value: calc.net, token: 'chart-1' },
              { label: `${labels.tax} at ${calc.r}%`, value: calc.tax, token: 'chart-4' },
            ]}
            caption={`The tax fraction of a gross amount at ${calc.r}% is ${calc.fraction} = ${calc.fractionValue.toFixed(
              4,
            )}.`}
          />
        </ToolPanel>
      </div>

      <CmWorking
        items={
          direction === 'add'
            ? [
                {
                  label: `${labels.tax} due`,
                  general: 'tax = net × rate',
                  steps: [`= ${formatNumber(calc.net, 2)} × ${calc.r}%`],
                  result: money.exact(calc.tax),
                },
                {
                  label: 'Gross amount',
                  general: 'gross = net × (1 + rate)',
                  steps: [`= ${formatNumber(calc.net, 2)} × ${calc.factor.toFixed(4)}`],
                  result: money.exact(calc.gross),
                },
              ]
            : [
                {
                  label: 'Net amount',
                  general: 'net = gross ÷ (1 + rate)',
                  steps: [`= ${formatNumber(calc.gross, 2)} ÷ ${calc.divisor.toFixed(4)}`],
                  result: money.exact(calc.net),
                },
                {
                  label: `${labels.tax} inside the gross figure`,
                  general: `tax = gross × rate ÷ (100 + rate), the "${labels.tax} fraction"`,
                  steps: [
                    `= ${formatNumber(calc.gross, 2)} × ${calc.fraction}`,
                    `= ${formatNumber(calc.gross, 2)} × ${calc.fractionValue.toFixed(6)}`,
                  ],
                  result: money.exact(calc.tax),
                },
              ]
        }
        note={`Dividing by ${calc.factor.toFixed(2)} is the only correct way to strip ${labels.tax} out of a gross amount. Subtracting ${calc.r}% from the gross figure gives the wrong answer, because it takes ${calc.r}% of the larger number.`}
      />

      <ToolPanel
        title="Multi-line invoice"
        description={`Each line is rounded to the minor unit on its own, the way accounting software does it. Mixed rates on one invoice are supported.`}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLines((rows) => [
                  ...rows,
                  { id: `line-${Date.now()}`, description: '', amount: '', rate: String(calc.r) },
                ])
              }
            >
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              Add a line
            </Button>
            <CmExportBar spec={exportSpec} />
          </>
        }
      >
        <div className="space-y-3">
          {lines.map((row, index) => (
            <div
              key={row.id}
              className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 sm:grid-cols-8"
            >
              <div className="col-span-2 space-y-1.5 sm:col-span-4">
                <Label htmlFor={`${row.id}-desc`} className="text-sm">
                  Description
                </Label>
                <Input
                  id={`${row.id}-desc`}
                  value={row.description}
                  autoComplete="off"
                  placeholder="e.g. Design work"
                  onChange={(e) => update(row.id, { description: e.target.value })}
                />
              </div>
              <CmField
                id={`${row.id}-amount`}
                label={direction === 'add' ? 'Net' : 'Gross'}
                value={row.amount}
                onChange={(v) => update(row.id, { amount: v })}
                prefix={money.symbol}
                className="sm:col-span-2"
              />
              <CmField
                id={`${row.id}-rate`}
                label="Rate"
                value={row.rate}
                onChange={(v) => update(row.id, { rate: v })}
                suffix="%"
                className="sm:col-span-1"
              />
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove line ${index + 1}`}
                  disabled={lines.length <= 1}
                  onClick={() => setLines((rows) => rows.filter((r) => r.id !== row.id))}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <CmDataTable
          ariaLabel={`Invoice lines with ${labels.tax}`}
          columns={lineColumns}
          rows={lineResults}
          pageSize={20}
          minWidth={540}
        />

        <div className="grid grid-cols-3 gap-3">
          <CmStat label="Total net" value={money.exact(totals.net)} />
          <CmStat label={`Total ${labels.tax}`} value={money.exact(totals.tax)} />
          <CmStat label="Total gross" value={money.exact(totals.gross)} />
        </div>
      </ToolPanel>

      <ToolPanel
        title={`The same amount at every ${labels.tax} rate`}
        description={`${direction === 'add' ? 'Adding to' : 'Stripping out of'} ${money.exact(
          toPositive(amount),
        )}.`}
      >
        <CmDataTable
          ariaLabel={`The entered amount at each common ${labels.tax} rate`}
          columns={quickColumns}
          rows={quick}
          pageSize={12}
          minWidth={420}
        />
      </ToolPanel>

      <CmAssumptions
        items={[
          `Rate presets are static data held in the page as of ${RATES_AS_OF}. Nothing is fetched, so the rates do not change or update on their own. Confirm against your tax authority before you file anything.`,
          'Reduced, zero and exempt categories differ by country and by product. Only the headline standard and common reduced rates are listed.',
          'Each invoice line is rounded to two decimals independently. Some jurisdictions require rounding the invoice total instead; the difference is at most a cent per line.',
          variant === 'gst'
            ? 'Canadian provinces charge GST alone, GST plus a separate PST, or a combined HST. The presets cover GST and HST; a province with separate PST needs both rates entered as two lines.'
            : 'Reverse-charge, margin-scheme and partial-exemption treatments are outside the scope of a rate calculator.',
          'Nothing you enter is transmitted. Invoice figures stay in this browser tab.',
        ]}
      />
    </div>
  )
}
