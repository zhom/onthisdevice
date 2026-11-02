import { useMemo, useState } from 'react'
import { LineChart, compact } from '@/components/viz'
import { discountedFlows, irr, irrAll, mirr, npv } from './money-math'
import { mirrParts } from './tvm-math'
import { CashFlowList, npvSteps, useCashFlows } from './CashFlowList'
import { Assumptions, CalcGrid, Field, Formula, Headline, Note, ResultPanel, Stats, numUpTo, pct, toNum, useCurrency } from './mb-ui'
import type { FormulaItem } from './mb-ui'

const STEPS = 60

/** Rate range for the NPV profile: 0% to about twice the highest IRR, 30% when there is none. */
function profileRange(rates: number[], financePct: number): [number, number] {
  const top = rates.length ? Math.max(...rates) : 0
  const bottom = rates.length ? Math.min(...rates) : 0
  const hi = Math.min(1000, Math.max(rates.length ? 10 : 30, Math.ceil((2 * top) / 5) * 5, Math.ceil(financePct / 5) * 5))
  const lo = Math.max(-90, Math.min(0, Math.floor((bottom - 5) / 5) * 5))
  return [lo, hi]
}

export default function IrrCalculator() {
  const { money, select } = useCurrency()
  const [finance, setFinance] = useState('10')
  const [reinvest, setReinvest] = useState('12')
  const { rows, setRows, flows } = useCashFlows([-70000, 12000, 15000, 18000, 21000, 26000])

  const c = useMemo(() => {
    const fr = Math.max(-90, Math.min(100, toNum(finance)))
    const rr = Math.max(-90, Math.min(100, toNum(reinvest)))
    const all = irrAll(flows)
    const main = irr(flows)
    const [lo, hi] = profileRange(all, fr)
    const x = Array.from({ length: STEPS + 1 }, (_, k) => lo + ((hi - lo) * k) / STEPS)
    const profile = x.map((r) => npv(r, flows))
    let near = 0
    x.forEach((r, k) => {
      if (Math.abs(r - fr) < Math.abs(x[near]! - fr)) near = k
    })
    return {
      fr,
      rr,
      all,
      main,
      lo,
      hi,
      x,
      profile,
      near,
      mirr: mirr(flows, fr, rr),
      parts: mirrParts(flows, fr, rr),
      npvFin: npv(fr, flows),
      pvFin: discountedFlows(fr, flows),
      pvIrr: main === null ? [] : discountedFlows(main, flows),
      total: flows.reduce((s, v) => s + v, 0),
      bothSigns: flows.some((f) => f > 0) && flows.some((f) => f < 0),
    }
  }, [flows, finance, reinvest])

  const list = c.all.map((r) => pct(r, 2)).join(', ')
  const hint =
    c.main === null
      ? 'These cash flows have no IRR.'
      : `At ${pct(c.main, 2)} a year the cash flows have an NPV of zero. The investment pays when your cost of money is below this rate.`

  const formula: FormulaItem[] = [
    ...(c.main === null
      ? []
      : [
          {
            label: 'Internal rate of return',
            general: '0 = Σ CFₜ ÷ (1 + IRR)^t, for t = 0 to n',
            steps: [
              'The rate is found by a search: the NPV changes sign between two rates, and bisection narrows the gap to 1e−12.',
              ...npvSteps(flows, c.pvIrr, c.main, money.exact),
            ],
            result: `IRR = ${numUpTo(c.main, 4)}%`,
          },
        ]),
    {
      label: 'Modified internal rate of return',
      general: 'MIRR = (FV of inflows at the reinvestment rate ÷ PV of outflows at the finance rate)^(1 ÷ n) − 1',
      steps: [
        `FV of inflows at ${pct(c.rr, 2)} = ${money.exact(c.parts.fvIn)}`,
        `PV of outflows at ${pct(c.fr, 2)} = ${money.exact(c.parts.pvOut)}`,
        `MIRR = (${money.exact(c.parts.fvIn)} ÷ ${money.exact(c.parts.pvOut)})^(1 ÷ ${c.parts.n}) − 1`,
      ],
      result: c.mirr === null ? 'None: it needs an inflow and an outflow' : `MIRR = ${numUpTo(c.mirr, 4)}%`,
    },
    {
      label: `NPV at the finance rate (${pct(c.fr, 2)})`,
      general: 'NPV = Σ CFₜ ÷ (1 + r)^t',
      steps: npvSteps(flows, c.pvFin, c.fr, money.exact),
      result: money.exact(c.npvFin),
    },
  ]

  return (
    <CalcGrid
      inputs={
        <>
          <CashFlowList id="irr-flow" rows={rows} onChange={setRows} symbol={money.symbol} />
          <Field id="irr-finance" label="Finance rate" value={finance} onChange={setFinance} suffix="%" slider={{ min: 0, max: 30, step: 0.25 }} hint="cost of money, per year" />
          <Field id="irr-reinvest" label="Reinvestment rate" value={reinvest} onChange={setReinvest} suffix="%" slider={{ min: 0, max: 30, step: 0.25 }} hint="for MIRR, per year" />
          {select('irr-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline label="Internal rate of return (IRR)" value={c.main ?? Number.NaN} format={(v) => pct(v, 2)} hint={hint} />
          {c.all.length > 1 ? (
            <Note warn>
              The cash flows change sign more than once, so the NPV is zero at {c.all.length} rates: {list}. The result above is the one nearest
              10%. IRR alone cannot judge this project: use the NPV at your cost of money, or the MIRR.
            </Note>
          ) : null}
          {c.main === null ? (
            <Note warn>
              {c.bothSigns
                ? 'No IRR: the NPV does not reach zero at any rate from −99% to 1,000% a year.'
                : 'No IRR: the cash flows need at least one negative amount (money you pay) and one positive amount (money you get back).'}
            </Note>
          ) : null}
          <Stats
            items={[
              { label: 'MIRR', value: c.mirr === null ? '–' : pct(c.mirr, 2), hint: `finance ${pct(c.fr, 1)}, reinvest ${pct(c.rr, 1)}` },
              { label: 'NPV at finance rate', value: money.exact(c.npvFin), hint: c.npvFin >= 0 ? 'adds value' : 'loses value' },
              { label: 'Cash flows total', value: money.exact(c.total), hint: 'NPV at 0%' },
            ]}
          />
          <LineChart
            x={c.x}
            series={[{ id: 'npv', label: 'NPV', values: c.profile, stroke: 'solid' }]}
            xLabel="Rate"
            formatX={(r) => `${numUpTo(r, 1)}%`}
            formatY={(v) => compact(v)}
            formatValue={money.round}
            markers={c.all.filter((r) => r >= c.lo && r <= c.hi).map((r) => ({ x: r, label: `IRR ${pct(r, 2)}` }))}
            defaultIndex={c.near}
            summary={
              `NPV of the cash flows at each discount rate from ${pct(c.lo, 0)} to ${pct(c.hi, 0)}. ` +
              (c.all.length
                ? `The line crosses zero at ${list}${c.all.length > 1 ? '' : ', the IRR'}. At your finance rate of ${pct(c.fr, 2)} the NPV is ${money.round(c.npvFin)}.`
                : `The line never crosses zero, so there is no IRR.`)
            }
            table
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <Formula items={formula} />
          <Assumptions
            title="Limits"
            items={[
              'Year 0 is today. Every later cash flow comes at the end of its year.',
              'IRR assumes the money that comes back earns the IRR again. MIRR uses your reinvestment rate instead.',
              'IRR does not show size. A small project can have a high IRR and add less value than a large one, so compare projects by NPV.',
              'The search covers rates from −99% to 1,000% a year.',
            ]}
          />
        </div>
      }
    />
  )
}
