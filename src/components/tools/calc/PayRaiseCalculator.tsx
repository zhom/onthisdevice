import { useMemo, useState } from 'react'
import { Decimal } from '@/components/tools/finance/money'
import { LineChart, compact } from '@/components/viz'
import { Assumptions, CalcGrid, Choice, Field, Formula, Headline, ResultPanel, Stats, num, toPositive, useCurrency } from './mb-ui'

export default function PayRaiseCalculator() {
  const { money, select } = useCurrency()
  const [payMode, setPayMode] = useState<'year' | 'hour'>('year')
  const [pay, setPay] = useState('60000')
  const [hours, setHours] = useState('40')
  const [raiseMode, setRaiseMode] = useState<'pct' | 'amount'>('pct')
  const [raise, setRaise] = useState('4')
  const [inflation, setInflation] = useState('3')

  const c = useMemo(() => {
    const hrs = Math.max(0, toPositive(hours, 40))
    const oldYear = payMode === 'year' ? new Decimal(toPositive(pay)) : new Decimal(toPositive(pay)).times(hrs).times(52)
    let newYear: Decimal
    if (raiseMode === 'pct') newYear = oldYear.times(new Decimal(toPositive(raise)).div(100).plus(1))
    else newYear = payMode === 'year' ? oldYear.plus(toPositive(raise)) : oldYear.plus(new Decimal(toPositive(raise)).times(hrs).times(52))
    const diff = newYear.minus(oldYear)
    const pct = oldYear.gt(0) ? diff.div(oldYear).times(100) : new Decimal(0)
    const infl = new Decimal(toPositive(inflation)).div(100)
    const real = newYear.div(oldYear.times(infl.plus(1))).minus(1).times(100)
    return {
      oldYear: oldYear.toNumber(),
      newYear: newYear.toNumber(),
      diff: diff.toNumber(),
      pct: pct.toNumber(),
      real: oldYear.gt(0) ? real.toNumber() : 0,
      hrs,
      infl: infl.toNumber(),
    }
  }, [payMode, pay, hours, raiseMode, raise, inflation])

  const years = Array.from({ length: 11 }, (_, i) => i)
  const g = c.pct / 100
  const withRaise = years.map((y) => c.oldYear * Math.pow(1 + g, y))
  const keepUp = years.map((y) => c.oldYear * Math.pow(1 + c.infl, y))
  const perHour = c.hrs > 0 ? c.newYear / (c.hrs * 52) : NaN

  return (
    <CalcGrid
      inputs={
        <>
          <Choice
            label="Current pay is"
            value={payMode}
            onChange={setPayMode}
            options={[
              { value: 'year', label: 'Per year' },
              { value: 'hour', label: 'Per hour' },
            ]}
          />
          <Field id="pr-pay" label={payMode === 'year' ? 'Yearly salary' : 'Hourly rate'} value={pay} onChange={setPay} prefix={money.symbol} />
          <Field id="pr-hours" label="Hours a week" value={hours} onChange={setHours} hint="for hourly and per-hour figures" />
          <Choice
            label="Raise given as"
            value={raiseMode}
            onChange={setRaiseMode}
            options={[
              { value: 'pct', label: 'Percent' },
              { value: 'amount', label: 'Amount' },
            ]}
          />
          {raiseMode === 'pct' ? (
            <Field id="pr-raise" label="Raise" value={raise} onChange={setRaise} suffix="%" slider={{ min: 0, max: 30, step: 0.5 }} />
          ) : (
            <Field id="pr-raise-amt" label={payMode === 'year' ? 'Raise per year' : 'Raise per hour'} value={raise} onChange={setRaise} prefix={money.symbol} />
          )}
          <Field id="pr-infl" label="Inflation" value={inflation} onChange={setInflation} suffix="% a year" />
          {select('pr-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline label="New yearly pay" value={c.newYear} format={money.round} hint={`${money.round(c.diff)} more a year, a ${num(c.pct, 2)}% raise.`} />
          <Stats
            items={[
              { label: 'More per month', value: money.exact(c.diff / 12) },
              { label: 'More per paycheck', value: money.exact(c.diff / 26), hint: 'every 2 weeks' },
              { label: 'New hourly rate', value: Number.isFinite(perHour) ? money.exact(perHour) : '–' },
              { label: 'Real raise', value: `${num(c.real, 2)}%`, hint: `after ${num(c.infl * 100, 1)}% inflation` },
            ]}
          />
          <LineChart
            x={years}
            series={[
              { id: 'r', label: `${num(c.pct, 1)}% a year`, values: withRaise, stroke: 'solid' },
              { id: 'i', label: 'Keeps up with prices', values: keepUp, stroke: 'grey' },
            ]}
            xLabel="Year"
            formatY={(v) => compact(v)}
            formatValue={money.round}
            zero={false}
            defaultIndex={10}
            summary={
              c.real >= 0
                ? `If you get the same raise every year, pay after 10 years is ${money.round(withRaise[10] ?? 0)}, ${money.round((withRaise[10] ?? 0) - (keepUp[10] ?? 0))} above the pay that only keeps up with ${num(c.infl * 100, 1)}% inflation.`
                : `This raise is below inflation. After 10 years of the same raise, pay is ${money.round((keepUp[10] ?? 0) - (withRaise[10] ?? 0))} short of the pay that keeps up with prices.`
            }
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <Formula
            items={[
              {
                label: 'New pay',
                general: raiseMode === 'pct' ? 'new = old × (1 + raise %)' : 'new = old + raise',
                steps: [raiseMode === 'pct' ? `${money.exact(c.oldYear)} × (1 + ${num(toPositive(raise), 2)}%)` : `${money.exact(c.oldYear)} + ${money.exact(c.diff)}`],
                result: money.exact(c.newYear),
              },
              { label: 'Raise in percent', general: '(new − old) ÷ old × 100', steps: [`${money.exact(c.diff)} ÷ ${money.exact(c.oldYear)} × 100`], result: `${num(c.pct, 3)}%` },
              { label: 'Real raise', general: '(1 + raise) ÷ (1 + inflation) − 1', steps: [`(1 + ${num(c.pct, 3)}%) ÷ (1 + ${num(c.infl * 100, 2)}%) − 1`], result: `${num(c.real, 3)}%` },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'Pay before tax. A raise can move part of your income into a higher tax bracket, so take-home pay rises by less.',
              'Hourly figures use 52 weeks of the hours you enter; paychecks are every two weeks (26 a year).',
            ]}
          />
        </div>
      }
    />
  )
}
