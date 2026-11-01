import { useMemo, useState } from 'react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula } from '@/components/shared/Formula'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatNumber } from '@/components/tools/finance/format'
import { Breakdown, EmptyState, Note, ScrollTable, StatGrid, parseNum } from './common'

const MAX = 3_999_999

const SYMBOLS: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

const VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
const CANONICAL = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/

/** Classic 1–3999 conversion. */
function romanBelow4000(value: number): string {
  let n = value
  let out = ''
  for (const [amount, glyph] of SYMBOLS) {
    while (n >= amount) {
      out += glyph
      n -= amount
    }
  }
  return out
}

interface RomanParts {
  /** Group written with an overline — its value is multiplied by 1000. */
  thousands: string
  /** Ordinary group. */
  rest: string
}

function toRomanParts(value: number): RomanParts {
  if (value < 4000) return { thousands: '', rest: romanBelow4000(value) }
  const thousands = Math.floor(value / 1000)
  const rest = value % 1000
  return { thousands: romanBelow4000(thousands), rest: rest === 0 ? '' : romanBelow4000(rest) }
}

/** Combining-overline form, e.g. "M̅M̅M̅CMXCIX" — copies and pastes correctly. */
function withVinculum(parts: RomanParts): string {
  const over = parts.thousands
    .split('')
    .map((ch) => `${ch}\u0305`)
    .join('')
  return over + parts.rest
}

/** ASCII-safe parenthesis form, e.g. "(MMM)CMXCIX". */
function withParens(parts: RomanParts): string {
  return parts.thousands ? `(${parts.thousands})${parts.rest}` : parts.rest
}

function romanValue(text: string): number {
  let total = 0
  for (let i = 0; i < text.length; i++) {
    const current = VALUES[text[i]]
    const next = VALUES[text[i + 1]] ?? 0
    total += current < next ? -current : current
  }
  return total
}

interface ParseResult {
  ok: boolean
  value: number
  message?: string
  canonical?: string
}

function parseRoman(raw: string): ParseResult | null {
  const cleaned = raw.toUpperCase().replace(/[\s.·]/g, '')
  if (cleaned === '') return null

  let overGroup = ''
  let plain = ''

  const parenMatch = /^\(([IVXLCDM]+)\)([IVXLCDM]*)$/.exec(cleaned)
  if (parenMatch) {
    overGroup = parenMatch[1]
    plain = parenMatch[2]
  } else if (/[\u0305\u0304\u00AF]/.test(cleaned)) {
    // Combining overline / macron: every marked glyph belongs to the ×1000 group.
    let seenPlain = false
    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i]
      if (!(ch in VALUES)) {
        if (/[\u0305\u0304\u00AF]/.test(ch)) continue
        return { ok: false, value: 0, message: `“${ch}” is not a Roman numeral. Use only I, V, X, L, C, D and M.` }
      }
      const marked = /[\u0305\u0304\u00AF]/.test(cleaned[i + 1] ?? '')
      if (marked) {
        if (seenPlain) {
          return {
            ok: false,
            value: 0,
            message: 'Overlined glyphs have to come first. The ×1000 part is always written before the rest.',
          }
        }
        overGroup += ch
      } else {
        seenPlain = true
        plain += ch
      }
    }
  } else {
    plain = cleaned
  }

  const bad = [...overGroup, ...plain].find((ch) => !(ch in VALUES))
  if (bad) {
    return {
      ok: false,
      value: 0,
      message: `“${bad}” is not a Roman numeral. Roman numerals only use I, V, X, L, C, D and M.`,
    }
  }

  if (overGroup && !CANONICAL.test(overGroup)) {
    return { ok: false, value: 0, message: `The overlined part “${overGroup}” is not a valid Roman numeral.` }
  }
  if (plain && !CANONICAL.test(plain)) {
    const guess = romanValue(plain)
    const canonical = guess > 0 && guess < 4000 ? romanBelow4000(guess) : undefined
    const bigForm = guess >= 4000 && guess <= MAX ? withParens(toRomanParts(guess)) : undefined
    return {
      ok: false,
      value: 0,
      message: canonical
        ? `“${plain}” is not standard form. The usual spelling for ${formatNumber(guess, 0)} is ${canonical}.`
        : bigForm
          ? `“${plain}” is not standard form. M cannot repeat more than three times. ${formatNumber(guess, 0)} is written ${bigForm} with an overline.`
          : `“${plain}” is not a valid Roman numeral in standard subtractive notation.`,
      canonical: canonical ?? bigForm,
    }
  }

  const value = romanValue(overGroup) * 1000 + romanValue(plain)
  if (value <= 0) return { ok: false, value: 0, message: 'That works out to zero, and Roman numerals have no zero.' }
  if (value > MAX) {
    return { ok: false, value, message: `That is larger than ${formatNumber(MAX, 0)}, the practical limit of the vinculum system.` }
  }
  return { ok: true, value }
}

