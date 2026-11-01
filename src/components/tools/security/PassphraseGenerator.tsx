import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { Formula } from '@/components/shared/Formula'
import {
  CrackTimeTable,
  Field,
  PrivacyNotice,
  SecretCopyButton,
  SecretOutput,
  Segmented,
  StrengthMeter,
  ToggleRow,
  ValueList,
} from './SecurityUi'
import { bandForBits, randomInt } from './seclib'
import { PASSPHRASE_WORDS } from './wordlists'
import { clamp, downloadBlob, formatNumber } from '@/lib/utils'

const BITS_PER_WORD = Math.log2(PASSPHRASE_WORDS.length)
const NUMBER_CHARS = '0123456789'
const SYMBOL_CHARS = '!@#$%&*?+-='

const MIN_WORDS = 3
const MAX_WORDS = 12
const MAX_COUNT = 50

type SeparatorId = 'hyphen' | 'space' | 'dot' | 'underscore' | 'none' | 'custom'

const SEPARATORS: { value: SeparatorId; label: string; char: string }[] = [
  { value: 'hyphen', label: '-', char: '-' },
  { value: 'space', label: 'space', char: ' ' },
  { value: 'dot', label: '.', char: '.' },
  { value: 'underscore', label: '_', char: '_' },
  { value: 'none', label: 'none', char: '' },
  { value: 'custom', label: 'custom', char: '' },
]

type CaseId = 'lower' | 'title' | 'upper'

const CASES: { value: CaseId; label: string; title: string }[] = [
  { value: 'lower', label: 'lowercase', title: 'correct horse battery' },
  { value: 'title', label: 'Capitalised', title: 'Correct Horse Battery' },
  { value: 'upper', label: 'UPPERCASE', title: 'CORRECT HORSE BATTERY' },
]

function applyCase(word: string, mode: CaseId): string {
  if (mode === 'upper') return word.toUpperCase()
  if (mode === 'title') return word.charAt(0).toUpperCase() + word.slice(1)
  return word
}

interface PassphraseOptions {
  wordCount: number
  separator: string
  caseMode: CaseId
  addNumber: boolean
  addSymbol: boolean
}

function generatePassphrase(options: PassphraseOptions): string {
  const parts: string[] = []
  for (let i = 0; i < options.wordCount; i += 1) {
    parts.push(applyCase(PASSPHRASE_WORDS[randomInt(PASSPHRASE_WORDS.length)], options.caseMode))
  }
  if (options.addNumber) {
    const index = randomInt(parts.length)
    parts[index] += NUMBER_CHARS[randomInt(NUMBER_CHARS.length)]
  }
  if (options.addSymbol) {
    const index = randomInt(parts.length)
    parts[index] += SYMBOL_CHARS[randomInt(SYMBOL_CHARS.length)]
  }
  return parts.join(options.separator)
}

/**
 * Entropy is exact here because every choice is an independent uniform draw:
 * the words, then (optionally) which word gets the digit and which digit it is,
 * then the same again for the symbol. Capitalisation adds nothing — it is a
 * fixed rule an attacker knows, not a random choice.
 */
function entropyFor(options: PassphraseOptions): number {
  let bits = BITS_PER_WORD * options.wordCount
  if (options.addNumber) bits += Math.log2(NUMBER_CHARS.length * options.wordCount)
  if (options.addSymbol) bits += Math.log2(SYMBOL_CHARS.length * options.wordCount)
  return bits
}

