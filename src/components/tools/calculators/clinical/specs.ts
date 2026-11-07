/** Clinical formulas: kidney function, electrolytes, ECG, blood sugar, lipids and dosing. */
import { choice, num, pos, select } from '../engine/fields'
import { dec, int } from '../engine/format'
import { fail } from '../engine/types'
import type { Spec } from '../engine/types'

const LB = 0.45359237
const SEX = choice('sex', 'Sex', 'f', [['f', 'Female'], ['m', 'Male']])
const CREAT_UNITS = choice('cu', 'Creatinine unit', 'mg', [['mg', 'mg/dL'], ['umol', 'µmol/L']])
const creatField = pos('scr', 'Serum creatinine', '1.0', undefined, { unit: (s) => (s.cu === 'umol' ? 'µmol/L' : 'mg/dL'), max: 2000 })
const toMgDl = (v: number, unit: string | undefined) => (unit === 'umol' ? v / 88.4 : v)
const NOTE = 'For education and to check a calculation. Clinical decisions belong to a qualified professional.'

/* ── kidney ────────────────────────────────────────────────────── */

/** CKD-EPI 2021 creatinine equation without race. */
export function egfr(scr: number, age: number, female: boolean) {
  const k = female ? 0.7 : 0.9
  const a = female ? -0.241 : -0.302
  return 142 * Math.pow(Math.min(scr / k, 1), a) * Math.pow(Math.max(scr / k, 1), -1.2) * Math.pow(0.9938, age) * (female ? 1.012 : 1)
}
export const ckdStage = (g: number) => (g >= 90 ? 'G1' : g >= 60 ? 'G2' : g >= 45 ? 'G3a' : g >= 30 ? 'G3b' : g >= 15 ? 'G4' : 'G5')

const egfrSpec: Spec = {
  inputs: [CREAT_UNITS, creatField, pos('age', 'Age', '55', 'years', { half: true, min: 18, max: 120 }), { ...SEX, half: true }],
  compute: ({ n, s }) => {
    const scr = toMgDl(n.scr, s.cu)
    const f = s.sex !== 'm'
    const g = egfr(scr, n.age, f)
    const st = ckdStage(g)
    const k = f ? 0.7 : 0.9
    return {
      main: { label: 'eGFR', value: Math.round(g), format: int, unit: 'mL/min/1.73 m²', sub: `Stage ${st}` },
      stats: [
        { label: 'Creatinine in mg/dL', value: scr, format: (v) => dec(v, 2) },
        { label: 'Creatinine in µmol/L', value: scr * 88.4, format: (v) => dec(v, 0) },
        { label: 'GFR category', value: st },
      ],
      working: [
        `κ = ${k}, α = ${f ? '−0.241' : '−0.302'}${f ? ', female factor 1.012' : ''}`,
        `eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^−1.200 × 0.9938^age${f ? ' × 1.012' : ''}`,
        `= 142 × ${dec(Math.min(scr / k, 1), 4)}^${f ? '−0.241' : '−0.302'} × ${dec(Math.max(scr / k, 1), 4)}^−1.2 × 0.9938^${n.age}${f ? ' × 1.012' : ''} = ${dec(g, 1)}`,
      ],
      note: `CKD-EPI 2021, without a race term. Valid for adults with stable creatinine. ${NOTE}`,
      chart: {
        kind: 'gauge',
        value: Math.min(130, g),
        min: 0,
        max: 130,
        bands: [{ to: 15, label: 'G5' }, { to: 30, label: 'G4' }, { to: 45, label: 'G3b' }, { to: 60, label: 'G3a' }, { to: 90, label: 'G2' }, { to: 130, label: 'G1' }],
        center: `${int(g)}`,
        formatValue: (v) => dec(v, 0),
        summary: `An eGFR of ${int(g)} mL/min/1.73 m² is in category ${st}. Kidney disease is diagnosed below 60 for 3 months, or with other signs of kidney damage.`,
      },
    }
  },
}

/** Cockcroft-Gault creatinine clearance (mL/min). */
export const cockcroftGault = (age: number, kg: number, scr: number, female: boolean) => (((140 - age) * kg) / (72 * scr)) * (female ? 0.85 : 1)
/** Devine ideal body weight (kg) from height in inches. */
export const ibwDevine = (inches: number, female: boolean) => (female ? 45.5 : 50) + 2.3 * (inches - 60)
export const adjustedBw = (ibw: number, actual: number) => ibw + 0.4 * (actual - ibw)

