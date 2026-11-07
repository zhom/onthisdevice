/** Circuits, wiring and batteries. */
import { choice, num, percent, pos, select } from '../engine/fields'
import { dec, fmt, int, pct } from '../engine/format'
import { fmtTick } from '../engine/plots'
import { readList } from '../engine/stats'
import { fail } from '../engine/types'
import type { Chart, Spec } from '../engine/types'

/** "4.7 kΩ", "220 nF". */
export function eng(v: number, unit: string, sig = 4): string {
  if (!Number.isFinite(v)) return '–'
  if (v === 0) return `0 ${unit}`
  const P: [number, string][] = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']]
  const a = Math.abs(v)
  const p = P.find(([f]) => a >= f) ?? P[P.length - 1]!
  return `${fmt(v / p[0], sig)} ${p[1]}${unit}`
}

/** E12 and E24 preferred values (IEC 60063), one decade. */
export const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]
export const E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1]
/** Smallest preferred value at or above v. */
export function standardAbove(v: number, series = E24): number {
  const dec10 = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [...series, 10]) if (m * dec10 >= v * (1 - 1e-9)) return Number((m * dec10).toPrecision(3))
  return 10 * dec10
}

/* ── divider and LED ───────────────────────────────────────────── */

const RU = select('ru', 'Resistor unit', '1000', [['1', 'Ω'], ['1000', 'kΩ'], ['1000000', 'MΩ']], { half: true })

const dividerSpec: Spec = {
  inputs: [pos('vin', 'Input voltage', '12', 'V', { half: true }), RU, pos('r1', 'R1 (top)', '10', undefined, { half: true, unit: (s) => ({ '1': 'Ω', '1000': 'kΩ', '1000000': 'MΩ' })[s.ru ?? '1000'] ?? 'kΩ' }), pos('r2', 'R2 (bottom)', '4.7', undefined, { half: true, unit: (s) => ({ '1': 'Ω', '1000': 'kΩ', '1000000': 'MΩ' })[s.ru ?? '1000'] ?? 'kΩ' }), num('rl', 'Load on the output', '', undefined, { optional: true, above: 0, unit: (s) => ({ '1': 'Ω', '1000': 'kΩ', '1000000': 'MΩ' })[s.ru ?? '1000'] ?? 'kΩ', hint: 'Leave empty for no load.' })],
  compute: ({ n, s }) => {
    const k = Number(s.ru)
    const r1 = n.r1 * k
    const r2raw = n.r2 * k
    const r2 = Number.isFinite(n.rl) ? (r2raw * n.rl * k) / (r2raw + n.rl * k) : r2raw
    const vout = (n.vin * r2) / (r1 + r2)
    const i = n.vin / (r1 + r2)
    return {
      main: { label: 'Output voltage', value: `${fmt(vout, 6)} V` },
      stats: [
        { label: 'Ratio', value: fmt(r2 / (r1 + r2), 6) },
        { label: 'Current', value: eng(i, 'A') },
        { label: 'Power in R1', value: eng(i * i * r1, 'W') },
        { label: 'Power in R2', value: eng(i * i * r2, 'W') },
      ],
      working: [...(Number.isFinite(n.rl) ? [`R2 with the load = R2 × RL ÷ (R2 + RL) = ${eng(r2, 'Ω')}`] : []), `Vout = Vin × R2 ÷ (R1 + R2) = ${n.vin} × ${eng(r2, 'Ω')} ÷ (${eng(r1, 'Ω')} + ${eng(r2, 'Ω')}) = ${fmt(vout, 6)} V`, `I = Vin ÷ (R1 + R2) = ${eng(i, 'A')}`],
      note: 'A load in parallel with R2 lowers the output. Keep the divider current at least ten times the load current, or buffer the output.',
      chart: { kind: 'split', parts: [{ label: 'Across R1', value: n.vin - vout, paint: 'grey' }, { label: 'Across R2 (output)', value: vout, paint: 'ink' }], formatValue: (v) => `${fmt(v, 4)} V`, summary: `${n.vin} V splits into ${fmt(n.vin - vout, 4)} V across R1 and ${fmt(vout, 4)} V across R2.`, table: true },
    }
  },
}

