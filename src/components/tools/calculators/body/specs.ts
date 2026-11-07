/** Body, fitness, pregnancy and pet calculators. */
import { choice, num, percent, pos, select } from '../engine/fields'
import { dec, int, pct } from '../engine/format'
import { fail } from '../engine/types'
import type { Raw, Spec } from '../engine/types'

export const LB = 0.45359237
export const IN = 2.54
const UNITS = [['metric', 'Metric'], ['us', 'US']] as const
const isUs = (s: Raw) => s.u === 'us'
const unitChoice = choice('u', 'Units', 'us', UNITS)
const weightField = (value = '170') => pos('w', 'Weight', value, undefined, { unit: (s) => (isUs(s) ? 'lb' : 'kg'), max: 1500, half: true })
const heightField = (value = '69') => pos('h', 'Height', value, undefined, { unit: (s) => (isUs(s) ? 'in' : 'cm'), max: 300, half: true })
const kgOf = (w: number, s: Raw) => (isUs(s) ? w * LB : w)
const cmOf = (h: number, s: Raw) => (isUs(s) ? h * IN : h)

/* ── FFMI ──────────────────────────────────────────────────────── */

export function ffmi(kg: number, cm: number, bf: number) {
  const m = cm / 100
  const lean = kg * (1 - bf / 100)
  const v = lean / (m * m)
  return { lean, ffmi: v, normalized: v + 6.1 * (1.8 - m) }
}

const ffmiSpec: Spec = {
  inputs: [unitChoice, weightField('180'), heightField('70'), percent('bf', 'Body fat', '15', { max: 70 }), choice('sex', 'Sex', 'm', [['m', 'Male'], ['f', 'Female']])],
  compute: ({ n, s }) => {
    const x = ffmi(kgOf(n.w, s), cmOf(n.h, s), n.bf)
    const male = s.sex !== 'f'
    const bands = male
      ? [{ to: 18, label: 'Below average' }, { to: 20, label: 'Average' }, { to: 22, label: 'Above average' }, { to: 23, label: 'Excellent' }, { to: 26, label: 'Superior' }, { to: 30, label: 'Rare without drugs' }]
      : [{ to: 15, label: 'Below average' }, { to: 17, label: 'Average' }, { to: 18, label: 'Above average' }, { to: 19, label: 'Excellent' }, { to: 22, label: 'Superior' }, { to: 30, label: 'Rare without drugs' }]
    return {
      main: { label: 'Normalized FFMI', value: x.normalized, format: (v) => dec(v, 1) },
      stats: [
        { label: 'FFMI', value: x.ffmi, format: (v) => dec(v, 1) },
        { label: 'Lean mass', value: isUs(s) ? x.lean / LB : x.lean, format: (v) => dec(v, 1), unit: isUs(s) ? 'lb' : 'kg' },
        { label: 'Fat mass', value: isUs(s) ? n.w - x.lean / LB : n.w - x.lean, format: (v) => dec(v, 1), unit: isUs(s) ? 'lb' : 'kg' },
      ],
      working: [
        `lean mass = ${dec(kgOf(n.w, s), 2)} kg × (1 − ${n.bf}%) = ${dec(x.lean, 2)} kg`,
        `FFMI = lean mass ÷ height² = ${dec(x.lean, 2)} ÷ ${dec(cmOf(n.h, s) / 100, 3)}² = ${dec(x.ffmi, 2)}`,
        `normalized = FFMI + 6.1 × (1.8 − height in m) = ${dec(x.normalized, 2)}`,
      ],
      note: 'Normalizing scales the index to a height of 1.8 m, so tall and short people compare fairly.',
      chart: {
        kind: 'gauge',
        value: Math.min(30, Math.max(12, x.normalized)),
        min: 12,
        max: 30,
        bands,
        center: dec(x.normalized, 1),
        formatValue: (v) => dec(v, 0),
        summary: `A normalized FFMI of ${dec(x.normalized, 1)}. In a study of male athletes, values above 25 were found only in steroid users.`,
      },
    }
  },
}

/* ── waist-to-height ───────────────────────────────────────────── */

const whtrSpec: Spec = {
  inputs: [
    choice('u', 'Units', 'us', [['us', 'Inches'], ['metric', 'Centimeters']]),
    pos('waist', 'Waist', '34', undefined, { unit: (s) => (isUs(s) ? 'in' : 'cm'), half: true, max: 300 }),
    pos('h', 'Height', '69', undefined, { unit: (s) => (isUs(s) ? 'in' : 'cm'), half: true, max: 300 }),
  ],
  compute: ({ n, s }) => {
    const r = n.waist / n.h
    const band = r < 0.4 ? 'Low' : r < 0.5 ? 'Healthy' : r < 0.6 ? 'Increased risk' : 'High risk'
    const unit = isUs(s) ? 'in' : 'cm'
    return {
      main: { label: 'Waist-to-height ratio', value: r, format: (v) => dec(v, 2), sub: band },
      stats: [
        { label: 'Healthy waist up to', value: n.h / 2, format: (v) => dec(v, 1), unit },
        { label: 'Difference', value: n.waist - n.h / 2, format: (v) => dec(v, 1), unit },
      ],
      working: [`ratio = waist ÷ height = ${n.waist} ÷ ${n.h} = ${dec(r, 3)}`, `half your height = ${dec(n.h / 2, 1)} ${unit}`],
      note: 'Measure the waist halfway between the lowest rib and the top of the hip bone, after breathing out.',
      chart: {
        kind: 'gauge',
        value: Math.min(0.8, Math.max(0.3, r)),
        min: 0.3,
        max: 0.8,
        bands: [{ to: 0.4, label: 'Low' }, { to: 0.5, label: 'Healthy' }, { to: 0.6, label: 'Increased' }, { to: 0.8, label: 'High' }],
        center: dec(r, 2),
        formatValue: (v) => dec(v, 1),
        summary: `A ratio of ${dec(r, 2)}: ${band.toLowerCase()}. Keeping the waist under half the height is the usual advice.`,
      },
    }
  },
}