const crclSpec: Spec = {
  inputs: [
    CREAT_UNITS,
    creatField,
    pos('age', 'Age', '65', 'years', { half: true, min: 18, max: 120 }),
    { ...SEX, half: true },
    pos('w', 'Weight', '80', 'kg', { half: true, max: 400 }),
    pos('h', 'Height', '165', 'cm', { half: true, max: 250 }),
    select('use', 'Weight in the formula', 'auto', [['auto', 'Adjusted if over 120% of ideal'], ['actual', 'Actual weight'], ['ideal', 'Ideal weight'], ['adjusted', 'Adjusted weight']]),
  ],
  compute: ({ n, s }) => {
    const scr = toMgDl(n.scr, s.cu)
    const f = s.sex !== 'm'
    const ibw = ibwDevine(n.h / 2.54, f)
    const abw = adjustedBw(ibw, n.w)
    const auto = n.w > 1.2 * ibw ? 'adjusted' : n.w < ibw ? 'actual' : 'ideal'
    const pick = s.use === 'auto' ? auto : (s.use ?? 'actual')
    const kg = pick === 'ideal' ? ibw : pick === 'adjusted' ? abw : n.w
    const c = cockcroftGault(n.age, kg, scr, f)
    const items = [
      { label: 'Actual weight', value: cockcroftGault(n.age, n.w, scr, f), highlight: pick === 'actual' },
      { label: 'Ideal weight', value: cockcroftGault(n.age, ibw, scr, f), highlight: pick === 'ideal' },
      { label: 'Adjusted weight', value: cockcroftGault(n.age, abw, scr, f), highlight: pick === 'adjusted' },
    ]
    return {
      main: { label: 'Creatinine clearance', value: c, format: (v) => dec(v, 0), unit: 'mL/min', sub: `with ${pick} weight, ${dec(kg, 1)} kg` },
      stats: [
        { label: 'Ideal body weight', value: ibw, format: (v) => dec(v, 1), unit: 'kg' },
        { label: 'Adjusted body weight', value: abw, format: (v) => dec(v, 1), unit: 'kg' },
        { label: 'Actual ÷ ideal', value: (n.w / ibw) * 100, format: (v) => `${dec(v, 0)}%` },
      ],
      working: [
        `IBW = ${f ? '45.5' : '50'} + 2.3 × (${dec(n.h / 2.54, 1)} in − 60) = ${dec(ibw, 1)} kg`,
        `adjusted = IBW + 0.4 × (actual − IBW) = ${dec(abw, 1)} kg`,
        `CrCl = (140 − age) × weight ÷ (72 × Scr)${f ? ' × 0.85' : ''} = (140 − ${n.age}) × ${dec(kg, 1)} ÷ (72 × ${dec(scr, 2)})${f ? ' × 0.85' : ''} = ${dec(c, 1)} mL/min`,
      ],
      note: `Drug labels often give doses by Cockcroft-Gault clearance. ${NOTE}`,
      chart: { kind: 'bars', items, formatValue: (v) => `${dec(v, 0)} mL/min`, summary: `Clearance is ${dec(c, 0)} mL/min with ${pick} weight. The weight chosen changes the result by up to ${dec(Math.max(...items.map((i) => i.value)) - Math.min(...items.map((i) => i.value)), 0)} mL/min.`, table: true, columns: ['Weight used', 'CrCl'] },
    }
  },
}

/* ── electrolytes ──────────────────────────────────────────────── */

const agSpec: Spec = {
  inputs: [
    pos('na', 'Sodium', '140', 'mEq/L', { half: true, max: 250 }),
    pos('cl', 'Chloride', '104', 'mEq/L', { half: true, max: 200 }),
    pos('hco3', 'Bicarbonate', '24', 'mEq/L', { half: true, max: 80 }),
    num('k', 'Potassium', '', 'mEq/L', { optional: true, half: true, min: 0, max: 15 }),
    num('alb', 'Albumin', '', 'g/dL', { optional: true, min: 0, max: 10, hint: 'Optional, to correct the gap for low albumin.' }),
  ],
  compute: ({ n }) => {
    const ag = n.na - (n.cl + n.hco3)
    const withK = Number.isFinite(n.k) ? ag + n.k : null
    const corr = Number.isFinite(n.alb) ? ag + 2.5 * (4 - n.alb) : null
    const shown = corr ?? ag
    return {
      main: { label: corr === null ? 'Anion gap' : 'Albumin-corrected anion gap', value: shown, format: (v) => dec(v, 1), unit: 'mEq/L' },
      stats: [
        { label: 'Anion gap', value: ag, format: (v) => dec(v, 1), unit: 'mEq/L' },
        { label: 'With potassium', value: withK === null ? 'Add potassium' : dec(withK, 1) },
        { label: 'Corrected for albumin', value: corr === null ? 'Add albumin' : dec(corr, 1) },
      ],
      working: [
        `AG = Na − (Cl + HCO3) = ${n.na} − (${n.cl} + ${n.hco3}) = ${dec(ag, 1)}`,
        ...(withK !== null ? [`with K: ${dec(ag, 1)} + ${n.k} = ${dec(withK, 1)}`] : []),
        ...(corr !== null ? [`corrected = AG + 2.5 × (4 − albumin) = ${dec(ag, 1)} + 2.5 × (4 − ${n.alb}) = ${dec(corr, 1)}`] : []),
      ],
      note: `Reference ranges depend on the lab’s analyzer; many give about 4 to 12 mEq/L without potassium. ${NOTE}`,
      chart: {
        kind: 'gauge',
        value: Math.max(0, Math.min(30, shown)),
        min: 0,
        max: 30,
        bands: [{ to: 4, label: 'Low' }, { to: 12, label: 'Normal' }, { to: 30, label: 'High' }],
        center: dec(shown, 1),
        formatValue: (v) => dec(v, 0),
        summary: `An anion gap of ${dec(shown, 1)} mEq/L, ${shown > 12 ? 'high: think of a high anion gap metabolic acidosis' : shown < 4 ? 'low' : 'in the usual range'}.`,
      },
    }
  },
}

/** Payne formula: corrected Ca (mg/dL) = Ca + 0.8 × (4 − albumin g/dL). */
export const correctedCa = (ca: number, alb: number, normalAlb = 4) => ca + 0.8 * (normalAlb - alb)

