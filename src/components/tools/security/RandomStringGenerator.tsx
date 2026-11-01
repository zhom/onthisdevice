import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { Field, PrivacyNotice, SecretCopyButton, SecretOutput, ToggleRow, ValueList } from './SecurityUi'
import { entropyBits, randomInt } from './seclib'
import { clamp, downloadBlob, formatNumber } from '@/lib/utils'

type PresetId =
  | 'alphanumeric'
  | 'lower-alnum'
  | 'upper-alnum'
  | 'letters'
  | 'digits'
  | 'hex-lower'
  | 'hex-upper'
  | 'base64url'
  | 'strong'
  | 'custom'

interface Preset {
  id: PresetId
  label: string
  chars: string
  note: string
}

const PRESETS: Preset[] = [
  {
    id: 'alphanumeric',
    label: 'Alphanumeric (A–Z a–z 0–9)',
    chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    note: 'The safe default: survives URLs, filenames, shell arguments and spreadsheets untouched.',
  },
  {
    id: 'lower-alnum',
    label: 'Lowercase alphanumeric (a–z 0–9)',
    chars: 'abcdefghijklmnopqrstuvwxyz0123456789',
    note: 'Case-insensitive systems: DNS labels, some databases, coupon codes read over the phone.',
  },
  {
    id: 'upper-alnum',
    label: 'Uppercase alphanumeric (A–Z 0–9)',
    chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    note: 'Licence keys and vouchers, where uppercase is easier to transcribe.',
  },
  { id: 'letters', label: 'Letters only (A–Z a–z)', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', note: 'When digits would be mistaken for a quantity or an ID.' },
  { id: 'digits', label: 'Digits (0–9)', chars: '0123456789', note: 'Numeric codes. Ten symbols is only 3.32 bits per character, so use plenty of them.' },
  { id: 'hex-lower', label: 'Hex lowercase (0–9 a–f)', chars: '0123456789abcdef', note: 'Matches the output of hashing tools and most config formats. Four bits per character.' },
  { id: 'hex-upper', label: 'Hex uppercase (0–9 A–F)', chars: '0123456789ABCDEF', note: 'Same as hex lowercase, in the style used by Windows tooling and MAC addresses.' },
  {
    id: 'base64url',
    label: 'Base64URL (A–Z a–z 0–9 - _)',
    chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
    note: 'RFC 4648 §5 alphabet: exactly 6 bits per character and safe inside a URL path or query.',
  },
  {
    id: 'strong',
    label: 'Full printable ASCII (94 characters)',
    chars:
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
    note: 'Maximum density at 6.55 bits per character. Expect to quote it when used in shell scripts.',
  },
  { id: 'custom', label: 'Custom character set', chars: '', note: 'Type the exact alphabet you need. Duplicate characters are collapsed so the entropy stays honest.' },
]

const AMBIGUOUS = 'iIlL1|oO0'

const MIN_LENGTH = 1
const MAX_LENGTH = 256
const MAX_COUNT = 500

function dedupe(input: string): string {
  const seen = new Set<string>()
  let out = ''
  for (const char of input) {
    if (!seen.has(char)) {
      seen.add(char)
      out += char
    }
  }
  return out
}

export default function RandomStringGenerator() {
  const [presetId, setPresetId] = useState<PresetId>('alphanumeric')
  const [customChars, setCustomChars] = useState('abcdef0123456789')
  const [length, setLength] = useState(24)
  const [count, setCount] = useState(5)
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [noAmbiguous, setNoAmbiguous] = useState(false)
  const [uniqueOnly, setUniqueOnly] = useState(true)
  const [values, setValues] = useState<string[]>([])
  const [seed, setSeed] = useState(0)

  const preset = PRESETS.find((entry) => entry.id === presetId) ?? PRESETS[0]

  const charset = useMemo(() => {
    const base = dedupe(presetId === 'custom' ? customChars : preset.chars)
    if (!noAmbiguous) return base
    const banned = new Set(AMBIGUOUS)
    return [...base].filter((char) => !banned.has(char)).join('')
  }, [customChars, noAmbiguous, preset.chars, presetId])

  const error = useMemo(() => {
    if (charset.length === 0) {
      return 'The character set is empty. Add some characters, or turn off “Exclude ambiguous characters”.'
    }
    if (charset.length === 1) {
      return 'A single-character alphabet produces the same string every time. Add at least one more character.'
    }
    return null
  }, [charset.length])

  useEffect(() => {
    if (error) {
      setValues([])
      return
    }
    const produced: string[] = []
    const seen = new Set<string>()
    // With a small alphabet and a short length, "all unique" can be impossible;
    // the attempt budget stops that from becoming an infinite loop.
    const budget = count * 40 + 200
    let attempts = 0
    while (produced.length < count && attempts < budget) {
      attempts += 1
      let body = ''
      for (let i = 0; i < length; i += 1) body += charset[randomInt(charset.length)]
      const full = `${prefix}${body}${suffix}`
      if (uniqueOnly) {
        if (seen.has(full)) continue
        seen.add(full)
      }
      produced.push(full)
    }
    setValues(produced)
  }, [charset, count, error, length, prefix, seed, suffix, uniqueOnly])

  const bits = error ? 0 : entropyBits(charset.length, length)
  const allText = values.join('\n')
  const shortfall = !error && values.length < count

  const download = useCallback(() => {
    downloadBlob(
      new Blob([`${allText}\n`], { type: 'text/plain;charset=utf-8' }),
      'random-strings.txt',
    )
  }, [allText])

  return (
    <div className="flex flex-col gap-6">
      <PrivacyNotice>
        Strings are generated on your device. Every character comes from{' '}
        <code className="font-mono text-[0.85em]">crypto.getRandomValues</code> with rejection
        sampling, so each symbol in your alphabet is equally likely. There is no modulo bias and no{' '}
        <code className="font-mono text-[0.85em]">Math.random</code> in this page.
      </PrivacyNotice>

      <ToolPanel title="Options">
        <Field
          label="Character set"
          htmlFor="charset-preset"
          hint={preset.note}
        >
          <Select value={presetId} onValueChange={(value) => setPresetId(value as PresetId)}>
            <SelectTrigger id="charset-preset" className="w-full">
              <SelectValue placeholder="Choose a character set" />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {presetId === 'custom' && (
          <Field
            label="Your characters"
            htmlFor="custom-charset"
            hint="Every distinct character becomes one symbol in the alphabet. Order does not matter."
          >
            <Input
              id="custom-charset"
              value={customChars}
              onChange={(event) => setCustomChars(event.target.value)}
              placeholder="e.g. ABCDEFGHJKMNPQRSTUVWXYZ23456789"
              className="font-mono"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </Field>
        )}

        <div className="rounded-lg bg-muted px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            Effective alphabet: {charset.length} characters
          </p>
          <code className="mt-1 block font-mono text-xs break-all text-foreground">
            {charset || '–'}
          </code>
        </div>

        <Field label={`Length: ${length} characters`} htmlFor="string-length-value">
          <div className="flex items-center gap-4">
            <Slider
              min={MIN_LENGTH}
              max={MAX_LENGTH}
              step={1}
              value={[length]}
              onValueChange={(value) => setLength(clamp(value[0] ?? 24, MIN_LENGTH, MAX_LENGTH))}
              aria-label="String length"
              className="flex-1"
            />
            <Input
              id="string-length-value"
              type="number"
              inputMode="numeric"
              min={MIN_LENGTH}
              max={MAX_LENGTH}
              value={length}
              aria-label="String length in characters"
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10)
                if (Number.isFinite(parsed)) setLength(clamp(parsed, MIN_LENGTH, MAX_LENGTH))
              }}
              className="w-20 shrink-0 tabular-nums"
            />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="How many" htmlFor="string-count">
            <Input
              id="string-count"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_COUNT}
              value={count}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10)
                setCount(Number.isFinite(parsed) ? clamp(parsed, 1, MAX_COUNT) : 1)
              }}
              className="tabular-nums"
            />
          </Field>
          <Field label="Prefix" htmlFor="string-prefix" hint="Added before, not random.">
            <Input
              id="string-prefix"
              value={prefix}
              onChange={(event) => setPrefix(event.target.value)}
              placeholder="sk_live_"
              className="font-mono"
              autoCapitalize="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Suffix" htmlFor="string-suffix" hint="Added after, not random.">
            <Input
              id="string-suffix"
              value={suffix}
              onChange={(event) => setSuffix(event.target.value)}
              placeholder="_v2"
              className="font-mono"
              autoCapitalize="off"
              spellCheck={false}
            />
          </Field>
        </div>

        <div className="grid gap-2">
          <ToggleRow
            label="Exclude ambiguous characters"
            description={`Drops ${AMBIGUOUS.split('').join(' ')} so the string can be read off a screen or dictated without mistakes. It shrinks the alphabet, so the entropy figure updates too.`}
            checked={noAmbiguous}
            onCheckedChange={setNoAmbiguous}
          />
          <ToggleRow
            label="No duplicates in the batch"
            description="Discards a string if it repeats one already generated. Only matters for short strings over a small alphabet."
            checked={uniqueOnly}
            onCheckedChange={setUniqueOnly}
          />
        </div>
      </ToolPanel>

      {error ? (
        <ErrorNote title="Nothing to generate from" message={error} />
      ) : (
        <ToolPanel
          title={values.length === 1 ? 'Your random string' : `${values.length} random strings`}
          footer={
            <>
              <SecretCopyButton
                value={allText}
                label={values.length === 1 ? 'Copy' : 'Copy all'}
                variant="default"
                size="default"
                autoClear={false}
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
              <Button type="button" variant="outline" className="gap-2" onClick={download}>
                <Download className="size-4" aria-hidden="true" />
                Download .txt
              </Button>
            </>
          }
        >
          {values.length === 1 ? (
            <SecretOutput value={values[0]} ariaLabel="Generated random string" />
          ) : (
            <ValueList values={values} ariaLabel="Generated random strings" />
          )}

          {shortfall && (
            <p role="status" className="text-sm text-foreground">
              Only {values.length} unique strings were possible with this alphabet and length. Make
              the strings longer, widen the alphabet, or turn off “No duplicates in the batch”.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Entropy per string" value={`${formatNumber(bits, 1)} bits`} emphasis />
            <ResultStat
              label="Alphabet"
              value={charset.length}
              hint={`${formatNumber(Math.log2(charset.length), 2)} bits per character`}
            />
            <ResultStat
              label="Random part"
              value={`${length} chars`}
              hint={prefix || suffix ? 'the prefix and suffix add no entropy' : 'the whole string'}
            />
          </div>
        </ToolPanel>
      )}
    </div>
  )
}