/* ── maximum heart rate ────────────────────────────────────────── */

export const MAX_HR = {
  fox: (a: number) => 220 - a,
  tanaka: (a: number) => 208 - 0.7 * a,
  gellish: (a: number) => 207 - 0.7 * a,
  nes: (a: number) => 211 - 0.64 * a,
  gulati: (a: number) => 206 - 0.88 * a,
}

const maxHrSpec: Spec = {
  inputs: [pos('age', 'Age', '40', 'years', { max: 110 }), choice('sex', 'Sex', 'm', [['m', 'Male'], ['f', 'Female']])],
  compute: ({ n, s }) => {
    const a = n.age
    const items = [
      { label: 'Tanaka: 208 − 0.7 × age', value: MAX_HR.tanaka(a), highlight: true },
      { label: 'Fox: 220 − age', value: MAX_HR.fox(a) },
      { label: 'Gellish: 207 − 0.7 × age', value: MAX_HR.gellish(a) },
      { label: 'Nes: 211 − 0.64 × age', value: MAX_HR.nes(a) },
      ...(s.sex === 'f' ? [{ label: 'Gulati (women): 206 − 0.88 × age', value: MAX_HR.gulati(a) }] : []),
    ]
    const t = MAX_HR.tanaka(a)
    return {
      main: { label: 'Maximum heart rate', value: Math.round(t), format: (v) => `${int(v)}`, unit: 'bpm', sub: 'Tanaka formula' },
      stats: [
        { label: '220 − age', value: MAX_HR.fox(a), format: (v) => int(v), unit: 'bpm' },
        { label: 'Range of formulas', value: `${int(Math.min(...items.map((i) => i.value)))}–${int(Math.max(...items.map((i) => i.value)))} bpm` },
        { label: '70% of max', value: t * 0.7, format: (v) => int(v), unit: 'bpm' },
        { label: '85% of max', value: t * 0.85, format: (v) => int(v), unit: 'bpm' },
      ],
      working: items.map((i) => `${i.label.split(':')[0]}: ${i.label.split(': ')[1]} = ${dec(i.value, 1)} bpm`),
      note: 'Each formula is an average from a study group. A single person’s maximum can differ by 10 bpm or more; only a maximal exercise test measures it.',
      chart: { kind: 'bars', items, formatValue: (v) => `${dec(v, 0)} bpm`, summary: `At ${a}, the formulas give ${int(Math.min(...items.map((i) => i.value)))} to ${int(Math.max(...items.map((i) => i.value)))} beats a minute.`, table: true, columns: ['Formula', 'Max heart rate'] },
    }
  },
}

/* ── steps ─────────────────────────────────────────────────────── */

/** Step length as a share of height. */
export const STRIDE = { m: 0.415, f: 0.413 }

const stepsMilesSpec: Spec = {
  inputs: [
    pos('steps', 'Steps', '10000', undefined, { int: true, max: 1e7 }),
    unitChoice,
    heightField('67'),
    choice('sex', 'Sex', 'f', [['f', 'Female'], ['m', 'Male']], { half: true }),
    num('len', 'Step length if you know it', '', undefined, { optional: true, unit: (s) => (isUs(s) ? 'in' : 'cm'), min: 1, max: 200 }),
  ],
  compute: ({ n, s }) => {
    const known = Number.isFinite(n.len)
    const stepCm = known ? cmOf(n.len, s) : cmOf(n.h, s) * (s.sex === 'm' ? STRIDE.m : STRIDE.f)
    const km = (n.steps * stepCm) / 100000
    const mi = km / 1.609344
    const per = (k: number) => (isUs(s) ? (k * stepCm) / 160934.4 : (k * stepCm) / 100000)
    const unit = isUs(s) ? 'mi' : 'km'
    return {
      main: { label: 'Distance', value: isUs(s) ? mi : km, format: (v) => dec(v, 2), unit },
      stats: [
        { label: isUs(s) ? 'Kilometers' : 'Miles', value: isUs(s) ? km : mi, format: (v) => dec(v, 2) },
        { label: 'Step length', value: isUs(s) ? stepCm / IN : stepCm, format: (v) => dec(v, 1), unit: isUs(s) ? 'in' : 'cm' },
        { label: isUs(s) ? 'Steps per mile' : 'Steps per km', value: isUs(s) ? 160934.4 / stepCm : 100000 / stepCm, format: int },
      ],
      working: [
        known ? `step length = ${n.len} ${isUs(s) ? 'in' : 'cm'} = ${dec(stepCm, 1)} cm` : `step length = height × ${s.sex === 'm' ? STRIDE.m : STRIDE.f} = ${dec(cmOf(n.h, s), 1)} cm × ${s.sex === 'm' ? STRIDE.m : STRIDE.f} = ${dec(stepCm, 1)} cm`,
        `distance = ${int(n.steps)} × ${dec(stepCm, 1)} cm = ${dec(km, 3)} km = ${dec(mi, 3)} mi`,
      ],
      chart: {
        kind: 'bars',
        items: [5000, 7500, 10000, n.steps].sort((a, b) => a - b).filter((v, i, a) => a.indexOf(v) === i).map((k) => ({ label: `${int(k)} steps`, value: per(k), highlight: k === n.steps })),
        formatValue: (v) => `${dec(v, 2)} ${unit}`,
        summary: `${int(n.steps)} steps of ${dec(isUs(s) ? stepCm / IN : stepCm, 1)} ${isUs(s) ? 'in' : 'cm'} cover ${dec(isUs(s) ? mi : km, 2)} ${unit}.`,
        table: true,
        columns: ['Steps', 'Distance'],
      },
    }
  },
}

