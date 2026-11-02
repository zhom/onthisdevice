/**
 * Body and fitness formulas for the health calculators in this folder. Pure
 * functions with no imports, so scripts/calc-test-money-body.mjs runs them in Node.
 * Units: kg, cm, years, minutes, beats per minute unless a name says otherwise.
 */

export type Sex = 'male' | 'female'

export const KG_PER_LB = 0.45359237
export const CM_PER_IN = 2.54

/* ── lean body mass ────────────────────────────────────────────── */

/** Boer (1984). */
export function lbmBoer(sex: Sex, kg: number, cm: number): number {
  return sex === 'male' ? 0.407 * kg + 0.267 * cm - 19.2 : 0.252 * kg + 0.473 * cm - 48.3
}

/** James (1976). */
export function lbmJames(sex: Sex, kg: number, cm: number): number {
  const q = kg / cm
  return sex === 'male' ? 1.1 * kg - 128 * q * q : 1.07 * kg - 148 * q * q
}

/** Hume (1966). */
export function lbmHume(sex: Sex, kg: number, cm: number): number {
  return sex === 'male' ? 0.3281 * kg + 0.33929 * cm - 29.5336 : 0.29569 * kg + 0.41813 * cm - 43.2933
}

/** Lean mass from a known body fat percentage. */
export function lbmFromBodyFat(kg: number, bodyFatPct: number): number {
  return kg * (1 - bodyFatPct / 100)
}

/** Katch-McArdle resting energy (kcal/day) from lean body mass. */
export function katchMcArdle(lbmKg: number): number {
  return 370 + 21.6 * lbmKg
}

/** Mifflin-St Jeor resting energy (kcal/day). */
export function mifflin(sex: Sex, kg: number, cm: number, age: number): number {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161)
}

/* ── waist to hip ──────────────────────────────────────────────── */

export function waistToHip(waist: number, hip: number): number {
  return hip > 0 ? waist / hip : NaN
}

/** Upper edges of the low / moderate / high risk bands. */
export function whrBands(sex: Sex): { to: number; label: string }[] {
  return sex === 'male'
    ? [
        { to: 0.955, label: 'Low risk' },
        { to: 1.005, label: 'Moderate risk' },
        { to: 1.3, label: 'High risk' },
      ]
    : [
        { to: 0.805, label: 'Low risk' },
        { to: 0.855, label: 'Moderate risk' },
        { to: 1.2, label: 'High risk' },
      ]
}

/* ── heart rate ────────────────────────────────────────────────── */

export type MaxHrFormula = 'fox' | 'tanaka' | 'gellish'

/** Estimated maximum heart rate. Fox: 220 − age. Tanaka: 208 − 0.7 × age. Gellish: 207 − 0.7 × age. */
export function maxHeartRate(age: number, formula: MaxHrFormula = 'fox'): number {
  if (formula === 'tanaka') return 208 - 0.7 * age
  if (formula === 'gellish') return 207 - 0.7 * age
  return 220 - age
}

/** Karvonen: target = (max − rest) × intensity + rest. Intensity 0-1. */
export function karvonen(maxHr: number, restHr: number, intensity: number): number {
  return (maxHr - restHr) * intensity + restHr
}

export const HR_ZONES = [
  { from: 0.5, to: 0.6, label: 'Zone 1, very light', use: 'Warm-up and recovery' },
  { from: 0.6, to: 0.7, label: 'Zone 2, light', use: 'Base endurance, fat use' },
  { from: 0.7, to: 0.8, label: 'Zone 3, moderate', use: 'Aerobic fitness' },
  { from: 0.8, to: 0.9, label: 'Zone 4, hard', use: 'Threshold and speed' },
  { from: 0.9, to: 1.0, label: 'Zone 5, maximum', use: 'Short intervals' },
]

/* ── calories from MET ─────────────────────────────────────────── */

/** kcal = MET × 3.5 × kg ÷ 200 × minutes. */
export function metCalories(met: number, kg: number, minutes: number): number {
  return ((met * 3.5 * kg) / 200) * minutes
}

/* ── alcohol ───────────────────────────────────────────────────── */

/** Widmark body water factor r. */
export const WIDMARK_R: Record<Sex, number> = { male: 0.68, female: 0.55 }
/** Elimination, % BAC per hour. */
export const WIDMARK_BETA = 0.015
/** Ethanol density, g/ml. */
export const ETHANOL_G_PER_ML = 0.789

/** Grams of alcohol in a drink: ml × ABV × 0.789. */
export function alcoholGrams(ml: number, abvPct: number): number {
  return ml * (abvPct / 100) * ETHANOL_G_PER_ML
}

/**
 * Widmark BAC in % (g per 100 ml of blood, as in US law): grams ÷ (body grams × r) × 100 − β × hours.
 * Never below 0.
 */
export function widmarkBac(grams: number, kg: number, sex: Sex, hours: number, r = WIDMARK_R[sex], beta = WIDMARK_BETA): number {
  if (!(kg > 0)) return NaN
  const peak = (grams / (kg * 1000 * r)) * 100
  return Math.max(0, peak - beta * hours)
}