const LED_V = [['2.0', 'Red, about 2.0 V'], ['2.1', 'Yellow, about 2.1 V'], ['2.2', 'Green (classic), about 2.2 V'], ['3.0', 'Green (bright), about 3.0 V'], ['3.2', 'Blue or white, about 3.2 V'], ['1.5', 'Infrared, about 1.5 V'], ['custom', 'Enter the forward voltage']] as const

const ledSpec: Spec = {
  inputs: [pos('vs', 'Supply voltage', '5', 'V', { half: true }), pos('i', 'LED current', '20', 'mA', { half: true }), select('c', 'LED', '2.0', LED_V), pos('vf', 'Forward voltage', '2', 'V', { when: (s) => s.c === 'custom', half: true }), num('n', 'LEDs in series', '1', undefined, { int: true, min: 1, max: 50, half: true })],
  compute: ({ n, s }) => {
    const vf = s.c === 'custom' ? n.vf : Number(s.c)
    const drop = n.vs - n.n * vf
    if (drop <= 0) fail(`${n.n} LED${n.n > 1 ? 's' : ''} need${n.n > 1 ? '' : 's'} ${fmt(n.n * vf, 4)} V, more than the ${n.vs} V supply.`)
    const r = drop / (n.i / 1000)
    const std = standardAbove(r, E24)
    const iStd = (drop / std) * 1000
    const p = drop * (iStd / 1000)
    const rating = p <= 0.125 / 2 ? '1/8 W' : p <= 0.25 / 2 ? '1/4 W' : p <= 0.5 / 2 ? '1/2 W' : p <= 0.5 ? '1 W' : `${int(Math.ceil(p * 2))} W`
    return {
      main: { label: 'Resistor', value: `${eng(std, 'Ω', 3)}`, sub: `nearest standard value above ${eng(r, 'Ω', 4)}` },
      stats: [
        { label: 'Exact value', value: eng(r, 'Ω', 5) },
        { label: 'Current with it', value: `${fmt(iStd, 4)} mA` },
        { label: 'Power in the resistor', value: eng(p, 'W') },
        { label: 'Use a resistor rated', value: rating },
      ],
      working: [`R = (Vs − n × Vf) ÷ I = (${n.vs} − ${n.n} × ${vf}) ÷ ${n.i / 1000} A = ${fmt(r, 6)} Ω`, `next E24 value up: ${eng(std, 'Ω', 3)}, giving I = ${fmt(drop, 4)} ÷ ${std} = ${fmt(iStd, 4)} mA`, `P = (Vs − n × Vf) × I = ${eng(p, 'W')}; pick a rating of at least twice that`],
      note: 'Check the forward voltage and the maximum current on the LED’s datasheet; they vary by part and color.',
      chart: { kind: 'split', parts: [...Array.from({ length: Math.min(n.n, 8) }, (_, k) => ({ label: `LED ${k + 1}`, value: vf, paint: 'ink' as const })), { label: 'Resistor', value: drop, paint: 'hatch' }], formatValue: (v) => `${fmt(v, 3)} V`, summary: `Of the ${n.vs} V supply, the LED${n.n > 1 ? 's take' : ' takes'} ${fmt(n.n * vf, 3)} V and the resistor drops the other ${fmt(drop, 3)} V.`, table: true },
    }
  },
}

/* ── series and parallel ───────────────────────────────────────── */

function combine(values: number[], parallel: boolean) {
  return parallel ? 1 / values.reduce((a, v) => a + 1 / v, 0) : values.reduce((a, v) => a + v, 0)
}

