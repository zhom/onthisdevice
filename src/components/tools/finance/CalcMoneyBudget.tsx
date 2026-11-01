import { useMemo, useState } from 'react'
import { Plus, Trash2, TriangleAlert } from 'lucide-react'

import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatNumber } from '@/components/tools/finance/format'

import { csvMoney, toPositive } from './calc-money-core'
import {
  CmAssumptions,
  CmBars,
  CmBreakdown,
  CmCurrencySelect,
  CmDataTable,
  CmExportBar,
  CmField,
  CmFieldGrid,
  CmSaveControl,
  CmSegmented,
  CmSelectField,
  CmStat,
  CmWorking,
  useCmStorage,
  useMoney,
} from './calc-money-ui'
import type { CmColumn } from './calc-money-ui'

type Bucket = 'needs' | 'wants' | 'savings'

const BUCKET_LABEL: Record<Bucket, string> = {
  needs: 'Needs',
  wants: 'Wants',
  savings: 'Savings & debt',
}

const BUCKET_TOKEN: Record<Bucket, string> = {
  needs: 'chart-1',
  wants: 'chart-4',
  savings: 'chart-2',
}

interface LineItem {
  id: string
  name: string
  bucket: Bucket
  amount: string
}

const DEFAULT_ITEMS: LineItem[] = [
  { id: 'b1', name: 'Rent or mortgage', bucket: 'needs', amount: '1450' },
  { id: 'b2', name: 'Utilities', bucket: 'needs', amount: '180' },
  { id: 'b3', name: 'Groceries', bucket: 'needs', amount: '420' },
  { id: 'b4', name: 'Transport', bucket: 'needs', amount: '160' },
  { id: 'b5', name: 'Eating out and takeaway', bucket: 'wants', amount: '240' },
  { id: 'b6', name: 'Subscriptions', bucket: 'wants', amount: '65' },
  { id: 'b7', name: 'Emergency fund', bucket: 'savings', amount: '300' },
  { id: 'b8', name: 'Extra debt payment', bucket: 'savings', amount: '150' },
]

type Frequency = 'monthly' | 'annual' | 'weekly' | 'biweekly' | 'semimonthly'

const FREQUENCIES: { value: Frequency; label: string; perYear: number }[] = [
  { value: 'monthly', label: 'Per month', perYear: 12 },
  { value: 'annual', label: 'Per year', perYear: 1 },
  { value: 'weekly', label: 'Per week', perYear: 52 },
  { value: 'biweekly', label: 'Every two weeks', perYear: 26 },
  { value: 'semimonthly', label: 'Twice a month', perYear: 24 },
]