/** Hours from the first drink until BAC reaches 0. */
export function hoursToSober(grams: number, kg: number, sex: Sex, r = WIDMARK_R[sex], beta = WIDMARK_BETA): number {
  if (!(kg > 0)) return NaN
  return (grams / (kg * 1000 * r)) * 100 / beta
}

/* ── body surface area (m²), kg and cm ─────────────────────────── */

export const BSA = {
  mosteller: (kg: number, cm: number) => Math.sqrt((cm * kg) / 3600),
  dubois: (kg: number, cm: number) => 0.007184 * Math.pow(kg, 0.425) * Math.pow(cm, 0.725),
  haycock: (kg: number, cm: number) => 0.024265 * Math.pow(kg, 0.5378) * Math.pow(cm, 0.3964),
  gehanGeorge: (kg: number, cm: number) => 0.0235 * Math.pow(kg, 0.51456) * Math.pow(cm, 0.42246),
  boyd: (kg: number, cm: number) => {
    const g = kg * 1000
    return 0.0003207 * Math.pow(cm, 0.3) * Math.pow(g, 0.7285 - 0.0188 * Math.log10(g))
  },
  fujimoto: (kg: number, cm: number) => 0.008883 * Math.pow(kg, 0.444) * Math.pow(cm, 0.663),
} as const

export type BsaFormula = keyof typeof BSA

/* ── running ───────────────────────────────────────────────────── */

/** Riegel: T2 = T1 × (D2 ÷ D1)^k, k = 1.06 by default. Times in seconds. */
export function riegel(t1: number, d1: number, d2: number, k = 1.06): number {
  if (!(t1 > 0) || !(d1 > 0) || !(d2 > 0)) return NaN
  return t1 * Math.pow(d2 / d1, k)
}

/* ── VO2 max (ml/kg/min) ───────────────────────────────────────── */

/** Cooper 12-minute run: (metres − 504.9) ÷ 44.73. */
export function vo2Cooper(metres: number): number {
  return (metres - 504.9) / 44.73
}

/** Uth et al.: 15.3 × max HR ÷ resting HR. */
export function vo2Uth(maxHr: number, restHr: number): number {
  return restHr > 0 ? (15.3 * maxHr) / restHr : NaN
}

/** Rockport 1-mile walk (Kline 1987). Weight in lb, time in minutes, HR at the finish. */
export function vo2Rockport(sex: Sex, age: number, lb: number, minutes: number, hr: number): number {
  return 132.853 - 0.0769 * lb - 0.3877 * age + 6.315 * (sex === 'male' ? 1 : 0) - 3.2649 * minutes - 0.1565 * hr
}

/** 1.5-mile run: 3.5 + 483 ÷ minutes. */
export function vo2OneAndHalfMile(minutes: number): number {
  return minutes > 0 ? 3.5 + 483 / minutes : NaN
}

/** Cooper Institute style norms: lower edges of Poor, Fair, Good, Excellent, Superior by age group. */
const VO2_NORMS: Record<Sex, { maxAge: number; edges: [number, number, number, number, number] }[]> = {
  male: [
    { maxAge: 29, edges: [33.0, 36.5, 42.5, 46.5, 52.5] },
    { maxAge: 39, edges: [31.5, 35.5, 41.0, 45.0, 49.5] },
    { maxAge: 49, edges: [30.2, 33.6, 39.0, 43.8, 48.1] },
    { maxAge: 59, edges: [26.1, 31.0, 35.8, 41.0, 45.4] },
    { maxAge: 200, edges: [20.5, 26.1, 32.3, 36.5, 44.3] },
  ],
  female: [
    { maxAge: 29, edges: [23.6, 29.0, 33.0, 37.0, 41.1] },
    { maxAge: 39, edges: [22.8, 27.0, 31.5, 35.7, 40.1] },
    { maxAge: 49, edges: [21.0, 24.5, 29.0, 32.9, 37.0] },
    { maxAge: 59, edges: [20.2, 22.8, 27.0, 31.5, 35.8] },
    { maxAge: 200, edges: [17.5, 20.2, 24.5, 30.3, 31.5] },
  ],
}

export const VO2_LABELS = ['Very poor', 'Poor', 'Fair', 'Good', 'Excellent', 'Superior'] as const

export function vo2Bands(sex: Sex, age: number): { to: number; label: string }[] {
  const row = VO2_NORMS[sex].find((r) => age <= r.maxAge) ?? VO2_NORMS[sex][VO2_NORMS[sex].length - 1]!
  const e = row.edges
  return [
    { to: e[0], label: VO2_LABELS[0] },
    { to: e[1], label: VO2_LABELS[1] },
    { to: e[2], label: VO2_LABELS[2] },
    { to: e[3], label: VO2_LABELS[3] },
    { to: e[4], label: VO2_LABELS[4] },
    { to: 80, label: VO2_LABELS[5] },
  ]
}

/* ── body fat by tape ──────────────────────────────────────────── */

/**
 * US Navy / DoD circumference method, inches. Men: abdomen and neck. Women:
 * waist + hip − neck.
 */
