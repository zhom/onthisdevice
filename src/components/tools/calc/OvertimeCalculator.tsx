import { useMemo, useState } from 'react'
import { Donut } from '@/components/viz'
import { overtimePay } from './money-math'
import { Assumptions, CalcGrid, Choice, Field, Formula, Headline, ResultPanel, Stats, num, toPositive, useCurrency } from './mb-ui'

export default function OvertimeCalculator() {
  const { money, select } = useCurrency()
  const [rate, setRate] = useState('25')
  const [regular, setRegular] = useState('40')
  const [ot, setOt] = useState('8')
  const [mult, setMult] = useState<'1.5' | '2'>('1.5')
  const [dt, setDt] = useState('0')
  const [weeks, setWeeks] = useState('52')

  const p = useMemo(() => overtimePay(toPositive(rate), toPositive(regular), toPositive(ot), Number(mult), toPositive(dt)), [rate, regular, ot, mult, dt])
  const r = toPositive(rate)
  const yearly = p.total * toPositive(weeks)

  return (
    <CalcGrid
      inputs={
        <>
          <Field id="ot-rate" label="Hourly rate" value={rate} onChange={setRate} prefix={money.symbol} slider={{ min: 7, max: 150, step: 0.25 }} />
          <Field id="ot-regular" label="Regular hours" value={regular} onChange={setRegular} suffix="hrs" />
          <Field id="ot-hours" label="Overtime hours" value={ot} onChange={setOt} suffix="hrs" slider={{ min: 0, max: 40, step: 0.5 }} />
          <Choice
            label="Overtime rate"
            value={mult}
            onChange={setMult}
            options={[
              { value: '1.5', label: 'Time and a half' },
              { value: '2', label: 'Double time' },
            ]}
          />
          <Field id="ot-dt" label="Double-time hours" value={dt} onChange={setDt} suffix="hrs" hint="for example holidays" />
          <Field id="ot-weeks" label="Weeks like this a year" value={weeks} onChange={setWeeks} />
          {select('ot-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline label="Pay for the week" value={p.total} format={money.exact} hint={`${num(p.hours, 2)} hours, before tax.`} />
          <Stats
            items={[
              { label: 'Overtime pay', value: money.exact(p.overtime + p.doubleTime) },
              { label: 'Overtime rate', value: money.exact(r * Number(mult)), hint: 'per hour' },
              { label: 'Average per hour', value: money.exact(p.effectiveRate) },
              { label: 'Per year', value: money.round(yearly), hint: `${num(toPositive(weeks), 0)} weeks` },
            ]}
          />
          <Donut
            parts={[
              { label: 'Regular pay', value: p.regular, paint: 'grey' },
              { label: 'Overtime', value: p.overtime, paint: 'ink' },
              { label: 'Double time', value: p.doubleTime, paint: 'hatch' },
            ]}
            formatValue={money.exact}
            center={
              <>
                <span className="text-lg font-[720]">{num(p.total > 0 ? ((p.overtime + p.doubleTime) / p.total) * 100 : 0, 0)}%</span>
                <span className="text-xs text-muted-foreground">from overtime</span>
              </>
            }
            summary={`${num(toPositive(ot) + toPositive(dt), 2)} extra hours add ${money.exact(p.overtime + p.doubleTime)}, ${num(p.total > 0 ? ((p.overtime + p.doubleTime) / p.total) * 100 : 0, 1)}% of the week's pay.`}
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <Formula
            items={[
              { label: 'Regular pay', general: 'rate × regular hours', steps: [`${money.exact(r)} × ${num(toPositive(regular), 2)}`], result: money.exact(p.regular) },
              { label: 'Overtime pay', general: 'rate × multiplier × overtime hours', steps: [`${money.exact(r)} × ${mult} × ${num(toPositive(ot), 2)}`], result: money.exact(p.overtime) },
              { label: 'Double time', general: 'rate × 2 × double-time hours', steps: [`${money.exact(r)} × 2 × ${num(toPositive(dt), 2)}`], result: money.exact(p.doubleTime) },
              { label: 'Total', general: 'regular + overtime + double time', steps: [`${money.exact(p.regular)} + ${money.exact(p.overtime)} + ${money.exact(p.doubleTime)}`], result: money.exact(p.total) },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'US federal law (the Fair Labor Standards Act) requires 1.5 times the regular rate for hours over 40 in a workweek for non-exempt employees. Some states also count hours over 8 in a day.',
              'Bonuses and shift premiums can raise the regular rate used for overtime; this tool uses the hourly rate you enter.',
              'Pay before tax and deductions.',
            ]}
          />
        </div>
      }
    />
  )
}