export default function CalcMoneyBudget() {
  const [currency, setCurrency] = useState('USD')
  const money = useMoney(currency)

  const [income, setIncome] = useState('3800')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [needsPct, setNeedsPct] = useState('50')
  const [wantsPct, setWantsPct] = useState('30')
  const [savingsPct, setSavingsPct] = useState('20')
  const [showItems, setShowItems] = useState<'targets' | 'items'>('targets')

  const [saveOn, setSaveOn] = useState(false)
  const [items, setItems, clearStored] = useCmStorage<LineItem[]>(
    'otd:calc-money:budget',
    DEFAULT_ITEMS,
    saveOn,
  )

  const calc = useMemo(() => {
    const perYear = FREQUENCIES.find((f) => f.value === frequency)?.perYear ?? 12
    const monthly = (toPositive(income) * perYear) / 12
    const rawNeeds = toPositive(needsPct, 50)
    const rawWants = toPositive(wantsPct, 30)
    const rawSavings = toPositive(savingsPct, 20)
    const splitTotal = rawNeeds + rawWants + rawSavings || 100

    const targets: Record<Bucket, number> = {
      needs: (monthly * rawNeeds) / 100,
      wants: (monthly * rawWants) / 100,
      savings: (monthly * rawSavings) / 100,
    }

    const actual: Record<Bucket, number> = { needs: 0, wants: 0, savings: 0 }
    for (const item of items) actual[item.bucket] += toPositive(item.amount)
    const actualTotal = actual.needs + actual.wants + actual.savings

    return {
      monthly,
      annual: monthly * 12,
      weekly: (monthly * 12) / 52,
      perYear,
      rawNeeds,
      rawWants,
      rawSavings,
      splitTotal,
      targets,
      actual,
      actualTotal,
      unallocated: monthly - actualTotal,
    }
  }, [income, frequency, needsPct, wantsPct, savingsPct, items])

  const update = (id: string, patch: Partial<LineItem>) => {
    setItems((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const buckets: Bucket[] = ['needs', 'wants', 'savings']

  interface VarianceRow {
    bucket: Bucket
    target: number
    actual: number
  }
  const varianceRows: VarianceRow[] = buckets.map((b) => ({
    bucket: b,
    target: calc.targets[b],
    actual: calc.actual[b],
  }))

  const varianceColumns: CmColumn<VarianceRow>[] = [
    { key: 'bucket', header: 'Category', render: (r) => BUCKET_LABEL[r.bucket] },
    { key: 'target', header: 'Target', align: 'right', render: (r) => money.exact(r.target) },
    { key: 'actual', header: 'Planned', align: 'right', render: (r) => money.exact(r.actual) },
    {
      key: 'var',
      header: 'Variance',
      align: 'right',
      render: (r) => {
        const diff = r.target - r.actual
        return (
          <span className={diff < -0.005 ? 'text-destructive' : diff > 0.005 ? 'text-success' : ''}>
            {diff >= 0 ? '+' : '−'}
            {money.exact(Math.abs(diff)).replace('-', '')}
            <span className="sr-only">{diff >= 0 ? ' under target' : ' over target'}</span>
          </span>
        )
      },
    },
    {
      key: 'share',
      header: 'Share of income',
      align: 'right',
      hideOnMobile: true,
      render: (r) => (calc.monthly > 0 ? `${((r.actual / calc.monthly) * 100).toFixed(1)}%` : '–'),
    },
  ]

  const itemColumns: CmColumn<LineItem>[] = [
    { key: 'name', header: 'Line item', render: (r) => r.name || '–' },
    { key: 'bucket', header: 'Category', render: (r) => BUCKET_LABEL[r.bucket] },
    { key: 'amount', header: 'Per month', align: 'right', render: (r) => money.exact(toPositive(r.amount)) },
    {
      key: 'pct',
      header: '% of income',
      align: 'right',
      hideOnMobile: true,
      render: (r) =>
        calc.monthly > 0 ? `${((toPositive(r.amount) / calc.monthly) * 100).toFixed(1)}%` : '–',
    },
  ]

  const exportSpec = useMemo(
    () => ({
      filename: 'monthly-budget',
      title: '50/30/20 monthly budget',
      subtitle: `${money.exact(calc.monthly)} take-home per month · split ${calc.rawNeeds}/${
        calc.rawWants
      }/${calc.rawSavings}`,
      tables: [
        {
          name: 'Targets vs plan',
          headers: ['Category', 'Target', 'Planned', 'Variance', 'Share of income %'],
          aligns: ['left', 'right', 'right', 'right', 'right'] as ('left' | 'right')[],
          rows: varianceRows.map((r) => [
            BUCKET_LABEL[r.bucket],
            csvMoney(r.target),
            csvMoney(r.actual),
            csvMoney(r.target - r.actual),
            calc.monthly > 0 ? ((r.actual / calc.monthly) * 100).toFixed(1) : '0',
          ]),
        },
        {
          name: 'Line items',
          headers: ['Line item', 'Category', 'Per month', 'Per year'],
          aligns: ['left', 'left', 'right', 'right'] as ('left' | 'right')[],
          rows: items.map((r) => [
            r.name,
            BUCKET_LABEL[r.bucket],
            csvMoney(toPositive(r.amount)),
            csvMoney(toPositive(r.amount) * 12),
          ]),
        },
      ],
      notes: [
        `Take-home income entered as ${csvMoney(toPositive(income))} ${frequency}, normalised to ${csvMoney(calc.monthly)} per month.`,
        'The 50/30/20 rule applies to take-home (after-tax) pay, not gross salary.',
        'Employer pension or 401(k) contributions deducted before you are paid are outside this budget; count them separately.',
      ],
    }),
    [calc, currency, frequency, income, items, money, varianceRows],
  )

  const splitWarning =
    Math.abs(calc.splitTotal - 100) > 0.5
      ? `Your split adds up to ${calc.splitTotal.toFixed(0)}%, not 100%. Targets are still calculated from the percentages you entered.`
      : undefined

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ToolPanel
            title="Take-home pay"
            description="After tax and any deductions: the amount that reaches your account."
          >
            <CmFieldGrid columns={2}>
              <CmField
                id="bud-income"
                label="Income"
                value={income}
                onChange={setIncome}
                prefix={money.symbol}
                hint={
                  calc.monthly > 0 && frequency !== 'monthly'
                    ? `${money.exact(calc.monthly)} / month`
                    : undefined
                }
              />
              <CmSelectField
                id="bud-freq"
                label="Paid"
                value={frequency}
                onChange={(v) => setFrequency(v as Frequency)}
                options={FREQUENCIES.map((f) => ({ value: f.value, label: f.label }))}
              />
              <CmCurrencySelect value={currency} onChange={setCurrency} id="bud-currency" />
              <CmStat
                label="Annual take-home"
                value={money.round(calc.annual)}
                hint={`${money.round(calc.weekly)} a week`}
              />
            </CmFieldGrid>
          </ToolPanel>

          <ToolPanel
            title="Your split"
            description="50/30/20 is the starting point, not a law. Adjust it to your rent and your goals."
          >
            <CmFieldGrid columns={3}>
              <CmField
                id="bud-needs"
                label="Needs"
                value={needsPct}
                onChange={setNeedsPct}
                suffix="%"
                hint={money.round(calc.targets.needs)}
                slider={{ min: 0, max: 90, step: 1 }}
              />
              <CmField
                id="bud-wants"
                label="Wants"
                value={wantsPct}
                onChange={setWantsPct}
                suffix="%"
                hint={money.round(calc.targets.wants)}
                slider={{ min: 0, max: 90, step: 1 }}
              />
              <CmField
                id="bud-savings"
                label="Savings & debt"
                value={savingsPct}
                onChange={setSavingsPct}
                suffix="%"
                hint={money.round(calc.targets.savings)}
                slider={{ min: 0, max: 90, step: 1 }}
              />
            </CmFieldGrid>
            {splitWarning ? (
              <p className="flex items-start gap-1.5 text-xs text-foreground" role="status">
                <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                <span>{splitWarning}</span>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setNeedsPct('50')
                  setWantsPct('30')
                  setSavingsPct('20')
                }}
              >
                50 / 30 / 20
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setNeedsPct('60')
                  setWantsPct('20')
                  setSavingsPct('20')
                }}
              >
                60 / 20 / 20 (high rent)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setNeedsPct('50')
                  setWantsPct('20')
                  setSavingsPct('30')
                }}
              >
                50 / 20 / 30 (aggressive saving)
              </Button>
            </div>
          </ToolPanel>
        </div>

        <div className="space-y-6">
          <ToolPanel title="Your monthly targets">
            <ResultStat
              label={`Needs: ${calc.rawNeeds}%`}
              value={money.exact(calc.targets.needs)}
              hint="rent, utilities, groceries, transport, minimum debt payments, insurance"
              emphasis
            />
            <div className="grid grid-cols-2 gap-3">
              <CmStat
                label={`Wants: ${calc.rawWants}%`}
                value={money.exact(calc.targets.wants)}
                hint="everything you would cut in a bad month"
              />
              <CmStat
                label={`Savings & debt: ${calc.rawSavings}%`}
                value={money.exact(calc.targets.savings)}
                hint="emergency fund, investing, extra debt payments"
              />
              <CmStat
                label="Savings per year"
                value={money.round(calc.targets.savings * 12)}
                hint="if you hit the target every month"
              />
              <CmStat
                label="Three-month emergency fund"
                value={money.round(calc.targets.needs * 3)}
                hint="three months of needs"
              />
            </div>

            <CmBreakdown
              format={money.exact}
              items={buckets.map((b) => ({
                label: `${BUCKET_LABEL[b]} target`,
                value: calc.targets[b],
                token: BUCKET_TOKEN[b],
              }))}
              caption="Where every unit of take-home pay is meant to go."
            />
          </ToolPanel>

          <ToolPanel
            title="Target vs plan"
            description="Fill in the line items below and this fills itself in."
          >
            <CmBars
              ariaLabel="Planned spending against target for each category"
              format={money.exact}
              rows={buckets.flatMap((b) => [
                { label: `${BUCKET_LABEL[b]} target`, value: calc.targets[b], token: BUCKET_TOKEN[b] },
                {
                  label: `${BUCKET_LABEL[b]} planned`,
                  value: calc.actual[b],
                  token: BUCKET_TOKEN[b],
                  hint:
                    calc.actual[b] > calc.targets[b] + 0.005
                      ? `over by ${money.exact(calc.actual[b] - calc.targets[b])}`
                      : `under by ${money.exact(calc.targets[b] - calc.actual[b])}`,
                },
              ])}
            />
            <CmStat
              label="Left unallocated"
              value={money.exact(calc.unallocated)}
              tone={calc.unallocated < -0.005 ? 'negative' : 'positive'}
              hint={
                calc.unallocated < -0.005
                  ? 'your plan spends more than you take home'
                  : 'assign this to savings or a specific goal'
              }
            />
          </ToolPanel>
        </div>
      </div>

      <ToolPanel
        title="Line items"
        description="Optional, but this is where a budget stops being a slogan and starts being a plan."
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setItems((rows) => [
                  ...rows,
                  { id: `item-${Date.now()}`, name: '', bucket: 'needs', amount: '' },
                ])
              }
            >
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              Add a line
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setItems(DEFAULT_ITEMS.map((row) => ({ ...row })))}
            >
              Reset to the example
            </Button>
            <CmSegmented
              label="Line item view"
              value={showItems}
              onChange={setShowItems}
              options={[
                { value: 'targets', label: 'Edit' },
                { value: 'items', label: 'Summary' },
              ]}
            />
          </>
        }
      >
        {showItems === 'targets' ? (
          <div className="space-y-3">
            {items.map((row, index) => (
              <div
                key={row.id}
                className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 sm:grid-cols-8"
              >
                <div className="col-span-2 space-y-1.5 sm:col-span-3">
                  <Label htmlFor={`${row.id}-name`} className="text-sm">
                    Line item
                  </Label>
                  <Input
                    id={`${row.id}-name`}
                    value={row.name}
                    autoComplete="off"
                    placeholder="e.g. Phone bill"
                    onChange={(e) => update(row.id, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor={`${row.id}-bucket`} className="text-sm">
                    Category
                  </Label>
                  <Select
                    value={row.bucket}
                    onValueChange={(v) => update(row.id, { bucket: v as Bucket })}
                  >
                    <SelectTrigger id={`${row.id}-bucket`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {buckets.map((b) => (
                        <SelectItem key={b} value={b}>
                          {BUCKET_LABEL[b]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <CmField
                  id={`${row.id}-amount`}
                  label="Per month"
                  value={row.amount}
                  onChange={(v) => update(row.id, { amount: v })}
                  prefix={money.symbol}
                  className="sm:col-span-2"
                />
                <div className="flex items-end justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.name || `line ${index + 1}`}`}
                    onClick={() => setItems((rows) => rows.filter((r) => r.id !== row.id))}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
            {items.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No line items yet. Add one to compare your real spending against the targets.
              </p>
            ) : null}
          </div>
        ) : (
          <CmDataTable
            ariaLabel="Budget line items"
            columns={itemColumns}
            rows={items}
            pageSize={20}
            minWidth={480}
            emptyMessage="No line items yet."
          />
        )}

        <CmSaveControl
          id="bud-save"
          what="this budget"
          enabled={saveOn}
          onToggle={setSaveOn}
          onClear={() => {
            clearStored()
            setItems(DEFAULT_ITEMS.map((row) => ({ ...row })))
          }}
        />
      </ToolPanel>

      <ToolPanel
        title="Variance"
        description="Positive means you have room left in that category; negative means the plan is over."
        footer={<CmExportBar spec={exportSpec} />}
      >
        <CmDataTable
          ariaLabel="Budget targets against planned spending"
          columns={varianceColumns}
          rows={varianceRows}
          pageSize={10}
          minWidth={520}
        />
      </ToolPanel>

      <CmWorking
        items={[
          {
            label: 'Monthly take-home',
            general: 'monthly = amount × payments per year ÷ 12',
            steps: [`= ${formatNumber(toPositive(income), 2)} × ${calc.perYear} ÷ 12`],
            result: money.exact(calc.monthly),
          },
          {
            label: 'Needs target',
            general: 'needs = monthly × needs %',
            steps: [`= ${formatNumber(calc.monthly, 2)} × ${calc.rawNeeds}%`],
            result: money.exact(calc.targets.needs),
          },
          {
            label: 'Wants target',
            general: 'wants = monthly × wants %',
            steps: [`= ${formatNumber(calc.monthly, 2)} × ${calc.rawWants}%`],
            result: money.exact(calc.targets.wants),
          },
          {
            label: 'Savings target',
            general: 'savings = monthly × savings %',
            steps: [`= ${formatNumber(calc.monthly, 2)} × ${calc.rawSavings}%`],
            result: money.exact(calc.targets.savings),
          },
          {
            label: 'Unallocated',
            general: 'left over = monthly − Σ line items',
            steps: [`= ${formatNumber(calc.monthly, 2)} − ${formatNumber(calc.actualTotal, 2)}`],
            result: money.exact(calc.unallocated),
          },
        ]}
        note="Percentages are applied to take-home pay. If you enter gross salary the targets will be too high by roughly your average tax rate."
      />

      <CmAssumptions
        items={[
          'The 50/30/20 rule, popularised by Elizabeth Warren and Amelia Warren Tyagi in All Your Worth (2005), splits after-tax income into needs, wants and savings.',
          'Minimum debt payments count as needs; anything paid above the minimum counts as savings, because it is buying down future interest.',
          'Weekly and fortnightly pay are annualised at 52 and 26 periods and divided by twelve, so a "monthly" figure includes the two extra pay packets those schedules produce each year.',
          'Employer pension contributions and payroll deductions taken before you are paid are outside this budget. It starts from what reaches your account.',
          'Nothing you type is uploaded. The save switch writes only to this browser’s local storage, and the delete button clears it.',
        ]}
      />
    </div>
  )
}
