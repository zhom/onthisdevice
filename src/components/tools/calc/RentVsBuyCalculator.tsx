import { useMemo, useState } from 'react'
import { LineChart, compact } from '@/components/viz'
import { monthlyFromAnnualEffective, rentVsBuy } from './money-math'
import { Assumptions, CalcGrid, Field, FieldGroup, Formula, Headline, ResultPanel, Stats, numUpTo, pct, toPositive, useCurrency } from './mb-ui'

/** Years simulated to look for the break-even year beyond the stay. */
const HORIZON = 40

export default function RentVsBuyCalculator() {
  const { money, select } = useCurrency()
  const [price, setPrice] = useState('400000')
  const [down, setDown] = useState('20')
  const [rate, setRate] = useState('6.5')
  const [term, setTerm] = useState('30')
  const [closing, setClosing] = useState('3')
  const [selling, setSelling] = useState('6')
  const [propTax, setPropTax] = useState('1.1')
  const [insurance, setInsurance] = useState('1800')
  const [maint, setMaint] = useState('1')
  const [hoa, setHoa] = useState('0')
  const [rent, setRent] = useState('2200')
  const [rentInc, setRentInc] = useState('3')
  const [renterIns, setRenterIns] = useState('180')
  const [appr, setAppr] = useState('3')
  const [invest, setInvest] = useState('6')
  const [stay, setStay] = useState('10')

  const c = useMemo(() => {
    const x = {
      price: toPositive(price),
      downPct: Math.min(100, toPositive(down)),
      ratePct: toPositive(rate),
      termYears: Math.max(1, Math.min(40, Math.round(toPositive(term, 30)))),
      closingPct: toPositive(closing),
      sellingPct: Math.min(100, toPositive(selling)),
      propertyTaxPct: toPositive(propTax),
      insurancePerYear: toPositive(insurance),
      maintenancePct: toPositive(maint),
      hoaPerMonth: toPositive(hoa),
      appreciationPct: toPositive(appr),
      rentPerMonth: toPositive(rent),
      rentIncreasePct: toPositive(rentInc),
      renterInsurancePerYear: toPositive(renterIns),
      investReturnPct: toPositive(invest),
      years: HORIZON,
    }
    const years = Math.max(1, Math.min(HORIZON, Math.round(toPositive(stay, 10))))
    const res = rentVsBuy(x)
    return { x, years, res }
  }, [price, down, rate, term, closing, selling, propTax, insurance, maint, hoa, rent, rentInc, renterIns, appr, invest, stay])

  const { x, years, res } = c
  const at = res.years[years - 1]!
  const diff = at.buyWealth - at.rentWealth
  const buyWins = diff >= 0
  const be = res.breakEvenYear
  const shownYears = Math.max(years, be ?? 0)
  const rows = res.years.slice(0, shownYears)
  const first = res.years[0]!

  const downAmt = (x.price * x.downPct) / 100
  const closingAmt = (x.price * x.closingPct) / 100
  const loan = x.price - downAmt
  const owner1 = res.payment + (x.price * x.propertyTaxPct) / 1200 + x.insurancePerYear / 12 + (x.price * x.maintenancePct) / 1200 + x.hoaPerMonth
  const renter1 = x.rentPerMonth + x.renterInsurancePerYear / 12
  const iInv = monthlyFromAnnualEffective(x.investReturnPct)
  const equity = at.homeValue * (1 - x.sellingPct / 100) - at.loanBalance
  const buyerPot = at.buyWealth - equity
  const winner = buyWins ? 'buying' : 'renting'
  const upfrontGrown = res.upfront * Math.pow(1 + iInv, years * 12)

  return (
    <CalcGrid
      inputs={
        <>
          <FieldGroup title="Home" columns={1}>
            <Field id="rb-price" label="Home price" value={price} onChange={setPrice} prefix={money.symbol} />
            <div className="grid grid-cols-2 gap-3">
              <Field id="rb-down" label="Down payment" value={down} onChange={setDown} suffix="%" />
              <Field id="rb-rate" label="Interest rate" value={rate} onChange={setRate} suffix="%" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field id="rb-term" label="Loan term" value={term} onChange={setTerm} suffix="yrs" />
              <Field id="rb-closing" label="Closing costs" value={closing} onChange={setClosing} suffix="%" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field id="rb-selling" label="Selling costs" value={selling} onChange={setSelling} suffix="%" />
              <Field id="rb-tax" label="Property tax" value={propTax} onChange={setPropTax} suffix="%/yr" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field id="rb-ins" label="Home insurance" value={insurance} onChange={setInsurance} prefix={money.symbol} suffix="/yr" />
              <Field id="rb-maint" label="Maintenance" value={maint} onChange={setMaint} suffix="%/yr" />
            </div>
            <Field id="rb-hoa" label="HOA fee" value={hoa} onChange={setHoa} prefix={money.symbol} suffix="/mo" />
          </FieldGroup>
          <FieldGroup title="Renting" columns={1}>
            <Field id="rb-rent" label="Monthly rent" value={rent} onChange={setRent} prefix={money.symbol} />
            <div className="grid grid-cols-2 gap-3">
              <Field id="rb-rent-inc" label="Rent increase" value={rentInc} onChange={setRentInc} suffix="%/yr" />
              <Field id="rb-renter-ins" label="Renter's insurance" value={renterIns} onChange={setRenterIns} prefix={money.symbol} suffix="/yr" />
            </div>
          </FieldGroup>
          <FieldGroup title="Both" columns={1}>
            <div className="grid grid-cols-2 gap-3">
              <Field id="rb-appr" label="Home price growth" value={appr} onChange={setAppr} suffix="%/yr" />
              <Field id="rb-invest" label="Investment return" value={invest} onChange={setInvest} suffix="%/yr" />
            </div>
            <Field id="rb-stay" label="Years you stay" value={stay} onChange={setStay} suffix="yrs" slider={{ min: 1, max: HORIZON, step: 1 }} />
          </FieldGroup>
          {select('rb-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label={`${buyWins ? 'Buying' : 'Renting'} leaves you better off after ${years} ${years === 1 ? 'year' : 'years'}`}
            value={Math.abs(diff)}
            format={money.round}
            hint={`If you buy: ${money.round(at.buyWealth)} after you sell the home. If you rent: ${money.round(at.rentWealth)} in investments.`}
          />
          <Stats
            items={[
              { label: 'Break-even year', value: be ? `Year ${be}` : `Not in ${HORIZON} years`, hint: be ? 'first year buying is ahead' : undefined },
              { label: 'Monthly mortgage payment', value: money.exact(res.payment), hint: 'principal and interest' },
              { label: 'Cash needed up front', value: money.round(res.upfront), hint: `${money.round(downAmt)} down + ${money.round(closingAmt)} closing` },
            ]}
          />
          <LineChart
            x={rows.map((r) => r.year)}
            series={[
              { id: 'buy', label: 'If you buy', values: rows.map((r) => r.buyWealth), stroke: 'solid' },
              { id: 'rent', label: 'If you rent', values: rows.map((r) => r.rentWealth), stroke: 'dash' },
            ]}
            xLabel="Year"
            formatY={(v) => compact(v)}
            formatValue={money.round}
            markers={be && be <= shownYears ? [{ x: be, label: `Break-even, year ${be}` }] : []}
            defaultIndex={years - 1}
            zero={false}
            summary={`Wealth at the end of each year if you sell then. After ${years} ${years === 1 ? 'year' : 'years'} ${winner} is ahead by ${money.round(Math.abs(diff))}. ${be ? `Buying is ahead from year ${be}${be > years ? ', after the years you stay' : ''}.` : `Buying does not get ahead within ${HORIZON} years.`}`}
            table
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <ResultPanel title="Yearly costs">
            <LineChart
              x={rows.map((r) => r.year)}
              series={[
                { id: 'own', label: 'Owning', values: rows.map((r) => r.buyCostYear), stroke: 'solid' },
                { id: 'rent', label: 'Renting', values: rows.map((r) => r.rentCostYear), stroke: 'dash' },
              ]}
              xLabel="Year"
              formatY={(v) => compact(v)}
              formatValue={money.round}
              defaultIndex={0}
              summary={`In year 1 owning costs ${money.round(first.buyCostYear)} and renting ${money.round(first.rentCostYear)}. The mortgage payment stays the same while rent rises ${numUpTo(x.rentIncreasePct, 2)}% a year. Each month the one who pays less invests the difference.`}
              table
            />
          </ResultPanel>
          <Formula
            items={[
              {
                label: 'Monthly mortgage payment',
                general: 'M = L × i ÷ (1 − (1 + i)^−n)',
                steps: [
                  `L = ${money.exact(x.price)} − ${money.exact(downAmt)} = ${money.exact(loan)}`,
                  `i = ${numUpTo(x.ratePct, 4)}% ÷ 12 = ${(x.ratePct / 1200).toFixed(6)}, n = ${x.termYears * 12}`,
                ],
                result: money.exact(res.payment),
              },
              {
                label: 'Cash up front (the same for both)',
                general: 'down payment + closing costs',
                steps: [`${money.exact(downAmt)} + ${money.exact(closingAmt)}`],
                result: money.exact(res.upfront),
              },
              {
                label: 'Cost of owning in month 1',
                general: 'M + property tax + insurance + maintenance + HOA',
                steps: [`${money.exact(res.payment)} + ${money.exact((x.price * x.propertyTaxPct) / 1200)} + ${money.exact(x.insurancePerYear / 12)} + ${money.exact((x.price * x.maintenancePct) / 1200)} + ${money.exact(x.hoaPerMonth)}`],
                result: money.exact(owner1),
              },
              {
                label: 'Cost of renting in month 1',
                general: "rent + renter's insurance",
                steps: [`${money.exact(x.rentPerMonth)} + ${money.exact(x.renterInsurancePerYear / 12)}`],
                result: money.exact(renter1),
              },
              {
                label: 'Invested in month 1',
                general: 'the difference, by the one who pays less',
                steps: [`|${money.exact(owner1)} − ${money.exact(renter1)}|`],
                result: `${money.exact(Math.abs(owner1 - renter1))} by the ${owner1 >= renter1 ? 'renter' : 'buyer'}`,
              },
              {
                label: 'Monthly investment return',
                general: 'j = (1 + R)^(1/12) − 1',
                steps: [`j = (1 + ${numUpTo(x.investReturnPct / 100, 6)})^(1/12) − 1`],
                result: `${(iInv * 100).toFixed(4)}% a month`,
              },
              {
                label: `Wealth if you buy, year ${years}`,
                general: 'home value × (1 − selling costs) − loan balance + investments',
                steps: [`${money.exact(at.homeValue)} × (1 − ${numUpTo(x.sellingPct / 100, 4)}) − ${money.exact(at.loanBalance)} + ${money.exact(buyerPot)}`],
                result: money.exact(at.buyWealth),
              },
              {
                label: `Wealth if you rent, year ${years}`,
                general: 'cash up front × (1 + j)^months + monthly differences with their growth',
                steps: [
                  `${money.exact(res.upfront)} × (1 + ${iInv.toFixed(6)})^${years * 12} + monthly differences`,
                  `${money.exact(upfrontGrown)} + ${money.exact(at.rentWealth - upfrontGrown)}`,
                ],
                result: money.exact(at.rentWealth),
              },
              {
                label: 'Difference',
                general: 'buy − rent',
                steps: [`${money.exact(at.buyWealth)} − ${money.exact(at.rentWealth)}`],
                result: `${money.exact(diff)} (${winner} ahead)`,
              },
            ]}
            note="The calculator repeats the monthly step for every month: costs, investment growth and home price growth. Property tax and maintenance follow the home value. Rent rises once a year."
          />
          <Assumptions
            title="Limits"
            items={[
              'Both start with the same cash. The buyer pays the down payment and closing costs; the renter invests the same amount. Each month the one who pays less invests the difference at the same return.',
              'Wealth assumes you sell at the end of the year: selling costs are paid and the loan is cleared.',
              'Taxes are not included: no mortgage interest deduction, no tax on investment returns and no tax on the gain from the home.',
              'Home price growth, rent increase and investment return stay the same every year. Home insurance and the HOA fee do not rise.',
            ]}
          />
        </div>
      }
    />
  )
}