const resSpec: Spec = {
  inputs: [choice('m', 'Connection', 'parallel', [['parallel', 'Parallel'], ['series', 'Series']]), { id: 'r', kind: 'text', label: 'Resistances in ohms', value: '100 220 470', rows: 2, hint: 'Use k or M for kΩ and MΩ: 4.7k, 1M.' }, num('v', 'Voltage across them (optional)', '', 'V', { optional: true })],
  compute: ({ n, s }) => {
    const toks = (s.r ?? '').split(/[\s,;]+/).filter(Boolean)
    const values = toks.map((t) => {
      const m = /^([0-9]*\.?[0-9]+(?:e[+-]?\d+)?)\s*([kKmM]?)Ω?$/.exec(t)
      if (!m) fail(`“${t}” is not a resistance.`)
      const v = Number(m[1]) * (m[2] === 'k' || m[2] === 'K' ? 1e3 : m[2] === 'M' ? 1e6 : m[2] === 'm' ? 1e-3 : 1)
      if (!(v > 0)) fail('Every resistance must be above zero.')
      return v
    })
    if (values.length < 2) fail('Enter at least 2 resistances.')
    const par = s.m === 'parallel'
    const total = combine(values, par)
    const hasV = Number.isFinite(n.v)
    return {
      main: { label: `${par ? 'Parallel' : 'Series'} resistance`, value: eng(total, 'Ω', 6) },
      stats: [
        { label: 'Resistors', value: values.length, format: int },
        { label: hasV ? 'Total current' : 'Current', value: hasV ? eng(n.v / total, 'A') : 'Add a voltage' },
        { label: hasV ? 'Total power' : 'Power', value: hasV ? eng((n.v * n.v) / total, 'W') : 'Add a voltage' },
      ],
      working: par ? [`1/R = ${values.map((v) => `1/${fmt(v, 5)}`).join(' + ')} = ${fmt(1 / total, 6)}`, `R = ${fmt(total, 7)} Ω`] : [`R = ${values.map((v) => fmt(v, 5)).join(' + ')} = ${fmt(total, 7)} Ω`],
      note: par ? 'The parallel total is always below the smallest resistor.' : 'The series total is always above the largest resistor.',
      chart: { kind: 'bars', items: values.map((v, i) => ({ label: `R${i + 1} = ${eng(v, 'Ω', 3)}`, value: par ? total / v : v / total })), formatValue: (v) => pct(v * 100, 1), summary: par ? `Current divides inversely to resistance: the smallest resistor carries the most.` : `Voltage divides in proportion to resistance: the largest resistor drops the most.`, table: true, columns: ['Resistor', par ? 'Share of the current' : 'Share of the voltage'] },
    }
  },
}

const CU = [['1e-12', 'pF'], ['1e-9', 'nF'], ['1e-6', 'µF'], ['1e-3', 'mF']] as const

const capSpec: Spec = {
  inputs: [choice('m', 'Connection', 'series', [['series', 'Series'], ['parallel', 'Parallel']]), select('u', 'Unit', '1e-6', CU, { half: true }), num('v', 'Voltage (optional)', '', 'V', { optional: true, half: true }), { id: 'c', kind: 'text', label: 'Capacitances', value: '10 22 47', rows: 2 }],
  compute: ({ n, s }) => {
    const { values, error } = readList(s.c ?? '', 2)
    if (error) fail(error)
    if (values.some((v) => v <= 0)) fail('Every capacitance must be above zero.')
    const k = Number(s.u)
    const caps = values.map((v) => v * k)
    const series = s.m === 'series'
    const total = series ? 1 / caps.reduce((a, c) => a + 1 / c, 0) : caps.reduce((a, c) => a + c, 0)
    const hasV = Number.isFinite(n.v)
    return {
      main: { label: `${series ? 'Series' : 'Parallel'} capacitance`, value: eng(total, 'F', 6) },
      stats: [
        { label: 'Charge at the voltage', value: hasV ? eng(total * n.v, 'C') : 'Add a voltage' },
        { label: 'Energy stored', value: hasV ? eng(0.5 * total * n.v * n.v, 'J') : 'Add a voltage' },
      ],
      working: series ? [`1/C = ${values.map((v) => `1/${fmt(v, 5)}`).join(' + ')} (${CU.find((u) => u[0] === s.u)?.[1]})`, `C = ${eng(total, 'F', 7)}`] : [`C = ${values.map((v) => fmt(v, 5)).join(' + ')} = ${eng(total, 'F', 7)}`],
      note: series ? 'Capacitors combine the opposite way to resistors: in series the total is below the smallest one.' : 'In parallel the capacitances add, and each gets the full voltage.',
      chart: { kind: 'bars', items: values.map((v, i) => ({ label: `C${i + 1} = ${fmt(v, 4)} ${CU.find((u) => u[0] === s.u)?.[1]}`, value: series ? total / (v * k) : (v * k) / total })), formatValue: (v) => pct(v * 100, 1), summary: series ? 'In series every capacitor holds the same charge, and the smallest one takes the largest share of the voltage.' : 'In parallel each capacitor’s share of the charge matches its share of the capacitance.', table: true, columns: ['Capacitor', series ? 'Share of the voltage' : 'Share of the charge'] },
    }
  },
}