const caSpec: Spec = {
  inputs: [
    choice('u', 'Units', 'us', [['us', 'mg/dL and g/dL'], ['si', 'mmol/L and g/L']]),
    pos('ca', 'Total calcium', '8.2', undefined, { unit: (s) => (s.u === 'si' ? 'mmol/L' : 'mg/dL'), half: true, max: 30 }),
    pos('alb', 'Albumin', '2.8', undefined, { unit: (s) => (s.u === 'si' ? 'g/L' : 'g/dL'), half: true, max: 100 }),
  ],
  compute: ({ n, s }) => {
    const si = s.u === 'si'
    const ca = si ? n.ca * 4.008 : n.ca
    const alb = si ? n.alb / 10 : n.alb
    const c = correctedCa(ca, alb)
    const show = si ? c / 4.008 : c
    const unit = si ? 'mmol/L' : 'mg/dL'
    const state = c < 8.5 ? 'Low' : c > 10.5 ? 'High' : 'Normal'
    return {
      main: { label: 'Corrected calcium', value: show, format: (v) => dec(v, 2), unit, sub: state },
      stats: [
        { label: 'Measured', value: n.ca, format: (v) => dec(v, 2), unit },
        { label: 'Correction', value: si ? (c - ca) / 4.008 : c - ca, format: (v) => dec(v, 2), unit },
        { label: 'In the other unit', value: si ? c : c / 4.008, format: (v) => dec(v, 2), unit: si ? 'mg/dL' : 'mmol/L' },
      ],
      working: si
        ? [`corrected = Ca + 0.02 × (40 − albumin g/L) = ${n.ca} + 0.02 × (40 − ${n.alb}) = ${dec(n.ca + 0.02 * (40 - n.alb), 3)} mmol/L`]
        : [`corrected = Ca + 0.8 × (4 − albumin) = ${n.ca} + 0.8 × (4 − ${n.alb}) = ${dec(c, 2)} mg/dL`],
      note: `An ionized calcium test is more reliable than any correction, mainly in critical illness and kidney failure. ${NOTE}`,
      chart: {
        kind: 'gauge',
        variant: 'bar',
        value: Math.max(6, Math.min(13, c)),
        min: 6,
        max: 13,
        bands: [{ to: 8.5, label: 'Low' }, { to: 10.5, label: 'Normal' }, { to: 13, label: 'High' }],
        center: `${dec(c, 2)} mg/dL`,
        formatValue: (v) => dec(v, 1),
        summary: `Corrected for an albumin of ${n.alb} ${si ? 'g/L' : 'g/dL'}, calcium is ${dec(show, 2)} ${unit}: ${state.toLowerCase()}.`,
      },
    }
  },
}

/* ── ECG ───────────────────────────────────────────────────────── */

export function qtc(qtMs: number, hr: number) {
  const rr = 60 / hr
  return {
    rr,
    bazett: qtMs / Math.sqrt(rr),
    fridericia: qtMs / Math.cbrt(rr),
    framingham: qtMs + 154 * (1 - rr),
    hodges: qtMs + 1.75 * (hr - 60),
  }
}

const qtcSpec: Spec = {
  inputs: [pos('qt', 'QT interval', '400', 'ms', { half: true, max: 1000 }), pos('hr', 'Heart rate', '75', 'bpm', { half: true, max: 300 }), SEX],
  compute: ({ n, s }) => {
    const x = qtc(n.qt, n.hr)
    const limit = s.sex === 'm' ? 450 : 460
    const items = [
      { label: 'Bazett', value: x.bazett, highlight: true },
      { label: 'Fridericia', value: x.fridericia },
      { label: 'Framingham', value: x.framingham },
      { label: 'Hodges', value: x.hodges },
    ]
    const word = x.bazett >= 500 ? 'markedly prolonged' : x.bazett > limit ? 'prolonged' : 'normal'
    return {
      main: { label: 'QTc (Bazett)', value: Math.round(x.bazett), format: int, unit: 'ms', sub: word },
      stats: [
        { label: 'Fridericia', value: x.fridericia, format: int, unit: 'ms' },
        { label: 'Framingham', value: x.framingham, format: int, unit: 'ms' },
        { label: 'Hodges', value: x.hodges, format: int, unit: 'ms' },
        { label: 'RR interval', value: x.rr, format: (v) => dec(v, 3), unit: 's' },
      ],
      working: [
        `RR = 60 ÷ ${n.hr} = ${dec(x.rr, 4)} s`,
        `Bazett = QT ÷ √RR = ${n.qt} ÷ ${dec(Math.sqrt(x.rr), 4)} = ${dec(x.bazett, 1)} ms`,
        `Fridericia = QT ÷ ∛RR = ${dec(x.fridericia, 1)} ms`,
        `Framingham = QT + 154 × (1 − RR) = ${dec(x.framingham, 1)} ms`,
        `Hodges = QT + 1.75 × (HR − 60) = ${dec(x.hodges, 1)} ms`,
      ],
      note: `Bazett over-corrects at fast heart rates; Fridericia and Framingham hold up better. Prolonged: over ${limit} ms for ${s.sex === 'm' ? 'men' : 'women'}; 500 ms or more carries a high risk of torsades de pointes. ${NOTE}`,
      chart: { kind: 'bars', items, formatValue: (v) => `${int(v)} ms`, max: Math.max(520, ...items.map((i) => i.value)), summary: `At ${n.hr} bpm a QT of ${n.qt} ms corrects to ${int(x.fridericia)} to ${int(x.bazett)} ms depending on the formula.`, table: true, columns: ['Formula', 'QTc'] },
    }
  },
}

