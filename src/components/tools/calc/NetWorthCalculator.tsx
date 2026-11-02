import { useMemo, useState } from 'react'
import { Decimal } from '@/components/tools/finance/money'
import { Donut, Split } from '@/components/viz'
import { Assumptions, CalcGrid, Field, Formula, Headline, ResultPanel, Stats, num, toPositive, useCurrency } from './mb-ui'

const ASSETS = [
  { id: 'cash', label: 'Cash and savings', init: '15000' },
  { id: 'invest', label: 'Investments', init: '40000' },
  { id: 'retire', label: 'Retirement accounts', init: '85000' },
  { id: 'home', label: 'Home and property', init: '350000' },
  { id: 'cars', label: 'Vehicles', init: '20000' },
  { id: 'other', label: 'Other assets', init: '5000' },
] as const
const DEBTS = [
  { id: 'mortgage', label: 'Mortgage', init: '260000' },
  { id: 'car', label: 'Car loans', init: '12000' },
  { id: 'student', label: 'Student loans', init: '18000' },
  { id: 'cards', label: 'Credit cards', init: '3000' },
  { id: 'otherDebt', label: 'Other debt', init: '0' },
] as const

type Values = Record<string, string>

export default function NetWorthCalculator() {
  const { money, select } = useCurrency()
  const [vals, setVals] = useState<Values>(() => Object.fromEntries([...ASSETS, ...DEBTS].map((f) => [f.id, f.init])))
  const set = (id: string) => (v: string) => setVals((s) => ({ ...s, [id]: v }))
  const v = (id: string) => toPositive(vals[id] ?? '0')

  const c = useMemo(() => {
    const sum = (ids: readonly { id: string }[]) => ids.reduce((a, f) => a.plus(toPositive(vals[f.id] ?? '0')), new Decimal(0))
    const assets = sum(ASSETS)
    const debts = sum(DEBTS)
    return { assets: assets.toNumber(), debts: debts.toNumber(), net: assets.minus(debts).toNumber() }
  }, [vals])

  const ratio = c.assets > 0 ? (c.debts / c.assets) * 100 : NaN
  const liquid = v('cash') + v('invest') - v('cards')
  const groups = [
    { label: 'Cash and investments', value: v('cash') + v('invest'), paint: 'ink' as const },
    { label: 'Retirement', value: v('retire'), paint: 'hatch' as const },
    { label: 'Home and property', value: v('home'), paint: 'grey' as const },
    { label: 'Vehicles and other', value: v('cars') + v('other'), paint: 'dots' as const },
  ]

  return (
    <CalcGrid
      inputs={
        <>
          <fieldset className="space-y-3">
            <legend className="text-sm font-[650]">What you own</legend>
            {ASSETS.map((f) => (
              <Field key={f.id} id={`nw-${f.id}`} label={f.label} value={vals[f.id] ?? ''} onChange={set(f.id)} prefix={money.symbol} />
            ))}
          </fieldset>
          <fieldset className="space-y-3 pt-2">
            <legend className="text-sm font-[650]">What you owe</legend>
            {DEBTS.map((f) => (
              <Field key={f.id} id={`nw-${f.id}`} label={f.label} value={vals[f.id] ?? ''} onChange={set(f.id)} prefix={money.symbol} />
            ))}
          </fieldset>
          {select('nw-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Net worth"
            value={c.net}
            format={money.round}
            hint={c.net >= 0 ? `You own ${money.round(c.assets)} and owe ${money.round(c.debts)}.` : `You owe ${money.round(-c.net)} more than you own.`}
          />
          <Stats
            items={[
              { label: 'Assets', value: money.round(c.assets) },
              { label: 'Debts', value: money.round(c.debts) },
              { label: 'Debt to assets', value: Number.isFinite(ratio) ? `${num(ratio, 1)}%` : '–' },
              { label: 'Liquid net worth', value: money.round(liquid), hint: 'cash + investments − cards' },
            ]}
          />
          <Split
            parts={[
              { label: 'Yours', value: Math.max(0, c.net), paint: 'ink' },
              { label: 'Owed', value: Math.min(c.debts, c.assets), paint: 'hatch' },
            ]}
            formatValue={money.round}
            summary={c.assets > 0 ? `Of everything you own, ${num(Math.min(100, ratio), 1)}% is matched by debt and ${num(Math.max(0, 100 - ratio), 1)}% is yours.` : 'Enter what you own to see the split.'}
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <ResultPanel title="What your assets are">
            <Donut
              parts={groups}
              formatValue={money.round}
              center={
                <>
                  <span className="text-lg font-[720]">{money.round(c.assets)}</span>
                  <span className="text-xs text-muted-foreground">assets</span>
                </>
              }
              summary={`${num(c.assets > 0 ? (v('home') / c.assets) * 100 : 0, 1)}% of your assets is property and ${num(c.assets > 0 ? ((v('cash') + v('invest')) / c.assets) * 100 : 0, 1)}% is cash and investments you can reach quickly.`}
              table
            />
          </ResultPanel>
          <Formula
            items={[
              { label: 'Assets', general: 'A = sum of what you own', steps: [ASSETS.map((f) => money.round(v(f.id))).join(' + ')], result: money.exact(c.assets) },
              { label: 'Debts', general: 'D = sum of what you owe', steps: [DEBTS.map((f) => money.round(v(f.id))).join(' + ')], result: money.exact(c.debts) },
              { label: 'Net worth', general: 'NW = A − D', steps: [`${money.exact(c.assets)} − ${money.exact(c.debts)}`], result: money.exact(c.net) },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'Use what each asset would sell for today, after selling costs, and the payoff amount of each debt.',
              'Retirement accounts are counted before the tax you may pay when you withdraw.',
              'The figures stay in this browser tab. Write them down to track the change over time.',
            ]}
          />
        </div>
      }
    />
  )
}
