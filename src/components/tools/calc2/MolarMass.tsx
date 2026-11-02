import { useState } from 'react'
import { Donut } from '@/components/viz'
import type { Paint } from '@/components/viz/paint'
import { Button } from '@/components/ui/button'
import { CalcLayout, NumField, Result, Stage, Stat, Working } from './_viz/Calc'
import { dec, fmt, num } from './_viz/format'
import { parseFormula } from './chem'
import type { Part } from './chem'

const EXAMPLES = ['H2O', 'NaCl', 'C6H12O6', 'Ca(OH)2', 'CuSO4·5H2O', 'K4[Fe(CN)6]']
const PAINTS: Paint[] = ['ink', 'hatch', 'grey', 'dots', 'paper']
const MAX_ATOMS = 40

export default function MolarMass() {
  const [formula, setFormula] = useState('C6H12O6')
  const p = parseFormula(formula)
  const parts: Part[] = p.ok ? p.parts : []
  const total = p.ok ? p.total : 0
  const approx = parts.some((x) => x.isotope)
  const error = p.ok ? null : `${p.error}${p.pos >= 0 ? ` (at character ${p.pos + 1})` : ''}`

  const summary = p.ok
    ? `${formula.trim()} has ${p.atoms} atoms per formula unit and a molar mass of ${fmt(total, 6)} g/mol. By mass it is ${parts.map((x) => `${dec(x.percent, 2)}% ${x.name.toLowerCase()}`).join(', ')}. Each circle is one atom, drawn larger for heavier elements.`
    : 'Enter a formula such as H2O or Ca(OH)2.'

  return (
    <CalcLayout
      inputs={
        <>
          <NumField label="Chemical formula" value={formula} onChange={setFormula} inputMode="text" error={error} hint="Brackets and hydrates work: Ca(OH)2, CuSO4·5H2O." />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((x) => (
              <Button key={x} variant="ghost" size="sm" onClick={() => setFormula(x)}>
                {x}
              </Button>
            ))}
          </div>
        </>
      }
      result={
        <Result
          label="Molar mass"
          value={p.ok ? total : '–'}
          format={(n) => fmt(n, 7)}
          unit="g/mol"
          sub={p.ok ? `${p.atoms} atoms${approx ? '; includes an element with no standard atomic weight (mass number used)' : ''}` : undefined}
          error={error}
          copy={p.ok ? `${formula.trim()}: ${fmt(total, 7)} g/mol` : undefined}
        >
          {parts.map((x) => (
            <Stat key={x.symbol} label={`${x.name} (${x.symbol}) × ${x.count}`} value={`${fmt(x.mass, 6)} g/mol, ${dec(x.percent, 2)}%`} />
          ))}
        </Result>
      }
      visual={
        <div className="space-y-6">
          <Stage summary={summary}>{p.ok ? <Atoms key={formula} parts={parts} /> : <div className="h-40" />}</Stage>
          {p.ok ? (
            <div className="rounded-xl bg-card p-4 sm:p-5">
              <Donut
                parts={parts.map((x, i) => ({ label: `${x.symbol}`, value: x.mass, paint: PAINTS[i % PAINTS.length] }))}
                center={<span className="text-[0.9375rem] font-[650] tabular-nums">{fmt(total, 5)}</span>}
                formatValue={(v) => `${fmt(v, 5)} g/mol, ${dec((v / total) * 100, 1)}%`}
                summary="Mass share of each element."
                size={168}
              />
            </div>
          ) : null}
        </div>
      }
      working={
        p.ok ? (
          <Working
            lines={[
              ...parts.map((x) => `${x.symbol.padEnd(2)}  ${String(x.count).padStart(3)} × ${num(x.weight)}${x.isotope ? '*' : ''} = ${num(x.mass, 8)} g/mol`),
              `total = ${parts.map((x) => num(x.mass, 8)).join(' + ')} = ${num(total, 8)} g/mol`,
            ]}
            caption={`Atomic weights: IUPAC abridged standard atomic weights.${approx ? ' * mass number of the longest-lived isotope.' : ''}`}
          />
        ) : null
      }
    />
  )
}

/** One circle per atom, grouped by element; the rows drop in one after another. */
function Atoms({ parts }: { parts: Part[] }) {
  let i = 0
  return (
    <div className="space-y-3 px-4 py-5 sm:px-5" aria-hidden="true">
      {parts.map((x) => {
        const r = 5 + Math.cbrt(x.weight) * 1.6
        const shown = Math.min(x.count, MAX_ATOMS)
        return (
          <div key={x.symbol} className="flex items-center gap-3">
            <span className="w-9 shrink-0 text-[0.9375rem] font-[650] tabular-nums">{x.symbol}</span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {Array.from({ length: shown }, (_, k) => (
                <span
                  key={k}
                  className="enter inline-block rounded-full bg-foreground"
                  style={{ width: r * 2, height: r * 2, ['--i' as string]: Math.min(i++, 30) }}
                />
              ))}
              {x.count > shown ? <span className="pl-1 text-[0.8125rem] text-muted-foreground">+{x.count - shown}</span> : null}
            </div>
            <span className="shrink-0 text-[0.8125rem] text-muted-foreground tabular-nums">× {x.count}</span>
          </div>
        )
      })}
    </div>
  )
}
