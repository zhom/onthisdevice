import { useMemo, useState } from 'react'

import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber } from '@/components/tools/finance/format'

import { LineChart, compactMoney, compactNumber } from './charts'
import {
  Assumptions,
  CsvButton,
  CurrencySelect,
  DataTable,
  Field,
  FieldGroup,
  Formula,
  MiniStat,
  useMoney,
} from './common'
import type { Column } from './common'
import { useLocalStorage } from './hooks'
import { csvMoney, d, toPositive } from './money'

interface UnitRow {
  units: number
  revenue: number
  variableCost: number
  totalCost: number
  profit: number
}

export default function BreakEvenCalculator() {
  const [currency, setCurrency] = useLocalStorage('otd:finance:currency', 'USD')
  const money = useMoney(currency)

  const [fixedCosts, setFixedCosts] = useState('40000')
  const [variableCost, setVariableCost] = useState('12')
  const [price, setPrice] = useState('30')
  const [targetProfit, setTargetProfit] = useState('20000')
  const [expectedUnits, setExpectedUnits] = useState('3500')

  const calc = useMemo(() => {
    const fixed = toPositive(fixedCosts)
    const vc = toPositive(variableCost)
    const p = toPositive(price)
    const target = toPositive(targetProfit)
    const expected = toPositive(expectedUnits)

    const contribution = d(p).minus(vc).toNumber()
    const contributionRatio = p > 0 ? contribution / p : 0
    const viable = contribution > 0

    const beUnits = viable ? d(fixed).div(contribution).toNumber() : Number.POSITIVE_INFINITY
    const beRevenue = viable ? beUnits * p : Number.POSITIVE_INFINITY
    const targetUnits = viable ? d(fixed).plus(target).div(contribution).toNumber() : Number.POSITIVE_INFINITY
    const targetRevenue = viable ? targetUnits * p : Number.POSITIVE_INFINITY

    const expectedRevenue = expected * p
    const expectedProfit = expected * contribution - fixed
    const marginOfSafetyUnits = viable ? expected - beUnits : 0
    const marginOfSafetyPct = expected > 0 && viable ? (marginOfSafetyUnits / expected) * 100 : 0

    const maxUnits = Math.max(
      10,
      Math.ceil((viable ? Math.max(beUnits * 2, expected * 1.25, targetUnits * 1.1) : expected * 1.25) || 10),
    )

    const steps = 10
    const rows: UnitRow[] = []
    for (let s = 0; s <= steps; s++) {
      const units = Math.round((maxUnits / steps) * s)
      const revenue = units * p
      const variable = units * vc
      const totalCost = fixed + variable
      rows.push({ units, revenue, variableCost: variable, totalCost, profit: revenue - totalCost })
    }

    const error = !viable
      ? p <= 0
        ? 'Enter a selling price above zero.'
        : `Each unit sells for ${money.exact(p)} but costs ${money.exact(
            vc,
          )} to make, so every extra sale loses money. There is no break-even point until the price rises above the variable cost.`
      : undefined

    return {
      fixed,
      vc,
      p,
      target,
      expected,
      contribution,
      contributionRatio,
      viable,
      beUnits,
      beRevenue,
      targetUnits,
      targetRevenue,
      expectedRevenue,
      expectedProfit,
      marginOfSafetyUnits,
      marginOfSafetyPct,
      maxUnits,
      rows,
      error,
    }
    // `money` is stable for a given currency and only used for the error copy.
  }, [fixedCosts, variableCost, price, targetProfit, expectedUnits, money])

  const columns: Column<UnitRow>[] = [
    { key: 'units', header: 'Units sold', align: 'right', render: (r) => formatNumber(r.units, 0) },
    { key: 'revenue', header: 'Revenue', align: 'right', render: (r) => money.exact(r.revenue) },
    {
      key: 'variable',
      header: 'Variable cost',
      align: 'right',
      hideOnMobile: true,
      render: (r) => money.exact(r.variableCost),
    },
    { key: 'total', header: 'Total cost', align: 'right', render: (r) => money.exact(r.totalCost) },
    {
      key: 'profit',
      header: 'Profit',
      align: 'right',
      render: (r) => (
        <span className={r.profit >= 0 ? 'text-success' : 'text-destructive'}>
          {r.profit >= 0 ? '+' : '−'}
          {money.exact(Math.abs(r.profit))}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ToolPanel
          title="Costs and price"
          description="Fixed costs stay the same whatever you sell; variable costs scale with each unit."
        >
          <div className="space-y-5">
            <FieldGroup columns={2}>
              <Field
                id="be-fixed"
                label="Fixed costs"
                value={fixedCosts}
                onChange={setFixedCosts}
                prefix={money.symbol}
                hint="rent, salaries, software"
              />
              <CurrencySelect value={currency} onChange={setCurrency} id="be-currency" />
              <Field
                id="be-variable"
                label="Variable cost per unit"
                value={variableCost}
                onChange={setVariableCost}
                prefix={money.symbol}
                hint="materials, shipping, fees"
              />
              <Field
                id="be-price"
                label="Selling price per unit"
                value={price}
                onChange={setPrice}
                prefix={money.symbol}
              />
              <Field
                id="be-target"
                label="Target profit"
                value={targetProfit}
                onChange={setTargetProfit}
                prefix={money.symbol}
                hint="optional"
              />
              <Field
                id="be-expected"
                label="Units you expect to sell"
                value={expectedUnits}
                onChange={setExpectedUnits}
                suffix="u"
                hint="for margin of safety"
              />
            </FieldGroup>
          </div>
        </ToolPanel>

        <div className="space-y-6">
          {calc.error ? <ErrorNote message={calc.error} /> : null}

          <ToolPanel title="Break-even point">
            <div className="space-y-5">
              <ResultStat
                label="Units to break even"
                value={calc.viable ? `${formatNumber(Math.ceil(calc.beUnits), 0)} units` : '–'}
                hint={
                  calc.viable
                    ? `${money.exact(calc.beRevenue)} of revenue at ${money.exact(calc.p)} each`
                    : 'raise the price above the variable cost'
                }
                emphasis
              />
              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  label="Contribution margin"
                  value={money.exact(calc.contribution)}
                  hint={`${formatNumber(calc.contributionRatio * 100, 1)}% of the price`}
                />
                <MiniStat label="Break-even revenue" value={calc.viable ? money.exact(calc.beRevenue) : '–'} />
                <MiniStat
                  label={`Units for ${money.round(calc.target)} profit`}
                  value={calc.viable ? `${formatNumber(Math.ceil(calc.targetUnits), 0)} units` : '–'}
                  hint={calc.viable ? money.exact(calc.targetRevenue) : undefined}
                />
                <MiniStat
                  label="Profit at expected volume"
                  value={money.exact(calc.expectedProfit)}
                  hint={`${formatNumber(calc.expected, 0)} units → ${money.exact(calc.expectedRevenue)}`}
                  tone={calc.expectedProfit >= 0 ? 'positive' : 'negative'}
                />
                <MiniStat
                  label="Margin of safety"
                  value={
                    calc.viable ? `${formatNumber(Math.max(0, calc.marginOfSafetyUnits), 0)} units` : '–'
                  }
                  hint={
                    calc.viable
                      ? `sales can fall ${formatNumber(Math.max(0, calc.marginOfSafetyPct), 1)}% before a loss`
                      : undefined
                  }
                />
                <MiniStat
                  label="Fixed cost per expected unit"
                  value={money.exact(calc.expected > 0 ? calc.fixed / calc.expected : 0)}
                />
              </div>
            </div>
          </ToolPanel>
        </div>
      </div>

      <ToolPanel
        title="Cost and revenue crossover"
        description="Revenue starts at zero and climbs faster than cost. Where the lines cross is the break-even point; the gap after it is profit."
      >
        <LineChart
          ariaLabel="Total revenue against total cost by units sold, showing the break-even crossover"
          series={[
            {
              label: 'Total revenue',
              token: 'chart-1',
              points: [
                { x: 0, y: 0 },
                { x: calc.maxUnits, y: calc.maxUnits * calc.p },
              ],
              fill: true,
            },
            {
              label: 'Total cost',
              token: 'chart-3',
              points: [
                { x: 0, y: calc.fixed },
                { x: calc.maxUnits, y: calc.fixed + calc.maxUnits * calc.vc },
              ],
            },
            {
              label: 'Fixed cost',
              token: 'chart-3',
              dashed: true,
              points: [
                { x: 0, y: calc.fixed },
                { x: calc.maxUnits, y: calc.fixed },
              ],
            },
          ]}
          markers={
            calc.viable && calc.beUnits <= calc.maxUnits
              ? [
                  {
                    x: calc.beUnits,
                    y: calc.beRevenue,
                    label: `Break-even · ${formatNumber(Math.ceil(calc.beUnits), 0)} units`,
                  },
                ]
              : []
          }
          xLabel={(x) => compactNumber(Math.round(x))}
          yFormat={(v) => compactMoney(v, currency)}
          legend={[
            { label: 'Total revenue', token: 'chart-1' },
            { label: 'Total cost', token: 'chart-3' },
            { label: 'Fixed cost', token: 'chart-3', dashed: true },
          ]}
          caption="Horizontal axis is units sold."
        />
      </ToolPanel>

      <Formula
        items={[
          {
            label: 'Contribution margin per unit',
            general: 'CM = price − variable cost',
            steps: [`CM = ${formatNumber(calc.p, 2)} − ${formatNumber(calc.vc, 2)}`],
            result: money.exact(calc.contribution),
          },
          {
            label: 'Break-even units',
            general: 'Units = fixed costs / CM',
            steps: [`Units = ${formatNumber(calc.fixed, 2)} ÷ ${formatNumber(calc.contribution, 2)}`],
            result: calc.viable ? `${formatNumber(calc.beUnits, 2)} units` : 'never reached',
          },
          {
            label: 'Break-even revenue',
            general: 'Revenue = fixed costs / contribution margin ratio',
            steps: [
              `ratio = ${formatNumber(calc.contribution, 2)} ÷ ${formatNumber(calc.p, 2)} = ${formatNumber(
                calc.contributionRatio,
                4,
              )}`,
              `Revenue = ${formatNumber(calc.fixed, 2)} ÷ ${formatNumber(calc.contributionRatio, 4)}`,
            ],
            result: calc.viable ? money.exact(calc.beRevenue) : '–',
          },
          {
            label: 'Units for a target profit',
            general: 'Units = (fixed costs + target profit) / CM',
            steps: [
              `Units = (${formatNumber(calc.fixed, 2)} + ${formatNumber(
                calc.target,
                2,
              )}) ÷ ${formatNumber(calc.contribution, 2)}`,
            ],
            result: calc.viable ? `${formatNumber(calc.targetUnits, 2)} units` : '–',
          },
          {
            label: 'Margin of safety',
            general: 'MoS = (expected units − break-even units) / expected units',
            steps: [
              `MoS = (${formatNumber(calc.expected, 0)} − ${formatNumber(
                calc.beUnits,
                2,
              )}) ÷ ${formatNumber(calc.expected, 0)}`,
            ],
            result: calc.viable ? `${formatNumber(calc.marginOfSafetyPct, 2)}%` : '–',
          },
        ]}
        note="Break-even units are usually rounded up: you cannot sell a fraction of a unit, and the fractional part still leaves a small loss."
      />

      <ToolPanel title="Profit at different volumes">
        <div className="space-y-4">
          <div className="flex justify-end">
            <CsvButton
              filename="break-even-analysis.csv"
              headers={['Units sold', 'Revenue', 'Variable cost', 'Total cost', 'Profit']}
              rows={calc.rows.map((r) => [
                r.units,
                csvMoney(r.revenue),
                csvMoney(r.variableCost),
                csvMoney(r.totalCost),
                csvMoney(r.profit),
              ])}
            />
          </div>
          <DataTable
            columns={columns}
            rows={calc.rows}
            pageSize={0}
            ariaLabel="Revenue, cost and profit at different sales volumes"
          />
        </div>
      </ToolPanel>

      <Assumptions
        items={[
          'One product at one price. If you sell a mix, run the numbers on a weighted average price and variable cost, or on each product line separately.',
          'Fixed costs are taken as fixed across the whole volume range shown. In practice they step up when you add a shift, a machine or a warehouse.',
          'The variable cost per unit is constant. Bulk discounts on materials lower it as volume rises, which pulls the real break-even point down.',
          'Everything produced is sold, with no inventory build-up and no discounting.',
          'Revenue is recognised at the point of sale, ignoring payment terms and bad debt.',
        ]}
      />
    </div>
  )
}