const mapSpec: Spec = {
  inputs: [pos('sys', 'Systolic pressure', '120', 'mmHg', { half: true, max: 300 }), pos('dia', 'Diastolic pressure', '80', 'mmHg', { half: true, max: 200 })],
  compute: ({ n }) => {
    if (n.dia >= n.sys) fail('The systolic pressure must be higher than the diastolic.')
    const map = n.dia + (n.sys - n.dia) / 3
    const pp = n.sys - n.dia
    return {
      main: { label: 'Mean arterial pressure', value: map, format: (v) => dec(v, 0), unit: 'mmHg' },
      stats: [
        { label: 'Pulse pressure', value: pp, format: int, unit: 'mmHg' },
        { label: 'Blood pressure', value: `${n.sys}/${n.dia} mmHg` },
      ],
      working: [`MAP = DBP + (SBP − DBP) ÷ 3 = ${n.dia} + (${n.sys} − ${n.dia}) ÷ 3 = ${dec(map, 1)} mmHg`, `pulse pressure = ${n.sys} − ${n.dia} = ${pp} mmHg`],
      note: `The heart spends about two thirds of each beat in diastole, so the mean sits a third of the way from diastolic to systolic. ${NOTE}`,
      chart: {
        kind: 'gauge',
        value: Math.max(40, Math.min(140, map)),
        min: 40,
        max: 140,
        bands: [{ to: 65, label: 'Low' }, { to: 100, label: 'Normal' }, { to: 140, label: 'High' }],
        center: `${dec(map, 0)} mmHg`,
        formatValue: (v) => dec(v, 0),
        summary: `A blood pressure of ${n.sys}/${n.dia} gives a mean arterial pressure of ${dec(map, 0)} mmHg. Below about 65 mmHg organs may not get enough blood.`,
      },
    }
  },
}

/* ── glucose and lipids ────────────────────────────────────────── */

/** ADAG study: estimated average glucose (mg/dL) = 28.7 × A1C − 46.7. */
export const eag = (a1c: number) => 28.7 * a1c - 46.7
export const GLUCOSE = 18.016

const a1cSpec: Spec = {
  inputs: [
    choice('dir', 'Convert', 'a1c', [['a1c', 'A1C to glucose'], ['eag', 'Glucose to A1C']]),
    pos('a1c', 'A1C', '6.5', '%', { when: (s) => s.dir !== 'eag', max: 20 }),
    pos('g', 'Average glucose', '140', 'mg/dL', { when: (s) => s.dir === 'eag', max: 800 }),
  ],
  compute: ({ n, s }) => {
    const a1c = s.dir === 'eag' ? (n.g + 46.7) / 28.7 : n.a1c
    const g = eag(a1c)
    const band = a1c < 5.7 ? 'Normal' : a1c < 6.5 ? 'Prediabetes range' : 'Diabetes range'
    const ifcc = (a1c - 2.15) * 10.929
    return {
      main: s.dir === 'eag' ? { label: 'A1C', value: a1c, format: (v) => `${dec(v, 1)}%`, sub: band } : { label: 'Estimated average glucose', value: g, format: (v) => dec(v, 0), unit: 'mg/dL', sub: band },
      stats: [
        { label: 'Average glucose', value: g / GLUCOSE, format: (v) => dec(v, 1), unit: 'mmol/L' },
        { label: 'A1C (IFCC)', value: ifcc, format: (v) => dec(v, 0), unit: 'mmol/mol' },
        { label: 'A1C (NGSP)', value: a1c, format: (v) => `${dec(v, 1)}%` },
      ],
      working: [
        `eAG = 28.7 × A1C − 46.7 = 28.7 × ${dec(a1c, 2)} − 46.7 = ${dec(g, 1)} mg/dL`,
        `in mmol/L: ${dec(g, 1)} ÷ 18.016 = ${dec(g / GLUCOSE, 2)}`,
        `IFCC = (NGSP − 2.15) × 10.929 = ${dec(ifcc, 1)} mmol/mol`,
      ],
      note: `Anemia, kidney disease and some hemoglobin variants make A1C less reliable. ${NOTE}`,
      chart: {
        kind: 'gauge',
        value: Math.max(4, Math.min(14, a1c)),
        min: 4,
        max: 14,
        bands: [{ to: 5.7, label: 'Normal' }, { to: 6.5, label: 'Prediabetes' }, { to: 14, label: 'Diabetes' }],
        center: `${dec(a1c, 1)}%`,
        formatValue: (v) => `${v}%`,
        summary: `An A1C of ${dec(a1c, 1)}% matches an average glucose of about ${int(g)} mg/dL (${dec(g / GLUCOSE, 1)} mmol/L): ${band.toLowerCase()}.`,
      },
    }
  },
}

