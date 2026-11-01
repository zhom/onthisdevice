import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Info, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CrackTimeTable, Field, PrivacyNotice, SecretCopyButton, SecretOutput, StrengthMeter, ToggleRow, ValueList } from './SecurityUi'
import { bandForBits, randomInt, randomItem, shuffle } from './seclib'
import { clamp, downloadBlob, formatNumber } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Character classes                                                   */
/* ------------------------------------------------------------------ */

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{}<>?/|~;:,.'

/** Glyphs that look alike in most UI fonts: capital i, lowercase L, one, pipe… */
const SIMILAR_CHARS = 'iIlL1|oO0'
/** Punctuation that is awkward to read aloud, quote in a shell or paste into a CSV. */
const AMBIGUOUS_CHARS = '{}[]()<>/|~;:,.\''

type ClassId = 'lowercase' | 'uppercase' | 'digits' | 'symbols'

interface CharClass {
  id: ClassId
  label: string
  chars: string
  hint: string
}

const CHAR_CLASSES: CharClass[] = [
  { id: 'lowercase', label: 'Lowercase', chars: LOWERCASE, hint: 'a–z' },
  { id: 'uppercase', label: 'Uppercase', chars: UPPERCASE, hint: 'A–Z' },
  { id: 'digits', label: 'Digits', chars: DIGITS, hint: '0–9' },
  { id: 'symbols', label: 'Symbols', chars: SYMBOLS, hint: SYMBOLS },
]

const MIN_LENGTH = 4
const MAX_LENGTH = 128
const MAX_COUNT = 100
/** Rejection sampling gives an exactly uniform result; this cap is a safety net. */
const MAX_REJECTION_ATTEMPTS = 20_000

function subtract(source: string, remove: string): string {
  const banned = new Set(remove)
  return [...source].filter((char) => !banned.has(char)).join('')
}

interface PoolSetup {
  pools: { id: ClassId; chars: string }[]
  combined: string
}

function buildPools(
  enabled: Record<ClassId, boolean>,
  excludeSimilar: boolean,
  excludeAmbiguous: boolean,
): PoolSetup {
  const pools: { id: ClassId; chars: string }[] = []
  for (const charClass of CHAR_CLASSES) {
    if (!enabled[charClass.id]) continue
    let chars = charClass.chars
    if (excludeSimilar) chars = subtract(chars, SIMILAR_CHARS)
    if (excludeAmbiguous) chars = subtract(chars, AMBIGUOUS_CHARS)
    if (chars.length > 0) pools.push({ id: charClass.id, chars })
  }
  return { pools, combined: pools.map((pool) => pool.chars).join('') }
}

function randomString(pool: string, length: number): string {
  let out = ''
  for (let i = 0; i < length; i += 1) out += pool[randomInt(pool.length)]
  return out
}

function hasEveryClass(candidate: string, memberships: Set<string>[]): boolean {
  return memberships.every((members) => {
    for (const char of candidate) if (members.has(char)) return true
    return false
  })
}

/**
 * Generates one password.
 *
 * Without "one of each", every character is an independent uniform draw.
 *
 * With it, the password is drawn uniformly from the *subset* of strings that
 * contain all the selected classes, using rejection sampling — that keeps the
 * distribution exactly uniform, so the entropy figure below is exact. The
 * classic "place one of each, then shuffle" trick is used only as a fallback,
 * with an unbiased Fisher-Yates shuffle (`shuffle` draws its indices from
 * crypto.getRandomValues with rejection, never `Math.random`).
 */
function generatePassword(setup: PoolSetup, length: number, requireEach: boolean): string {
  const { pools, combined } = setup
  if (!requireEach || pools.length <= 1) return randomString(combined, length)

  const memberships = pools.map((pool) => new Set(pool.chars))
  for (let attempt = 0; attempt < MAX_REJECTION_ATTEMPTS; attempt += 1) {
    const candidate = randomString(combined, length)
    if (hasEveryClass(candidate, memberships)) return candidate
  }

  const chars = pools.map((pool) => randomItem([...pool.chars]))
  for (let i = chars.length; i < length; i += 1) chars.push(combined[randomInt(combined.length)])
  return shuffle(chars).join('')
}

