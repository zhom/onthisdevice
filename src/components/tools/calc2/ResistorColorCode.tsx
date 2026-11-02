import { useId, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalcLayout, Choice, Result, Row, Stage, Stat, UnitField, Working, useFields } from './_viz/Calc'
import { fmt, num, sup } from './_viz/format'
import { COLORS, allowed, decode, encode, ohmsText, roles, tolText } from './resistor'
import type { BandColor, BandCount, BandRole } from './resistor'

type Mode = 'read' | 'find'
type OhmU = 'Ω' | 'kΩ' | 'MΩ'
const OHM_UNITS: { value: OhmU; label: string }[] = [
  { value: 'Ω', label: 'Ω' },
  { value: 'kΩ', label: 'kΩ' },
  { value: 'MΩ', label: 'MΩ' },
]
const OHM_F: Record<OhmU, number> = { Ω: 1, kΩ: 1e3, MΩ: 1e6 }

const ROLE_NAME: Record<BandRole, string> = { digit: 'digit', multiplier: 'multiplier', tolerance: 'tolerance', tempco: 'temperature coefficient' }
const ORDINAL = ['1st', '2nd', '3rd']

const DEFAULTS: Record<BandCount, BandColor[]> = {
  4: ['yellow', 'violet', 'red', 'gold'],
  5: ['brown', 'black', 'black', 'brown', 'brown'],
  6: ['red', 'red', 'black', 'brown', 'brown', 'red'],
}

function bandMeaning(c: BandColor, role: BandRole): string {
  const i = COLORS[c]
  if (role === 'digit') return String(i.digit)
  if (role === 'multiplier') return `× ${fmt(10 ** (i.exp ?? 0), 6)}`
  if (role === 'tolerance') return tolText(i.tol ?? 20)
  return `${i.ppm} ppm/K`
}

function bandTitle(role: BandRole, index: number): string {
  return role === 'digit' ? `${ORDINAL[index]} digit` : ROLE_NAME[role][0]!.toUpperCase() + ROLE_NAME[role].slice(1)
}

function Swatch({ c }: { c: BandColor }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-3.5 shrink-0 rounded-[3px] ring-1 ring-input"
      style={{ background: COLORS[c].hex === 'transparent' ? undefined : COLORS[c].hex }}
    />
  )
}