const sugarSpec: Spec = {
  inputs: [
    choice('dir', 'Convert', 'mg', [['mg', 'mg/dL to mmol/L'], ['mmol', 'mmol/L to mg/dL']]),
    pos('v', 'Blood sugar', '100', undefined, { unit: (s) => (s.dir === 'mmol' ? 'mmol/L' : 'mg/dL'), max: 2000 }),
    choice('when', 'Measured', 'fasting', [['fasting', 'Fasting'], ['after', '2 h after a meal']]),
  ],
  compute: ({ n, s }) => {
    const mg = s.dir === 'mmol' ? n.v * GLUCOSE : n.v
    const mmol = mg / GLUCOSE
    const fasting = s.when !== 'after'
    const bands = fasting ? [{ to: 70, label: 'Low' }, { to: 100, label: 'Normal' }, { to: 126, label: 'Prediabetes' }, { to: 300, label: 'Diabetes' }] : [{ to: 70, label: 'Low' }, { to: 140, label: 'Normal' }, { to: 200, label: 'Prediabetes' }, { to: 300, label: 'Diabetes' }]
    const band = bands.find((b) => mg < b.to)?.label ?? 'Diabetes'
    return {
      main: s.dir === 'mmol' ? { label: 'Blood sugar', value: mg, format: (v) => dec(v, 0), unit: 'mg/dL', sub: band } : { label: 'Blood sugar', value: mmol, format: (v) => dec(v, 1), unit: 'mmol/L', sub: band },
      stats: [
        { label: 'mg/dL', value: mg, format: (v) => dec(v, 1) },
        { label: 'mmol/L', value: mmol, format: (v) => dec(v, 2) },
      ],
      working: s.dir === 'mmol' ? [`mg/dL = mmol/L × 18.016 = ${n.v} × 18.016 = ${dec(mg, 1)}`] : [`mmol/L = mg/dL ÷ 18.016 = ${n.v} ÷ 18.016 = ${dec(mmol, 2)}`],
      note: `18.016 is one tenth of the molar mass of glucose, 180.16 g/mol. One reading does not diagnose diabetes. ${NOTE}`,
      chart: {
        kind: 'gauge',
        variant: 'bar',
        value: Math.max(40, Math.min(300, mg)),
        min: 40,
        max: 300,
        bands,
        center: `${dec(mg, 0)} mg/dL · ${dec(mmol, 1)} mmol/L`,
        formatValue: (v) => dec(v, 0),
        summary: `${dec(mg, 0)} mg/dL is ${dec(mmol, 1)} mmol/L, in the ${band.toLowerCase()} range for a ${fasting ? 'fasting' : 'two-hour after-meal'} reading.`,
      },
    }
  },
}

const LIPID_UNITS = choice('u', 'Units', 'mg', [['mg', 'mg/dL'], ['mmol', 'mmol/L']])
const toMg = (v: number, mmol: boolean, tg = false) => (mmol ? v * (tg ? 88.57 : 38.67) : v)

const ratioSpec: Spec = {
  inputs: [
    LIPID_UNITS,
    pos('tc', 'Total cholesterol', '200', undefined, { unit: (s) => (s.u === 'mmol' ? 'mmol/L' : 'mg/dL'), half: true }),
    pos('hdl', 'HDL', '50', undefined, { unit: (s) => (s.u === 'mmol' ? 'mmol/L' : 'mg/dL'), half: true }),
    num('ldl', 'LDL', '120', undefined, { optional: true, min: 0, unit: (s) => (s.u === 'mmol' ? 'mmol/L' : 'mg/dL'), half: true }),
    num('tg', 'Triglycerides', '150', undefined, { optional: true, min: 0, unit: (s) => (s.u === 'mmol' ? 'mmol/L' : 'mg/dL'), half: true }),
  ],
  compute: ({ n, s }) => {
    const r = n.tc / n.hdl
    const ldlHdl = Number.isFinite(n.ldl) ? n.ldl / n.hdl : null
    const tgHdl = Number.isFinite(n.tg) ? toMg(n.tg, s.u === 'mmol', true) / toMg(n.hdl, s.u === 'mmol') : null
    const nonHdl = n.tc - n.hdl
    const unit = s.u === 'mmol' ? 'mmol/L' : 'mg/dL'
    return {
      main: { label: 'Total to HDL ratio', value: r, format: (v) => dec(v, 2), sub: r < 3.5 ? 'Ideal' : r <= 5 ? 'Acceptable' : 'High' },
      stats: [
        { label: 'Non-HDL cholesterol', value: nonHdl, format: (v) => dec(v, s.u === 'mmol' ? 2 : 0), unit },
        { label: 'LDL to HDL', value: ldlHdl === null ? 'Add LDL' : dec(ldlHdl, 2) },
        { label: 'Triglyceride to HDL (mg/dL)', value: tgHdl === null ? 'Add triglycerides' : dec(tgHdl, 2) },
      ],
      working: [
        `total ÷ HDL = ${n.tc} ÷ ${n.hdl} = ${dec(r, 3)}`,
        `non-HDL = ${n.tc} − ${n.hdl} = ${dec(nonHdl, 2)} ${unit}`,
        ...(ldlHdl !== null ? [`LDL ÷ HDL = ${n.ldl} ÷ ${n.hdl} = ${dec(ldlHdl, 3)}`] : []),
        ...(tgHdl !== null ? [`TG ÷ HDL (both in mg/dL) = ${dec(tgHdl, 3)}`] : []),
      ],
      note: `Guidelines treat LDL and non-HDL cholesterol as the main targets; the ratios add context. ${NOTE}`,
      chart: {
        kind: 'gauge',
        value: Math.max(1, Math.min(9, r)),
        min: 1,
        max: 9,
        bands: [{ to: 3.5, label: 'Ideal' }, { to: 5, label: 'Acceptable' }, { to: 9, label: 'High' }],
        center: dec(r, 1),
        formatValue: (v) => dec(v, 0),
        summary: `A total-to-HDL ratio of ${dec(r, 1)}. Below 5 is the usual goal and below 3.5 is ideal.`,
      },
    }
  },
}

