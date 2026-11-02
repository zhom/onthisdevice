import { useMemo, useState } from 'react'
import { LineChart, compact } from '@/components/viz'
import { refinance } from './money-math'
import { Assumptions, CalcGrid, Choice, Field, Formula, Headline, ResultPanel, Stats, num, toPositive, useCurrency, yearsMonths } from './mb-ui'

export default function RefinanceCalculator() {
  const { money, select } = useCurrency()
  const [balance, setBalance] = useState('300000')
  const [curRate, setCurRate] = useState('7.25')
  const [yearsLeft, setYearsLeft] = useState('27')
  const [newRate, setNewRate] = useState('6')
  const [newYears, setNewYears] = useState('30')
  const [costs, setCosts] = useState('6000')
  const [roll, setRoll] = useState<'cash' | 'loan'>('cash')

  const c = useMemo(() => {
    const monthsLeft = Math.max(1, Math.min(480, Math.round(toPositive(yearsLeft, 27) * 12)))
    const newMonths = Math.max(1, Math.min(480, Math.round(toPositive(newYears, 30) * 12)))
    const r = refinance({
      balance: toPositive(balance),
      currentPct: toPositive(curRate),
      monthsLeft,
      newPct: toPositive(newRate),
      newMonths,
      closingCosts: toPositive(costs),
      rollIn: roll === 'loan',
    })
    return { r, monthsLeft, newMonths }
  }, [balance, curRate, yearsLeft, newRate, newYears, costs, roll])

  const { r } = c
  const horizonYears = Math.ceil((r.cumCurrent.length - 1) / 12)
  const x = Array.from({ length: horizonYears + 1 }, (_, i) => i)
  const at = (arr: number[], y: number) => arr[Math.min(arr.length - 1, y * 12)] ?? 0
  const saving = r.monthlySaving
  const be = r.breakEvenMonth
  const cc = toPositive(costs)
  const lifetimeWord = r.lifetimeSaving >= 0 ? 'Saved over the life of the loans' : 'Extra cost over the life of the loans'

  return (
    <CalcGrid
      inputs={
        <>
          <Field id="rf-balance" label="Loan balance now" value={balance} onChange={setBalance} prefix={money.symbol} />
          <div className="grid grid-cols-2 gap-3">
            <Field id="rf-cur-rate" label="Current rate" value={curRate} onChange={setCurRate} suffix="%" />
            <Field id="rf-years-left" label="Years left" value={yearsLeft} onChange={setYearsLeft} suffix="yrs" />
          </div>
          <Field id="rf-new-rate" label="New rate" value={newRate} onChange={setNewRate} suffix="%" slider={{ min: 2, max: 10, step: 0.05 }} />
          <Field id="rf-new-years" label="New term" value={newYears} onChange={setNewYears} suffix="yrs" slider={{ min: 5, max: 40, step: 1 }} />
          <Field id="rf-costs" label="Closing costs" value={costs} onChange={setCosts} prefix={money.symbol} />
          <Choice
            label="Pay the closing costs"
            value={roll}
            onChange={setRoll}
            options={[
              { value: 'cash', label: 'In cash' },
              { value: 'loan', label: 'Add to the loan' },
            ]}
          />
          {select('rf-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label={saving >= 0 ? 'Monthly saving' : 'Monthly increase'}
            value={Math.abs(saving)}
            format={money.exact}
            hint={
              saving <= 0
                ? 'The new payment is not lower, so the closing costs are never paid back by the payment.'
                : be === 0
                  ? 'The closing costs are in the new loan, so you save from the first payment.'
                  : `The closing costs are paid back after ${be} months (${yearsMonths(be ?? 0)}).`
            }
          />
          <Stats
            items={[
              { label: 'New payment', value: money.exact(r.newPayment), hint: `now ${money.exact(r.currentPayment)}` },
              { label: 'Break-even', value: be === null ? 'Never' : `${be} months` },
              { label: lifetimeWord, value: money.round(Math.abs(r.lifetimeSaving)) },
            ]}
          />
          <LineChart
            x={x}
            series={[
              { id: 'new', label: 'Refinance', values: x.map((y) => at(r.cumNew, y)), stroke: 'solid' },
              { id: 'cur', label: 'Keep the loan', values: x.map((y) => at(r.cumCurrent, y)), stroke: 'grey' },
            ]}
            xLabel="Year"
            formatY={(v) => compact(v)}
            formatValue={money.round}
            markers={be !== null && be > 0 ? [{ x: be / 12, label: `Break-even, month ${be}` }] : []}
            defaultIndex={Math.min(horizonYears, 5)}
            summary={`Total paid so far on each path, closing costs included. Refinancing costs ${money.round(at(r.cumNew, Math.min(horizonYears, 5)))} over 5 years against ${money.round(at(r.cumCurrent, Math.min(horizonYears, 5)))} if you keep the loan.`}
            table
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <Formula
            items={[
              {
                label: 'Current payment',
                general: 'M = P × i ÷ (1 − (1 + i)^−n)',
                steps: [`i = ${num(toPositive(curRate), 3)}% ÷ 12, n = ${c.monthsLeft}`, `M = ${money.exact(toPositive(balance))} × i ÷ (1 − (1 + i)^−${c.monthsLeft})`],
                result: money.exact(r.currentPayment),
              },
              {
                label: 'New payment',
                general: 'M = P × i ÷ (1 − (1 + i)^−n)',
                steps: [
                  `P = ${money.exact(r.newPrincipal)}${roll === 'loan' ? ' (balance + closing costs)' : ''}, i = ${num(toPositive(newRate), 3)}% ÷ 12, n = ${c.newMonths}`,
                ],
                result: money.exact(r.newPayment),
              },
              {
                label: 'Break-even',
                general: 'months = closing costs ÷ monthly saving',
                steps: roll === 'loan' ? ['The closing costs are in the loan, so there is nothing to pay back in cash.'] : [`${money.exact(cc)} ÷ ${money.exact(saving)}`],
                result: be === null ? 'never (no monthly saving)' : `${be} months`,
              },
              {
                label: 'Lifetime difference',
                general: 'Δ = payments left on the current loan − (payments on the new loan + cash closing costs)',
                steps: [`${money.exact(r.cumCurrent[r.cumCurrent.length - 1] ?? 0)} − ${money.exact(r.cumNew[r.cumNew.length - 1] ?? 0)}`],
                result: money.exact(r.lifetimeSaving),
              },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'Fixed rates on both loans; principal and interest only, without taxes, insurance or PMI.',
              'A longer new term can lower the payment and still cost more in total. The lifetime difference and the chart show this.',
              'Money saved each month is not invested in this model, and the time value of money is ignored.',
            ]}
          />
        </div>
      }
    />
  )
}