/* ── wire size and voltage drop ────────────────────────────────── */

export const AWG = ['14', '12', '10', '8', '6', '4', '3', '2', '1', '1/0', '2/0', '3/0', '4/0'] as const
const awgNum = (g: string) => (g.includes('/') ? 1 - Number(g.split('/')[0]) : Number(g))
/** Conductor area in mm² from the AWG definition. */
export const awgArea = (g: string) => (Math.PI / 4) * (0.127 * Math.pow(92, (36 - awgNum(g)) / 39)) ** 2
/** DC resistance per meter at 75 °C (NEC Chapter 9, Table 8 basis). */
export const ohmPerM = (g: string, al: boolean) => (al ? 2.826e-8 * (1 + 0.00403 * 55) : 1.7241e-8 * (1 + 0.00393 * 55)) / (awgArea(g) * 1e-6)
/** NEC Table 310.16 ampacity, 75 °C column. Copper from 14 AWG, aluminum from 12 AWG. */
export const AMPACITY: Record<string, [number, number]> = { '14': [20, 0], '12': [25, 20], '10': [35, 30], '8': [50, 40], '6': [65, 50], '4': [85, 65], '3': [100, 75], '2': [115, 90], '1': [130, 100], '1/0': [150, 120], '2/0': [175, 135], '3/0': [200, 155], '4/0': [230, 180] }
export function voltageDrop(g: string, al: boolean, amps: number, meters: number, three: boolean) {
  return (three ? Math.sqrt(3) : 2) * meters * amps * ohmPerM(g, al)
}

const wireInputs = [
  pos('a', 'Current', '30', 'A', { half: true }),
  pos('v', 'Voltage', '240', 'V', { half: true }),
  pos('l', 'One-way length', '100', undefined, { unit: (s: Record<string, string>) => (s.lu === 'm' ? 'm' : 'ft'), half: true }),
  select('lu', 'Length unit', 'ft', [['ft', 'feet'], ['m', 'meters']], { half: true }),
  choice('mat', 'Conductor', 'cu', [['cu', 'Copper'], ['al', 'Aluminum']]),
  choice('ph', 'System', '1', [['1', 'Single-phase or DC'], ['3', 'Three-phase']]),
]

const gaugeSpec: Spec = {
  inputs: [...wireInputs, percent('max', 'Maximum voltage drop', '3', { above: 0, max: 20 })],
  compute: ({ n, s }) => {
    const al = s.mat === 'al'
    const m = s.lu === 'm' ? n.l : n.l * 0.3048
    const three = s.ph === '3'
    const rows = AWG.map((g) => ({ g, drop: voltageDrop(g, al, n.a, m, three), amp: AMPACITY[g]![al ? 1 : 0] })).filter((r) => r.amp > 0)
    const fit = rows.find((r) => r.amp >= n.a && (r.drop / n.v) * 100 <= n.max)
    if (!fit) fail('No size up to 4/0 AWG meets both the ampacity and the drop limit. Use parallel runs or a larger conductor.')
    const byAmp = rows.find((r) => r.amp >= n.a)
    return {
      main: { label: 'Minimum wire size', value: `${fit.g} AWG`, sub: `${fmt(awgArea(fit.g), 4)} mm², ${al ? 'aluminum' : 'copper'}` },
      stats: [
        { label: 'Voltage drop', value: `${fmt(fit.drop, 4)} V (${pct((fit.drop / n.v) * 100, 2)})` },
        { label: 'Ampacity (75 °C)', value: `${fit.amp} A` },
        { label: 'Smallest size by ampacity alone', value: byAmp ? `${byAmp.g} AWG` : 'Over 4/0' },
        { label: 'Voltage at the load', value: `${fmt(n.v - fit.drop, 5)} V` },
      ],
      working: [`resistance at 75 °C: ρ ÷ area, ${al ? 'aluminum' : 'copper'} ${fit.g} AWG = ${fmt(ohmPerM(fit.g, al) * 304.8, 4)} Ω per 1,000 ft`, `drop = ${three ? '√3' : '2'} × length × current × R = ${three ? '1.732' : '2'} × ${fmt(m, 5)} m × ${n.a} A × ${fmt(ohmPerM(fit.g, al), 4)} Ω/m = ${fmt(fit.drop, 4)} V`, `${pct((fit.drop / n.v) * 100, 2)} ≤ ${n.max}% and ${fit.amp} A ≥ ${n.a} A`],
      note: 'A guide only. The NEC also limits the breaker size for 14, 12 and 10 AWG copper (15, 20 and 30 A) and adjusts ampacity for heat and bundling. Follow local code and a licensed electrician.',
      chart: { kind: 'bars', items: rows.slice(0, 10).map((r) => ({ label: `${r.g} AWG`, value: (r.drop / n.v) * 100, note: r.amp < n.a ? `too small for ${n.a} A` : undefined, highlight: r.g === fit.g })), formatValue: (v) => pct(v, 2), summary: `${fit.g} AWG ${al ? 'aluminum' : 'copper'} carries ${n.a} A over ${n.l} ${s.lu} with a ${pct((fit.drop / n.v) * 100, 1)} drop.`, table: true, columns: ['Size', 'Voltage drop'] },
    }
  },
}