/** Friedewald (1972): LDL = TC − HDL − TG/5, mg/dL, TG under 400. */
export const friedewald = (tc: number, hdl: number, tg: number) => tc - hdl - tg / 5
/** Sampson / NIH equation (2020), mg/dL. */
export const sampson = (tc: number, hdl: number, tg: number) => tc / 0.948 - hdl / 0.971 - (tg / 8.56 + (tg * (tc - hdl)) / 2140 - (tg * tg) / 16100) - 9.44

const ldlSpec: Spec = {
  inputs: [
    LIPID_UNITS,
    pos('tc', 'Total cholesterol', '200', undefined, { unit: (s) => (s.u === 'mmol' ? 'mmol/L' : 'mg/dL'), half: true }),
    pos('hdl', 'HDL', '50', undefined, { unit: (s) => (s.u === 'mmol' ? 'mmol/L' : 'mg/dL'), half: true }),
    pos('tg', 'Triglycerides', '150', undefined, { unit: (s) => (s.u === 'mmol' ? 'mmol/L' : 'mg/dL') }),
  ],
  compute: ({ n, s }) => {
    const mm = s.u === 'mmol'
    const tc = toMg(n.tc, mm)
    const hdl = toMg(n.hdl, mm)
    const tg = toMg(n.tg, mm, true)
    if (hdl >= tc) fail('HDL must be lower than total cholesterol.')
    const fr = friedewald(tc, hdl, tg)
    const sa = sampson(tc, hdl, tg)
    const out = (v: number) => (mm ? v / 38.67 : v)
    const unit = mm ? 'mmol/L' : 'mg/dL'
    const d = mm ? 2 : 0
    return {
      main: { label: 'LDL cholesterol (Sampson)', value: out(sa), format: (v) => dec(v, d), unit },
      stats: [
        { label: 'Friedewald', value: tg >= 400 ? 'Not valid, TG 400 or more' : dec(out(fr), d) },
        { label: 'Non-HDL cholesterol', value: out(tc - hdl), format: (v) => dec(v, d), unit },
        { label: 'Triglycerides', value: tg, format: (v) => dec(v, 0), unit: 'mg/dL' },
      ],
      working: [
        ...(mm ? [`mg/dL: TC × 38.67 = ${dec(tc, 1)}, HDL × 38.67 = ${dec(hdl, 1)}, TG × 88.57 = ${dec(tg, 1)}`] : []),
        `Friedewald: TC − HDL − TG ÷ 5 = ${dec(tc, 1)} − ${dec(hdl, 1)} − ${dec(tg / 5, 1)} = ${dec(fr, 1)} mg/dL`,
        `Sampson: TC/0.948 − HDL/0.971 − (TG/8.56 + TG × nonHDL/2140 − TG²/16100) − 9.44 = ${dec(sa, 1)} mg/dL`,
      ],
      note: `Friedewald underestimates LDL when LDL is low or triglycerides high, and is not valid at 400 mg/dL or more. The Sampson equation stays accurate up to 800 mg/dL. ${NOTE}`,
      chart: {
        kind: 'bars',
        items: [
          { label: 'Sampson (NIH)', value: out(sa), highlight: true },
          { label: 'Friedewald', value: Math.max(0, out(fr)) },
          { label: 'Non-HDL', value: out(tc - hdl) },
        ],
        formatValue: (v) => `${dec(v, d)} ${unit}`,
        summary: `Calculated LDL is ${dec(out(sa), d)} ${unit} by the Sampson equation and ${dec(out(fr), d)} by Friedewald. Under 100 mg/dL (2.6 mmol/L) is optimal for most adults.`,
        table: true,
        columns: ['Equation', 'LDL'],
      },
    }
  },
}

/* ── dosing and fluids ─────────────────────────────────────────── */

const doseSpec: Spec = {
  inputs: [
    choice('wu', 'Weight unit', 'kg', [['kg', 'kg'], ['lb', 'lb']]),
    pos('w', 'Patient weight', '20', undefined, { unit: (s) => s.wu ?? 'kg', half: true, max: 1000 }),
    pos('d', 'Dose', '15', 'mg/kg', { half: true, max: 1000 }),
    select('n', 'Doses a day', '4', [['1', 'Once a day'], ['2', 'Every 12 hours'], ['3', 'Every 8 hours'], ['4', 'Every 6 hours'], ['6', 'Every 4 hours']], { half: true }),
    pos('c', 'Concentration', '32', 'mg/mL', { half: true, hint: 'For example 160 mg in 5 mL = 32 mg/mL.' }),
    num('max', 'Maximum single dose', '', 'mg', { optional: true, above: 0 }),
  ],
  compute: ({ n, s }) => {
    const kg = s.wu === 'lb' ? n.w * LB : n.w
    const raw = kg * n.d
    const capped = Number.isFinite(n.max) && raw > n.max
    const dose = capped ? n.max : raw
    const per = Number(s.n)
    const ml = dose / n.c
    const gap = 24 / per
    return {
      main: { label: 'Each dose', value: dose, format: (v) => dec(v, 1), unit: 'mg', sub: `${dec(ml, 2)} mL of ${n.c} mg/mL${capped ? ', capped at the maximum' : ''}` },
      stats: [
        { label: 'Volume each dose', value: ml, format: (v) => dec(v, 2), unit: 'mL' },
        { label: 'Total a day', value: dose * per, format: (v) => dec(v, 0), unit: 'mg' },
        { label: 'Daily mg/kg', value: (dose * per) / kg, format: (v) => dec(v, 1) },
        { label: 'Every', value: gap, format: (v) => dec(v, 0), unit: 'hours' },
      ],
      working: [
        ...(s.wu === 'lb' ? [`weight = ${n.w} lb × 0.4536 = ${dec(kg, 2)} kg`] : []),
        `dose = ${dec(kg, 2)} kg × ${n.d} mg/kg = ${dec(raw, 1)} mg${capped ? `, above the ${n.max} mg maximum, so ${n.max} mg` : ''}`,
        `volume = ${dec(dose, 1)} mg ÷ ${n.c} mg/mL = ${dec(ml, 2)} mL`,
        `daily = ${dec(dose, 1)} × ${per} = ${dec(dose * per, 0)} mg`,
      ],
      note: `Always check the dose against the drug label or a formulary and the patient’s age, kidney and liver function. ${NOTE}`,
      chart: {
        kind: 'timeline',
        start: 0,
        end: 24,
        events: Array.from({ length: per }, (_, k) => ({ at: k * gap, label: `Dose ${k + 1}`, detail: `${dec(dose, 1)} mg, ${dec(ml, 2)} mL` })),
        formatAt: (h) => `Hour ${dec(h, 0)}`,
        summary: `${per} doses of ${dec(dose, 1)} mg (${dec(ml, 2)} mL), ${dec(gap, 0)} hours apart: ${dec(dose * per, 0)} mg in 24 hours.`,
      },
    }
  },
}

