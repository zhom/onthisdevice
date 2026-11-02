import { useMemo, useState } from 'react'
import { AreaChart, compact } from '@/components/viz'
import { k401, monthlyFromAnnualEffective } from './money-math'
import { Assumptions, CalcGrid, Field, Formula, Headline, Note, ResultPanel, Stats, num, numUpTo, pct, toPositive, useCurrency } from './mb-ui'

export default function Retirement401kCalculator() {
  const { money, select } = useCurrency()
  const [age, setAge] = useState('30')
  const [retire, setRetire] = useState('65')
  const [balance, setBalance] = useState('25000')
  const [salary, setSalary] = useState('70000')
  const [contrib, setContrib] = useState('6')
  const [match, setMatch] = useState('50')
  const [matchCap, setMatchCap] = useState('6')
  const [raise, setRaise] = useState('2')
  const [ret, setRet] = useState('6')
  const [limit, setLimit] = useState('24500')

  const c = useMemo(() => {
    const a = Math.max(14, Math.min(90, Math.round(toPositive(age, 30))))
    const ra = Math.max(a + 1, Math.min(100, Math.round(toPositive(retire, 65))))
    const x = {
      age: a,
      retireAge: ra,
      balance: toPositive(balance),
      salary: toPositive(salary),
      contribPct: Math.min(100, toPositive(contrib)),
      matchPct: toPositive(match),
      matchCapPct: Math.min(100, toPositive(matchCap)),
      salaryGrowthPct: toPositive(raise),
      returnPct: toPositive(ret),
      limit: toPositive(limit),
    }
    const rows = k401(x)
    const last = rows[rows.length - 1]!
    const prev = rows[rows.length - 2] ?? rows[0]!
    const i = monthlyFromAnnualEffective(x.returnPct)
    const youY1 = rows[1] ? rows[1].you : 0
    const empY1 = rows[1] ? rows[1].employer : 0
    const uncapped = (x.salary * x.contribPct) / 100
    return {
      x,
      rows,
      last,
      i,
      years: ra - a,
      youY1,
      empY1,
      uncapped,
      youLast: last.you - prev.you,
      empLast: last.employer - prev.employer,
      month1: x.balance * (1 + i) + (youY1 + empY1) / 12,
    }
  }, [age, retire, balance, salary, contrib, match, matchCap, raise, ret, limit])

  const { x, rows, last } = c
  const ages = rows.map((r) => r.age)
  const capped = x.limit > 0 && c.uncapped > x.limit
  const matched = Math.min(x.contribPct, x.matchCapPct)
  const pc = (n: number) => `${numUpTo(n, 2)}%`
  const growthShare = last.balance > 0 ? (last.growth / last.balance) * 100 : 0

  return (
    <CalcGrid
      inputs={
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field id="k4-age" label="Your age" value={age} onChange={setAge} />
            <Field id="k4-retire" label="Retirement age" value={retire} onChange={setRetire} />
          </div>
          <Field id="k4-balance" label="Current 401(k) balance" value={balance} onChange={setBalance} prefix={money.symbol} />
          <Field id="k4-salary" label="Yearly salary" value={salary} onChange={setSalary} prefix={money.symbol} />
          <Field id="k4-contrib" label="Your contribution" value={contrib} onChange={setContrib} suffix="%" hint="of salary" slider={{ min: 0, max: 30, step: 1 }} />
          <div className="grid grid-cols-2 gap-3">
            <Field id="k4-match" label="Employer match" value={match} onChange={setMatch} suffix="%" />
            <Field id="k4-match-cap" label="Up to" value={matchCap} onChange={setMatchCap} suffix="%" hint="of salary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="k4-raise" label="Salary growth" value={raise} onChange={setRaise} suffix="%" />
            <Field id="k4-return" label="Annual return" value={ret} onChange={setRet} suffix="%" />
          </div>
          <Field id="k4-limit" label="Yearly limit on your contributions" value={limit} onChange={setLimit} prefix={money.symbol} hint="0 = no cap" />
          <Note>24,500 is the 2026 limit under age 50. Check the IRS figure for your year.</Note>
          {select('k4-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Balance at retirement"
            value={last.balance}
            format={money.round}
            hint={`At age ${x.retireAge}, after ${c.years} ${c.years === 1 ? 'year' : 'years'} of contributions.`}
          />
          <Stats
            items={[
              { label: 'Your contributions', value: money.round(last.you), hint: capped ? 'capped by the limit' : undefined },
              { label: 'Employer contributions', value: money.round(last.employer) },
              { label: 'Growth', value: money.round(last.growth), hint: `${pct(growthShare, 0)} of the balance` },
            ]}
          />
          <AreaChart
            x={ages}
            series={[
              { id: 'start', label: 'Starting balance', values: rows.map(() => x.balance), paint: 'grey' },
              { id: 'you', label: 'You', values: rows.map((r) => r.you), paint: 'ink' },
              { id: 'emp', label: 'Employer', values: rows.map((r) => r.employer), paint: 'dots' },
              { id: 'growth', label: 'Growth', values: rows.map((r) => r.growth), paint: 'hatch' },
            ]}
            xLabel="Age"
            formatY={(v) => compact(v)}
            formatValue={money.round}
            summary={`Balance at each birthday, split by source. At ${x.retireAge} the ${money.round(last.balance)} is ${money.round(x.balance)} you start with, ${money.round(last.you)} you put in, ${money.round(last.employer)} from your employer and ${money.round(last.growth)} of growth.`}
            table
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <Formula
            items={[
              {
                label: 'Monthly return',
                general: 'i = (1 + R)^(1/12) − 1',
                steps: [`i = (1 + ${numUpTo(x.returnPct / 100, 6)})^(1/12) − 1`],
                result: `${(c.i * 100).toFixed(4)}% a month`,
              },
              {
                label: 'Your contribution in year 1',
                general: 'C = min(salary × c, limit)',
                steps: [
                  `C = min(${money.exact(x.salary)} × ${pc(x.contribPct)}, ${x.limit > 0 ? money.exact(x.limit) : 'no limit'})`,
                  `C = min(${money.exact(c.uncapped)}, ${x.limit > 0 ? money.exact(x.limit) : 'no limit'})`,
                ],
                result: money.exact(c.youY1),
              },
              {
                label: 'Employer match in year 1',
                general: 'E = salary × min(c, cap) × match',
                steps: [
                  `E = ${money.exact(x.salary)} × min(${pc(x.contribPct)}, ${pc(x.matchCapPct)}) × ${pc(x.matchPct)}`,
                  `E = ${money.exact(x.salary)} × ${pc(matched)} × ${pc(x.matchPct)}`,
                ],
                result: money.exact(c.empY1),
              },
              {
                label: 'Each month',
                general: 'B = B × (1 + i) + (C + E) ÷ 12',
                steps: [
                  `Month 1: ${money.exact(x.balance)} × (1 + ${c.i.toFixed(6)}) + (${money.exact(c.youY1)} + ${money.exact(c.empY1)}) ÷ 12`,
                  `Last year: C = ${money.exact(c.youLast)}, E = ${money.exact(c.empLast)}`,
                  `Months in total: ${num(c.years * 12)}`,
                ],
                result: `${money.exact(c.month1)} after month 1, ${money.exact(last.balance)} at age ${x.retireAge}`,
              },
            ]}
            note={`Salary grows ${pc(x.salaryGrowthPct)} a year, so C and E grow with it. The limit applies to C only.`}
          />
          <Assumptions
            title="Limits"
            items={[
              'The return is the same every year. Real returns change from year to year and can be negative.',
              'Your contributions and the match go in each month in equal parts. Some employers pay the match once a year.',
              'The limit stays the same each year. The IRS raises it with inflation, and at age 50 or older you can add catch-up contributions.',
              'Fees, inflation and the income tax you pay on withdrawals are not included. Employer money can need some years of service before it is yours (vesting).',
            ]}
          />
        </div>
      }
    />
  )
}