/** Compendium of Physical Activities (2011) METs for level walking by speed in mph. */
export const WALK_MET: [number, number, string][] = [
  [2.0, 2.8, 'Slow, 2 mph'],
  [2.5, 3.0, 'Easy, 2.5 mph'],
  [3.0, 3.5, 'Moderate, 3 mph'],
  [3.5, 4.3, 'Brisk, 3.5 mph'],
  [4.0, 5.0, 'Very brisk, 4 mph'],
]

const stepsCalSpec: Spec = {
  inputs: [
    pos('steps', 'Steps', '10000', undefined, { int: true, max: 1e7 }),
    unitChoice,
    weightField('160'),
    heightField('67'),
    select('pace', 'Walking pace', '3', WALK_MET.map(([mph, , l]) => [String(mph), l] as const)),
  ],
  compute: ({ n, s }) => {
    const kg = kgOf(n.w, s)
    const stepCm = cmOf(n.h, s) * 0.414
    const mi = (n.steps * stepCm) / 160934.4
    const cal = (mph: number, met: number) => met * kg * (mi / mph)
    const mph = Number(s.pace)
    const met = WALK_MET.find((r) => r[0] === mph)?.[1] ?? 3.5
    const kcal = cal(mph, met)
    return {
      main: { label: 'Calories burned', value: Math.round(kcal), format: int, unit: 'kcal' },
      stats: [
        { label: 'Distance', value: isUs(s) ? mi : mi * 1.609344, format: (v) => dec(v, 2), unit: isUs(s) ? 'mi' : 'km' },
        { label: 'Time', value: `${int((mi / mph) * 60)} min` },
        { label: 'Per 1,000 steps', value: (kcal / n.steps) * 1000, format: (v) => dec(v, 1), unit: 'kcal' },
        { label: 'Above resting', value: Math.round(kcal - kg * (mi / mph)), format: int, unit: 'kcal' },
      ],
      working: [
        `distance = ${int(n.steps)} steps × ${dec(stepCm, 1)} cm = ${dec(mi, 3)} mi`,
        `time = ${dec(mi, 3)} mi ÷ ${mph} mph = ${dec((mi / mph) * 60, 1)} min`,
        `calories = MET × kg × hours = ${met} × ${dec(kg, 1)} × ${dec(mi / mph, 3)} = ${dec(kcal, 0)} kcal`,
      ],
      note: 'One MET is the energy of sitting still, about 1 kcal per kg per hour. The “above resting” figure takes that out.',
      chart: {
        kind: 'bars',
        items: WALK_MET.map(([v, m, l]) => ({ label: l, value: cal(v, m), highlight: v === mph })),
        formatValue: (v) => `${int(v)} kcal`,
        summary: `${int(n.steps)} steps at ${mph} mph burn about ${int(kcal)} kcal. Faster walking burns more for the same steps.`,
        table: true,
        columns: ['Pace', 'Calories'],
      },
    }
  },
}

/* ── walking and running (ACSM metabolic equations) ────────────── */

/** ACSM: walking VO2 = 0.1·S + 1.8·S·G + 3.5, running VO2 = 0.2·S + 0.9·S·G + 3.5 (mL/kg/min, S in m/min). */
export const acsm = (mPerMin: number, grade: number, run: boolean) => (run ? 0.2 * mPerMin + 0.9 * mPerMin * grade : 0.1 * mPerMin + 1.8 * mPerMin * grade) + 3.5
/** kcal from VO2 (mL/kg/min), mass and minutes, at 5 kcal per litre of oxygen. */
export const kcalOf = (vo2: number, kg: number, minutes: number) => (vo2 * kg * minutes) / 1000 * 5