/**
 * Exact entropy for the "one of each" case.
 *
 * The number of valid strings follows from inclusion-exclusion over the class
 * subsets that are *missing*. Working with the ratio to P^L instead of the raw
 * counts keeps every term in [0, 1], so no precision is lost for long passwords.
 */
function entropyForSetup(setup: PoolSetup, length: number, requireEach: boolean): number {
  const poolSize = setup.combined.length
  if (poolSize <= 1 || length <= 0) return 0
  const base = Math.log2(poolSize) * length
  if (!requireEach || setup.pools.length <= 1) return base

  const sizes = setup.pools.map((pool) => pool.chars.length)
  let ratio = 0
  for (let mask = 0; mask < 1 << sizes.length; mask += 1) {
    let removed = 0
    let bits = 0
    for (let i = 0; i < sizes.length; i += 1) {
      if (mask & (1 << i)) {
        removed += sizes[i]
        bits += 1
      }
    }
    const remaining = poolSize - removed
    if (remaining <= 0) continue
    ratio += (bits % 2 === 0 ? 1 : -1) * (remaining / poolSize) ** length
  }
  if (ratio <= 0) return 0
  return base + Math.log2(ratio)
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function PasswordGenerator() {
  const [length, setLength] = useState(20)
  const [count, setCount] = useState(1)
  const [enabled, setEnabled] = useState<Record<ClassId, boolean>>({
    lowercase: true,
    uppercase: true,
    digits: true,
    symbols: true,
  })
  const [excludeSimilar, setExcludeSimilar] = useState(false)
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false)
  const [requireEach, setRequireEach] = useState(true)
  const [passwords, setPasswords] = useState<string[]>([])
  const [seed, setSeed] = useState(0)

  const setup = useMemo(
    () => buildPools(enabled, excludeSimilar, excludeAmbiguous),
    [enabled, excludeAmbiguous, excludeSimilar],
  )

  const error = useMemo(() => {
    if (setup.pools.length === 0) {
      return 'Turn on at least one character type. With everything excluded there is nothing to build a password from.'
    }
    if (requireEach && length < setup.pools.length) {
      return `A password of ${length} characters cannot contain one of each of the ${setup.pools.length} selected types. Increase the length or turn off “Include one of each type”.`
    }
    return null
  }, [length, requireEach, setup.pools.length])

  // Generated after mount only: the server has no business producing your secret,
  // and it keeps the markup identical on both sides of hydration.
  useEffect(() => {
    if (error) {
      setPasswords([])
      return
    }
    const next: string[] = []
    for (let i = 0; i < count; i += 1) next.push(generatePassword(setup, length, requireEach))
    setPasswords(next)
  }, [count, error, length, requireEach, seed, setup])

  const bits = useMemo(
    () => (error ? 0 : entropyForSetup(setup, length, requireEach)),
    [error, length, requireEach, setup],
  )
  const band = bandForBits(bits)
  const primary = passwords[0] ?? ''
  const allText = passwords.join('\n')

  const toggleClass = useCallback((id: ClassId) => {
    setEnabled((previous) => ({ ...previous, [id]: !previous[id] }))
  }, [])

  const regenerate = useCallback(() => setSeed((previous) => previous + 1), [])

  return (
    <div className="flex flex-col gap-6">
      <PrivacyNotice>
        Every password comes from your browser’s own <code className="font-mono text-[0.85em]">crypto.getRandomValues</code>{' '}
        generator. It is not written to the URL, local storage or your browser history, and this
        page makes no network requests after it loads.
      </PrivacyNotice>

      <ToolPanel
        title="Your password"
        description={
          count > 1
            ? `Showing the first of ${count} generated passwords.`
            : 'Each new password is independent of the last.'
        }
      >
        {error ? (
          <ErrorNote title="Check the options" message={error} />
        ) : (
          <>
            <SecretOutput
              value={primary}
              ariaLabel="Generated password"
              actions={
                <>
                  <SecretCopyButton value={primary} label="Copy password" variant="default" size="default" />
                  <Button type="button" variant="outline" onClick={regenerate} className="gap-2">
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Regenerate
                  </Button>
                </>
              }
            />
            <div aria-live="polite">
              <StrengthMeter bits={bits} band={band} />
            </div>
            <p className="text-xs text-muted-foreground">
              Pool of {setup.combined.length} characters × {length} positions ={' '}
              {formatNumber(bits, 1)} bits. Copying uses the clipboard only, and the clipboard is
              overwritten again after 45 seconds.
            </p>
          </>
        )}
      </ToolPanel>

      <ToolPanel title="Options">
        <Field
          label={`Length: ${length} characters`}
          htmlFor="password-length-value"
          hint={`Anything from ${MIN_LENGTH} to ${MAX_LENGTH}. Sixteen or more is the sensible floor for an account you care about.`}
        >
          <div className="flex items-center gap-4">
            <Slider
              min={MIN_LENGTH}
              max={MAX_LENGTH}
              step={1}
              value={[length]}
              onValueChange={(value) => setLength(clamp(value[0] ?? 20, MIN_LENGTH, MAX_LENGTH))}
              aria-label="Password length"
              className="flex-1"
            />
            <Input
              id="password-length-value"
              type="number"
              inputMode="numeric"
              min={MIN_LENGTH}
              max={MAX_LENGTH}
              value={length}
              aria-label="Password length in characters"
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10)
                if (Number.isFinite(parsed)) setLength(clamp(parsed, MIN_LENGTH, MAX_LENGTH))
              }}
              className="w-20 shrink-0 tabular-nums"
            />
          </div>
        </Field>

        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-medium text-foreground">Character types</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHAR_CLASSES.map((charClass) => {
              const active = enabled[charClass.id]
              const pool = setup.pools.find((entry) => entry.id === charClass.id)
              return (
                <button
                  key={charClass.id}
                  type="button"
                  role="switch"
                  aria-checked={active}
                  onClick={() => toggleClass(charClass.id)}
                  className={
                    'flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:outline-none ' +
                    (active
                      ? 'ring-2 ring-foreground'
                      : 'hover:bg-muted')
                  }
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {charClass.label}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {charClass.hint}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                    {active ? `${pool?.chars.length ?? 0} chars` : 'Off'}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="grid gap-2">
          <ToggleRow
            label="Include one of each type"
            description="Guarantees the password satisfies “must contain a digit and a symbol” rules. The password is drawn uniformly from the strings that qualify, so the entropy shown above stays exact."
            checked={requireEach}
            onCheckedChange={setRequireEach}
          />
          <ToggleRow
            label="Exclude similar characters"
            description={`Drops ${SIMILAR_CHARS.split('').join(' ')}. Use this when the password will be read off a screen or written down.`}
            checked={excludeSimilar}
            onCheckedChange={setExcludeSimilar}
          />
          <ToggleRow
            label="Exclude ambiguous punctuation"
            description={`Drops ${AMBIGUOUS_CHARS.split('').join(' ')}: brackets and quotes that break shell commands, CSV files and some legacy login forms.`}
            checked={excludeAmbiguous}
            onCheckedChange={setExcludeAmbiguous}
          />
        </div>

        <Field
          label="How many to generate"
          htmlFor="password-count"
          hint={`Up to ${MAX_COUNT} at once, for seeding a set of service accounts or a team.`}
        >
          <Input
            id="password-count"
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

      {passwords.length > 1 && (
        <ToolPanel
          title={`${passwords.length} passwords`}
          description="Each one is generated independently, with no shared seed or counter between them."
          footer={
            <>
              <SecretCopyButton
                value={allText}
                label="Copy all"
                variant="default"
                size="default"
                autoClear={false}
              />
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() =>
                  downloadBlob(
                    new Blob([`${allText}\n`], { type: 'text/plain;charset=utf-8' }),
                    'passwords.txt',
                  )
                }
              >
                <Download className="size-4" aria-hidden="true" />
                Download .txt
              </Button>
            </>
          }
        >
          <ValueList values={passwords} ariaLabel="Generated passwords" />
        </ToolPanel>
      )}

      {!error && (
        <ToolPanel
          title="How long would this take to crack?"
          description="Assuming the attacker knows exactly which options you chose, and has to search the whole space."
        >
          <CrackTimeTable bits={bits} />
          <p className="text-xs text-pretty text-muted-foreground">
            <Info className="mr-1 inline size-3 align-[-0.1em]" aria-hidden="true" />
            These figures describe brute force only. A password that leaks (through a phishing
            page, a keylogger or reuse on a breached site) is compromised no matter how many bits
            it has.
          </p>
        </ToolPanel>
      )}
    </div>
  )
}
