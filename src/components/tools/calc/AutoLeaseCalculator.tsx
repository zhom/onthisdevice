import { useMemo, useState } from 'react'
import { Donut, Split } from '@/components/viz'
import { lease } from './money-math'
import { Assumptions, CalcGrid, Choice, Field, Formula, Headline, ResultPanel, Stats, num, toPositive, useCurrency } from './mb-ui'

export default function AutoLeaseCalculator() {
  const { money, select } = useCurrency()
  const [msrp, setMsrp] = useState('35000')
  const [price, setPrice] = useState('33000')
  const [down, setDown] = useState('2000')
  const [trade, setTrade] = useState('0')
  const [rebates, setRebates] = useState('0')
  const [fees, setFees] = useState('895')
  const [residual, setResidual] = useState('58')
  const [rateMode, setRateMode] = useState<'mf' | 'apr'>('mf')
  const [mf, setMf] = useState('0.0025')
  const [apr, setApr] = useState('6')
  const [months, setMonths] = useState('36')
  const [tax, setTax] = useState('7')

  const moneyFactor = rateMode === 'mf' ? toPositive(mf) : toPositive(apr) / 2400
  const n = Math.max(1, Math.min(84, Math.round(toPositive(months, 36))))
  const l = useMemo(
    () =>
      lease({
        msrp: toPositive(msrp),
        price: toPositive(price),
        down: toPositive(down),
        tradeIn: toPositive(trade),
        rebates: toPositive(rebates),
        fees: toPositive(fees),
        residualPct: toPositive(residual),
        moneyFactor,
        months: n,
        taxPct: toPositive(tax),
      }),
    [msrp, price, down, trade, rebates, fees, residual, moneyFactor, n, tax],
  )
  const upfront = toPositive(down) + toPositive(trade)
  const invalid = l.capCost <= 0 || l.depreciation < 0

  return (
    <CalcGrid
      inputs={
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field id="al-msrp" label="MSRP" value={msrp} onChange={setMsrp} prefix={money.symbol} />
            <Field id="al-price" label="Agreed price" value={price} onChange={setPrice} prefix={money.symbol} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="al-down" label="Down payment" value={down} onChange={setDown} prefix={money.symbol} />
            <Field id="al-trade" label="Trade-in" value={trade} onChange={setTrade} prefix={money.symbol} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="al-rebates" label="Rebates" value={rebates} onChange={setRebates} prefix={money.symbol} />
            <Field id="al-fees" label="Fees in the lease" value={fees} onChange={setFees} prefix={money.symbol} />
          </div>
          <Field id="al-residual" label="Residual value" value={residual} onChange={setResidual} suffix="% of MSRP" slider={{ min: 30, max: 80, step: 1 }} />
          <Choice
            label="Lease rate given as"
            value={rateMode}
            onChange={setRateMode}
            options={[
              { value: 'mf', label: 'Money factor' },
              { value: 'apr', label: 'APR' },
            ]}
          />
          {rateMode === 'mf' ? (
            <Field id="al-mf" label="Money factor" value={mf} onChange={setMf} hint={`= ${num(moneyFactor * 2400, 2)}% APR`} />
          ) : (
            <Field id="al-apr" label="APR" value={apr} onChange={setApr} suffix="%" hint={`= ${moneyFactor.toFixed(5)} money factor`} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field id="al-months" label="Term" value={months} onChange={setMonths} suffix="months" />
            <Field id="al-tax" label="Sales tax" value={tax} onChange={setTax} suffix="%" />
          </div>
          {select('al-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Monthly lease payment"
            value={l.monthly}
            format={money.exact}
            hint={`${n} payments, plus ${money.round(upfront)} at signing.`}
          />
          <Stats
            items={[
              { label: 'Depreciation fee', value: money.exact(l.depreciation) },
              { label: 'Finance fee', value: money.exact(l.finance) },
              { label: 'Tax', value: money.exact(l.tax) },
              { label: 'Total cost of the lease', value: money.round(l.totalCost), hint: 'payments + down + trade-in' },
              { label: 'Residual value', value: money.round(l.residual) },
              { label: 'APR equivalent', value: `${num(l.aprEquivalent, 2)}%` },
            ]}
          />
          {invalid ? null : (
            <Donut
              parts={[
                { label: 'Depreciation', value: l.depreciation, paint: 'ink' },
                { label: 'Finance fee', value: l.finance, paint: 'hatch' },
                { label: 'Tax', value: l.tax, paint: 'grey' },
              ]}
              formatValue={money.exact}
              center={
                <>
                  <span className="text-lg font-[720]">{money.exact(l.monthly)}</span>
                  <span className="text-xs text-muted-foreground">a month</span>
                </>
              }
              summary={`Of each ${money.exact(l.monthly)} payment, ${money.exact(l.depreciation)} pays for the value the car loses, ${money.exact(l.finance)} is the finance fee and ${money.exact(l.tax)} is tax.`}
            />
          )}
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <ResultPanel title="What you pay for">
            <Split
              parts={[
                { label: 'Value used over the lease', value: Math.max(0, l.capCost - l.residual), paint: 'ink' },
                { label: 'Residual (you return it)', value: Math.max(0, l.residual), paint: 'hatch' },
              ]}
              formatValue={money.round}
              summary={`The adjusted price is ${money.round(l.capCost)}. You pay for the ${money.round(Math.max(0, l.capCost - l.residual))} it loses over ${n} months, plus finance fees and tax; the ${money.round(l.residual)} residual goes back with the car.`}
            />
          </ResultPanel>
          <Formula
            items={[
              {
                label: 'Adjusted capitalized cost',
                general: 'cap = price + fees − down − trade-in − rebates',
                steps: [`${money.exact(toPositive(price))} + ${money.exact(toPositive(fees))} − ${money.exact(toPositive(down))} − ${money.exact(toPositive(trade))} − ${money.exact(toPositive(rebates))}`],
                result: money.exact(l.capCost),
              },
              {
                label: 'Residual value',
                general: 'residual = MSRP × residual %',
                steps: [`${money.exact(toPositive(msrp))} × ${num(toPositive(residual), 1)}%`],
                result: money.exact(l.residual),
              },
              {
                label: 'Depreciation fee',
                general: '(cap − residual) ÷ months',
                steps: [`(${money.exact(l.capCost)} − ${money.exact(l.residual)}) ÷ ${n}`],
                result: money.exact(l.depreciation),
              },
              {
                label: 'Finance fee',
                general: '(cap + residual) × money factor',
                steps: [`(${money.exact(l.capCost)} + ${money.exact(l.residual)}) × ${moneyFactor.toFixed(5)}`, 'money factor = APR ÷ 2400'],
                result: money.exact(l.finance),
              },
              {
                label: 'Monthly payment',
                general: '(depreciation + finance) × (1 + tax rate)',
                steps: [`(${money.exact(l.depreciation)} + ${money.exact(l.finance)}) × (1 + ${num(toPositive(tax), 2)}%)`],
                result: money.exact(l.monthly),
              },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'Tax is charged on each monthly payment, as in most US states. Some states tax the full price or the down payment instead.',
              'Mileage over the allowance, wear charges and the disposition fee at the end are not included.',
              'The money factor and residual come from the lessor; ask for both in writing.',
            ]}
          />
        </div>
      }
    />
  )
}
