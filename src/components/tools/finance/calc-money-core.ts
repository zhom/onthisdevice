/**
 * Round-2 batch `calc-money` — shared numeric core.
 *
 * Self-contained on purpose: round-1 finance helpers live in `money.ts`, which
 * belongs to another agent, so the handful of primitives this batch needs are
 * reimplemented here rather than imported across an ownership boundary.
 *
 * All money arithmetic goes through decimal.js. Floating point is never used to
 * accumulate a balance, an interest charge or a payroll total.
 */

import Decimal from 'decimal.js'

/* 40 significant digits is ample for a 600-period schedule compounded monthly. */
Decimal.set({ precision: 40, toExpNeg: -30, toExpPos: 40 })

export { Decimal }

export function d(value: Decimal.Value): Decimal {
  return new Decimal(value)
}

export const ZERO = new Decimal(0)

/* ────────────────────────────── currencies ────────────────────────────── */

export interface CurrencyOption {
  code: string
  name: string
  symbol: string
}

export const CM_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', name: 'US dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian dollar', symbol: 'A$' },
  { code: 'NZD', name: 'New Zealand dollar', symbol: 'NZ$' },
  { code: 'INR', name: 'Indian rupee', symbol: '₹' },
  { code: 'ZAR', name: 'South African rand', symbol: 'R' },
  { code: 'SGD', name: 'Singapore dollar', symbol: 'S$' },
  { code: 'JPY', name: 'Japanese yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss franc', symbol: 'CHF' },
  { code: 'PLN', name: 'Polish złoty', symbol: 'zł' },
  { code: 'SEK', name: 'Swedish krona', symbol: 'kr' },
  { code: 'DKK', name: 'Danish krone', symbol: 'kr.' },
  { code: 'MYR', name: 'Malaysian ringgit', symbol: 'RM' },
]

export function currencySymbol(code: string): string {
  return CM_CURRENCIES.find((c) => c.code === code)?.symbol ?? code
}

/** Currencies whose minor unit is not 1/100. */
export function currencyDecimals(code: string): number {
  return code === 'JPY' ? 0 : 2
}

/* ────────────────────────────── parsing ────────────────────────────── */

/**
 * Parse a free-typed numeric field. Tolerates thousands separators, currency
 * symbols, spaces and a trailing decimal point ("1,250." while still typing).
 */
export function toNum(input: string | number, fallback = 0): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : fallback
  const cleaned = input.replace(/[^0-9.\-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') return fallback
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : fallback
}

/** Same as `toNum` but clamped at zero — most money inputs cannot be negative. */
export function toPositive(input: string | number, fallback = 0): number {
  return Math.max(0, toNum(input, fallback))
}

/** True when the field is blank or still mid-typing rather than a real zero. */
export function isBlank(input: string): boolean {
  return input.replace(/[^0-9.\-]/g, '').replace(/[.\-]/g, '') === ''
}

/* ────────────────────────────── dates ────────────────────────────── */

export function addMonths(date: Date, months: number): Date {
  const out = new Date(date.getTime())
  const targetDay = out.getDate()
  out.setDate(1)
  out.setMonth(out.getMonth() + months)
  const lastDay = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate()
  out.setDate(Math.min(targetDay, lastDay))
  return out
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function formatLongDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', day: 'numeric' })
}

export function isoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 41 → "3 years 5 months" */
export function formatMonths(totalMonths: number): string {
  if (!Number.isFinite(totalMonths) || totalMonths <= 0) return '0 months'
  const whole = Math.round(totalMonths)
  const years = Math.floor(whole / 12)
  const months = whole % 12
  const parts: string[] = []
  if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`)
  if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`)
  return parts.length ? parts.join(' ') : '0 months'
}

/* ────────────────────────── amortisation engine ────────────────────────── */

export interface CmScheduleRow {
  /** 1-based payment number. */
  n: number
  date: Date
  payment: number
  interest: number
  principal: number
  extra: number
  balance: number
  cumInterest: number
  cumPrincipal: number
}

export interface CmYearRow {
  year: number
  payments: number
  interest: number
  principal: number
  extra: number
  endingBalance: number
}

export interface CmLumpSum {
  /** 1-based payment number the lump sum lands on. */
  month: number
  amount: number
}

