import { useMemo, useState } from 'react'
import { BarList, Split } from '@/components/viz'
import { amortize, aprOf, monthlyPayment } from './money-math'
import { Assumptions, CalcGrid, Choice, Field, Formula, Headline, ResultPanel, Stats, num, toPositive, useCurrency } from './mb-ui'

export default function AprCalculator() {
  const { money, select } = useCurrency()
  const [amount, setAmount] = useState('25000')
  const [rate, setRate] = useState('7.5')
  const [years, setYears] = useState('5')
  const [fees, setFees] = useState('1000')
  const [feeMode, setFeeMode] = useState<'upfront' | 'financed'>('upfront')

  const c = useMemo(() => {
    const A = toPositive(amount)
    const r = toPositive(rate)
    const n = Math.max(1, Math.min(480, Math.round(toPositive(years, 5) * 12)))
    const F = toPositive(fees)
    const principal = feeMode === 'financed' ? A + F : A
    const received = feeMode === 'financed' ? A : A - F
    const pay = monthlyPayment(principal, r, n)
    const sched = amortize({ principal, annualPct: r, months: n })
    const apr = aprOf(received, pay, n)
    return { A, r, n, F, principal, received, pay, interest: sched.totalInterest, apr, total: sched.totalPaid + (feeMode === 'upfront' ? F : 0) }
  }, [amount, rate, years, fees, feeMode])

  const apr = c.apr ?? NaN
  const cost = c.total - c.received

  return (
    <CalcGrid
      inputs={
        <>
          <Field id="apr-amount" label="Loan amount" value={amount} onChange={setAmount} prefix={money.symbol} />
          <Field id="apr-rate" label="Interest rate" value={rate} onChange={setRate} suffix="%" slider={{ min: 0, max: 30, step: 0.1 }} />
          <Field id="apr-years" label="Term" value={years} onChange={setYears} suffix="yrs" slider={{ min: 1, max: 30, step: 1 }} />
          <Field id="apr-fees" label="Fees and points" value={fees} onChange={setFees} prefix={money.symbol} />
          <Choice
            label="The fees are"
            value={feeMode}
            onChange={setFeeMode}
            options={[
              { value: 'upfront', label: 'Taken from the loan' },
              { value: 'financed', label: 'Added to the loan' },
            ]}
          />
          {select('apr-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="APR"
            value={apr}
            format={(v) => `${num(v, 3)}%`}
            hint={
              c.apr === null
                ? 'Enter a loan amount larger than the fees.'
                : `The fees raise the yearly cost from ${num(c.r, 3)}% to ${num(apr, 3)}%.`
            }
          />
          <Stats
            items={[
              { label: 'Monthly payment', value: money.exact(c.pay) },
              { label: 'You receive', value: money.round(c.received) },
              { label: 'Cost of the loan', value: money.round(cost), hint: 'interest + fees' },
            ]}
          />
          <BarList
            items={[
              { label: 'Interest rate', value: c.r },
              { label: 'APR with fees', value: Number.isFinite(apr) ? apr : 0, highlight: true },
            ]}
            formatValue={(v) => `${num(v, 3)}%`}
            summary={`The APR is ${num(apr - c.r, 3)} percentage points above the interest rate. Use the APR to compare loans that have different fees.`}
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <ResultPanel title="Where the money goes">
            <Split
              parts={[
                { label: 'Money you receive', value: c.received, paint: 'ink' },
                { label: 'Interest', value: c.interest, paint: 'hatch' },
                { label: 'Fees', value: c.F, paint: 'grey' },
              ]}
              formatValue={money.round}
              summary={`You repay ${money.round(c.total)} in all, fees included, for ${money.round(c.received)} in hand.`}
            />
          </ResultPanel>
          <Formula
            items={[
              {
                label: 'Monthly payment',
                general: 'M = P × i ÷ (1 − (1 + i)^−n)',
                steps: [`P = ${money.exact(c.principal)}, i = ${num(c.r, 3)}% ÷ 12, n = ${c.n}`],
                result: money.exact(c.pay),
              },
              {
                label: 'APR',
                general: 'find j with  received = M × (1 − (1 + j)^−n) ÷ j,  APR = 12 × j',
                steps: [`${money.exact(c.received)} = ${money.exact(c.pay)} × (1 − (1 + j)^−${c.n}) ÷ j`, `j = ${(apr / 1200).toFixed(7)} a month (solved by bisection)`],
                result: `${num(apr, 4)}%`,
              },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'Fixed rate and level monthly payments. The US Truth in Lending Act APR uses the same idea for a fixed-rate loan.',
              'Which fees count toward APR depends on the law and the lender. Enter the fees you pay to get the loan.',
              'APR assumes you keep the loan to the end. Repaying early makes the fees cost more per year.',
            ]}
          />
        </div>
      }
    />
  )
}