const walkSpec: Spec = {
  inputs: [
    unitChoice,
    weightField('170'),
    pos('min', 'Time', '45', 'min', { half: true, max: 1440 }),
    pos('speed', 'Speed', '3', undefined, { unit: (s) => (isUs(s) ? 'mph' : 'km/h'), max: 10, half: true }),
    percent('grade', 'Incline', '0', { half: true, max: 40 }),
  ],
  compute: ({ n, s }) => {
    const kg = kgOf(n.w, s)
    const mpm = (isUs(s) ? n.speed * 1609.344 : n.speed * 1000) / 60
    if (mpm > 134) fail('Above about 5 mph (8 km/h) most people run. Use the running calorie calculator.')
    const vo2 = acsm(mpm, n.grade / 100, false)
    const kcal = kcalOf(vo2, kg, n.min)
    const xs = Array.from({ length: Math.ceil(n.min / 5) + 1 }, (_, k) => Math.min(n.min, k * 5))
    return {
      main: { label: 'Calories burned', value: Math.round(kcal), format: int, unit: 'kcal' },
      stats: [
        { label: 'Per hour', value: (kcal / n.min) * 60, format: int, unit: 'kcal' },
        { label: 'Distance', value: (n.speed * n.min) / 60, format: (v) => dec(v, 2), unit: isUs(s) ? 'mi' : 'km' },
        { label: 'Oxygen use', value: vo2, format: (v) => dec(v, 1), unit: 'mL/kg/min' },
        { label: 'METs', value: vo2 / 3.5, format: (v) => dec(v, 1) },
      ],
      working: [
        `speed = ${dec(mpm, 1)} m/min, grade = ${n.grade}%`,
        `VO2 = 0.1 × S + 1.8 × S × G + 3.5 = ${dec(vo2, 2)} mL/kg/min`,
        `kcal = VO2 × kg × minutes ÷ 1000 × 5 = ${dec(vo2, 2)} × ${dec(kg, 1)} × ${n.min} ÷ 1000 × 5 = ${dec(kcal, 0)}`,
      ],
      note: 'The ACSM walking equation holds for speeds of about 1.9 to 3.7 mph (50 to 100 m/min).',
      chart: {
        kind: 'line',
        x: xs,
        series: [
          { id: 'g', label: `At ${n.grade}% incline`, values: xs.map((t) => kcalOf(vo2, kg, t)) },
          { id: 'f', label: 'On the flat', values: xs.map((t) => kcalOf(acsm(mpm, 0, false), kg, t)), stroke: 'dash' },
        ],
        xLabel: 'Minutes',
        formatX: String,
        formatValue: (v) => `${int(v)} kcal`,
        summary: `${n.min} minutes at ${n.speed} ${isUs(s) ? 'mph' : 'km/h'}${n.grade ? ` up a ${n.grade}% incline` : ''} burn about ${int(kcal)} kcal.`,
        table: true,
      },
    }
  },
}

const runSpec: Spec = {
  inputs: [
    unitChoice,
    weightField('160'),
    pos('dist', 'Distance', '5', undefined, { unit: (s) => (isUs(s) ? 'mi' : 'km'), half: true, max: 500 }),
    pos('min', 'Time', '45', 'min', { half: true, max: 6000 }),
    percent('grade', 'Incline', '0', { max: 30 }),
  ],
  compute: ({ n, s }) => {
    const kg = kgOf(n.w, s)
    const meters = isUs(s) ? n.dist * 1609.344 : n.dist * 1000
    const mpm = meters / n.min
    if (mpm < 80) fail('That pace is a walk. Use the walking calorie calculator.')
    const vo2 = acsm(mpm, n.grade / 100, true)
    const kcal = kcalOf(vo2, kg, n.min)
    const per = isUs(s) ? n.min / n.dist : n.min / n.dist
    const splits = Array.from({ length: Math.ceil(n.dist) + 1 }, (_, k) => Math.min(n.dist, k))
    return {
      main: { label: 'Calories burned', value: Math.round(kcal), format: int, unit: 'kcal' },
      stats: [
        { label: isUs(s) ? 'Per mile' : 'Per km', value: kcal / n.dist, format: int, unit: 'kcal' },
        { label: 'Pace', value: `${Math.floor(per)}:${String(Math.round((per % 1) * 60)).padStart(2, '0')} /${isUs(s) ? 'mi' : 'km'}` },
        { label: 'Per hour', value: (kcal / n.min) * 60, format: int, unit: 'kcal' },
        { label: 'METs', value: vo2 / 3.5, format: (v) => dec(v, 1) },
      ],
      working: [
        `speed = ${dec(meters, 0)} m ÷ ${n.min} min = ${dec(mpm, 1)} m/min`,
        `VO2 = 0.2 × S + 0.9 × S × G + 3.5 = ${dec(vo2, 2)} mL/kg/min`,
        `kcal = VO2 × kg × minutes ÷ 1000 × 5 = ${dec(kcal, 0)}`,
        `rule of thumb: about 1 kcal per kg per km = ${int((kg * meters) / 1000)} kcal`,
      ],
      chart: {
        kind: 'line',
        x: splits,
        series: [{ id: 'c', label: 'Calories so far', values: splits.map((d) => (kcal * d) / n.dist) }],
        xLabel: isUs(s) ? 'Mile' : 'Km',
        formatX: (v) => dec(v, 1),
        formatValue: (v) => `${int(v)} kcal`,
        summary: `Running ${n.dist} ${isUs(s) ? 'miles' : 'km'} in ${n.min} minutes burns about ${int(kcal)} kcal, ${int(kcal / n.dist)} per ${isUs(s) ? 'mile' : 'km'}.`,
        table: true,
      },
    }
  },
}

/** Compendium of Physical Activities (2011) METs for road cycling by speed. */
export const CYCLE_MET: [number, number, string][] = [
  [9, 4.0, 'Leisure, under 10 mph'],
  [11, 6.8, '10–11.9 mph, light'],
  [13, 8.0, '12–13.9 mph, moderate'],
  [15, 10.0, '14–15.9 mph, vigorous'],
  [17.5, 12.0, '16–19 mph, racing'],
  [21, 15.8, '20 mph and over'],
]