export interface CmAmortInput {
  principal: number
  /** Nominal annual rate, in percent. */
  annualRatePct: number
  /** Scheduled number of monthly payments. */
  months: number
  /** Additional principal paid every month. */
  extraMonthly?: number
  /** Additional principal paid once every twelve payments. */
  extraYearly?: number
  /** One-off principal payments keyed to a payment number. */
  lumpSums?: CmLumpSum[]
  /** Date of the first payment. */
  firstPaymentDate?: Date
}

export interface CmAmortResult {
  /** Scheduled principal + interest payment, rounded to the minor unit. */
  monthlyPayment: number
  rows: CmScheduleRow[]
  totalInterest: number
  totalPrincipal: number
  totalPaid: number
  monthsToPayoff: number
  payoffDate: Date
  /** True when the payment cannot cover the interest, so the balance never falls. */
  neverAmortises: boolean
}

/**
 * Level monthly payment for an amortising loan:
 *   M = P · i / (1 − (1 + i)^−n)
 * With i = 0 this degenerates to P / n.
 */
export function levelPayment(principal: number, annualRatePct: number, months: number): Decimal {
  const P = d(principal)
  const n = Math.max(1, Math.round(months))
  if (annualRatePct === 0) return P.div(n)
  const i = d(annualRatePct).div(100).div(12)
  const factor = d(1).minus(d(1).plus(i).pow(-n))
  if (factor.isZero()) return P.div(n)
  return P.times(i).div(factor)
}

/**
 * Month-by-month amortisation with optional overpayments.
 *
 * Interest is charged on the opening balance and rounded to the minor unit
 * exactly as a servicer does; the final instalment absorbs the rounding drift
 * rather than creating an extra payment period.
 */
export function buildSchedule(input: CmAmortInput): CmAmortResult {
  const first = input.firstPaymentDate ?? addMonths(new Date(), 1)
  const months = Math.max(1, Math.min(1200, Math.round(input.months)))
  const principal = Math.max(0, input.principal)
  const extraMonthly = Math.max(0, input.extraMonthly ?? 0)
  const extraYearly = Math.max(0, input.extraYearly ?? 0)
  const lumps = new Map<number, number>()
  for (const lump of input.lumpSums ?? []) {
    if (lump.amount > 0 && lump.month >= 1) {
      lumps.set(Math.round(lump.month), (lumps.get(Math.round(lump.month)) ?? 0) + lump.amount)
    }
  }

  const payment = levelPayment(principal, input.annualRatePct, months).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  )

  const empty: CmAmortResult = {
    monthlyPayment: payment.toNumber(),
    rows: [],
    totalInterest: 0,
    totalPrincipal: 0,
    totalPaid: 0,
    monthsToPayoff: 0,
    payoffDate: first,
    neverAmortises: false,
  }
  if (principal <= 0) return empty

  const i = d(input.annualRatePct).div(100).div(12)
  if (!i.isZero() && payment.plus(extraMonthly).lte(d(principal).times(i))) {
    return { ...empty, neverAmortises: true }
  }

  const rows: CmScheduleRow[] = []
  let balance = d(principal)
  let cumInterest = ZERO
  let cumPrincipal = ZERO
  let n = 0

  while (balance.gt(0) && n < months + 600) {
    n += 1
    const interest = balance.times(i).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    let scheduledPrincipal = payment.minus(interest)
    let extra = d(extraMonthly)
      .plus(extraYearly > 0 && n % 12 === 0 ? extraYearly : 0)
      .plus(lumps.get(n) ?? 0)

    if (n >= months || scheduledPrincipal.gte(balance)) {
      scheduledPrincipal = balance
      extra = ZERO
    } else if (scheduledPrincipal.plus(extra).gte(balance)) {
      extra = balance.minus(scheduledPrincipal)
    }

    const principalPaid = scheduledPrincipal.plus(extra)
    balance = balance.minus(principalPaid)
    if (balance.abs().lt(0.005)) balance = ZERO

    cumInterest = cumInterest.plus(interest)
    cumPrincipal = cumPrincipal.plus(principalPaid)

    rows.push({
      n,
      date: addMonths(first, n - 1),
      payment: scheduledPrincipal.plus(interest).plus(extra).toNumber(),
      interest: interest.toNumber(),
      principal: scheduledPrincipal.toNumber(),
      extra: extra.toNumber(),
      balance: balance.toNumber(),
      cumInterest: cumInterest.toNumber(),
      cumPrincipal: cumPrincipal.toNumber(),
    })
  }

  return {
    monthlyPayment: payment.toNumber(),
    rows,
    totalInterest: cumInterest.toNumber(),
    totalPrincipal: cumPrincipal.toNumber(),
    totalPaid: cumInterest.plus(cumPrincipal).toNumber(),
    monthsToPayoff: rows.length,
    payoffDate: rows.length > 0 ? rows[rows.length - 1]!.date : first,
    neverAmortises: false,
  }
}