function BandPicker({ label, value, options, onChange }: { label: string; value: BandColor; options: BandColor[]; onChange: (c: BandColor) => void }) {
  const id = useId()
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as BandColor)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((c) => (
            <SelectItem key={c} value={c}>
              <span className="flex items-center gap-2">
                <Swatch c={c} />
                {COLORS[c].name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default function ResistorColorCode() {
  const [count, setCount] = useState<BandCount>(4)
  const [mode, setMode] = useState<Mode>('read')
  const [bands, setBands] = useState<Record<BandCount, BandColor[]>>(DEFAULTS)
  const f = useFields({ value: '4.7' })
  const [unit, setUnit] = useState<OhmU>('kΩ')
  const [tol, setTol] = useState<BandColor>('gold')
  const [ppm, setPpm] = useState<BandColor>('brown')

  const r = roles(count)
  const tolOptions = allowed('tolerance')
  const ppmOptions = allowed('tempco')

  const tolEff: BandColor = count > 4 && tol === 'none' ? 'brown' : tol
  let shown: BandColor[] = bands[count]
  let findError: string | null = null
  let rounded = false
  if (mode === 'find') {
    const v = f.num.value
    if (v === null) findError = 'Enter a resistance.'
    else if (v <= 0) findError = 'The resistance must be above zero.'
    else {
      const enc = encode(v * OHM_F[unit], count, tolEff, ppm)
      if (!enc) findError = count === 4 ? 'Use a value from 0.1 Ω to 99 GΩ.' : 'Use a value from 1 Ω to 999 GΩ.'
      else {
        shown = enc.bands
        rounded = enc.rounded
      }
    }
  }
  const d = findError ? null : decode(shown)

  const setBand = (i: number, c: BandColor) =>
    setBands((b) => {
      const next = [...b[count]]
      next[i] = c
      return { ...b, [count]: next }
    })

  const named = shown.map((c, i) => `${bandTitle(r[i]!, r.slice(0, i).filter((x) => x === 'digit').length)}: ${COLORS[c].name} (${bandMeaning(c, r[i]!)})`)
  const digits = d ? d.digits.join('') : ''
  const working = d
    ? [
        `digits      ${shown.filter((_, i) => r[i] === 'digit').map((c) => COLORS[c].name).join(', ')} = ${digits}`,
        `multiplier  ${COLORS[shown[r.indexOf('multiplier')]!].name} = 10${sup(d.exp)} = ${fmt(10 ** d.exp, 6)}`,
        `R = ${digits} × ${fmt(10 ** d.exp, 6)} = ${num(d.ohms, 8)} Ω = ${ohmsText(d.ohms)}`,
        `tolerance   ${tolText(d.tol)}: ${ohmsText(d.min)} to ${ohmsText(d.max)}`,
        ...(d.ppm !== undefined ? [`tempco      ${d.ppm} ppm/K: ${fmt((d.ohms * d.ppm) / 1e6, 4)} Ω per kelvin`] : []),
      ]
    : []

  return (
    <CalcLayout
      inputs={
        <>
          <Choice
            label="Bands"
            value={String(count) as '4' | '5' | '6'}
            onChange={(v) => setCount(Number(v) as BandCount)}
            options={[
              { value: '4', label: '4 bands' },
              { value: '5', label: '5 bands' },
              { value: '6', label: '6 bands' },
            ]}
          />
          <Choice
            label="Direction"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'read', label: 'Colours to value' },
              { value: 'find', label: 'Value to colours' },
            ]}
          />
          {mode === 'read' ? (
            <div className="grid grid-cols-2 gap-3">
              {r.map((role, i) => (
                <BandPicker
                  key={`${count}-${i}`}
                  label={`Band ${i + 1}, ${role === 'digit' ? `${ORDINAL[i]} digit` : ROLE_NAME[role]}`}
                  value={shown[i]!}
                  options={allowed(role, i === 0)}
                  onChange={(c) => setBand(i, c)}
                />
              ))}
            </div>
          ) : (
            <>
              <UnitField label="Resistance" {...f.bind('value')} unit={unit} units={OHM_UNITS} onUnit={setUnit} error={findError === 'Enter a resistance.' || findError === 'The resistance must be above zero.' ? findError : null} />
              <Row>
                <BandPicker label="Tolerance" value={tolEff} options={count === 4 ? tolOptions : tolOptions.filter((c) => c !== 'none')} onChange={setTol} />
                {count === 6 ? <BandPicker label="Temperature coefficient" value={ppm} options={ppmOptions} onChange={setPpm} /> : null}
              </Row>
            </>
          )}
        </>
      }
      result={
        <Result
          label="Resistance"
          value={d ? ohmsText(d.ohms) : '–'}
          sub={d ? `${tolText(d.tol)}${rounded ? `. Rounded to ${count === 4 ? 2 : 3} significant digits` : ''}` : undefined}
          error={findError && findError !== 'Enter a resistance.' && findError !== 'The resistance must be above zero.' ? findError : null}
          copy={d ? `${ohmsText(d.ohms)} ${tolText(d.tol)}: ${shown.map((c) => COLORS[c].name.toLowerCase()).join(', ')}` : undefined}
        >
          {d ? (
            <>
              <Stat label="Minimum" value={ohmsText(d.min)} />
              <Stat label="Maximum" value={ohmsText(d.max)} />
              {d.ppm !== undefined ? <Stat label="Temperature coefficient" value={`${d.ppm} ppm/K`} /> : null}
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage
          summary={
            d ? (
              <>
                <span>{`A ${count} band resistor of ${ohmsText(d.ohms)} ${tolText(d.tol)}, read from left to right.`}</span>
                <ol className="mt-2 space-y-0.5">
                  {named.map((n, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Swatch c={shown[i]!} />
                      <span>{n}</span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              'Enter a value to see its bands.'
            )
          }
        >
          <ResistorDrawing bands={shown} roles={r} />
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="Value = digits × 10 to the power of the multiplier, IEC 60062 colour code." /> : null}
    />
  )
}

/** The resistor drawn with HTML: a body, two leads and bands that slide in when they change. */
function ResistorDrawing({ bands, roles: r }: { bands: BandColor[]; roles: BandRole[] }) {
  const n = bands.length
  // Value bands from 24 %, a gap, then tolerance (and tempco) near the right end.
  const left = (i: number) => {
    const role = r[i]
    if (role === 'tolerance') return n === 6 ? 66 : 72
    if (role === 'tempco') return 78
    return 22 + i * (n === 4 ? 11 : 9.5)
  }
  return (
    <div className="flex aspect-[2/1] w-full items-center justify-center px-4 sm:aspect-[16/10]" role="img" aria-label={`Resistor with bands ${bands.map((c) => COLORS[c].name).join(', ')}`}>
      <div className="relative h-16 w-full max-w-[26rem] sm:h-20">
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-muted-foreground" />
        <div className="absolute inset-y-0 left-[14%] right-[14%] overflow-hidden rounded-[2rem] bg-background ring-1 ring-input">
          {bands.map((c, i) =>
            c === 'none' ? null : (
              <div
                key={`${i}-${c}`}
                className="absolute inset-y-0 w-[7%] ring-1 ring-input motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-6 motion-safe:duration-300"
                style={{ left: `${((left(i) - 14) / 72) * 100}%`, background: COLORS[c].hex, animationTimingFunction: 'var(--ease-out)' }}
              />
            ),
          )}
        </div>
      </div>
    </div>
  )
}
