import { useMemo, useState } from 'react'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber } from '@/components/tools/finance/format'

import { StackedGrowthChart } from './charts'
import type { GrowthPoint } from './charts'
import {
  Assumptions,
  Breakdown,
  CsvButton,
  CurrencySelect,
  DataTable,
  Field,
  FieldGroup,
  Formula,
  MiniStat,
  SelectField,
  useMoney,
} from './common'
import type { Column } from './common'
import { useLocalStorage } from './hooks'
import {
  COMPOUND_FREQUENCIES,
  buildGrowth,
  csvMoney,
  effectiveAnnualRate,
  periodsPerYear,
  ratePerContribution,
  toPositive,
} from './money'
import type { CompoundFrequency, GrowthYear } from './money'

const CONTRIBUTION_FREQUENCIES: CompoundFrequency[] = [
  'annually',
  'semiannually',
  'quarterly',
  'monthly',
  'semimonthly',
  'biweekly',
  'weekly',
]

export default function CompoundInterestCalculator() {
  const [currency, setCurrency] = useLocalStorage('otd:finance:currency', 'USD')
  const money = useMoney(currency)

  const [principal, setPrincipal] = useState('10000')
  const [contribution, setContribution] = useState('500')
  const [contributionFreq, setContributionFreq] = useState<CompoundFrequency>('monthly')
  const [atStart, setAtStart] = useState(false)
  const [rate, setRate] = useState('7')
  const [compoundFreq, setCompoundFreq] = useState<CompoundFrequency>('monthly')
  const [years, setYears] = useState('25')

  const calc = useMemo(() => {
    const P = toPositive(principal)
    const pmt = toPositive(contribution)
    const rateN = toPositive(rate)
    const yearsN = Math.max(0, Math.min(100, Math.round(toPositive(years, 25))))
    const m = periodsPerYear(compoundFreq)
    const c = periodsPerYear(contributionFreq)

    const growth = buildGrowth({
      principal: P,
      contribution: pmt,
      contributionsPerYear: c,
      contributeAtStart: atStart,
      annualRatePct: rateN,
      compoundsPerYear: m,
      years: yearsN,
    })

    const ear = effectiveAnnualRate(rateN, m).times(100).toNumber()
    const stepRate = ratePerContribution(rateN, m, c).toNumber()
    const growthMultiple = growth.totalDeposited > 0 ? growth.futureValue / growth.totalDeposited : 0
    const interestShare =
      growth.futureValue > 0 ? (growth.totalInterest / growth.futureValue) * 100 : 0

    return { P, pmt, rateN, yearsN, m, c, growth, ear, stepRate, growthMultiple, interestShare }
  }, [principal, contribution, contributionFreq, atStart, rate, compoundFreq, years])

  const points: GrowthPoint[] = useMemo(() => {
    const list: GrowthPoint[] = [{ x: 0, principal: calc.P, contributions: 0, interest: 0 }]
    for (const y of calc.growth.years) {
      list.push({
        x: y.year,
        principal: calc.P,
        contributions: y.cumContributions,
        interest: y.cumInterest,
      })
    }
    return list
  }, [calc])

  const columns: Column<GrowthYear>[] = [
    { key: 'year', header: 'Year', render: (r) => r.year },
    { key: 'start', header: 'Start balance', align: 'right', render: (r) => money.exact(r.startBalance) },
    {
      key: 'contributions',
      header: 'Deposits',
      align: 'right',
      render: (r) => money.exact(r.contributions),
    },
    { key: 'interest', header: 'Interest', align: 'right', render: (r) => money.exact(r.interest) },
    {
      key: 'cumInterest',
      header: 'Interest to date',
      align: 'right',
      hideOnMobile: true,
      render: (r) => money.exact(r.cumInterest),
    },
    { key: 'end', header: 'End balance', align: 'right', render: (r) => money.exact(r.endBalance) },
  ]

  const freqOptions = (list: CompoundFrequency[]) =>
    COMPOUND_FREQUENCIES.filter((f) => list.includes(f.value)).map((f) => ({
      value: f.value,
      label: f.label,
    }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ToolPanel
          title="Your plan"
          description="The projection, table and chart update as you type."
        >
          <div className="space-y-5">
            <FieldGroup columns={2}>
              <Field
                id="ci-principal"
                label="Starting balance"
                value={principal}
                onChange={setPrincipal}
                prefix={money.symbol}
              />
              <CurrencySelect value={currency} onChange={setCurrency} id="ci-currency" />
              <Field
                id="ci-contribution"
                label="Regular deposit"
                value={contribution}
                onChange={setContribution}
                prefix={money.symbol}
                hint={
                  calc.pmt > 0
                    ? `${money.round(calc.pmt * calc.c)} / year`
                    : 'set to 0 for lump sum only'
                }
              />
              <SelectField
                id="ci-contribution-freq"
                label="Deposit frequency"
                value={contributionFreq}
                onChange={(v) => setContributionFreq(v as CompoundFrequency)}
                options={freqOptions(CONTRIBUTION_FREQUENCIES)}
              />
              <Field
                id="ci-rate"
                label="Annual interest rate"
                value={rate}
                onChange={setRate}
                suffix="%"
                slider={{ min: 0, max: 20, step: 0.1 }}
              />
              <SelectField
                id="ci-compound-freq"
                label="Compounding frequency"
                value={compoundFreq}
                onChange={(v) => setCompoundFreq(v as CompoundFrequency)}
                options={COMPOUND_FREQUENCIES.map((f) => ({ value: f.value, label: f.label }))}
                hint={`${formatNumber(calc.ear, 3)}% effective`}
              />
              <Field
                id="ci-years"
                label="Years to grow"
                value={years}
                onChange={setYears}
                suffix="yrs"
                slider={{ min: 1, max: 60, step: 1 }}
              />
            </FieldGroup>

            <div className="flex items-start justify-between gap-3 rounded-lg bg-muted px-3 py-3">
              <Label htmlFor="ci-at-start" className="text-sm font-normal leading-snug">
                Deposit at the start of each period
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  An annuity-due. Each deposit earns one extra period of interest.
                </span>
              </Label>
              <Switch id="ci-at-start" checked={atStart} onCheckedChange={setAtStart} />
            </div>
          </div>
        </ToolPanel>

        <div className="space-y-6">
          <ToolPanel title="Projection">
            <div className="space-y-5">
              <ResultStat
                label={`Balance after ${calc.yearsN} ${calc.yearsN === 1 ? 'year' : 'years'}`}
                value={money.exact(calc.growth.futureValue)}
                hint={`${formatNumber(calc.growthMultiple, 2)}× what you put in`}
                emphasis
              />
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="You deposit" value={money.exact(calc.growth.totalDeposited)} />
                <MiniStat
                  label="Interest earned"
                  value={money.exact(calc.growth.totalInterest)}
                  tone="positive"
                />
                <MiniStat
                  label="Interest share of final balance"
                  value={`${formatNumber(calc.interestShare, 1)}%`}
                />
                <MiniStat
                  label="Effective annual rate"
                  value={`${formatNumber(calc.ear, 3)}%`}
                  hint={`nominal ${formatNumber(calc.rateN, 2)}%`}
                />
              </div>
              <Breakdown
                currency={currency}
                caption="What the final balance is made of."
                items={[
                  { label: 'Starting balance', value: calc.P, token: 'chart-3' },
                  { label: 'Deposits', value: calc.growth.totalContributions, token: 'chart-1' },
                  { label: 'Compound interest', value: calc.growth.totalInterest, token: 'chart-5' },
                ]}
              />
            </div>
          </ToolPanel>
        </div>
      </div>

      <ToolPanel
        title="Growth over time"
        description="The top band is the money the account earned for you. It passes your own deposits late, then stays ahead."
      >
        <StackedGrowthChart
          points={points}
          currency={currency}
          ariaLabel="Stacked chart of starting balance, deposits and compound interest by year"
          legend={[
            { label: 'Starting balance', token: 'chart-3', value: money.round(calc.P) },
            { label: 'Deposits', token: 'chart-1', value: money.round(calc.growth.totalContributions) },
            { label: 'Interest', token: 'chart-5', value: money.round(calc.growth.totalInterest) },
          ]}
          caption="Bands are stacked, so the top edge is the projected balance."
        />
      </ToolPanel>

      <Formula
        items={[
          {
            label: 'Growth of the starting balance',
            general: 'FV₀ = P × (1 + r/m)^(m·t)',
            steps: [
              `FV₀ = ${formatNumber(calc.P, 2)} × (1 + ${formatNumber(calc.rateN, 4)}% ÷ ${calc.m})^(${
                calc.m
              } × ${calc.yearsN})`,
            ],
            result: money.exact(
              calc.P * Math.pow(1 + calc.rateN / 100 / calc.m, calc.m * calc.yearsN),
            ),
          },
          {
            label: 'Growth of the deposits',
            general: 'FVₚ = PMT × [((1 + i)^n − 1) / i]' + (atStart ? ' × (1 + i)' : ''),
            steps:
              calc.stepRate === 0
                ? [
                    'i = 0, so deposits simply add up',
                    `FVₚ = ${formatNumber(calc.pmt, 2)} × ${calc.c * calc.yearsN} deposits`,
                  ]
                : [
                    `i = rate per deposit period = ${calc.stepRate.toFixed(8)}`,
                    `n = ${calc.c} × ${calc.yearsN} = ${calc.c * calc.yearsN} deposits`,
                    `FVₚ = ${formatNumber(calc.pmt, 2)} × [((1 + ${calc.stepRate.toFixed(8)})^${
                      calc.c * calc.yearsN
                    } − 1) ÷ ${calc.stepRate.toFixed(8)}]`,
                  ],
            result: money.exact(
              calc.growth.futureValue -
                calc.P * Math.pow(1 + calc.rateN / 100 / calc.m, calc.m * calc.yearsN),
            ),
          },
          {
            label: 'Projected balance',
            general: 'FV = FV₀ + FVₚ',
            steps: [
              `FV = ${money.exact(calc.P)} start + ${money.exact(
                calc.growth.totalContributions,
              )} deposits + ${money.exact(calc.growth.totalInterest)} interest`,
            ],
            result: money.exact(calc.growth.futureValue),
          },
          {
            label: 'Effective annual rate',
            general: 'EAR = (1 + r/m)^m − 1',
            steps: [`EAR = (1 + ${formatNumber(calc.rateN, 4)}% ÷ ${calc.m})^${calc.m} − 1`],
            result: `${formatNumber(calc.ear, 4)}%`,
          },
        ]}
        note="When deposits and compounding happen at different frequencies, the deposit-period rate is derived from the nominal rate as (1 + r/m)^(m/c) − 1, which reproduces the exact compounded growth between deposits."
      />

      <ToolPanel title="Year-by-year table">
        <div className="space-y-4">
          <div className="flex justify-end">
            <CsvButton
              filename="compound-interest-schedule.csv"
              headers={['Year', 'Start balance', 'Deposits', 'Interest', 'Interest to date', 'End balance']}
              rows={calc.growth.years.map((y) => [
                y.year,
                csvMoney(y.startBalance),
                csvMoney(y.contributions),
                csvMoney(y.interest),
                csvMoney(y.cumInterest),
                csvMoney(y.endBalance),
              ])}
            />
          </div>
          <DataTable
            columns={columns}
            rows={calc.growth.years}
            pageSize={15}
            ariaLabel="Year by year compound interest growth"
            emptyMessage="Set a term of at least one year to see the table."
          />
        </div>
      </ToolPanel>

      <Assumptions
        items={[
          'A constant annual rate for the whole period. Real investment returns vary year to year, so treat this as an average-case projection.',
          'Deposits are the same size every period and never missed.',
          'No tax on interest, no account fees and no inflation adjustment. Use the inflation calculator to see the result in today’s money.',
          'Interest is credited at the end of each compounding period and immediately starts earning interest itself.',
        ]}
      />
    </div>
  )
}