/** Collapse a monthly schedule into calendar-year totals. */
export function aggregateByYear(rows: CmScheduleRow[]): CmYearRow[] {
  const map = new Map<number, CmYearRow>()
  for (const row of rows) {
    const year = row.date.getFullYear()
    const entry = map.get(year) ?? {
      year,
      payments: 0,
      interest: 0,
      principal: 0,
      extra: 0,
      endingBalance: 0,
    }
    entry.payments += 1
    entry.interest += row.interest
    entry.principal += row.principal
    entry.extra += row.extra
    entry.endingBalance = row.balance
    map.set(year, entry)
  }
  return [...map.values()].sort((a, b) => a.year - b.year)
}

/* ────────────────────────────── CSV ────────────────────────────── */

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) lines.push(row.map(csvCell).join(','))
  return lines.join('\r\n')
}

/** Rounded to the minor unit and plain (no separators) so spreadsheets parse it. */
export function csvMoney(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(decimals)
}

/* ─────────────────────────── export bar plumbing ─────────────────────────── */

export interface CmTable {
  /** Sheet name in XLSX (max 31 chars) and section heading in the PDF. */
  name: string
  headers: string[]
  rows: (string | number)[][]
  /** Per-column alignment for the PDF renderer. Defaults to left. */
  aligns?: ('left' | 'right')[]
}

export interface CmExportSpec {
  /** Base filename with no extension, e.g. "amortization-schedule". */
  filename: string
  /** Document title printed at the top of the PDF. */
  title: string
  subtitle?: string
  tables: CmTable[]
  /** Assumption / method lines printed under the tables. */
  notes?: string[]
}

/**
 * pdf-lib's standard fonts are WinAnsi-encoded, which cannot represent ₹, ≈ or
 * a handful of other characters we render happily in HTML. Substituting them
 * beats throwing at export time.
 */
const WIN_ANSI_MAP: Record<string, string> = {
  '₹': 'Rs.',
  '≈': '~',
  '–': '-',
  '—': '-',
  '×': 'x',
  '÷': '/',
  '−': '-',
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  '…': '...',
  '·': '-',
  '½': '1/2',
  '¼': '1/4',
  '¾': '3/4',
  '⁄': '/',
}

export function winAnsi(input: string): string {
  let out = ''
  for (const ch of input) {
    const mapped = WIN_ANSI_MAP[ch]
    if (mapped !== undefined) {
      out += mapped
      continue
    }
    const code = ch.codePointAt(0) ?? 63
    out += code <= 0xff ? ch : '?'
  }
  return out
}