const DROP = [['10', '10 gtt/mL'], ['15', '15 gtt/mL'], ['20', '20 gtt/mL'], ['60', '60 gtt/mL (micro)']] as const

const ivSpec: Spec = {
  inputs: [
    pos('v', 'Volume', '1000', 'mL', { max: 10000 }),
    pos('h', 'Time', '8', 'hours', { half: true, max: 72 }),
    select('df', 'Drop factor', '20', DROP, { half: true }),
  ],
  compute: ({ n, s }) => {
    const df = Number(s.df)
    const mlh = n.v / n.h
    const gtt = (n.v * df) / (n.h * 60)
    const xs = Array.from({ length: Math.ceil(n.h) + 1 }, (_, k) => Math.min(n.h, k))
    return {
      main: { label: 'Drip rate', value: Math.round(gtt), format: int, unit: 'gtt/min', sub: `${dec(gtt, 1)} before rounding` },
      stats: [
        { label: 'Pump rate', value: mlh, format: (v) => dec(v, 1), unit: 'mL/h' },
        { label: 'Drops in 15 s', value: gtt / 4, format: (v) => dec(v, 0) },
        { label: 'Seconds per drop', value: 60 / gtt, format: (v) => dec(v, 1) },
      ],
      working: [`mL/h = ${n.v} ÷ ${n.h} = ${dec(mlh, 2)}`, `gtt/min = volume × drop factor ÷ minutes = ${n.v} × ${df} ÷ ${dec(n.h * 60, 0)} = ${dec(gtt, 2)}`],
      note: `The drop factor is printed on the giving set. ${NOTE}`,
      chart: {
        kind: 'line',
        x: xs,
        series: [{ id: 'v', label: 'Volume left', values: xs.map((t) => n.v - mlh * t) }],
        xLabel: 'Hour',
        formatX: String,
        formatValue: (v) => `${dec(v, 0)} mL`,
        summary: `${n.v} mL over ${n.h} hours runs at ${dec(mlh, 1)} mL/h, or ${int(gtt)} drops a minute with a ${df} gtt/mL set.`,
        table: true,
      },
    }
  },
}

const abwSpec: Spec = {
  inputs: [SEX, pos('h', 'Height', '64', 'in', { half: true, min: 48, max: 96 }), pos('w', 'Actual weight', '210', 'lb', { half: true, max: 1000 })],
  compute: ({ n, s }) => {
    const f = s.sex !== 'm'
    const ibw = ibwDevine(n.h, f)
    const kg = n.w * LB
    const abw = adjustedBw(ibw, kg)
    return {
      main: { label: 'Adjusted body weight', value: abw, format: (v) => dec(v, 1), unit: 'kg', sub: `${dec(abw / LB, 1)} lb` },
      stats: [
        { label: 'Ideal body weight', value: ibw, format: (v) => dec(v, 1), unit: 'kg' },
        { label: 'Actual weight', value: kg, format: (v) => dec(v, 1), unit: 'kg' },
        { label: 'Actual ÷ ideal', value: (kg / ibw) * 100, format: (v) => `${dec(v, 0)}%` },
      ],
      working: [`IBW (Devine) = ${f ? '45.5' : '50'} + 2.3 × (${n.h} − 60) = ${dec(ibw, 1)} kg`, `actual = ${n.w} lb × 0.4536 = ${dec(kg, 1)} kg`, `AdjBW = IBW + 0.4 × (actual − IBW) = ${dec(abw, 1)} kg`],
      note: `Adjusted weight is used for some drug doses and for nutrition needs when actual weight is over about 120% of ideal. ${NOTE}`,
      chart: {
        kind: 'bars',
        items: [{ label: 'Ideal', value: ibw }, { label: 'Adjusted', value: abw, highlight: true }, { label: 'Actual', value: kg }],
        formatValue: (v) => `${dec(v, 1)} kg`,
        summary: `Ideal weight is ${dec(ibw, 1)} kg and actual ${dec(kg, 1)} kg; the adjusted weight adds 40% of the difference: ${dec(abw, 1)} kg.`,
        table: true,
        columns: ['Weight', 'kg'],
      },
    }
  },
}