const cycleSpec: Spec = {
  inputs: [
    unitChoice,
    weightField('170'),
    pos('min', 'Time', '60', 'min', { half: true, max: 2000 }),
    select('band', 'Speed', '13', CYCLE_MET.map(([v, , l]) => [String(v), l] as const)),
  ],
  compute: ({ n, s }) => {
    const kg = kgOf(n.w, s)
    const row = CYCLE_MET.find((r) => String(r[0]) === s.band) ?? CYCLE_MET[2]!
    const kcal = row[1] * kg * (n.min / 60)
    return {
      main: { label: 'Calories burned', value: Math.round(kcal), format: int, unit: 'kcal' },
      stats: [
        { label: 'MET value', value: row[1], format: (v) => dec(v, 1) },
        { label: 'Per hour', value: row[1] * kg, format: int, unit: 'kcal' },
        { label: 'Distance about', value: isUs(s) ? (row[0] * n.min) / 60 : (row[0] * 1.609344 * n.min) / 60, format: (v) => dec(v, 1), unit: isUs(s) ? 'mi' : 'km' },
      ],
      working: [`kcal = MET × kg × hours = ${row[1]} × ${dec(kg, 1)} × ${dec(n.min / 60, 3)} = ${dec(kcal, 0)}`],
      note: 'Wind, hills and the bike change the effort a lot. A power meter gives a better figure: kcal ≈ average watts × hours × 3.6.',
      chart: {
        kind: 'bars',
        items: CYCLE_MET.map(([v, m, l]) => ({ label: l, value: m * kg * (n.min / 60), highlight: String(v) === s.band })),
        formatValue: (v) => `${int(v)} kcal`,
        summary: `${n.min} minutes at ${row[2]} burn about ${int(kcal)} kcal at your weight.`,
        table: true,
        columns: ['Speed', 'Calories'],
      },
    }
  },
}

/* ── caffeine ──────────────────────────────────────────────────── */

export const DRINKS: [string, string, number][] = [
  ['coffee', 'Brewed coffee, 8 oz', 95],
  ['espresso', 'Espresso, 1 shot', 63],
  ['cold-brew', 'Cold brew, 12 oz', 155],
  ['tea', 'Black tea, 8 oz', 47],
  ['green', 'Green tea, 8 oz', 28],
  ['cola', 'Cola, 12 oz', 34],
  ['energy', 'Energy drink, 8.4 oz', 80],
  ['pre', 'Pre-workout, 1 scoop', 200],
]

export const remaining = (mg: number, hours: number, halfLife: number) => mg * Math.pow(0.5, hours / halfLife)

const caffeineSpec: Spec = {
  inputs: [
    select('d', 'Drink', 'coffee', DRINKS.map(([v, l, mg]) => [v, `${l} (${mg} mg)`] as const)),
    pos('cups', 'How many', '2', undefined, { half: true, max: 20 }),
    num('at', 'Drunk at (24-hour clock)', '15', 'h', { half: true, min: 0, max: 23.99 }),
    num('bed', 'Bedtime (24-hour clock)', '23', 'h', { half: true, min: 0, max: 23.99 }),
    pos('hl', 'Half-life', '5', 'hours', { half: true, max: 24, hint: '3 to 7 hours in most adults.' }),
  ],
  compute: ({ n, s }) => {
    const mg = (DRINKS.find((d) => d[0] === s.d)?.[2] ?? 95) * n.cups
    const until = (n.bed - n.at + 24) % 24 || 24
    const left = remaining(mg, until, n.hl)
    const xs = Array.from({ length: 25 }, (_, k) => k)
    const clock = (h: number) => `${String(Math.floor((n.at + h) % 24)).padStart(2, '0')}:${String(Math.round(((n.at + h) % 1) * 60)).padStart(2, '0')}`
    const toSafe = left > 50 ? n.hl * Math.log2(mg / 50) : null
    return {
      main: { label: 'Caffeine left at bedtime', value: Math.round(left), format: int, unit: 'mg' },
      stats: [
        { label: 'Caffeine taken', value: mg, format: int, unit: 'mg' },
        { label: 'Hours to bedtime', value: until, format: (v) => dec(v, 1) },
        { label: 'Share of 400 mg daily limit', value: (mg / 400) * 100, format: (v) => pct(v, 0) },
        { label: 'Under 50 mg at', value: toSafe === null ? 'Before bedtime' : clock(toSafe) },
      ],
      working: [
        `caffeine = ${n.cups} × ${DRINKS.find((d) => d[0] === s.d)?.[2]} mg = ${mg} mg at ${clock(0)}`,
        `left after t hours = ${mg} × 0.5^(t ÷ ${n.hl})`,
        `at bedtime: ${mg} × 0.5^(${dec(until, 2)} ÷ ${n.hl}) = ${dec(left, 1)} mg`,
      ],
      note: 'Pregnancy, some medicines and liver function slow caffeine clearance; smoking speeds it up.',
      chart: {
        kind: 'line',
        x: xs,
        series: [{ id: 'c', label: 'Caffeine in your body', values: xs.map((h) => remaining(mg, h, n.hl)) }],
        xLabel: 'Hours after',
        formatX: String,
        readoutX: (h) => `${h} (${clock(h)})`,
        formatValue: (v) => `${dec(v, 0)} mg`,
        markers: [{ x: Math.min(24, until), label: 'Bedtime' }],
        guides: [{ y: 50, label: '50 mg' }],
        summary: `${mg} mg at ${clock(0)} leaves about ${int(left)} mg in your body at bedtime, ${dec(until, 1)} hours later.`,
        table: true,
      },
    }
  },
}

/* ── alcohol units ─────────────────────────────────────────────── */

export const ETHANOL = 0.789
export const ukUnits = (ml: number, abv: number) => (ml * abv) / 1000
export const usDrinks = (ml: number, abv: number) => (ml * (abv / 100) * ETHANOL) / 14

const PRESETS: [string, string, number, number][] = [
  ['beer', 'Beer, 12 oz at 5%', 355, 5],
  ['pint', 'Pint of beer, 568 mL at 4.5%', 568, 4.5],
  ['wine', 'Glass of wine, 5 oz at 12%', 148, 12],
  ['large-wine', 'Large wine, 250 mL at 13%', 250, 13],
  ['spirit', 'Shot of spirits, 1.5 oz at 40%', 44, 40],
  ['custom', 'Enter volume and strength', 0, 0],
]

