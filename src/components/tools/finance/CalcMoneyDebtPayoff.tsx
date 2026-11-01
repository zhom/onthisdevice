import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatNumber } from '@/components/tools/finance/format'

import {
  Decimal,
  ZERO,
  addMonths,
  csvMoney,
  d,
  formatLongDate,
  formatMonths,
  formatMonthYear,
  isoDate,
  toPositive,
} from './calc-money-core'
import {
  CmAssumptions,
  CmBars,
  CmCurrencySelect,
  CmDataTable,
  CmExportBar,
  CmField,
  CmLineChart,
  CmSaveControl,
  CmSegmented,
  CmStat,
  CmWorking,
  useCmStorage,
  useCmToday,
  useMoney,
} from './calc-money-ui'
import type { CmColumn } from './calc-money-ui'

interface DebtInput {
  id: string
  name: string
  balance: string
  apr: string
  minimum: string
}

interface MonthRow {
  n: number
  date: Date
  paid: number
  interest: number
  principal: number
  balance: number
  clearedNames: string[]
}

interface DebtOutcome {
  name: string
  order: number
  startBalance: number
  apr: number
  interest: number
  paid: number
  months: number
  payoffDate: Date
}

interface Simulation {
  rows: MonthRow[]
  outcomes: DebtOutcome[]
  months: number
  totalInterest: number
  totalPaid: number
  neverClears: boolean
  payoffDate: Date
}

type Strategy = 'snowball' | 'avalanche'

const MAX_MONTHS = 600

const NEW_DEBT = (i: number): DebtInput => ({
  id: `debt-${Date.now()}-${i}`,
  name: `Debt ${i}`,
  balance: '',
  apr: '',
  minimum: '',
})

const DEFAULT_DEBTS: DebtInput[] = [
  { id: 'seed-1', name: 'Store card', balance: '1200', apr: '26.9', minimum: '35' },
  { id: 'seed-2', name: 'Credit card', balance: '5400', apr: '19.9', minimum: '110' },
  { id: 'seed-3', name: 'Car loan', balance: '9800', apr: '7.4', minimum: '265' },
]

/**
 * Simulate paying every debt's minimum, then throwing the extra budget plus
 * every freed-up minimum at one target debt at a time (the "rollover" that
 * makes both strategies work).
 */
