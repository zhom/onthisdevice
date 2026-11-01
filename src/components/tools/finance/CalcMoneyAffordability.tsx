import { useMemo, useState } from 'react'

import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber } from '@/components/tools/finance/format'

import { Decimal, levelPayment, toPositive } from './calc-money-core'
import {
  CmAssumptions,
  CmBreakdown,
  CmCurrencySelect,
  CmDataTable,
  CmField,
  CmFieldGrid,
  CmStat,
  CmWorking,
  useMoney,
} from './calc-money-ui'
import type { CmColumn } from './calc-money-ui'

interface Inputs {
  downPayment: number
  ratePct: number
  months: number
  taxRatePct: number
  insuranceAnnual: number
  hoaMonthly: number
  pmiRatePct: number
}

interface Piti {
  loan: number
  pi: number
  tax: number
  insurance: number
  hoa: number
  pmi: number
  total: number
}

/** Monthly housing cost for a given purchase price. */
function pitiFor(price: number, io: Inputs): Piti {
  const loan = Math.max(0, price - io.downPayment)
  const pi = levelPayment(loan, io.ratePct, io.months)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()
  const tax = (price * io.taxRatePct) / 100 / 12
  const insurance = io.insuranceAnnual / 12
  const ltv = price > 0 ? loan / price : 0
  const pmi = ltv > 0.8 ? (loan * io.pmiRatePct) / 100 / 12 : 0
  return {
    loan,
    pi,
    tax,
    insurance,
    hoa: io.hoaMonthly,
    pmi,
    total: pi + tax + insurance + io.hoaMonthly + pmi,
  }
}

/**
 * Largest purchase price whose housing cost satisfies both DTI limits.
 * PITI rises monotonically with price, so a 60-step bisection is exact to well
 * under one currency unit even for very large numbers.
 */
function maxPrice(io: Inputs, frontCap: number, backCap: number, debts: number): number {
  const ok = (price: number) => {
    const p = pitiFor(price, io)
    return p.total <= frontCap + 1e-9 && p.total + debts <= backCap + 1e-9
  }
  if (!ok(io.downPayment)) return io.downPayment
  let lo = io.downPayment
  let hi = io.downPayment + 50_000_000
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2
    if (ok(mid)) lo = mid
    else hi = mid
  }
  return lo
}