const alcoholSpec: Spec = {
  inputs: [
    select('d', 'Drink', 'beer', PRESETS.map(([v, l]) => [v, l] as const)),
    pos('ml', 'Volume', '330', 'mL', { when: (s) => s.d === 'custom', half: true, max: 5000 }),
    percent('abv', 'Strength (ABV)', '5', { when: (s) => s.d === 'custom', half: true, above: 0 }),
    pos('count', 'Drinks a week', '6', undefined, { max: 200 }),
  ],
  compute: ({ n, s }) => {
    const p = PRESETS.find((x) => x[0] === s.d)!
    const ml = s.d === 'custom' ? n.ml : p[2]
    const abv = s.d === 'custom' ? n.abv : p[3]
    const one = ukUnits(ml, abv)
    const week = one * n.count
    const grams = ml * (abv / 100) * ETHANOL
    return {
      main: { label: 'UK units a week', value: week, format: (v) => dec(v, 1), sub: `${dec(one, 2)} units a drink` },
      stats: [
        { label: 'US standard drinks a week', value: usDrinks(ml, abv) * n.count, format: (v) => dec(v, 1) },
        { label: 'Alcohol a drink', value: grams, format: (v) => dec(v, 1), unit: 'g' },
        { label: 'Calories from alcohol a week', value: grams * 7 * n.count, format: int, unit: 'kcal' },
      ],
      working: [
        `units = mL × ABV ÷ 1000 = ${ml} × ${abv} ÷ 1000 = ${dec(one, 3)}`,
        `alcohol = ${ml} mL × ${abv}% × 0.789 g/mL = ${dec(grams, 2)} g`,
        `US standard drinks = ${dec(grams, 2)} g ÷ 14 g = ${dec(grams / 14, 3)}`,
        `a week = ${dec(one, 3)} × ${n.count} = ${dec(week, 2)} units`,
      ],
      note: 'A UK unit is 8 g of alcohol; a US standard drink is 14 g. UK guidance is no more than 14 units a week, spread over 3 or more days.',
      chart: {
        kind: 'gauge',
        variant: 'bar',
        value: Math.min(42, week),
        min: 0,
        max: 42,
        bands: [{ to: 14, label: 'Within 14 units' }, { to: 28, label: 'Above guidance' }, { to: 42, label: 'High' }],
        center: `${dec(week, 1)} units a week`,
        formatValue: (v) => dec(v, 0),
        summary: `${n.count} drinks a week is ${dec(week, 1)} UK units, ${week <= 14 ? 'within' : 'above'} the 14-unit low-risk guideline.`,
      },
    }
  },
}

/* ── pregnancy weight gain ─────────────────────────────────────── */

/** IOM 2009: total gain (lb) and weekly rate in the 2nd and 3rd trimesters by pre-pregnancy BMI. */
export const IOM: { to: number; label: string; total: [number, number]; twins: [number, number] | null; rate: [number, number] }[] = [
  { to: 18.5, label: 'Underweight', total: [28, 40], twins: null, rate: [1, 1.3] },
  { to: 25, label: 'Normal weight', total: [25, 35], twins: [37, 54], rate: [0.8, 1] },
  { to: 30, label: 'Overweight', total: [15, 25], twins: [31, 50], rate: [0.5, 0.7] },
  { to: 99, label: 'Obese', total: [11, 20], twins: [25, 42], rate: [0.4, 0.6] },
]

export function gainRange(bmi: number, week: number) {
  const row = IOM.find((r) => bmi < r.to)!
  const first = (w: number, hi: boolean) => ((hi ? 4.4 : 1.1) * Math.min(w, 13)) / 13
  const at = (w: number, hi: boolean) => (w <= 13 ? first(w, hi) : first(13, hi) + ((row.total[hi ? 1 : 0] - first(13, hi)) * Math.min(w - 13, 27)) / 27)
  return { row, lo: at(week, false), hi: at(week, true), at }
}