export default function PassphraseGenerator() {
  const [wordCount, setWordCount] = useState(5)
  const [separatorId, setSeparatorId] = useState<SeparatorId>('hyphen')
  const [customSeparator, setCustomSeparator] = useState('+')
  const [caseMode, setCaseMode] = useState<CaseId>('lower')
  const [addNumber, setAddNumber] = useState(false)
  const [addSymbol, setAddSymbol] = useState(false)
  const [count, setCount] = useState(1)
  const [phrases, setPhrases] = useState<string[]>([])
  const [seed, setSeed] = useState(0)

  const separator = useMemo(() => {
    if (separatorId === 'custom') return customSeparator
    return SEPARATORS.find((entry) => entry.value === separatorId)?.char ?? '-'
  }, [customSeparator, separatorId])

  const options = useMemo<PassphraseOptions>(
    () => ({ wordCount, separator, caseMode, addNumber, addSymbol }),
    [addNumber, addSymbol, caseMode, separator, wordCount],
  )

  useEffect(() => {
    const next: string[] = []
    for (let i = 0; i < count; i += 1) next.push(generatePassphrase(options))
    setPhrases(next)
  }, [count, options, seed])

  const bits = entropyFor(options)
  const band = bandForBits(bits)
  const primary = phrases[0] ?? ''
  const allText = phrases.join('\n')

  const downloadWordlist = useCallback(() => {
    downloadBlob(
      new Blob([`${PASSPHRASE_WORDS.join('\n')}\n`], { type: 'text/plain;charset=utf-8' }),
      'onthisdevice-wordlist-1024.txt',
    )
  }, [])

  const extras: string[] = []
  if (addNumber) extras.push(`log2(10 × ${wordCount})`)
  if (addSymbol) extras.push(`log2(${SYMBOL_CHARS.length} × ${wordCount})`)

  return (
    <div className="flex flex-col gap-6">
      <PrivacyNotice>
        The 1 024-word list is in the page, and your browser’s{' '}
        <code className="font-mono text-[0.85em]">crypto.getRandomValues</code> picks the words. The
        passphrase is not sent, logged or stored.
      </PrivacyNotice>

      <ToolPanel
        title="Your passphrase"
        description="Diceware-style: several unrelated words, chosen uniformly at random, easy to type and remember."
      >
        <SecretOutput
          value={primary}
          ariaLabel="Generated passphrase"
          actions={
            <>
              <SecretCopyButton
                value={primary}
                label="Copy passphrase"
                variant="default"
                size="default"
              />
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setSeed((previous) => previous + 1)}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Regenerate
              </Button>
            </>
          }
        />
        <div aria-live="polite">
          <StrengthMeter bits={bits} band={band} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <ResultStat label="Entropy" value={`${formatNumber(bits, 1)} bits`} emphasis />
          <ResultStat label="Word list size" value={formatNumber(PASSPHRASE_WORDS.length, 0)} hint="exactly 2¹⁰ words" />
          <ResultStat label="Bits per word" value={BITS_PER_WORD.toFixed(2)} hint="log2 of the list size" />
        </div>

        <Formula
          caption="Every word is an independent uniform draw, so the bits add up. Capitalisation adds no bits, because it is a rule and has no random choice."
        >
          {`${BITS_PER_WORD.toFixed(2)} bits/word × ${wordCount} words${extras.length > 0 ? ` + ${extras.join(' + ')}` : ''} = ${bits.toFixed(2)} bits`}
        </Formula>
      </ToolPanel>

      <ToolPanel title="Options">
        <Field
          label={`Words: ${wordCount}`}
          hint="Four words is the usual minimum; six or more if it protects a password manager, a disk or a backup."
        >
          <Slider
            min={MIN_WORDS}
            max={MAX_WORDS}
            step={1}
            value={[wordCount]}
            onValueChange={(value) => setWordCount(clamp(value[0] ?? 5, MIN_WORDS, MAX_WORDS))}
            aria-label="Number of words"
          />
        </Field>

        <Field label="Separator">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Segmented
              label="Separator"
              value={separatorId}
              options={SEPARATORS.map((entry) => ({ value: entry.value, label: entry.label }))}
              onChange={setSeparatorId}
              className="sm:flex-1"
            />
            {separatorId === 'custom' && (
              <Input
                id="passphrase-separator"
                value={customSeparator}
                maxLength={4}
                aria-label="Custom separator"
                onChange={(event) => setCustomSeparator(event.target.value)}
                className="w-full font-mono sm:w-24"
              />
            )}
          </div>
        </Field>

        <Field label="Capitalisation">
          <Segmented
            label="Capitalisation"
            value={caseMode}
            options={CASES}
            onChange={setCaseMode}
          />
        </Field>

        <div className="grid gap-2">
          <ToggleRow
            label="Add a digit"
            description={`Appends one random digit to one random word. Worth ${Math.log2(10 * wordCount).toFixed(1)} bits, and satisfies “must contain a number” rules.`}
            checked={addNumber}
            onCheckedChange={setAddNumber}
          />
          <ToggleRow
            label="Add a symbol"
            description={`Appends one character from ${SYMBOL_CHARS} to one random word. Worth ${Math.log2(SYMBOL_CHARS.length * wordCount).toFixed(1)} bits.`}
            checked={addSymbol}
            onCheckedChange={setAddSymbol}
          />
        </div>

        <Field
          label="How many to generate"
          htmlFor="passphrase-count"
          hint={`Up to ${MAX_COUNT} at once.`}
        >
          <Input
            id="passphrase-count"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_COUNT}
            value={count}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10)
              setCount(Number.isFinite(parsed) ? clamp(parsed, 1, MAX_COUNT) : 1)
            }}
            className="w-28 tabular-nums"
          />
        </Field>
      </ToolPanel>

      {phrases.length > 1 && (
        <ToolPanel
          title={`${phrases.length} passphrases`}
          footer={
            <SecretCopyButton
              value={allText}
              label="Copy all"
              variant="default"
              size="default"
              autoClear={false}
            />
          }
        >
          <ValueList values={phrases} ariaLabel="Generated passphrases" />
        </ToolPanel>
      )}

      <ToolPanel
        title="How long would this take to crack?"
        description="Assumes that the attacker knows the word list, the word count and the separator. This is the correct assumption."
        footer={
          <Button type="button" variant="outline" className="gap-2" onClick={downloadWordlist}>
            <Download className="size-4" aria-hidden="true" />
            Download the word list
          </Button>
        }
      >
        <CrackTimeTable bits={bits} />
        <p className="text-xs text-pretty text-muted-foreground">
          Kerckhoffs’s principle: the security comes from the randomness of the choice, not from
          keeping the list secret. That is why the whole list is downloadable: you can verify it
          has 1 024 entries and that each word therefore carries exactly 10 bits.
        </p>
      </ToolPanel>
    </div>
  )
}