const dropSpec: Spec = {
  inputs: [select('g', 'Wire size', '10', AWG.map((g) => [g, `${g} AWG`] as const)), ...wireInputs],
  compute: ({ n, s }) => {
    const al = s.mat === 'al'
    const m = s.lu === 'm' ? n.l : n.l * 0.3048
    const three = s.ph === '3'
    const g = s.g ?? '10'
    if (al && g === '14') fail('14 AWG is not used in aluminum building wire. Pick 12 AWG or larger.')
    const d = voltageDrop(g, al, n.a, m, three)
    const p = (d / n.v) * 100
    const lens = Array.from({ length: 21 }, (_, k) => Number(((n.l * 2 * k) / 20).toPrecision(6)))
    return {
      main: { label: 'Voltage drop', value: `${fmt(d, 5)} V`, sub: `${pct(p, 2)} of ${n.v} V` },
      stats: [
        { label: 'Voltage at the load', value: `${fmt(n.v - d, 5)} V` },
        { label: 'Power lost in the wire', value: `${fmt(d * n.a, 5)} W` },
        { label: 'Wire resistance per 1,000 ft', value: `${fmt(ohmPerM(g, al) * 304.8, 4)} Ω` },
        { label: 'Ampacity (75 °C)', value: `${AMPACITY[g]?.[al ? 1 : 0] ?? '–'} A` },
      ],
      working: [`R = ${fmt(ohmPerM(g, al), 5)} Ω/m for ${g} AWG ${al ? 'aluminum' : 'copper'} at 75 °C`, `drop = ${three ? '√3' : '2'} × ${fmt(m, 5)} m × ${n.a} A × R = ${fmt(d, 5)} V`],
      note: 'The NEC informational notes suggest at most 3% on a branch circuit and 5% for feeder and branch together.',
      chart: { kind: 'line', x: lens, series: [{ id: 'd', label: 'Drop', values: lens.map((L) => (voltageDrop(g, al, n.a, s.lu === 'm' ? L : L * 0.3048, three) / n.v) * 100) }], xLabel: `Length (${s.lu ?? 'ft'})`, formatX: (v) => fmtTick(v), formatValue: (v) => pct(v, 2), guides: [{ y: 3, label: '3%' }, { y: 5, label: '5%' }], markers: [{ x: lens[10]!, label: 'Your run' }], defaultIndex: 10, summary: `Over ${n.l} ${s.lu} of ${g} AWG, ${n.a} A loses ${fmt(d, 3)} V, ${pct(p, 1)}.`, table: true },
    }
  },
}

/* ── AC power ──────────────────────────────────────────────────── */

