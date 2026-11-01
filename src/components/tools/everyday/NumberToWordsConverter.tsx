import { useMemo, useState } from 'react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, Note, ScrollTable, Segmented, StatGrid } from './common'
import {
  CURRENCY_WORDS,
  cardinalToOrdinalWords,
  fractionToWords,
  groupThousands,
  integerToWords,
  numericOrdinal,
  splitNumber,
  twoDigitWords,
  wordsToNumber,
  type ScaleSystem,
} from './number-words'

function sentenceCase(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1)
}

function titleCase(text: string): string {
  return text.replace(/(^|[\s-])([a-z])/g, (_, lead: string, ch: string) => lead + ch.toUpperCase())
}

const EXAMPLES = [1, 12, 21, 100, 101, 999, 1000, 1200.5, 45678, 1000000, 123456789, 1234567890123]

export default function NumberToWordsConverter() {
  const [tab, setTab] = useState('to-words')
  const [input, setInput] = useState('1200.50')
  const [useAnd, setUseAnd] = useState(false)
  const [system, setSystem] = useState<ScaleSystem>('short')
  const [caseStyle, setCaseStyle] = useState<'lower' | 'sentence' | 'title'>('lower')
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [chequeStyle, setChequeStyle] = useState(true)
  const [wordsInput, setWordsInput] = useState('two thousand and forty-six')

  const applyCase = (text: string): string =>
    caseStyle === 'sentence' ? sentenceCase(text) : caseStyle === 'title' ? titleCase(text) : text

  const forward = useMemo(() => {
    try {
      const parts = splitNumber(input)
      const cardinalCore = integerToWords(parts.integerDigits, { useAnd, system })
      const fractionWords = fractionToWords(parts.fractionDigits)
      const cardinal = [parts.negative ? 'minus' : '', cardinalCore, fractionWords]
        .filter(Boolean)
        .join(' ')
      const ordinal =
        parts.fractionDigits === ''
          ? [parts.negative ? 'minus' : '', cardinalToOrdinalWords(cardinalCore)].filter(Boolean).join(' ')
          : null

      const unit = CURRENCY_WORDS.find((c) => c.code === currencyCode) ?? CURRENCY_WORDS[0]
      const minorDigits = (parts.fractionDigits + '00').slice(0, 2)
      const minorValue = Number(minorDigits)
      const majorValue = parts.integerDigits
      const majorWord = majorValue === '1' ? unit.major : unit.majorPlural
      const minorWord = minorValue === 1 ? unit.minor : unit.minorPlural
      const currencyText = chequeStyle
        ? `${cardinalCore} ${majorWord} and ${minorDigits}/${unit.minorPerMajor}`
        : minorValue === 0
          ? `${cardinalCore} ${majorWord}`
          : `${cardinalCore} ${majorWord} and ${twoDigitWords(minorValue)} ${minorWord}`

      return {
        ok: true as const,
        parts,
        cardinal,
        ordinal,
        numericOrdinalText: parts.fractionDigits === '' ? numericOrdinal(parts.integerDigits) : null,
        currencyText: (parts.negative ? 'minus ' : '') + currencyText,
        grouped:
          (parts.negative ? '-' : '') +
          groupThousands(parts.integerDigits) +
          (parts.fractionDigits ? `.${parts.fractionDigits}` : ''),
      }
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : 'That number could not be converted.',
      }
    }
  }, [chequeStyle, currencyCode, input, system, useAnd])

  const reverse = useMemo(() => {
    if (wordsInput.trim() === '') return null
    try {
      const parsed = wordsToNumber(wordsInput)
      const digits = (parsed.negative ? '-' : '') + parsed.value + (parsed.fraction ? `.${parsed.fraction}` : '')
      return {
        ok: true as const,
        digits,
        grouped:
          (parsed.negative ? '-' : '') +
          groupThousands(parsed.value) +
          (parsed.fraction ? `.${parsed.fraction}` : ''),
      }
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : 'Those words could not be read as a number.',
      }
    }
  }, [wordsInput])

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="to-words">Number → words</TabsTrigger>
          <TabsTrigger value="to-number">Words → number</TabsTrigger>
        </TabsList>

        {/* --------------------------- FORWARD --------------------------- */}
        <TabsContent value="to-words" className="mt-6 space-y-6">
          <ToolPanel title="Number" description="Digits, an optional minus sign and an optional decimal point.">
            <div className="space-y-1.5">
              <Label htmlFor="ntw-input">Number to spell out</Label>
              <Input
                id="ntw-input"
                value={input}
                inputMode="decimal"
                autoComplete="off"
                placeholder="1200.50"
                onChange={(e) => setInput(e.target.value)}
                aria-invalid={forward.ok ? undefined : true}
                className="text-lg tabular-nums"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setInput(String(n))}
                  className="rounded-md bg-muted px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {n.toLocaleString('en-US')}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <span className="text-sm font-medium text-foreground">Number system</span>
                <Segmented
                  label="Number system"
                  value={system}
                  onChange={setSystem}
                  options={[
                    { value: 'short', label: 'Million / billion' },
                    { value: 'indian', label: 'Lakh / crore' },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-foreground">Capitalisation</span>
                <Segmented
                  label="Capitalisation"
                  value={caseStyle}
                  onChange={setCaseStyle}
                  options={[
                    { value: 'lower', label: 'lower' },
                    { value: 'sentence', label: 'Sentence' },
                    { value: 'title', label: 'Title' },
                  ]}
                />
              </div>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
              <div className="min-w-0">
                <Label htmlFor="use-and" className="text-sm font-medium">
                  British “and” (one hundred and five)
                </Label>
                <p className="mt-1 text-xs text-pretty text-muted-foreground">
                  Standard in UK, Irish, Australian and Indian English. American English usually omits
                  it.
                </p>
              </div>
              <Switch id="use-and" checked={useAnd} onCheckedChange={setUseAnd} aria-label="British and" />
            </div>
          </ToolPanel>

          {!forward.ok ? (
            <ToolPanel title="Result">
              <Note tone="warning">{forward.message}</Note>
            </ToolPanel>
          ) : (
            <>
              <ToolPanel
                title="In words"
                footer={<CopyButton value={applyCase(forward.cardinal)} label="Copy the words" />}
              >
                <div className="rounded-lg bg-muted p-5">
                  <p className="text-xs font-medium text-muted-foreground">Cardinal</p>
                  <p className="mt-2 text-xl leading-relaxed font-semibold text-pretty text-primary sm:text-2xl">
                    {applyCase(forward.cardinal)}
                  </p>
                </div>

                <StatGrid>
                  <ResultStat label="Digits" value={forward.grouped} />
                  {forward.numericOrdinalText && (
                    <ResultStat label="Ordinal (figures)" value={forward.numericOrdinalText} />
                  )}
                </StatGrid>

                {forward.ordinal && (
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      Ordinal
                    </p>
                    <p className="mt-1 text-base leading-relaxed text-pretty text-foreground">
                      {applyCase(forward.ordinal)}
                    </p>
                    <div className="mt-3">
                      <CopyButton value={applyCase(forward.ordinal)} label="Copy the ordinal" size="sm" variant="ghost" />
                    </div>
                  </div>
                )}
              </ToolPanel>

              <ToolPanel
                title="Cheque / currency wording"
                description="The line you write on the “amount in words” row of a cheque."
                footer={<CopyButton value={applyCase(forward.currencyText)} label="Copy for a cheque" />}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ntw-currency">Currency</Label>
                    <Select value={currencyCode} onValueChange={setCurrencyCode}>
                      <SelectTrigger id="ntw-currency" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCY_WORDS.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code} ({c.majorPlural} and {c.minorPlural})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
                    <div className="min-w-0">
                      <Label htmlFor="cheque-style" className="text-sm font-medium">
                        Use the xx/100 form
                      </Label>
                      <p className="mt-1 text-xs text-pretty text-muted-foreground">
                        Banks accept both. Turn it off to spell the cents out in words.
                      </p>
                    </div>
                    <Switch
                      id="cheque-style"
                      checked={chequeStyle}
                      onCheckedChange={setChequeStyle}
                      aria-label="Use the xx/100 form"
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-muted p-5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Amount in words
                  </p>
                  <p className="mt-2 text-lg leading-relaxed text-pretty text-foreground">
                    {applyCase(forward.currencyText)}
                  </p>
                </div>

                <Note>
                  Draw a line through the empty space after the wording so nothing can be added, and
                  make sure the words match the figures. Where they disagree, most jurisdictions have the
                  bank pay the amount in words.
                </Note>
              </ToolPanel>
            </>
          )}
        </TabsContent>

        {/* --------------------------- REVERSE --------------------------- */}
        <TabsContent value="to-number" className="mt-6 space-y-6">
          <ToolPanel
            title="Words"
            description="Understands hyphens, “and”, “point” for decimals, and lakh/crore as well as million/billion."
          >
            <div className="space-y-1.5">
              <Label htmlFor="wtn-input">Number in words</Label>
              <Textarea
                id="wtn-input"
                value={wordsInput}
                rows={3}
                spellCheck={false}
                placeholder="two thousand and forty-six"
                onChange={(e) => setWordsInput(e.target.value)}
                aria-invalid={reverse && !reverse.ok ? true : undefined}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                'forty-two',
                'one hundred and five',
                'three thousand four hundred and twenty',
                'two point five',
                'twelve million six hundred thousand',
                'five crore twenty lakh',
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setWordsInput(sample)}
                  className="rounded-md bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {sample}
                </button>
              ))}
            </div>
          </ToolPanel>

          <ToolPanel
            title="As digits"
            footer={reverse?.ok ? <CopyButton value={reverse.digits} label="Copy the number" /> : undefined}
          >
            {!reverse ? (
              <EmptyState message="Type or paste a number written in words." />
            ) : !reverse.ok ? (
              <Note tone="warning">{reverse.message}</Note>
            ) : (
              <StatGrid>
                <ResultStat label="Number" value={reverse.grouped} emphasis />
                <ResultStat label="Plain digits" value={reverse.digits} hint="Ready to paste into a spreadsheet" />
              </StatGrid>
            )}
          </ToolPanel>
        </TabsContent>
      </Tabs>

      <ToolPanel title="How the scale names line up" description="Short scale versus the Indian system.">
        <ScrollTable>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Digits</TableHead>
                <TableHead>Short scale (US / UK)</TableHead>
                <TableHead>Indian system</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ['1,000', 'one thousand', 'one thousand'],
                ['100,000', 'one hundred thousand', 'one lakh'],
                ['1,000,000', 'one million', 'ten lakh'],
                ['10,000,000', 'ten million', 'one crore'],
                ['1,000,000,000', 'one billion', 'one hundred crore / one arab'],
                ['1,000,000,000,000', 'one trillion', 'one lakh crore'],
              ].map((row) => (
                <TableRow key={row[0]}>
                  <TableCell className="tabular-nums">{row[0]}</TableCell>
                  <TableCell>{row[1]}</TableCell>
                  <TableCell>{row[2]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollTable>
      </ToolPanel>
    </div>
  )
}
