import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BarList, LineChart, compact } from '@/components/viz'
import { tieredCommission } from './money-math'
import type { Tier } from './money-math'
import { Assumptions, CalcGrid, Choice, Field, Formula, Headline, ResultPanel, Stats, num, toPositive, useCurrency } from './mb-ui'

interface TierText {
  upTo: string
  rate: string
}

export default function CommissionCalculator() {
  const { money, select } = useCurrency()
  const [mode, setMode] = useState<'flat' | 'tiered'>('tiered')
  const [sales, setSales] = useState('120000')
  const [flat, setFlat] = useState('5')
  const [base, setBase] = useState('3000')
  const [tiers, setTiers] = useState<TierText[]>([
    { upTo: '50000', rate: '5' },
    { upTo: '100000', rate: '7' },
    { upTo: '', rate: '10' },
  ])

  const plan: Tier[] = useMemo(() => {
    if (mode === 'flat') return [{ upTo: Infinity, ratePct: toPositive(flat) }]
    const out: Tier[] = []
    let prev = 0
    tiers.forEach((t, k) => {
      const last = k === tiers.length - 1
      const up = last ? Infinity : Math.max(prev, toPositive(t.upTo))
      out.push({ upTo: up, ratePct: toPositive(t.rate) })
      prev = up
    })
    return out
  }, [mode, flat, tiers])

  const S = toPositive(sales)
  const res = useMemo(() => tieredCommission(S, plan), [S, plan])
  const B = toPositive(base)
  const eff = S > 0 ? (res.total / S) * 100 : 0
  const top = Math.max(S * 2, 1000)
  const xs = Array.from({ length: 81 }, (_, k) => (top * k) / 80)
  const curve = xs.map((v) => tieredCommission(v, plan).total)
  const edge = (t: Tier, k: number) => (k === 0 ? 0 : plan[k - 1]!.upTo)
  const tierLabel = (t: Tier, k: number) => (t.upTo === Infinity ? `Over ${money.round(edge(t, k))} at ${num(t.ratePct, 2)}%` : `${money.round(edge(t, k))} to ${money.round(t.upTo)} at ${num(t.ratePct, 2)}%`)

  const setTier = (k: number, patch: Partial<TierText>) => setTiers((ts) => ts.map((t, j) => (j === k ? { ...t, ...patch } : t)))

  return (
    <CalcGrid
      inputs={
        <>
          <Field id="cm-sales" label="Sales" value={sales} onChange={setSales} prefix={money.symbol} slider={{ min: 0, max: 500000, step: 1000 }} />
          <Choice
            label="Commission plan"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'flat', label: 'One rate' },
              { value: 'tiered', label: 'Tiers' },
            ]}
          />
          {mode === 'flat' ? (
            <Field id="cm-flat" label="Commission rate" value={flat} onChange={setFlat} suffix="%" />
          ) : (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Tiers (each rate applies to the sales inside its tier)</legend>
              {tiers.map((t, k) => {
                const last = k === tiers.length - 1
                return (
                  <div key={k} className="grid grid-cols-[1fr_6.5rem_2.25rem] items-end gap-2">
                    {last ? (
                      <p className="pb-2.5 text-sm text-muted-foreground">Above {money.round(plan[k - 1]?.upTo ?? 0)}</p>
                    ) : (
                      <Field id={`cm-up-${k}`} label={`Tier ${k + 1} up to`} value={t.upTo} onChange={(v) => setTier(k, { upTo: v })} prefix={money.symbol} />
                    )}
                    <Field id={`cm-rate-${k}`} label="Rate" value={t.rate} onChange={(v) => setTier(k, { rate: v })} suffix="%" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove tier ${k + 1}`}
                      disabled={tiers.length <= 1}
                      onClick={() => setTiers((ts) => ts.filter((_, j) => j !== k))}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                )
              })}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setTiers((ts) => {
                    const lastEdge = plan.length > 1 ? plan[plan.length - 2]!.upTo : 0
                    const next = [...ts]
                    next.splice(ts.length - 1, 0, { upTo: String(Math.round(lastEdge + 50000)), rate: ts[ts.length - 1]?.rate ?? '5' })
                    return next
                  })
                }
              >
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                Add a tier
              </Button>
            </fieldset>
          )}
          <Field id="cm-base" label="Base pay for the period" value={base} onChange={setBase} prefix={money.symbol} hint="optional" />
          {select('cm-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline label="Commission" value={res.total} format={money.exact} hint={`${num(eff, 2)}% of ${money.round(S)} in sales.`} />
          <Stats
            items={[
              { label: 'Total pay', value: money.exact(res.total + B), hint: 'base + commission' },
              { label: 'Effective rate', value: `${num(eff, 2)}%` },
              { label: 'Next sale earns', value: `${num(plan.find((t) => S < t.upTo)?.ratePct ?? 0, 2)}%`, hint: 'marginal rate' },
            ]}
          />
          <LineChart
            x={xs}
            series={[{ id: 'c', label: 'Commission', values: curve, stroke: 'solid' }]}
            xLabel="Sales"
            formatX={(v) => compact(v)}
            formatValue={money.round}
            markers={[{ x: S, label: 'Your sales' }]}
            defaultIndex={40}
            summary={mode === 'tiered' ? `Commission rises faster after each tier edge, because each tier pays its own rate. At ${money.round(S)} you earn ${money.round(res.total)}.` : `Commission is a straight line at ${num(toPositive(flat), 2)}% of sales.`}
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          {mode === 'tiered' ? (
            <ResultPanel title="Commission from each tier">
              <BarList
                items={res.parts.map((p, k) => ({ label: tierLabel(plan[k]!, k), value: p.commission, note: `on ${money.round(p.amount)}` }))}
                formatValue={money.exact}
                summary="Each tier pays its rate only on the sales inside it."
                table
                columns={['Tier', 'Commission']}
              />
            </ResultPanel>
          ) : null}
          <Formula
            items={[
              {
                label: 'Commission',
                general: mode === 'flat' ? 'C = sales × rate' : 'C = Σ (sales inside tier × tier rate)',
                steps: res.parts.map((p, k) => `${money.exact(p.amount)} × ${num(plan[k]!.ratePct, 2)}% = ${money.exact(p.commission)}`),
                result: money.exact(res.total),
              },
              { label: 'Total pay', general: 'pay = base + C', steps: [`${money.exact(B)} + ${money.exact(res.total)}`], result: money.exact(B + res.total) },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'Tiers are marginal: a higher rate applies only to sales above the tier edge. Some plans pay the top rate on all sales once you reach a tier; check your plan.',
              'Draws, clawbacks, caps and tax are not included.',
            ]}
          />
        </div>
      }
    />
  )
}
