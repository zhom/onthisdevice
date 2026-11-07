/**
 * Island for watts-to-amps and the other power, current and voltage pages. The typed value,
 * the known third value, the circuit type and the power factor give the result.
 */
import { useId, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { Formula } from '@/components/shared/Formula'
import { AnimatedNumber, Gauge } from '@/components/viz'
import { D, formatValue, parseNumber, type Dec } from '@/lib/convert/units/engine'
import { QTY_LABEL, circuitFactor, formulaText, knownOf, solve, type Circuit, type ElectricPair, type ElectricQty } from '@/lib/convert/units/electrical'

type Props = { pair: Pick<ElectricPair, 'slug' | 'from' | 'to' | 'kilo' | 'dflt'> }

const CIRCUITS: { value: Circuit; label: string }[] = [
  { value: 'dc', label: 'DC' },
  { value: 'ac1', label: 'AC single-phase' },
  { value: 'ac3', label: 'AC three-phase' },
]

const VOLTAGES = ['5', '12', '24', '48', '120', '230', '240', '400', '480']

const LOADS: [string, number][] = [
  ['Phone charger', 20],
  ['Laptop', 65],
  ['TV', 100],
  ['Fridge (running)', 150],
  ['Microwave', 1000],
  ['Hair dryer', 1800],
  ['Kettle (UK)', 3000],
  ['Electric car charger', 7400],
  ['Electric shower', 9500],
]

const BREAKERS = [5, 10, 13, 15, 16, 20, 25, 30, 32, 40, 50, 63]

export default function ElectricalPair({ pair }: Props) {
  const uid = useId()
  const known = knownOf(pair)
  const [value, setValue] = useState(pair.dflt.value)
  const [knownText, setKnownText] = useState(pair.dflt.known)
  const [circuit, setCircuit] = useState<Circuit>('ac1')
  const [pfText, setPfText] = useState('1')

  const powerScale = pair.kilo ? new D(1000) : new D(1)
  const unitOf = (q: ElectricQty) => (q === 'power' && pair.kilo ? 'kW' : QTY_LABEL[q].symbol)
  const nameOf = (q: ElectricQty) => (q === 'power' ? (pair.kilo ? 'Kilowatts' : 'Watts') : q === 'current' ? 'Amps' : 'Volts')

  const state = useMemo(() => {
    const v = parseNumber(value)
    const k = parseNumber(knownText)
    const pf = circuit === 'dc' ? new D(1) : parseNumber(pfText)
    if (!value.trim() || !knownText.trim()) return { ok: false as const, message: null }
    if (!v || v.isNegative()) return { ok: false as const, message: `Enter the ${nameOf(pair.from).toLowerCase()} as a positive number.` }
    if (!k || k.lte(0)) return { ok: false as const, message: `Enter the ${QTY_LABEL[known].name} as a number above zero.` }
    if (!pf || pf.lte(0) || pf.gt(1)) return { ok: false as const, message: 'The power factor is a number above 0 and at most 1.' }
    const toBase = (q: ElectricQty, d: Dec) => (q === 'power' ? d.times(powerScale) : d)
    const values: { power?: Dec; current?: Dec; voltage?: Dec } = { [pair.from]: toBase(pair.from, v), [known]: k }
    const out = solve(values, pair.to, circuit, pf)
    if (!out) return { ok: false as const, message: 'That combination has no answer.' }
    const shown = pair.to === 'power' ? out.div(powerScale) : out
    return { ok: true as const, v, k, pf, out, shown }
  }, [value, knownText, circuit, pfText, pair, known, powerScale])

  const fmt = (d: Dec) => formatValue(d, 'auto', 8)
  const fmt4 = (d: Dec) => formatValue(d, 'auto', 4)
  const heroText = state.ok ? `${fmt(state.shown)} ${unitOf(pair.to)}` : '–'

  const working = useMemo(() => {
    if (!state.ok) return null
    const k = circuitFactor(circuit, state.pf)
    const lines = [formulaText(pair.to, circuit)]
    const vIn = `${fmt(state.v)} ${unitOf(pair.from)}`
    const kIn = `${fmt(state.k)} ${QTY_LABEL[known].symbol}`
    const factor = circuit === 'dc' ? '' : circuit === 'ac1' ? ` × ${fmt(state.pf)}` : ` × ${fmt(state.pf)} × √3`
    if (pair.kilo && pair.from === 'power') lines.push(`P = ${vIn} × 1,000 = ${fmt(state.v.times(1000))} W`)
    if (pair.to === 'power') lines.push(`P = ${kIn} × ${vIn}${factor}`)
    else lines.push(`${QTY_LABEL[pair.to].letter} = ${pair.kilo ? fmt(state.v.times(1000)) + ' W' : vIn} ÷ (${kIn}${factor})`)
    if (circuit === 'ac3') lines.push(`√3 × ${fmt(state.pf)} = ${fmt(k)}`)
    lines.push(`= ${fmt(state.out)} ${QTY_LABEL[pair.to].symbol}`)
    if (pair.kilo && pair.to === 'power') lines.push(`= ${fmt(state.shown)} kW`)
    return lines
  }, [state, circuit, pair, known])

  /* Gauge: where the result sits against common circuits. */
  const gauge = useMemo(() => {
    if (!state.ok) return null
    const n = state.out.toNumber()
    if (pair.to === 'current') {
      return { value: n, max: Math.max(80, Math.ceil(n / 10) * 10), bands: [{ to: 15, label: 'Up to 15 A' }, { to: 32, label: '16 to 32 A' }, { to: 63, label: '33 to 63 A' }, { to: Math.max(80, Math.ceil(n / 10) * 10), label: 'Above 63 A' }], unit: 'A' }
    }
    if (pair.to === 'voltage') {
      const max = Math.max(1500, n * 1.1)
      return { value: n, max, bands: [{ to: 50, label: 'Extra-low voltage' }, { to: 1000, label: 'Low voltage' }, { to: max, label: 'High voltage' }], unit: 'V' }
    }
    const max = Math.max(12000, n * 1.1)
    return { value: n, max, bands: [{ to: 1800, label: 'One US 15 A outlet' }, { to: 3680, label: 'One 16 A circuit at 230 V' }, { to: 7400, label: 'EV charger, 32 A' }, { to: max, label: 'Larger' }], unit: 'W' }
  }, [state, pair.to])

  /* Reference table at the chosen voltage or current. */
  const table = useMemo(() => {
    if (!state.ok) return null
    const pf = state.pf
    if (pair.from === 'power') {
      return LOADS.map(([label, watts]) => {
        const out = solve({ power: new D(watts), [known]: state.k }, pair.to, circuit, pf)
        return { a: `${label}, ${pair.kilo ? fmt(new D(watts).div(1000)) + ' kW' : watts.toLocaleString('en-US') + ' W'}`, b: out ? `${fmt4(out)} ${QTY_LABEL[pair.to].symbol}` : '–' }
      })
    }
    if (pair.from === 'current') {
      return BREAKERS.map((amps) => {
        const out = solve({ current: new D(amps), [known]: state.k }, 'power', circuit, pf)
        return { a: `${amps} A`, b: out ? `${fmt(pair.kilo ? out.div(1000) : out)} ${pair.kilo ? 'kW' : 'W'}` : '–' }
      })
    }
    return ['1.5', '3.3', '5', '9', '12', '24', '48', '120', '230'].map((volts) => {
      const out = solve({ voltage: new D(volts), [known]: state.k }, 'power', circuit, pf)
      return { a: `${volts} V`, b: out ? `${fmt4(out)} W` : '–' }
    })
  }, [state, pair, known, circuit])

  const tableText = table ? table.map((r) => `${r.a}\t${r.b}`).join('\n') : ''

  return (
    <div className="space-y-6">
      <ToolPanel title={`${nameOf(pair.from)} to ${nameOf(pair.to).toLowerCase()}`} description={`Enter the ${nameOf(pair.from).toLowerCase()} and the ${QTY_LABEL[known].name}. Pick the kind of circuit.`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-v`}>
              {nameOf(pair.from)} ({unitOf(pair.from)})
            </Label>
            <Input id={`${uid}-v`} inputMode="decimal" autoComplete="off" className="num text-lg" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-k`}>
              {nameOf(known)} ({QTY_LABEL[known].symbol})
            </Label>
            <Input
              id={`${uid}-k`}
              inputMode="decimal"
              autoComplete="off"
              className="num text-lg"
              list={known === 'voltage' ? `${uid}-volts` : undefined}
              value={knownText}
              onChange={(e) => setKnownText(e.target.value)}
            />
            {known === 'voltage' ? (
              <datalist id={`${uid}-volts`}>
                {VOLTAGES.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            ) : null}
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-[560]">Circuit</legend>
          <RadioGroup value={circuit} onValueChange={(v) => setCircuit(v as Circuit)} className="flex flex-wrap gap-x-5 gap-y-2">
            {CIRCUITS.map((c) => (
              <div key={c.value} className="flex items-center gap-2">
                <RadioGroupItem id={`${uid}-${c.value}`} value={c.value} />
                <Label htmlFor={`${uid}-${c.value}`}>{c.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>
        {circuit !== 'dc' ? (
          <div className="max-w-[220px] space-y-1.5">
            <Label htmlFor={`${uid}-pf`}>Power factor (0 to 1)</Label>
            <Input id={`${uid}-pf`} inputMode="decimal" autoComplete="off" className="num" value={pfText} onChange={(e) => setPfText(e.target.value)} />
          </div>
        ) : null}
        {circuit === 'ac3' ? <p className="text-sm text-muted-foreground">Three-phase uses the line-to-line voltage, such as 400 V or 480 V.</p> : null}
      </ToolPanel>

      {state.message ? <ErrorNote message={state.message} /> : null}

      <div role="status" aria-live="polite">
        <ResultStat
          label={`${nameOf(pair.to)}`}
          value={state.ok ? <AnimatedNumber value={state.shown.toNumber()} format={() => heroText} /> : '–'}
          hint={state.ok ? `${fmt(state.v)} ${unitOf(pair.from)} at ${fmt(state.k)} ${QTY_LABEL[known].symbol}, ${CIRCUITS.find((c) => c.value === circuit)?.label}${circuit === 'dc' ? '' : `, power factor ${fmt(state.pf)}`}.` : 'Enter both values to see the result.'}
          emphasis
        />
        {state.ok ? (
          <div className="mt-3">
            <CopyButton value={`${fmt(state.v)} ${unitOf(pair.from)} at ${fmt(state.k)} ${QTY_LABEL[known].symbol} = ${heroText}`} label="Copy result" />
          </div>
        ) : null}
      </div>

      {gauge ? (
        <ToolPanel title="Where the result sits">
          <Gauge
            variant="bar"
            value={gauge.value}
            min={0}
            max={gauge.max}
            bands={gauge.bands}
            formatValue={(v) => `${Math.round(v).toLocaleString('en-US')}`}
            summary={`${heroText} compared with common circuits and voltage bands.`}
          />
        </ToolPanel>
      ) : null}

      {working ? (
        <ToolPanel title="The working">
          <Formula>{working.join('\n')}</Formula>
        </ToolPanel>
      ) : null}

      {table ? (
        <ToolPanel
          title={pair.from === 'power' ? `Common loads at ${fmt(state.ok ? state.k : new D(0))} ${QTY_LABEL[known].symbol}` : pair.from === 'current' ? `Circuit sizes at ${fmt(state.ok ? state.k : new D(0))} V` : `Common voltages at ${fmt(state.ok ? state.k : new D(0))} A`}
          footer={<CopyButton value={tableText} label="Copy table" />}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{pair.from === 'power' ? 'Load' : nameOf(pair.from)}</TableHead>
                  <TableHead>{pair.from === 'power' ? nameOf(pair.to) : nameOf('power')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.map((r) => (
                  <TableRow key={r.a}>
                    <TableCell>{r.a}</TableCell>
                    <TableCell className="num">{r.b}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      ) : null}
    </div>
  )
}