/** Holliday-Segar 4-2-1 rule: mL/h. */
export function holliday(kg: number) {
  const a = Math.min(kg, 10)
  const b = Math.min(Math.max(kg - 10, 0), 10)
  const c = Math.max(kg - 20, 0)
  return { a: a * 4, b: b * 2, c: c * 1, rate: a * 4 + b * 2 + c }
}

const fluidSpec: Spec = {
  inputs: [choice('wu', 'Weight unit', 'kg', [['kg', 'kg'], ['lb', 'lb']]), pos('w', 'Weight', '25', undefined, { unit: (s) => s.wu ?? 'kg', max: 500 })],
  compute: ({ n, s }) => {
    const kg = s.wu === 'lb' ? n.w * LB : n.w
    const x = holliday(kg)
    return {
      main: { label: 'Maintenance rate', value: x.rate, format: (v) => dec(v, 0), unit: 'mL/h', sub: `${dec(x.rate * 24, 0)} mL a day` },
      stats: [
        { label: 'First 10 kg', value: x.a, format: (v) => dec(v, 0), unit: 'mL/h' },
        { label: 'Next 10 kg', value: x.b, format: (v) => dec(v, 0), unit: 'mL/h' },
        { label: 'Each kg above 20', value: x.c, format: (v) => dec(v, 0), unit: 'mL/h' },
      ],
      working: [`4 mL/kg/h × ${dec(Math.min(kg, 10), 1)} kg = ${dec(x.a, 1)}`, `2 mL/kg/h × ${dec(Math.min(Math.max(kg - 10, 0), 10), 1)} kg = ${dec(x.b, 1)}`, `1 mL/kg/h × ${dec(Math.max(kg - 20, 0), 1)} kg = ${dec(x.c, 1)}`, `total = ${dec(x.rate, 1)} mL/h = ${dec(x.rate * 24, 0)} mL a day`],
      note: `Many adult protocols cap maintenance near 100 to 120 mL/h. Children in hospital often get isotonic fluid at a lower rate. ${NOTE}`,
      chart: {
        kind: 'split',
        parts: [
          { label: 'First 10 kg', value: x.a, paint: 'ink' },
          { label: 'Next 10 kg', value: x.b, paint: 'hatch' },
          { label: 'Above 20 kg', value: x.c, paint: 'grey' },
        ],
        formatValue: (v) => `${dec(v, 0)} mL/h`,
        summary: `${dec(kg, 1)} kg needs ${dec(x.rate, 0)} mL/h by the 4-2-1 rule.`,
        table: true,
      },
    }
  },
}

const packSpec: Spec = {
  inputs: [
    pos('cig', 'Cigarettes a day', '15', undefined, { half: true, max: 200 }),
    pos('yrs', 'Years smoked', '30', 'years', { half: true, max: 90 }),
    pos('age', 'Age', '58', 'years', { half: true, max: 120 }),
    num('quit', 'Years since quitting', '0', 'years', { half: true, min: 0, max: 90, hint: '0 if you still smoke.' }),
  ],
  compute: ({ n }) => {
    const py = (n.cig / 20) * n.yrs
    const eligible = n.age >= 50 && n.age <= 80 && py >= 20 && n.quit <= 15
    return {
      main: { label: 'Pack-years', value: py, format: (v) => dec(v, 1), sub: eligible ? 'Meets the USPSTF screening criteria' : 'Does not meet the USPSTF screening criteria' },
      stats: [
        { label: 'Packs a day', value: n.cig / 20, format: (v) => dec(v, 2) },
        { label: 'Cigarettes in all', value: n.cig * 365.25 * n.yrs, format: int },
        { label: 'Screening', value: eligible ? 'Yearly low-dose CT' : 'Not recommended by age, pack-years or quit time' },
      ],
      working: [`packs a day = ${n.cig} ÷ 20 = ${dec(n.cig / 20, 2)}`, `pack-years = ${dec(n.cig / 20, 2)} × ${n.yrs} = ${dec(py, 1)}`, `USPSTF 2021: age 50–80, 20 pack-years or more, smoking now or quit within 15 years`],
      note: NOTE,
      chart: {
        kind: 'gauge',
        variant: 'bar',
        value: Math.min(60, py),
        min: 0,
        max: 60,
        bands: [{ to: 20, label: 'Under 20' }, { to: 40, label: '20 to 40' }, { to: 60, label: 'Over 40' }],
        center: `${dec(py, 1)} pack-years`,
        formatValue: (v) => dec(v, 0),
        summary: `${n.cig} cigarettes a day for ${n.yrs} years is ${dec(py, 1)} pack-years. ${eligible ? 'Yearly lung cancer screening with low-dose CT is recommended.' : 'The screening criteria are not met.'}`,
      },
    }
  },
}

export const specs: Record<string, Spec> = {
  'egfr-calculator': egfrSpec,
  'creatinine-clearance-calculator': crclSpec,
  'anion-gap-calculator': agSpec,
  'corrected-calcium-calculator': caSpec,
  'qtc-calculator': qtcSpec,
  'mean-arterial-pressure-calculator': mapSpec,
  'a1c-calculator': a1cSpec,
  'blood-sugar-converter': sugarSpec,
  'cholesterol-ratio-calculator': ratioSpec,
  'ldl-calculator': ldlSpec,
  'dosage-calculator': doseSpec,
  'iv-drip-rate-calculator': ivSpec,
  'adjusted-body-weight-calculator': abwSpec,
  'maintenance-fluids-calculator': fluidSpec,
  'pack-year-calculator': packSpec,
}