export default function CalcMoneyAffordability() {
  const [currency, setCurrency] = useState('USD')
  const money = useMoney(currency)

  const [annualIncome, setAnnualIncome] = useState('96000')
  const [coIncome, setCoIncome] = useState('0')
  const [monthlyDebts, setMonthlyDebts] = useState('550')
  const [downPayment, setDownPayment] = useState('40000')
  const [rate, setRate] = useState('6.25')
  const [years, setYears] = useState('30')
  const [taxRate, setTaxRate] = useState('1.1')
  const [insurance, setInsurance] = useState('1800')
  const [hoa, setHoa] = useState('0')
  const [pmiRate, setPmiRate] = useState('0.55')
  const [frontDti, setFrontDti] = useState('28')
  const [backDti, setBackDti] = useState('36')

  const calc = useMemo(() => {
    const income = toPositive(annualIncome) + toPositive(coIncome)
    const monthlyIncome = income / 12
    const debts = toPositive(monthlyDebts)
    const io: Inputs = {
      downPayment: toPositive(downPayment),
      ratePct: Math.max(0, toPositive(rate)),
      months: Math.max(12, Math.round(Math.min(50, toPositive(years, 30) || 30) * 12)),
      taxRatePct: toPositive(taxRate),
      insuranceAnnual: toPositive(insurance),
      hoaMonthly: toPositive(hoa),
      pmiRatePct: toPositive(pmiRate),
    }
    const front = Math.min(100, Math.max(1, toPositive(frontDti, 28) || 28))
    const back = Math.min(100, Math.max(1, toPositive(backDti, 36) || 36))

    const frontCap = (monthlyIncome * front) / 100
    const backCap = (monthlyIncome * back) / 100

    /* Solve each cap independently so we can name the binding constraint. */
    const priceFront = maxPrice(io, frontCap, Number.POSITIVE_INFINITY, debts)
    const priceBack = maxPrice(io, Number.POSITIVE_INFINITY, backCap, debts)
    const price = Math.min(priceFront, priceBack)
    const piti = pitiFor(price, io)

    const frontUsed = monthlyIncome > 0 ? (piti.total / monthlyIncome) * 100 : 0
    const backUsed = monthlyIncome > 0 ? ((piti.total + debts) / monthlyIncome) * 100 : 0
    const limiter: 'front' | 'back' | 'down' =
      price <= io.downPayment + 1 ? 'down' : priceFront <= priceBack ? 'front' : 'back'

    const scenarios = [
      { label: 'Conservative', front: 25, back: 33 },
      { label: 'Standard (28 / 36)', front: 28, back: 36 },
      { label: 'Your limits', front, back },
      { label: 'Stretched (FHA-style)', front: 31, back: 43 },
      { label: 'Stretch (43% back-end)', front: 43, back: 43 },
    ].map((s) => {
      const p = maxPrice(io, (monthlyIncome * s.front) / 100, (monthlyIncome * s.back) / 100, debts)
      return { ...s, price: p, piti: pitiFor(p, io) }
    })

    return {
      income,
      monthlyIncome,
      debts,
      io,
      front,
      back,
      frontCap,
      backCap,
      price,
      piti,
      frontUsed,
      backUsed,
      limiter,
      scenarios,
      ltv: price > 0 ? piti.loan / price : 0,
      downPct: price > 0 ? (io.downPayment / price) * 100 : 0,
    }
  }, [
    annualIncome,
    coIncome,
    monthlyDebts,
    downPayment,
    rate,
    years,
    taxRate,
    insurance,
    hoa,
    pmiRate,
    frontDti,
    backDti,
  ])

  const incomeError =
    calc.income <= 0 ? 'Enter a gross annual income to work out what you can borrow.' : undefined
  const debtWarning =
    calc.monthlyIncome > 0 && calc.debts >= (calc.monthlyIncome * calc.back) / 100
      ? 'Your existing monthly debts already use the whole back-end DTI allowance, so no housing payment fits inside these limits.'
      : undefined

  const scenarioColumns: CmColumn<(typeof calc.scenarios)[number]>[] = [
    { key: 'label', header: 'DTI rule', render: (r) => r.label },
    { key: 'ratio', header: 'Front / back', align: 'right', render: (r) => `${r.front}% / ${r.back}%` },
    { key: 'price', header: 'Max price', align: 'right', render: (r) => money.round(r.price) },
    {
      key: 'loan',
      header: 'Loan',
      align: 'right',
      hideOnMobile: true,
      render: (r) => money.round(r.piti.loan),
    },
    { key: 'piti', header: 'Monthly PITI', align: 'right', render: (r) => money.exact(r.piti.total) },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ToolPanel
            title="Income and debts"
            description="These numbers stay in this tab. There is no lead form and no broker behind this page."
          >
            <CmFieldGrid columns={2}>
              <CmField
                id="af-income"
                label="Gross annual income"
                value={annualIncome}
                onChange={setAnnualIncome}
                prefix={money.symbol}
                hint="before tax"
                invalid={incomeError}
              />
              <CmCurrencySelect value={currency} onChange={setCurrency} id="af-currency" />
              <CmField
                id="af-co"
                label="Co-borrower income"
                value={coIncome}
                onChange={setCoIncome}
                prefix={money.symbol}
                hint="annual, optional"
              />
              <CmField
                id="af-debts"
                label="Other monthly debts"
                value={monthlyDebts}
                onChange={setMonthlyDebts}
                prefix={money.symbol}
                hint="cards, car, student loans"
              />
            </CmFieldGrid>
          </ToolPanel>

          <ToolPanel title="Mortgage terms">
            <CmFieldGrid columns={2}>
              <CmField
                id="af-down"
                label="Down payment"
                value={downPayment}
                onChange={setDownPayment}
                prefix={money.symbol}
                hint={calc.price > 0 ? `${calc.downPct.toFixed(1)}% of max price` : undefined}
              />
              <CmField
                id="af-rate"
                label="Interest rate"
                value={rate}
                onChange={setRate}
                suffix="%"
                slider={{ min: 0, max: 15, step: 0.05 }}
              />
              <CmField
                id="af-years"
                label="Term"
                value={years}
                onChange={setYears}
                suffix="yrs"
                slider={{ min: 5, max: 40, step: 1 }}
              />
              <CmField
                id="af-pmi"
                label="PMI rate"
                value={pmiRate}
                onChange={setPmiRate}
                suffix="%"
                hint={calc.ltv > 0.8 ? 'charged above 80% LTV' : 'not required at this LTV'}
              />
            </CmFieldGrid>
          </ToolPanel>

          <ToolPanel title="Ownership costs and lender limits">
            <CmFieldGrid columns={2}>
              <CmField
                id="af-tax"
                label="Property tax rate"
                value={taxRate}
                onChange={setTaxRate}
                suffix="%"
                hint="of price, per year"
                slider={{ min: 0, max: 4, step: 0.05 }}
              />
              <CmField
                id="af-ins"
                label="Home insurance"
                value={insurance}
                onChange={setInsurance}
                prefix={money.symbol}
                hint="per year"
              />
              <CmField
                id="af-hoa"
                label="HOA / service charge"
                value={hoa}
                onChange={setHoa}
                prefix={money.symbol}
                hint="per month"
              />
              <div className="grid grid-cols-2 gap-3">
                <CmField
                  id="af-front"
                  label="Front-end DTI"
                  value={frontDti}
                  onChange={setFrontDti}
                  suffix="%"
                />
                <CmField
                  id="af-back"
                  label="Back-end DTI"
                  value={backDti}
                  onChange={setBackDti}
                  suffix="%"
                />
              </div>
            </CmFieldGrid>
          </ToolPanel>
        </div>

        <div className="space-y-6">
          {incomeError || debtWarning ? (
            <ErrorNote
              title={debtWarning ? 'No headroom left' : 'Something is missing'}
              message={debtWarning ?? incomeError ?? ''}
            />
          ) : null}

          <ToolPanel title="What you can afford">
            <ResultStat
              label="Maximum home price"
              value={money.round(calc.price)}
              hint={
                calc.limiter === 'front'
                  ? `capped by the ${calc.front}% housing-cost limit`
                  : calc.limiter === 'back'
                    ? `capped by the ${calc.back}% total-debt limit`
                    : 'capped by your down payment'
              }
              emphasis
            />
            <div className="grid grid-cols-2 gap-3">
              <CmStat
                label="Loan amount"
                value={money.round(calc.piti.loan)}
                hint={`${(calc.ltv * 100).toFixed(1)}% LTV`}
              />
              <CmStat
                label="Monthly housing cost"
                value={money.exact(calc.piti.total)}
                hint="PITI + HOA + PMI"
              />
              <CmStat
                label="Front-end DTI"
                value={`${calc.frontUsed.toFixed(1)}%`}
                hint={`${calc.frontUsed > calc.front + 0.1 ? 'Over the limit of' : 'limit'} ${calc.front}% · ${money.exact(calc.frontCap)}/mo`}
                tone={calc.frontUsed > calc.front + 0.1 ? 'negative' : 'default'}
              />
              <CmStat
                label="Back-end DTI"
                value={`${calc.backUsed.toFixed(1)}%`}
                hint={`${calc.backUsed > calc.back + 0.1 ? 'Over the limit of' : 'limit'} ${calc.back}% · ${money.exact(calc.backCap)}/mo`}
                tone={calc.backUsed > calc.back + 0.1 ? 'negative' : 'default'}
              />
            </div>

            <CmBreakdown
              format={money.exact}
              items={[
                { label: 'Principal & interest', value: calc.piti.pi, token: 'chart-1' },
                { label: 'Property tax', value: calc.piti.tax, token: 'chart-2' },
                { label: 'Home insurance', value: calc.piti.insurance, token: 'chart-3' },
                { label: 'HOA / service charge', value: calc.piti.hoa, token: 'chart-4' },
                { label: 'PMI', value: calc.piti.pmi, token: 'chart-5' },
              ]}
              caption="What the monthly housing payment is actually made of at the maximum price."
            />
          </ToolPanel>

          <ToolPanel
            title="How different lending rules change the answer"
            description="Same income, same deposit. Only the ratio that a lender accepts changes."
          >
            <CmDataTable
              ariaLabel="Maximum home price under different debt-to-income rules"
              columns={scenarioColumns}
              rows={calc.scenarios}
              pageSize={10}
              minWidth={520}
            />
          </ToolPanel>
        </div>
      </div>

      <CmWorking
        items={[
          {
            label: 'Monthly gross income',
            general: 'Gross monthly = (income + co-borrower income) ÷ 12',
            steps: [
              `= (${formatNumber(toPositive(annualIncome), 0)} + ${formatNumber(
                toPositive(coIncome),
                0,
              )}) ÷ 12`,
            ],
            result: money.exact(calc.monthlyIncome),
          },
          {
            label: 'Front-end limit (housing only)',
            general: 'Housing cap = gross monthly × front-end DTI',
            steps: [`= ${formatNumber(calc.monthlyIncome, 2)} × ${calc.front}%`],
            result: money.exact(calc.frontCap),
          },
          {
            label: 'Back-end limit (all debt)',
            general: 'Housing cap = gross monthly × back-end DTI − existing debts',
            steps: [
              `= ${formatNumber(calc.monthlyIncome, 2)} × ${calc.back}% − ${formatNumber(
                calc.debts,
                2,
              )}`,
            ],
            result: money.exact(Math.max(0, calc.backCap - calc.debts)),
          },
          {
            label: 'Housing cost at the maximum price',
            general: 'PITI = P&I + tax ÷ 12 + insurance ÷ 12 + HOA + PMI',
            steps: [
              `P&I on ${money.round(calc.piti.loan)} at ${calc.io.ratePct}% for ${
                calc.io.months / 12
              } years = ${money.exact(calc.piti.pi)}`,
              `tax ${formatNumber(calc.io.taxRatePct, 2)}% × ${money.round(calc.price)} ÷ 12 = ${money.exact(
                calc.piti.tax,
              )}`,
              `insurance ${money.exact(calc.io.insuranceAnnual)} ÷ 12 = ${money.exact(
                calc.piti.insurance,
              )}`,
              `HOA ${money.exact(calc.piti.hoa)} + PMI ${money.exact(calc.piti.pmi)}`,
            ],
            result: money.exact(calc.piti.total),
          },
          {
            label: 'Maximum price',
            general: 'price = down payment + largest loan whose PITI fits both caps',
            steps: [
              `solved by bisection: PITI(${money.round(calc.price)}) = ${money.exact(
                calc.piti.total,
              )} ≤ ${money.exact(Math.min(calc.frontCap, calc.backCap - calc.debts))}`,
            ],
            result: money.round(calc.price),
          },
        ]}
        note="The binding constraint is the cap that is reached first. With significant card or car debt, it is almost always the back-end ratio."
      />

      <CmAssumptions
        items={[
          'Front-end DTI compares the whole housing payment to gross (pre-tax) income; back-end DTI adds every other monthly debt payment. 28/36 is the conventional US benchmark; 31/43 is closer to FHA practice, and 43% back-end, the old Qualified Mortgage cap, is still a common lender limit.',
          'Lenders count the minimum payment on revolving debt, not the balance. Utilities, groceries, childcare and insurance premiums other than home insurance are not counted in DTI even though they are real.',
          'PMI is estimated as a flat annual percentage of the loan and only applies above 80% loan-to-value. It normally falls away once the balance drops below that threshold.',
          'Closing costs, moving costs, maintenance, and any reserve requirement are not deducted from the down payment. Budget for them separately: 2% to 5% of the price is a common range for closing costs.',
          'Affordability from a lender’s point of view is not the same as affordability from yours. The maximum a bank will lend is a ceiling, not a target.',
        ]}
      />
    </div>
  )
}