function simulate(debts: DebtInput[], extra: number, strategy: Strategy, start: Date): Simulation {
  interface Live {
    name: string
    balance: Decimal
    rate: Decimal
    apr: number
    minimum: Decimal
    startBalance: number
    interest: Decimal
    paid: Decimal
    clearedAt: number | null
  }

  const live: Live[] = debts
    .map((row) => {
      const balance = toPositive(row.balance)
      return {
        name: row.name.trim() || 'Debt',
        balance: d(balance),
        rate: d(Math.max(0, toPositive(row.apr))).div(100).div(12),
        apr: Math.max(0, toPositive(row.apr)),
        minimum: d(toPositive(row.minimum)),
        startBalance: balance,
        interest: ZERO,
        paid: ZERO,
        clearedAt: null as number | null,
      }
    })
    .filter((row) => row.balance.gt(0))

  const rows: MonthRow[] = []
  if (live.length === 0) {
    return {
      rows,
      outcomes: [],
      months: 0,
      totalInterest: 0,
      totalPaid: 0,
      neverClears: false,
      payoffDate: start,
    }
  }

  /* Payment order is fixed at the start — that is what makes a plan followable. */
  const order = [...live].sort((a, b) =>
    strategy === 'snowball'
      ? a.startBalance - b.startBalance || b.apr - a.apr
      : b.apr - a.apr || a.startBalance - b.startBalance,
  )
  const budget = d(extra).plus(live.reduce((sum, row) => sum.plus(row.minimum), ZERO))

  let totalInterest = ZERO
  let totalPaid = ZERO
  let n = 0

  while (live.some((row) => row.balance.gt(0)) && n < MAX_MONTHS) {
    n += 1
    let pot = budget
    let monthInterest = ZERO
    let monthPaid = ZERO
    let monthPrincipal = ZERO
    const cleared: string[] = []

    /* 1. Interest first, on every open balance. */
    for (const row of live) {
      if (row.balance.lte(0)) continue
      const interest = row.balance.times(row.rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      row.balance = row.balance.plus(interest)
      row.interest = row.interest.plus(interest)
      monthInterest = monthInterest.plus(interest)
    }

    /* 2. Minimums on everything except the target. */
    const target = order.find((row) => row.balance.gt(0))
    for (const row of live) {
      if (row.balance.lte(0) || row === target) continue
      let pay = Decimal.min(row.minimum, row.balance, pot)
      if (pay.lt(0)) pay = ZERO
      row.balance = row.balance.minus(pay)
      row.paid = row.paid.plus(pay)
      pot = pot.minus(pay)
      monthPaid = monthPaid.plus(pay)
    }

    /* 3. Everything left goes at the target debt; once it clears, the rest
          of this month's money rolls straight on to the next one in order. */
    for (const row of order) {
      if (pot.lte(0)) break
      if (row.balance.lte(0)) continue
      const pay = Decimal.min(pot, row.balance)
      row.balance = row.balance.minus(pay)
      row.paid = row.paid.plus(pay)
      pot = pot.minus(pay)
      monthPaid = monthPaid.plus(pay)
    }

    for (const row of live) {
      if (row.balance.abs().lt(0.005)) row.balance = ZERO
      if (row.balance.lte(0) && row.clearedAt === null) {
        row.clearedAt = n
        cleared.push(row.name)
      }
    }

    monthPrincipal = monthPaid.minus(monthInterest)
    totalInterest = totalInterest.plus(monthInterest)
    totalPaid = totalPaid.plus(monthPaid)

    rows.push({
      n,
      date: addMonths(start, n - 1),
      paid: monthPaid.toNumber(),
      interest: monthInterest.toNumber(),
      principal: monthPrincipal.toNumber(),
      balance: live.reduce((sum, row) => sum.plus(row.balance), ZERO).toNumber(),
      clearedNames: cleared,
    })

    /* Guard: if nothing was repaid this month the budget can never clear it. */
    if (monthPrincipal.lte(0) && n > 1) break
  }

  const neverClears = live.some((row) => row.balance.gt(0))
  const outcomes: DebtOutcome[] = order.map((row, i) => ({
    name: row.name,
    order: i + 1,
    startBalance: row.startBalance,
    apr: row.apr,
    interest: row.interest.toNumber(),
    paid: row.paid.toNumber(),
    months: row.clearedAt ?? 0,
    payoffDate: addMonths(start, (row.clearedAt ?? 1) - 1),
  }))

  const last = rows[rows.length - 1]
  return {
    rows,
    outcomes,
    months: rows.length,
    totalInterest: totalInterest.toNumber(),
    totalPaid: totalPaid.toNumber(),
    neverClears,
    payoffDate: last ? last.date : start,
  }
}

export default function CalcMoneyDebtPayoff() {
  const today = useCmToday()
  const [currency, setCurrency] = useState('USD')
  const money = useMoney(currency)

  const [saveOn, setSaveOn] = useState(false)
  const [debts, setDebts, clearStored] = useCmStorage<DebtInput[]>(
    'otd:calc-money:debts',
    DEFAULT_DEBTS,
    saveOn,
  )
  const [extra, setExtra] = useState('200')
  const [strategy, setStrategy] = useState<Strategy>('avalanche')

  const start = useMemo(() => addMonths(today, 1), [today])

  const calc = useMemo(() => {
    const extraN = toPositive(extra)
    const snowball = simulate(debts, extraN, 'snowball', start)
    const avalanche = simulate(debts, extraN, 'avalanche', start)
    const active = strategy === 'snowball' ? snowball : avalanche
    const other = strategy === 'snowball' ? avalanche : snowball

    const totalBalance = debts.reduce((sum, row) => sum + toPositive(row.balance), 0)
    const totalMinimums = debts.reduce((sum, row) => sum + toPositive(row.minimum), 0)
    const weightedApr =
      totalBalance > 0
        ? debts.reduce((sum, row) => sum + toPositive(row.balance) * toPositive(row.apr), 0) /
          totalBalance
        : 0

    return {
      extraN,
      snowball,
      avalanche,
      active,
      other,
      totalBalance,
      totalMinimums,
      weightedApr,
      monthlyBudget: totalMinimums + extraN,
      interestGap: snowball.totalInterest - avalanche.totalInterest,
      monthGap: snowball.months - avalanche.months,
    }
  }, [debts, extra, strategy, start])

  const noDebts = calc.totalBalance <= 0
  const stalled =
    !noDebts && calc.active.neverClears
      ? `A budget of ${money.exact(
          calc.monthlyBudget,
        )} a month does not keep up with the interest on these balances. Increase the extra payment, or check the minimums you entered.`
      : undefined

  const update = (id: string, patch: Partial<DebtInput>) => {
    setDebts((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const orderColumns: CmColumn<DebtOutcome>[] = [
    { key: 'order', header: 'Order', render: (r) => r.order },
    { key: 'name', header: 'Debt', render: (r) => r.name },
    { key: 'bal', header: 'Balance', align: 'right', render: (r) => money.exact(r.startBalance) },
    { key: 'apr', header: 'APR', align: 'right', render: (r) => `${r.apr}%` },
    {
      key: 'interest',
      header: 'Interest paid',
      align: 'right',
      render: (r) => money.exact(r.interest),
    },
    {
      key: 'clear',
      header: 'Cleared',
      align: 'right',
      render: (r) => (r.months > 0 ? formatMonthYear(r.payoffDate) : 'not cleared'),
    },
  ]

  const monthColumns: CmColumn<MonthRow>[] = [
    { key: 'n', header: '#', render: (r) => r.n },
    { key: 'date', header: 'Month', render: (r) => formatMonthYear(r.date) },
    { key: 'paid', header: 'Paid', align: 'right', render: (r) => money.exact(r.paid) },
    { key: 'interest', header: 'Interest', align: 'right', render: (r) => money.exact(r.interest) },
    {
      key: 'principal',
      header: 'Debt cleared',
      align: 'right',
      hideOnMobile: true,
      render: (r) => money.exact(r.principal),
    },
    { key: 'balance', header: 'Total owed', align: 'right', render: (r) => money.exact(r.balance) },
    {
      key: 'cleared',
      header: 'Milestone',
      hideOnMobile: true,
      render: (r) => (r.clearedNames.length > 0 ? `${r.clearedNames.join(', ')} paid off` : '–'),
    },
  ]

  const exportSpec = useMemo(
    () => ({
      filename: `debt-${strategy}-plan`,
      title: `Debt payoff plan (${strategy === 'snowball' ? 'snowball' : 'avalanche'})`,
      subtitle: `${money.exact(calc.totalBalance)} across ${
        calc.active.outcomes.length
      } debts, ${money.exact(calc.monthlyBudget)} a month`,
      tables: [
        {
          name: 'Payoff order',
          headers: ['Order', 'Debt', 'Balance', 'APR %', 'Interest paid', 'Total paid', 'Cleared'],
          aligns: ['left', 'left', 'right', 'right', 'right', 'right', 'left'] as ('left' | 'right')[],
          rows: calc.active.outcomes.map((o) => [
            o.order,
            o.name,
            csvMoney(o.startBalance),
            o.apr,
            csvMoney(o.interest),
            csvMoney(o.paid),
            o.months > 0 ? isoDate(o.payoffDate) : 'not cleared',
          ]),
        },
        {
          name: 'Monthly plan',
          headers: ['#', 'Month', 'Paid', 'Interest', 'Debt cleared', 'Total owed', 'Milestone'],
          aligns: ['left', 'left', 'right', 'right', 'right', 'right', 'left'] as ('left' | 'right')[],
          rows: calc.active.rows.map((r) => [
            r.n,
            isoDate(r.date),
            csvMoney(r.paid),
            csvMoney(r.interest),
            csvMoney(r.principal),
            csvMoney(r.balance),
            r.clearedNames.join(', '),
          ]),
        },
      ],
      notes: [
        `Strategy: ${strategy === 'snowball' ? 'smallest balance first (snowball)' : 'highest APR first (avalanche)'}.`,
        `Monthly budget ${csvMoney(calc.monthlyBudget)} = minimums ${csvMoney(
          calc.totalMinimums,
        )} + extra ${csvMoney(calc.extraN)}.`,
        'Each debt keeps its minimum until it clears; the freed-up minimum rolls onto the next debt in the order.',
        'Interest is charged monthly on the balance carried into the month and no new borrowing is assumed.',
      ],
    }),
    [calc, money, strategy],
  )

  const chart = useMemo(() => {
    const toPoints = (rows: MonthRow[]) => [
      { x: 0, y: calc.totalBalance },
      ...rows.map((r) => ({ x: r.n, y: r.balance })),
    ]
    return [
      { label: 'Avalanche (highest APR first)', token: 'chart-1', points: toPoints(calc.avalanche.rows), fill: true },
      { label: 'Snowball (smallest balance first)', token: 'chart-3', points: toPoints(calc.snowball.rows), fill: false, dashed: true },
    ]
  }, [calc])

  return (
    <div className="space-y-6">
      <ToolPanel
        title="Your debts"
        description="Add every balance you owe. Nothing is uploaded, and nothing is stored unless you switch it on below."
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDebts((rows) => [...rows, NEW_DEBT(rows.length + 1)])}
            >
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              Add a debt
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDebts(DEFAULT_DEBTS.map((row) => ({ ...row })))}
            >
              Reset to the example
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {debts.map((row, index) => (
            <div
              key={row.id}
              className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 sm:grid-cols-9"
            >
              <div className="col-span-2 space-y-1.5 sm:col-span-3">
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
              <CmField
                id={`${row.id}-balance`}
                label="Balance"
                value={row.balance}
                onChange={(v) => update(row.id, { balance: v })}
                prefix={money.symbol}
                className="sm:col-span-2"
              />
              <CmField
                id={`${row.id}-apr`}
                label="APR"
                value={row.apr}
                onChange={(v) => update(row.id, { apr: v })}
                suffix="%"
                className="sm:col-span-2"
              />
              <CmField
                id={`${row.id}-min`}
                label="Minimum"
                value={row.minimum}
                onChange={(v) => update(row.id, { minimum: v })}
                prefix={money.symbol}
                className="sm:col-span-1"
              />
              <div className="flex items-end justify-end sm:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${row.name || `debt ${index + 1}`}`}
                  disabled={debts.length <= 1}
                  onClick={() => setDebts((rows) => rows.filter((r) => r.id !== row.id))}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
          <CmField
            id="dp-extra"
            label="Extra each month"
            value={extra}
            onChange={setExtra}
            prefix={money.symbol}
            hint="on top of the minimums"
          />
          <CmCurrencySelect value={currency} onChange={setCurrency} id="dp-currency" />
          <div className="space-y-1.5">
            <span className="block text-sm font-medium">Strategy</span>
            <CmSegmented
              label="Payoff strategy"
              value={strategy}
              onChange={setStrategy}
              options={[
                { value: 'avalanche', label: 'Avalanche' },
                { value: 'snowball', label: 'Snowball' },
              ]}
            />
          </div>
        </div>

        <CmSaveControl
          id="dp-save"
          what="this debt list"
          enabled={saveOn}
          onToggle={setSaveOn}
          onClear={() => {
            clearStored()
            setDebts(DEFAULT_DEBTS.map((row) => ({ ...row })))
          }}
        />
      </ToolPanel>

      {noDebts ? (
        <ErrorNote
          title="Nothing to plan yet"
          message="Enter at least one balance greater than zero and the plan will appear here."
        />
      ) : null}
      {stalled ? <ErrorNote title="The budget is too small" message={stalled} /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ToolPanel title={strategy === 'snowball' ? 'Snowball plan' : 'Avalanche plan'}>
          <ResultStat
            label="Debt-free in"
            value={calc.active.neverClears ? '–' : formatMonths(calc.active.months)}
            hint={
              calc.active.neverClears
                ? 'the budget never clears these balances'
                : `last payment ${formatLongDate(calc.active.payoffDate)}`
            }
            emphasis
          />
          <div className="grid grid-cols-2 gap-3">
            <CmStat label="Total owed today" value={money.exact(calc.totalBalance)} />
            <CmStat
              label="Monthly budget"
              value={money.exact(calc.monthlyBudget)}
              hint={`${money.exact(calc.totalMinimums)} minimums + ${money.exact(calc.extraN)} extra`}
            />
            <CmStat label="Total interest" value={money.exact(calc.active.totalInterest)} />
            <CmStat
              label="Total paid"
              value={money.exact(calc.active.totalPaid)}
              hint={`weighted APR ${calc.weightedApr.toFixed(2)}%`}
            />
          </div>
        </ToolPanel>

        <ToolPanel
          title="Snowball vs avalanche"
          description="Avalanche always costs less. Snowball clears the first debt sooner, which is why people stick to it."
        >
          <CmBars
            ariaLabel="Total interest paid under each strategy"
            format={money.exact}
            rows={[
              { label: 'Avalanche interest', value: calc.avalanche.totalInterest, token: 'chart-1', hint: formatMonths(calc.avalanche.months) },
              { label: 'Snowball interest', value: calc.snowball.totalInterest, token: 'chart-3', hint: formatMonths(calc.snowball.months) },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <CmStat
              label="Avalanche saves"
              value={money.exact(Math.max(0, calc.interestGap))}
              tone={calc.interestGap > 0 ? 'positive' : 'default'}
              hint="in interest, versus snowball"
            />
            <CmStat
              label="Difference in time"
              value={calc.monthGap === 0 ? 'None' : formatMonths(Math.abs(calc.monthGap))}
              hint={
                calc.monthGap > 0
                  ? 'avalanche finishes sooner'
                  : calc.monthGap < 0
                    ? 'snowball finishes sooner'
                    : 'both finish in the same month'
              }
            />
            <CmStat
              label="First win: snowball"
              value={
                calc.snowball.outcomes[0]?.months
                  ? formatMonths(calc.snowball.outcomes[0].months)
                  : '–'
              }
              hint={calc.snowball.outcomes[0]?.name}
            />
            <CmStat
              label="First win: avalanche"
              value={
                calc.avalanche.outcomes[0]?.months
                  ? formatMonths(calc.avalanche.outcomes[0].months)
                  : '–'
              }
              hint={calc.avalanche.outcomes[0]?.name}
            />
          </div>
        </ToolPanel>
      </div>

      <ToolPanel
        title="Total balance over time"
        description="Both curves start from the same budget. Only the order in which the debts are paid differs."
      >
        <CmLineChart
          ariaLabel="Total debt remaining by month under each strategy"
          series={chart}
          xFormat={(x) => `${Math.round(x)}mo`}
          yFormat={(v) => money.compact(v)}
          caption="Snowball's curve is flatter early on because it is clearing the small, cheap balances first."
        />
      </ToolPanel>

      <ToolPanel title="Payoff order" description="Pay the minimum on everything, then everything spare at row 1.">
        <CmDataTable
          ariaLabel="Debt payoff order under the selected strategy"
          columns={orderColumns}
          rows={calc.active.outcomes}
          pageSize={12}
          minWidth={560}
        />
      </ToolPanel>

      <CmWorking
        items={[
          {
            label: 'Monthly budget',
            general: 'Budget = Σ minimum payments + extra',
            steps: [
              `= ${formatNumber(calc.totalMinimums, 2)} + ${formatNumber(calc.extraN, 2)}`,
            ],
            result: money.exact(calc.monthlyBudget),
          },
          {
            label: 'Interest on one debt, one month',
            general: 'Interest = balance × (APR ÷ 12)',
            steps: calc.active.outcomes.slice(0, 3).map(
              (o) =>
                `${o.name}: ${formatNumber(o.startBalance, 2)} × ${(o.apr / 12 / 100).toFixed(6)} = ${money.exact(
                  (o.startBalance * o.apr) / 12 / 100,
                )}`,
            ),
            result: money.exact(
              calc.active.outcomes.reduce((sum, o) => sum + (o.startBalance * o.apr) / 12 / 100, 0),
            ),
          },
          {
            label: 'The rollover',
            general: 'target payment = budget − Σ minimums on the other open debts',
            steps: [
              `month 1: ${money.exact(calc.monthlyBudget)} − ${money.exact(
                Math.max(0, calc.totalMinimums - (toPositive(debts[0]?.minimum ?? '0'))),
              )} of other minimums`,
              'when a debt clears, its minimum payment goes to the next debt',
            ],
            result: `${calc.active.outcomes.length} debts cleared in ${formatMonths(calc.active.months)}`,
          },
          {
            label: 'Cost of choosing snowball',
            general: 'extra interest = snowball interest − avalanche interest',
            steps: [
              `= ${formatNumber(calc.snowball.totalInterest, 2)} − ${formatNumber(
                calc.avalanche.totalInterest,
                2,
              )}`,
            ],
            result: money.exact(Math.max(0, calc.interestGap)),
          },
        ]}
        note="Order is decided once, from today's balances, and then held. Re-sorting every month barely changes the total and makes the plan impossible to follow."
      />

      <ToolPanel
        title="Month-by-month plan"
        description="Every month of the plan, with the milestone months marked."
        footer={<CmExportBar spec={exportSpec} />}
      >
        <CmDataTable
          ariaLabel="Monthly debt payoff schedule"
          columns={monthColumns}
          rows={calc.active.rows}
          pageSize={12}
          minWidth={640}
        />
      </ToolPanel>

      <CmAssumptions
        items={[
          'Interest is charged once a month on the balance carried into the month, then payments are applied. Cards that use a daily periodic rate will differ slightly.',
          'Minimum payments are held constant at the figure you enter. Real card minimums fall as the balance falls, which makes the do-nothing case worse than modelled here. In both cases, the extra payment is what clears the debt.',
          'No new borrowing, no fees, no promotional-rate expiry and no rate changes are modelled.',
          'The payoff order is fixed from today’s balances and APRs; a debt is only ever paid its minimum until it becomes the target.',
          'Everything you type stays in this browser tab. Turning on the save switch writes the list to this device’s local storage only, and the delete button removes it immediately.',
        ]}
      />
    </div>
  )
}