/** Explain a numeral one symbol group at a time. */
function breakdownOf(value: number): { glyph: string; amount: number }[] {
  const out: { glyph: string; amount: number }[] = []
  const parts = toRomanParts(value)
  let n = value
  if (parts.thousands) {
    let t = Math.floor(value / 1000)
    for (const [amount, glyph] of SYMBOLS) {
      while (t >= amount) {
        out.push({ glyph: `${glyph} (overlined)`, amount: amount * 1000 })
        t -= amount
      }
    }
    n = value % 1000
  }
  for (const [amount, glyph] of SYMBOLS) {
    while (n >= amount) {
      out.push({ glyph, amount })
      n -= amount
    }
  }
  return out
}

const BASIC = [
  { symbol: 'I', value: 1 },
  { symbol: 'V', value: 5 },
  { symbol: 'X', value: 10 },
  { symbol: 'L', value: 50 },
  { symbol: 'C', value: 100 },
  { symbol: 'D', value: 500 },
  { symbol: 'M', value: 1000 },
]

const CHART_ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 2000, 3000, 4000, 5000, 10000]

export default function RomanNumeralConverter() {
  const [tab, setTab] = useState('to-roman')
  const [numberInput, setNumberInput] = useState('2026')
  const [romanInput, setRomanInput] = useState('MMXXVI')

  const numeric = useMemo(() => {
    const raw = numberInput.trim()
    if (raw === '') return null
    const value = parseNum(raw)
    if (value === null) return { error: 'Enter a whole number.' as const }
    if (!Number.isInteger(value)) return { error: 'Roman numerals only represent whole numbers. There is no way to write a fraction.' as const }
    if (value <= 0) return { error: 'Roman numerals start at 1. There is no symbol for zero or for negative numbers.' as const }
    if (value > MAX) return { error: `The vinculum system tops out at ${formatNumber(MAX, 0)}. Enter a smaller number.` as const }
    const parts = toRomanParts(value)
    return {
      error: null,
      value,
      parts,
      vinculum: withVinculum(parts),
      parens: withParens(parts),
      steps: breakdownOf(value),
    }
  }, [numberInput])

  const parsed = useMemo(() => parseRoman(romanInput), [romanInput])

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="to-roman">Number → Roman</TabsTrigger>
          <TabsTrigger value="to-number">Roman → Number</TabsTrigger>
        </TabsList>

        {/* -------------------------- TO ROMAN -------------------------- */}
        <TabsContent value="to-roman" className="mt-6 space-y-6">
          <ToolPanel title="Convert a number" description={`Any whole number from 1 to ${formatNumber(MAX, 0)}.`}>
            <div className="space-y-1.5">
              <Label htmlFor="roman-number">Number</Label>
              <Input
                id="roman-number"
                value={numberInput}
                inputMode="numeric"
                autoComplete="off"
                placeholder="2026"
                onChange={(e) => setNumberInput(e.target.value)}
                aria-invalid={numeric?.error ? true : undefined}
                className="text-lg tabular-nums"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[4, 9, 14, 40, 49, 90, 400, 1999, 2026, 4000, 1000000].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumberInput(String(n))}
                  className="rounded-md bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {formatNumber(n, 0)}
                </button>
              ))}
            </div>
          </ToolPanel>

          <ToolPanel
            title="Roman numeral"
            footer={
              numeric && !numeric.error ? (
                <>
                  <CopyButton value={numeric.vinculum} label="Copy with overline" />
                  <CopyButton value={numeric.parens} label="Copy ASCII form" variant="ghost" />
                </>
              ) : undefined
            }
          >
            {!numeric ? (
              <EmptyState message="Type a number above to convert it." />
            ) : numeric.error ? (
              <Note tone="warning">{numeric.error}</Note>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-6 text-center">
                  <p className="text-xs font-medium text-muted-foreground">
                    {formatNumber(numeric.value, 0)} in Roman numerals
                  </p>
                  <p className="mt-3 font-mono text-3xl leading-tight font-bold break-all text-primary sm:text-5xl">
                    {numeric.parts.thousands && (
                      <span className="[text-decoration:overline]">{numeric.parts.thousands}</span>
                    )}
                    {numeric.parts.rest}
                  </p>
                  {numeric.parts.thousands && (
                    <p className="mt-3 font-mono text-sm text-muted-foreground">
                      ASCII form: {numeric.parens}
                    </p>
                  )}
                </div>

                <ScrollTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead className="text-right">Worth</TableHead>
                        <TableHead className="text-right">Running total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {numeric.steps.map((s, i) => {
                        const running = numeric.steps.slice(0, i + 1).reduce((a, x) => a + x.amount, 0)
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-mono font-medium">{s.glyph}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(s.amount, 0)}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatNumber(running, 0)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </ScrollTable>

                {numeric.parts.thousands && (
                  <Note>
                    The overlined block <span className="font-mono [text-decoration:overline]">{numeric.parts.thousands}</span>{' '}
                    is a <em>vinculum</em>: a bar over a numeral multiplies it by 1,000. Because plain text
                    often loses the bar, the same value is commonly written {numeric.parens} with
                    parentheses instead.
                  </Note>
                )}
              </div>
            )}
          </ToolPanel>
        </TabsContent>

        {/* ------------------------- TO NUMBER ------------------------- */}
        <TabsContent value="to-number" className="mt-6 space-y-6">
          <ToolPanel
            title="Convert a Roman numeral"
            description="Overlines and the (MMM) parenthesis convention are both understood."
          >
            <div className="space-y-1.5">
              <Label htmlFor="roman-text">Roman numeral</Label>
              <Input
                id="roman-text"
                value={romanInput}
                autoComplete="off"
                spellCheck={false}
                placeholder="MMXXVI"
                onChange={(e) => setRomanInput(e.target.value)}
                aria-invalid={parsed && !parsed.ok ? true : undefined}
                className="font-mono text-lg"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {['IV', 'IX', 'XL', 'XCIX', 'CDXLIV', 'MCMXCIX', 'MMXXVI', '(MMM)CMXCIX'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRomanInput(r)}
                  className="rounded-md bg-muted px-3 py-1 font-mono text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {r}
                </button>
              ))}
            </div>
          </ToolPanel>

          <ToolPanel
            title="Decimal value"
            footer={parsed?.ok ? <CopyButton value={String(parsed.value)} label="Copy the number" /> : undefined}
          >
            {!parsed ? (
              <EmptyState message="Type a Roman numeral above to read its value." />
            ) : !parsed.ok ? (
              <Note tone="warning">{parsed.message}</Note>
            ) : (
              <div className="space-y-4">
                <StatGrid>
                  <ResultStat label="Value" value={formatNumber(parsed.value, 0)} emphasis />
                  <ResultStat
                    label="Standard spelling"
                    value={<span className="font-mono">{withParens(toRomanParts(parsed.value))}</span>}
                    hint="Confirms the numeral you typed is in canonical form"
                  />
                </StatGrid>
                <Formula caption="Read left to right: a smaller symbol in front of a bigger one is subtracted.">
                  {breakdownOf(parsed.value)
                    .map((s) => `${s.glyph.padEnd(16)} = ${formatNumber(s.amount, 0)}`)
                    .concat(`${'total'.padEnd(16)} = ${formatNumber(parsed.value, 0)}`)
                    .join('\n')}
                </Formula>
              </div>
            )}
          </ToolPanel>
        </TabsContent>
      </Tabs>

      <ToolPanel title="The seven symbols">
        <ScrollTable>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">With a vinculum (×1,000)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BASIC.map((b) => (
                <TableRow key={b.symbol}>
                  <TableCell className="font-mono text-base font-semibold">{b.symbol}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(b.value, 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(b.value * 1000, 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollTable>
        <Breakdown
          rows={[
            { label: 'Subtractive pairs', value: 'IV = 4, IX = 9, XL = 40, XC = 90, CD = 400, CM = 900' },
            { label: 'Never repeated more than three times', value: 'I, X, C, M' },
            { label: 'Never repeated at all', value: 'V, L, D' },
          ]}
        />
      </ToolPanel>

      <ToolPanel title="Reference chart" description="The values worth memorising.">
        <ScrollTable className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Roman numeral</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CHART_ROWS.map((n) => {
                const parts = toRomanParts(n)
                return (
                  <TableRow key={n}>
                    <TableCell className="tabular-nums">{formatNumber(n, 0)}</TableCell>
                    <TableCell className="font-mono">
                      {parts.thousands && <span className="[text-decoration:overline]">{parts.thousands}</span>}
                      {parts.rest}
                      {parts.thousands && (
                        <span className="ml-2 text-xs text-muted-foreground">({withParens(parts)})</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollTable>
      </ToolPanel>
    </div>
  )
}