export function csvBlob(headers: string[], rows: (string | number)[][]): Blob {
  // The BOM makes Excel open UTF-8 CSVs without mangling accented text.
  return new Blob(['\ufeff', toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' })
}

/** Build an .xlsx workbook, one sheet per table. Dynamically imports `xlsx`. */
export async function xlsxBlob(tables: CmTable[]): Promise<Blob> {
  const XLSX = await import('xlsx')
  const book = XLSX.utils.book_new()
  const used = new Set<string>()
  for (const table of tables) {
    const sheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows])
    sheet['!cols'] = table.headers.map((h, i) => ({
      wch: Math.min(
        40,
        Math.max(h.length + 2, ...table.rows.map((r) => String(r[i] ?? '').length + 2), 10),
      ),
    }))
    let name = table.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet'
    let suffix = 2
    while (used.has(name)) name = `${name.slice(0, 28)} ${suffix++}`
    used.add(name)
    XLSX.utils.book_append_sheet(book, sheet, name)
  }
  const out = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/**
 * Render tables to a paginated A4 PDF with pdf-lib. Columns are sized from the
 * widest cell and scaled down proportionally when the table is wider than the
 * printable area, so nothing is ever clipped off the edge of the sheet.
 */
export async function tablePdfBlob(spec: CmExportSpec): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  doc.setTitle(spec.title)
  doc.setProducer('onthisdevice.com')
  doc.setCreator('onthisdevice.com')

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const W = 595.28
  const H = 841.89
  const margin = 40
  const innerWidth = W - margin * 2
  const ink = rgb(0.09, 0.1, 0.12)
  const muted = rgb(0.42, 0.45, 0.5)
  const rule = rgb(0.82, 0.84, 0.87)
  const band = rgb(0.955, 0.96, 0.97)

  let page = doc.addPage([W, H])
  let y = H - margin

  const newPage = () => {
    page = doc.addPage([W, H])
    y = H - margin
  }
  const need = (space: number) => {
    if (y - space < margin + 24) newPage()
  }
  const text = (
    value: string,
    x: number,
    size: number,
    opts?: { bold?: boolean; color?: ReturnType<typeof rgb>; maxWidth?: number; right?: number },
  ) => {
    const f = opts?.bold ? bold : font
    let str = winAnsi(value)
    if (opts?.maxWidth !== undefined) {
      while (str.length > 1 && f.widthOfTextAtSize(str, size) > opts.maxWidth) {
        str = str.slice(0, -1)
      }
    }
    const drawX = opts?.right !== undefined ? opts.right - f.widthOfTextAtSize(str, size) : x
    page.drawText(str, { x: drawX, y, size, font: f, color: opts?.color ?? ink })
  }

  text(spec.title, margin, 18, { bold: true, maxWidth: innerWidth })
  y -= 22
  if (spec.subtitle) {
    text(spec.subtitle, margin, 10, { color: muted, maxWidth: innerWidth })
    y -= 16
  }
  y -= 6

  for (const table of spec.tables) {
    need(72)
    text(table.name, margin, 12, { bold: true, maxWidth: innerWidth })
    y -= 16

    const cols = table.headers.length
    const raw = table.headers.map((h, i) => {
      let w = bold.widthOfTextAtSize(winAnsi(h), 9) + 12
      for (const row of table.rows) {
        w = Math.max(w, font.widthOfTextAtSize(winAnsi(String(row[i] ?? '')), 9) + 12)
      }
      return Math.min(w, 200)
    })
    const rawTotal = raw.reduce((a, b) => a + b, 0)
    const scale = rawTotal > innerWidth ? innerWidth / rawTotal : 1
    const widths = raw.map((w) => w * scale)
    const xs: number[] = []
    let cursor = margin
    for (const w of widths) {
      xs.push(cursor)
      cursor += w
    }

    const drawHeader = () => {
      page.drawRectangle({
        x: margin,
        y: y - 13,
        width: widths.reduce((a, b) => a + b, 0),
        height: 17,
        color: band,
      })
      for (let i = 0; i < cols; i++) {
        const align = table.aligns?.[i] ?? 'left'
        const w = widths[i] ?? 0
        const x = xs[i] ?? margin
        text(String(table.headers[i] ?? ''), x + 6, 9, {
          bold: true,
          maxWidth: w - 12,
          right: align === 'right' ? x + w - 6 : undefined,
        })
      }
      y -= 20
    }

    drawHeader()

    for (const row of table.rows) {
      if (y - 14 < margin + 24) {
        newPage()
        drawHeader()
      }
      for (let i = 0; i < cols; i++) {
        const align = table.aligns?.[i] ?? 'left'
        const w = widths[i] ?? 0
        const x = xs[i] ?? margin
        text(String(row[i] ?? ''), x + 6, 9, {
          maxWidth: w - 12,
          right: align === 'right' ? x + w - 6 : undefined,
        })
      }
      y -= 13
      page.drawLine({
        start: { x: margin, y: y + 4 },
        end: { x: margin + widths.reduce((a, b) => a + b, 0), y: y + 4 },
        thickness: 0.4,
        color: rule,
      })
    }
    y -= 18
  }

  if (spec.notes && spec.notes.length > 0) {
    need(40)
    text('Notes and assumptions', margin, 11, { bold: true })
    y -= 15
    for (const note of spec.notes) {
      // Naive greedy wrap at the printable width.
      const words = winAnsi(note).split(' ')
      let line = ''
      const flush = () => {
        if (!line) return
        need(14)
        text(line, margin, 8.5, { color: muted })
        y -= 12
        line = ''
      }
      for (const word of words) {
        const next = line ? `${line} ${word}` : word
        if (font.widthOfTextAtSize(next, 8.5) > innerWidth - 10) {
          flush()
          line = word
        } else {
          line = next
        }
      }
      flush()
      y -= 4
    }
  }

  need(20)
  y = Math.max(y, margin)
  text('Calculated in the browser on onthisdevice.com - nothing was uploaded.', margin, 8, {
    color: muted,
  })

  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}