const pregSpec: Spec = {
  inputs: [
    unitChoice,
    weightField('140'),
    heightField('65'),
    num('week', 'Week of pregnancy', '20', undefined, { int: true, min: 1, max: 42, half: true }),
    num('now', 'Weight now', '', undefined, { optional: true, unit: (s) => (isUs(s) ? 'lb' : 'kg'), above: 0, half: true }),
    choice('twins', 'Expecting', 'one', [['one', 'One baby'], ['twins', 'Twins']]),
  ],
  compute: ({ n, s }) => {
    const kg = kgOf(n.w, s)
    const m = cmOf(n.h, s) / 100
    const bmi = kg / (m * m)
    const g = gainRange(bmi, n.week)
    const twins = s.twins === 'twins'
    if (twins && !g.row.twins) fail('There is no IOM range for twins with an underweight BMI. Ask your midwife or doctor.')
    const total = twins ? g.row.twins! : g.row.total
    const conv = (lb: number) => (isUs(s) ? lb : lb * LB)
    const unit = isUs(s) ? 'lb' : 'kg'
    const gained = Number.isFinite(n.now) ? n.now - n.w : null
    const weeks = Array.from({ length: 41 }, (_, k) => k)
    const scale = twins ? total[1] / g.row.total[1] : 1
    return {
      main: { label: `Healthy gain by week ${n.week}`, value: `${dec(conv(g.lo * scale), 1)}–${dec(conv(g.hi * scale), 1)} ${unit}` },
      stats: [
        { label: 'Pre-pregnancy BMI', value: bmi, format: (v) => dec(v, 1) },
        { label: 'Category', value: g.row.label },
        { label: 'Total by birth', value: `${dec(conv(total[0]), 0)}–${dec(conv(total[1]), 0)} ${unit}` },
        { label: 'Gained so far', value: gained === null ? 'Add weight now' : `${dec(gained, 1)} ${unit}` },
      ],
      working: [
        `BMI = ${dec(kg, 1)} kg ÷ ${dec(m, 2)}² = ${dec(bmi, 1)} (${g.row.label.toLowerCase()})`,
        `first trimester: 1.1–4.4 lb (0.5–2 kg) in all`,
        `then a steady gain to ${g.row.total[0]}–${g.row.total[1]} lb at week 40 (about ${g.row.rate[0]}–${g.row.rate[1]} lb a week)`,
        `week ${n.week}: ${dec(g.lo * scale, 1)}–${dec(g.hi * scale, 1)} lb`,
      ],
      note: 'Ranges from the Institute of Medicine (2009), as used by ACOG. Your care team may set a different goal.',
      chart: {
        kind: 'line',
        x: weeks,
        series: [
          { id: 'hi', label: 'Upper range', values: weeks.map((w) => conv(g.at(w, true) * scale)) },
          { id: 'lo', label: 'Lower range', values: weeks.map((w) => conv(g.at(w, false) * scale)), stroke: 'dash' },
        ],
        xLabel: 'Week',
        formatX: String,
        formatValue: (v) => `${dec(v, 1)} ${unit}`,
        markers: [{ x: n.week, label: gained === null ? 'Now' : `Now: ${dec(gained, 1)} ${unit}` }],
        defaultIndex: n.week,
        summary: `With a pre-pregnancy BMI of ${dec(bmi, 1)}, a healthy gain by week ${n.week} is ${dec(conv(g.lo * scale), 1)} to ${dec(conv(g.hi * scale), 1)} ${unit}, and ${dec(conv(total[0]), 0)} to ${dec(conv(total[1]), 0)} ${unit} by birth.`,
        table: true,
      },
    }
  },
}

/* ── pets ──────────────────────────────────────────────────────── */

const DOG_SIZES = [['small', 'Small, up to 20 lb'], ['medium', 'Medium, 21–50 lb'], ['large', 'Large, 51–100 lb'], ['giant', 'Giant, over 100 lb']] as const
const PER_YEAR: Record<string, number> = { small: 4, medium: 5, large: 6, giant: 7 }

/** Human years: 15 for the first year, 24 at two, then a size-dependent step. */
export function dogYears(age: number, size: string) {
  if (age <= 1) return 15 * age
  if (age <= 2) return 15 + 9 * (age - 1)
  return 24 + (age - 2) * (PER_YEAR[size] ?? 5)
}
/** Wang et al. (2020): human age = 16 ln(dog age) + 31, from DNA methylation in Labrador retrievers. */
export const dogEpigenetic = (age: number) => 16 * Math.log(age) + 31

const dogSpec: Spec = {
  inputs: [pos('age', 'Dog’s age', '6', 'years', { max: 30 }), select('size', 'Size', 'medium', DOG_SIZES)],
  compute: ({ n, s }) => {
    const h = dogYears(n.age, s.size ?? 'medium')
    const e = n.age >= 1 ? dogEpigenetic(n.age) : NaN
    const xs = Array.from({ length: 17 }, (_, k) => k)
    return {
      main: { label: 'Age in human years', value: Math.round(h), format: int, unit: 'years' },
      stats: [
        { label: 'DNA clock estimate', value: Number.isFinite(e) ? Math.round(e) : 'From age 1', format: int },
        { label: 'Each year now adds', value: n.age < 1 ? 15 : n.age < 2 ? 9 : PER_YEAR[s.size ?? 'medium']!, format: int, unit: 'years' },
        { label: 'Senior from about', value: s.size === 'giant' ? 5 : s.size === 'large' ? 6 : 7, format: int, unit: 'dog years' },
      ],
      working: [
        'first year = 15 human years; second year = 9 more (24)',
        `each later year = ${PER_YEAR[s.size ?? 'medium']} human years for a ${s.size} dog`,
        `${dec(n.age, 1)} years → ${dec(h, 1)} human years`,
        Number.isFinite(e) ? `DNA clock: 16 × ln(${dec(n.age, 1)}) + 31 = ${dec(e, 1)}` : 'the DNA clock formula starts at age 1',
      ],
      chart: {
        kind: 'line',
        x: xs,
        series: [
          { id: 'c', label: 'Size chart', values: xs.map((a) => dogYears(a, s.size ?? 'medium')) },
          { id: 'e', label: 'DNA clock', values: xs.map((a) => (a >= 1 ? dogEpigenetic(a) : 15 * a)), stroke: 'dash' },
        ],
        xLabel: 'Dog years',
        formatX: String,
        formatValue: (v) => `${dec(v, 0)} human years`,
        markers: [{ x: Math.min(16, Math.round(n.age)), label: 'Now' }],
        defaultIndex: Math.min(16, Math.round(n.age)),
        summary: `A ${dec(n.age, 1)}-year-old ${s.size} dog is about ${int(h)} in human years. Dogs age fast at first, then more slowly; big breeds age faster.`,
        table: true,
      },
    }
  },
}

/** AAHA/AAFP: 15 human years at 1, 24 at 2, then 4 a year. */
export const catYears = (age: number) => (age <= 1 ? 15 * age : age <= 2 ? 15 + 9 * (age - 1) : 24 + (age - 2) * 4)

