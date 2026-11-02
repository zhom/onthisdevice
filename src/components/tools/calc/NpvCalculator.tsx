import { useMemo, useState } from 'react'
import { LineChart, compact } from '@/components/viz'
import { DataTable } from '@/components/tools/finance/common'
import { discountedFlows, irr, npv, paybackYears } from './money-math'
import { cumulative, profitabilityIndex } from './tvm-math'
import { CashFlowList, npvSteps, useCashFlows } from './CashFlowList'
import { Assumptions, CalcGrid, Field, Formula, Headline, ResultPanel, Stats, num, pct, toPositive, useCurrency } from './mb-ui'
import type { FormulaItem } from './mb-ui'

interface FlowLine {
  t: number
  flow: number
  factor: number
  pv: number
  running: number
}

/** "2 + 3,000.00 ÷ 14,000.00" for the year the running total turns positive. */
function paybackSteps(flows: number[], running: number[], fmt: (n: number) => string): string[] {
  const k = running.findIndex((v) => v >= 0)
  if (k <= 0) return []
  return [`${k - 1} + ${fmt(-running[k - 1]!)} ÷ ${fmt(flows[k]!)}`]
}

export default function NpvCalculator() {
  const { money, select } = useCurrency()
  const [rate, setRate] = useState('8')
  const { rows, setRows, flows } = useCashFlows([-50000, 12000, 15000, 16000, 14000, 13000])

  const c = useMemo(() => {
    const r = Math.min(100, toPositive(rate))
    const value = npv(r, flows)
    const pvs = discountedFlows(r, flows)
    const running = cumulative(flows)
    const runningPv = cumulative(pvs)
    const lines: FlowLine[] = flows.map((flow, t) => ({ t, flow, factor: Math.pow(1 + r / 100, -t), pv: pvs[t]!, running: runningPv[t]! }))
    return {
      r,
      value,
      pvs,
      running,
      runningPv,
      lines,
      irr: irr(flows),
      payback: paybackYears(flows),
      dPayback: paybackYears(pvs),
      pi: profitabilityIndex(pvs),
      x: flows.map((_, t) => t),
    }
  }, [rate, flows])

  const N = flows.length - 1
  const rTxt = pct(c.r, 2)
  const yrs = (v: number | null) => (v === null ? `Not within ${N} years` : `${num(v, 2)} years`)
  const verdict =
    Math.abs(c.value) < 0.005
      ? `Zero: the project earns exactly ${rTxt} a year.`
      : c.value > 0
        ? `Positive: at ${rTxt} the project adds ${money.exact(c.value)} of value today. Accept it at this rate.`
        : `Negative: at ${rTxt} the project loses ${money.exact(-c.value)} of value today. Reject it at this rate.`

  const markers = [
    ...(c.payback !== null && c.payback > 0 ? [{ x: c.payback, label: `Payback ${num(c.payback, 1)}` }] : []),
    ...(c.dPayback !== null && c.dPayback > 0 ? [{ x: c.dPayback, label: `Discounted ${num(c.dPayback, 1)}` }] : []),
  ]

  const later = c.pvs.slice(1).reduce((s, v) => s + v, 0)

  const formula: FormulaItem[] = [
    {
      label: 'Net present value',
      general: 'NPV = Σ CFₜ ÷ (1 + r)^t, for t = 0 to n',
      steps: npvSteps(flows, c.pvs, c.r, money.exact),
      result: money.exact(c.value),
    },
    {
      label: 'Profitability index',
      general: 'PI = present value of years 1 to n ÷ investment in year 0',
      steps: c.pi === null ? ['Year 0 is not an outflow, so there is no investment to divide by.'] : [`PI = ${money.exact(later)} ÷ ${money.exact(-c.pvs[0]!)}`],
      result: c.pi === null ? '–' : num(c.pi, 3),
    },
    {
      label: 'Payback period',
      general: 'Last year with a negative running total + amount still to recover ÷ next year’s cash flow',
      steps: paybackSteps(flows, c.running, money.exact),
      result: yrs(c.payback),
    },
    {
      label: 'Discounted payback period',
      general: 'The same, with the present value of each cash flow',
      steps: paybackSteps(c.pvs, c.runningPv, money.exact),
      result: yrs(c.dPayback),
    },
  ]

  return (
    <CalcGrid
      inputs={
        <>
          <Field id="npv-rate" label="Discount rate" value={rate} onChange={setRate} suffix="%" slider={{ min: 0, max: 30, step: 0.25 }} hint="per year" />
          <CashFlowList id="npv-flow" rows={rows} onChange={setRows} symbol={money.symbol} />
          {select('npv-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline label="Net present value" value={c.value} format={money.exact} hint={verdict} />
          <Stats
            cols={2}
            items={[
              { label: 'IRR', value: c.irr === null ? 'None' : pct(c.irr, 2), hint: c.irr === null ? 'needs a negative and a positive flow' : 'NPV is zero at this rate' },
              { label: 'Profitability index', value: c.pi === null ? '–' : num(c.pi, 3), hint: 'above 1 adds value' },
              { label: 'Payback period', value: yrs(c.payback) },
              { label: 'Discounted payback', value: yrs(c.dPayback), hint: `at ${rTxt}` },
            ]}
          />
          <LineChart
            x={c.x}
            series={[
              { id: 'cum', label: 'Cash flow so far', values: c.running, stroke: 'solid' },
              { id: 'dcum', label: 'Discounted', values: c.runningPv, stroke: 'dash' },
            ]}
            xLabel="Year"
            formatY={(v) => compact(v)}
            formatValue={money.round}
            markers={markers}
            summary={
              `Running total of the cash flows. ` +
              (c.payback !== null ? `It turns positive after ${num(c.payback, 2)} years. ` : `It stays negative for all ${N} years. `) +
              (c.dPayback !== null
                ? `Discounted at ${rTxt}, it turns positive after ${num(c.dPayback, 2)} years and ends at the NPV, ${money.round(c.value)}.`
                : `Discounted at ${rTxt}, it stays negative and ends at the NPV, ${money.round(c.value)}.`)
            }
            table
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <ResultPanel title="Present value of each cash flow">
            <DataTable
              ariaLabel="Present value of each cash flow"
              pageSize={0}
              rows={c.lines}
              columns={[
                { key: 't', header: 'Year', render: (l) => l.t },
                { key: 'flow', header: 'Cash flow', align: 'right', render: (l) => money.exact(l.flow) },
                { key: 'factor', header: 'Discount factor', align: 'right', render: (l) => num(l.factor, 4) },
                { key: 'pv', header: 'Present value', align: 'right', render: (l) => money.exact(l.pv) },
                { key: 'run', header: 'Running total', align: 'right', render: (l) => money.exact(l.running) },
              ]}
            />
          </ResultPanel>
          <Formula items={formula} />
          <Assumptions
            title="Limits"
            items={[
              'Year 0 is today. Every later cash flow comes at the end of its year.',
              'One discount rate for all years. Use the return you could get elsewhere at the same risk.',
              'Payback ignores the cash flows after the payback year.',
              'IRR can have more than one value when the cash flows change sign more than once. The IRR calculator lists them all.',
            ]}
          />
        </div>
      }
    />
  )
}