function powerTriangle(P: number, Q: number, S: number, unit: string, summary: string): Chart {
  const k = 6 / Math.max(P, 1e-12)
  return {
    kind: 'shape',
    paths: [{ pts: [[0, 0], [P * k, 0], [P * k, Q * k]], closed: true, fill: 'hatch', line: 'solid', width: 2 }],
    labels: [{ at: [(P * k) / 2, 0], text: `P ${fmt(P, 4)} k${unit === 'W' ? 'W' : unit}`, dy: 14, strong: true }, { at: [P * k, (Q * k) / 2], text: `Q ${fmt(Q, 4)} kvar`, dx: 8, anchor: 'start' }, { at: [(P * k) / 2, (Q * k) / 2], text: `S ${fmt(S, 4)} kVA`, dx: -10, dy: -10, anchor: 'end' }],
    summary,
    height: 220,
  }
}

const threePhaseSpec: Spec = {
  inputs: [pos('v', 'Line-to-line voltage', '480', 'V', { half: true }), pos('i', 'Line current', '50', 'A', { half: true }), num('pf', 'Power factor', '0.85', undefined, { above: 0, max: 1, half: true }), percent('eff', 'Motor efficiency (optional)', '', { optional: true, above: 0, half: true })],
  compute: ({ n }) => {
    const S = (Math.sqrt(3) * n.v * n.i) / 1000
    const P = S * n.pf
    const Q = Math.sqrt(Math.max(0, S * S - P * P))
    const hasEff = Number.isFinite(n.eff)
    return {
      main: { label: 'Real power', value: `${fmt(P, 6)} kW` },
      stats: [
        { label: 'Apparent power', value: `${fmt(S, 6)} kVA` },
        { label: 'Reactive power', value: `${fmt(Q, 6)} kvar` },
        { label: 'Shaft output', value: hasEff ? `${fmt((P * n.eff) / 100, 5)} kW, ${fmt((P * n.eff) / 100 / 0.7457, 5)} hp` : 'Add the efficiency' },
        { label: 'Phase angle', value: `${fmt((Math.acos(n.pf) * 180) / Math.PI, 4)}°` },
      ],
      working: [`S = √3 × V × I = 1.732 × ${n.v} × ${n.i} = ${fmt(S * 1000, 7)} VA`, `P = S × PF = ${fmt(S, 6)} × ${n.pf} = ${fmt(P, 6)} kW`, `Q = √(S² − P²) = ${fmt(Q, 6)} kvar`],
      note: 'For a balanced three-phase load with line-to-line voltage and line current.',
      chart: powerTriangle(P, Q, S, 'W', `${fmt(S, 4)} kVA of apparent power delivers ${fmt(P, 4)} kW of real power at a power factor of ${n.pf}.`),
    }
  },
}

const kvaSpec: Spec = {
  inputs: [choice('ph', 'System', '1', [['1', 'Single-phase'], ['3', 'Three-phase']]), choice('k', 'Find', 'kva', [['kva', 'kVA from amps'], ['amps', 'Amps from kVA']]), pos('v', 'Voltage', '240', 'V', { half: true }), pos('i', 'Current', '40', 'A', { half: true, when: (s) => s.k !== 'amps' }), pos('kva', 'Apparent power', '15', 'kVA', { half: true, when: (s) => s.k === 'amps' }), num('pf', 'Power factor', '0.9', undefined, { above: 0, max: 1, half: true })],
  compute: ({ n, s }) => {
    const f = s.ph === '3' ? Math.sqrt(3) : 1
    const S = s.k === 'amps' ? n.kva : (f * n.v * n.i) / 1000
    const I = s.k === 'amps' ? (n.kva * 1000) / (f * n.v) : n.i
    const P = S * n.pf
    const Q = Math.sqrt(Math.max(0, S * S - P * P))
    return {
      main: s.k === 'amps' ? { label: 'Current', value: `${fmt(I, 6)} A` } : { label: 'Apparent power', value: `${fmt(S, 6)} kVA` },
      stats: [
        { label: 'Real power', value: `${fmt(P, 6)} kW` },
        { label: 'Reactive power', value: `${fmt(Q, 6)} kvar` },
        { label: s.k === 'amps' ? 'Apparent power' : 'Current', value: s.k === 'amps' ? `${fmt(S, 6)} kVA` : `${fmt(I, 6)} A` },
      ],
      working: [s.ph === '3' ? `kVA = √3 × V × I ÷ 1000` : `kVA = V × I ÷ 1000`, s.k === 'amps' ? `I = ${n.kva} × 1000 ÷ (${s.ph === '3' ? '1.732 × ' : ''}${n.v}) = ${fmt(I, 6)} A` : `kVA = ${s.ph === '3' ? '1.732 × ' : ''}${n.v} × ${n.i} ÷ 1000 = ${fmt(S, 6)}`, `kW = kVA × PF = ${fmt(P, 6)}`],
      note: 'Transformers and generators are rated in kVA because their heating depends on current, whatever the power factor.',
      chart: powerTriangle(P, Q, S, 'W', `${fmt(S, 4)} kVA at a power factor of ${n.pf} is ${fmt(P, 4)} kW of real power.`),
    }
  },
}