export function navyBodyFatIn(sex: Sex, heightIn: number, neckIn: number, waistIn: number, hipIn = 0): number {
  if (sex === 'male') {
    const x = waistIn - neckIn
    if (!(x > 0) || !(heightIn > 0)) return NaN
    return 86.01 * Math.log10(x) - 70.041 * Math.log10(heightIn) + 36.76
  }
  const x = waistIn + hipIn - neckIn
  if (!(x > 0) || !(heightIn > 0)) return NaN
  return 163.205 * Math.log10(x) - 97.684 * Math.log10(heightIn) - 78.387
}

/** US Navy formula in centimetres (Hodgdon and Beckett, density form). */
export function navyBodyFatCm(sex: Sex, heightCm: number, neckCm: number, waistCm: number, hipCm = 0): number {
  if (sex === 'male') {
    const x = waistCm - neckCm
    if (!(x > 0)) return NaN
    return 495 / (1.0324 - 0.19077 * Math.log10(x) + 0.15456 * Math.log10(heightCm)) - 450
  }
  const x = waistCm + hipCm - neckCm
  if (!(x > 0)) return NaN
  return 495 / (1.29579 - 0.35004 * Math.log10(x) + 0.221 * Math.log10(heightCm)) - 450
}

/** Army one-site tape test (Army Directive 2023-11). Weight in lb, abdomen in inches. */
export function armyOneSite(sex: Sex, lb: number, abdomenIn: number): number {
  return sex === 'male' ? -26.97 - 0.12 * lb + 1.99 * abdomenIn : -9.15 - 0.015 * lb + 1.27 * abdomenIn
}

/** Army maximum body fat % by age (Army Directive 2023-11 / AR 600-9 table). */
export function armyMaxBodyFat(sex: Sex, age: number): number {
  const male = [20, 22, 24, 26]
  const female = [30, 32, 34, 36]
  const k = age <= 20 ? 0 : age <= 27 ? 1 : age <= 39 ? 2 : 3
  return (sex === 'male' ? male : female)[k]!
}

/* ── protein ───────────────────────────────────────────────────── */

export const PROTEIN_GOALS = [
  { id: 'rda', label: 'Sedentary adult (RDA)', min: 0.8, max: 0.8 },
  { id: 'older', label: 'Adult over 65', min: 1.0, max: 1.2 },
  { id: 'active', label: 'Regular exercise', min: 1.2, max: 1.6 },
  { id: 'muscle', label: 'Build muscle', min: 1.6, max: 2.2 },
  { id: 'cut', label: 'Lose fat, keep muscle', min: 1.8, max: 2.4 },
] as const

export type ProteinGoal = (typeof PROTEIN_GOALS)[number]['id']

/* ── weight loss ───────────────────────────────────────────────── */

export const KCAL_PER_KG = 7700

export interface LossInput {
  sex: Sex
  kg: number
  cm: number
  age: number
  activity: number
  goalKg: number
  /** Planned loss per week in kg at the start. */
  kgPerWeek: number
}

export interface LossResult {
  intake: number
  startTdee: number
  /** Weight at the end of each day from day 0. */
  days: number[]
  reached: boolean
}

/**
 * Daily simulation: intake is fixed at the start (TDEE − planned deficit);
 * each day the weight changes by (TDEE at that weight − intake) ÷ 7700 kcal/kg,
 * so the loss slows as you get lighter. Stops at the goal or after 3 years.
 */
export function simulateLoss(x: LossInput): LossResult {
  const tdee = (kg: number) => mifflin(x.sex, kg, x.cm, x.age) * x.activity
  const startTdee = tdee(x.kg)
  const intake = startTdee - (x.kgPerWeek * KCAL_PER_KG) / 7
  const days = [x.kg]
  let w = x.kg
  const down = x.goalKg < x.kg
  for (let i = 1; i <= 1095; i++) {
    w -= (tdee(w) - intake) / KCAL_PER_KG
    days.push(w)
    if (down ? w <= x.goalKg : w >= x.goalKg) return { intake, startTdee, days, reached: true }
  }
  return { intake, startTdee, days, reached: false }
}

/* ── pregnancy ─────────────────────────────────────────────────── */

const DAY = 86_400_000

/** Whole days from a to b in local calendar days. */
export function daysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((ub - ua) / DAY)
}

export function addDays(a: Date, days: number): Date {
  const r = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  r.setDate(r.getDate() + days)
  return r
}

/** Gestational age from the first day of the last period (LMP), with cycle length correction. */
export function gestation(lmp: Date, today: Date, cycleDays = 28) {
  const adjusted = addDays(lmp, cycleDays - 28)
  const days = daysBetween(adjusted, today)
  const due = addDays(adjusted, 280)
  const weeks = Math.floor(days / 7)
  const rem = days - weeks * 7
  const trimester = days < 14 * 7 ? 1 : days < 28 * 7 ? 2 : 3
  return { days, weeks, rem, due, trimester, daysLeft: daysBetween(today, due), adjustedLmp: adjusted }
}