const catSpec: Spec = {
  inputs: [pos('age', 'Cat’s age', '8', 'years', { max: 35 })],
  compute: ({ n }) => {
    const h = catYears(n.age)
    const stage = n.age < 1 ? 'Kitten' : n.age < 7 ? 'Young adult' : n.age < 11 ? 'Mature adult' : 'Senior'
    const xs = Array.from({ length: 23 }, (_, k) => k)
    return {
      main: { label: 'Age in human years', value: Math.round(h), format: int, unit: 'years', sub: `Life stage: ${stage.toLowerCase()}` },
      stats: [
        { label: 'Life stage', value: stage },
        { label: 'Next birthday adds', value: n.age < 1 ? 15 : n.age < 2 ? 9 : 4, format: int, unit: 'years' },
      ],
      working: ['first year = 15 human years; second year = 9 more (24)', 'each later year = 4 human years', `${dec(n.age, 1)} years → ${dec(h, 1)} human years`],
      chart: {
        kind: 'line',
        x: xs,
        series: [{ id: 'c', label: 'Human years', values: xs.map(catYears) }],
        xLabel: 'Cat years',
        formatX: String,
        formatValue: (v) => `${dec(v, 0)} human years`,
        markers: [{ x: 1, label: 'Adult' }, { x: 7, label: 'Mature' }, { x: 11, label: 'Senior' }],
        defaultIndex: Math.min(22, Math.round(n.age)),
        summary: `An ${dec(n.age, 1)}-year-old cat is about ${int(h)} in human years: a ${stage.toLowerCase()}.`,
        table: true,
      },
    }
  },
}

/** Daily energy factors (× RER) from the WSAVA and AAHA nutrition guidelines. */
export const DOG_FACTORS: [string, string, number][] = [
  ['neutered', 'Neutered adult', 1.6],
  ['intact', 'Intact adult', 1.8],
  ['lazy', 'Inactive or gains weight easily', 1.3],
  ['loss', 'Weight loss', 1.0],
  ['work-light', 'Light work', 2.0],
  ['work-heavy', 'Heavy work', 4.0],
  ['puppy-young', 'Puppy under 4 months', 3.0],
  ['puppy-old', 'Puppy 4 months to adult', 2.0],
]
export const rer = (kg: number) => 70 * Math.pow(kg, 0.75)

const dogFoodSpec: Spec = {
  inputs: [
    choice('u', 'Units', 'us', [['us', 'Pounds'], ['metric', 'Kilograms']]),
    pos('w', 'Dog’s weight', '45', undefined, { unit: (s) => (isUs(s) ? 'lb' : 'kg'), max: 400 }),
    select('f', 'Life stage and activity', 'neutered', DOG_FACTORS.map(([v, l, k]) => [v, `${l} (× ${k})`] as const)),
    pos('kcal', 'Calories in the food', '380', 'kcal/cup', { hint: 'On the bag, often 300 to 450 kcal a cup.' }),
  ],
  compute: ({ n, s }) => {
    const kg = isUs(s) ? n.w * LB : n.w
    const r = rer(kg)
    const f = DOG_FACTORS.find((x) => x[0] === s.f) ?? DOG_FACTORS[0]!
    const mer = r * f[2]
    return {
      main: { label: 'Food a day', value: mer / n.kcal, format: (v) => dec(v, 2), unit: 'cups', sub: `${int(mer)} kcal a day` },
      stats: [
        { label: 'Resting energy (RER)', value: r, format: int, unit: 'kcal' },
        { label: 'Daily energy (MER)', value: mer, format: int, unit: 'kcal' },
        { label: 'Per meal, two meals', value: mer / n.kcal / 2, format: (v) => dec(v, 2), unit: 'cups' },
        { label: 'Treats, up to 10%', value: mer * 0.1, format: int, unit: 'kcal' },
      ],
      working: [`RER = 70 × kg^0.75 = 70 × ${dec(kg, 2)}^0.75 = ${dec(r, 0)} kcal`, `MER = RER × ${f[2]} (${f[1].toLowerCase()}) = ${dec(mer, 0)} kcal`, `cups = ${dec(mer, 0)} ÷ ${n.kcal} = ${dec(mer / n.kcal, 2)}`],
      note: 'A starting point. Weigh your dog every few weeks and adjust by 10% to keep a healthy body condition.',
      chart: {
        kind: 'bars',
        items: DOG_FACTORS.map(([v, l, k]) => ({ label: l, value: (r * k) / n.kcal, highlight: v === s.f })),
        formatValue: (v) => `${dec(v, 2)} cups`,
        summary: `A ${dec(n.w, 1)} ${isUs(s) ? 'lb' : 'kg'} dog needs about ${int(mer)} kcal a day: ${dec(mer / n.kcal, 2)} cups of a ${n.kcal} kcal/cup food.`,
        table: true,
        columns: ['Life stage', 'Cups a day'],
      },
    }
  },
}

export const specs: Record<string, Spec> = {
  'ffmi-calculator': ffmiSpec,
  'waist-to-height-ratio-calculator': whtrSpec,
  'max-heart-rate-calculator': maxHrSpec,
  'steps-to-miles-calculator': stepsMilesSpec,
  'steps-to-calories-calculator': stepsCalSpec,
  'walking-calorie-calculator': walkSpec,
  'running-calorie-calculator': runSpec,
  'cycling-calorie-calculator': cycleSpec,
  'caffeine-calculator': caffeineSpec,
  'alcohol-units-calculator': alcoholSpec,
  'pregnancy-weight-gain-calculator': pregSpec,
  'dog-age-calculator': dogSpec,
  'cat-age-calculator': catSpec,
  'dog-food-calculator': dogFoodSpec,
}