/* ── batteries ─────────────────────────────────────────────────── */

const batterySpec: Spec = {
  inputs: [pos('cap', 'Battery capacity', '3000', 'mAh', { half: true }), pos('v', 'Battery voltage', '3.7', 'V', { half: true }), choice('k', 'Load given as', 'ma', [['ma', 'Current'], ['w', 'Power']]), pos('load', (s) => (s.k === 'w' ? 'Load power' : 'Load current'), '150', undefined, { unit: (s) => (s.k === 'w' ? 'W' : 'mA'), half: true }), percent('use', 'Usable capacity', '85', { above: 0, half: true, hint: 'Converter losses, cold and aging.' })],
  compute: ({ n, s }) => {
    const ma = s.k === 'w' ? (n.load / n.v) * 1000 : n.load
    const hours = (n.cap * (n.use / 100)) / ma
    const xs = Array.from({ length: 21 }, (_, k) => Number(((hours * 1.05 * k) / 20).toPrecision(6)))
    const hm = `${Math.floor(hours)} h ${String(Math.round((hours % 1) * 60)).padStart(2, '0')} min`
    return {
      main: { label: 'Battery life', value: hours >= 48 ? `${fmt(hours / 24, 4)} days` : hm, sub: `${fmt(hours, 5)} hours` },
      stats: [
        { label: 'Energy', value: `${fmt((n.cap * n.v) / 1000, 5)} Wh` },
        { label: 'Load current', value: `${fmt(ma, 5)} mA` },
        { label: 'Load power', value: `${fmt((ma * n.v) / 1000, 5)} W` },
      ],
      working: [...(s.k === 'w' ? [`current = ${n.load} W ÷ ${n.v} V = ${fmt(ma, 6)} mA`] : []), `life = capacity × usable ÷ load = ${n.cap} × ${n.use}% ÷ ${fmt(ma, 6)} = ${fmt(hours, 6)} h`],
      note: 'Real life depends on the discharge rate, temperature and cut-off voltage. High currents often deliver less than the rated capacity.',
      chart: { kind: 'line', x: xs, series: [{ id: 'c', label: 'Charge left', values: xs.map((t) => Math.max(0, n.cap * (n.use / 100) - ma * t)) }], xLabel: 'Hours', formatX: (v) => fmtTick(v), formatValue: (v) => `${fmt(v, 4)} mAh`, markers: [{ x: xs[xs.findIndex((t) => t >= hours)] ?? xs[20]!, label: 'Empty' }], summary: `A ${n.cap} mAh battery running ${fmt(ma, 4)} mA lasts about ${hm}.`, table: true },
    }
  },
}

export const whOf = (mah: number, v: number) => (mah * v) / 1000

const mahSpec: Spec = {
  inputs: [choice('d', 'Convert', 'wh', [['wh', 'mAh to Wh'], ['mah', 'Wh to mAh']]), pos('x', (s) => (s.d === 'mah' ? 'Energy' : 'Capacity'), '20000', undefined, { unit: (s) => (s.d === 'mah' ? 'Wh' : 'mAh'), half: true }), pos('v', 'Voltage', '3.7', 'V', { half: true, hint: '3.6 to 3.85 V for lithium-ion cells.' })],
  compute: ({ n, s }) => {
    const wh = s.d === 'mah' ? n.x : whOf(n.x, n.v)
    const mah = s.d === 'mah' ? (n.x * 1000) / n.v : n.x
    const flight = wh <= 100 ? 'Allowed in carry-on' : wh <= 160 ? 'Needs airline approval' : 'Not allowed on passenger planes'
    return {
      main: s.d === 'mah' ? { label: 'Capacity', value: `${fmt(mah, 6)} mAh` } : { label: 'Energy', value: `${fmt(wh, 6)} Wh` },
      stats: [
        { label: 'In ampere-hours', value: `${fmt(mah / 1000, 5)} Ah` },
        { label: 'In joules', value: `${fmt(wh * 3600, 6)} J` },
        { label: 'On a plane', value: flight },
      ],
      working: s.d === 'mah' ? [`mAh = Wh × 1000 ÷ V = ${n.x} × 1000 ÷ ${n.v} = ${fmt(mah, 7)}`] : [`Wh = mAh × V ÷ 1000 = ${n.x} × ${n.v} ÷ 1000 = ${fmt(wh, 7)}`],
      note: 'Power banks list mAh at the cell voltage, about 3.7 V. At the 5 V USB output the same energy is fewer mAh.',
      chart: { kind: 'gauge', variant: 'bar', value: Math.min(200, wh), min: 0, max: 200, bands: [{ to: 100, label: 'Carry-on' }, { to: 160, label: 'Airline approval' }, { to: 200, label: 'Forbidden' }], center: `${fmt(wh, 4)} Wh`, formatValue: (v) => `${v} Wh`, summary: `${fmt(mah, 5)} mAh at ${n.v} V is ${fmt(wh, 4)} Wh. ${flight}, under FAA and IATA rules for spare lithium batteries.` },
    }
  },
}

const rcSpec: Spec = {
  inputs: [pos('r', 'Resistance', '10', 'kΩ', { half: true }), pos('c', 'Capacitance', '100', 'µF', { half: true }), pos('v', 'Supply voltage', '5', 'V')],
  compute: ({ n }) => {
    const tau = n.r * 1e3 * n.c * 1e-6
    const fc = 1 / (2 * Math.PI * tau)
    const xs = Array.from({ length: 51 }, (_, k) => Number(((tau * 5 * k) / 50).toPrecision(6)))
    return {
      main: { label: 'Time constant τ', value: eng(tau, 's', 6) },
      stats: [
        { label: 'Cutoff frequency', value: eng(fc, 'Hz', 5) },
        { label: 'To 63.2% (1τ)', value: `${fmt(n.v * (1 - Math.exp(-1)), 4)} V` },
        { label: 'Fully charged (5τ, 99.3%)', value: eng(5 * tau, 's') },
      ],
      working: [`τ = R × C = ${n.r} kΩ × ${n.c} µF = ${fmt(tau, 6)} s`, `charging: V(t) = V × (1 − e^(−t/τ))`, `fc = 1 ÷ (2πRC) = ${fmt(fc, 6)} Hz`],
      chart: { kind: 'line', x: xs, series: [{ id: 'c', label: 'Charging', values: xs.map((t) => n.v * (1 - Math.exp(-t / tau))) }, { id: 'd', label: 'Discharging', values: xs.map((t) => n.v * Math.exp(-t / tau)), stroke: 'dash' }], xLabel: 'Time (s)', formatX: (v) => fmtTick(v), formatValue: (v) => `${fmt(v, 4)} V`, markers: [1, 2, 3, 4, 5].map((k) => ({ x: xs[k * 10]!, label: `${k}τ` })), summary: `With τ = ${eng(tau, 's')}, the capacitor reaches 63% of ${n.v} V after one time constant and over 99% after five.`, table: true },
    }
  },
}

export const specs: Record<string, Spec> = {
  'voltage-divider-calculator': dividerSpec,
  'led-resistor-calculator': ledSpec,
  'resistors-in-parallel-calculator': resSpec,
  'capacitors-in-series-calculator': capSpec,
  'wire-gauge-calculator': gaugeSpec,
  'voltage-drop-calculator': dropSpec,
  'three-phase-power-calculator': threePhaseSpec,
  'kva-calculator': kvaSpec,
  'battery-life-calculator': batterySpec,
  'mah-to-wh-calculator': mahSpec,
  'rc-time-constant-calculator': rcSpec,
}
