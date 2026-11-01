import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ErrorNote } from '@/components/shared/ErrorNote'
import {
  CrackTimeTable,
  Field,
  PrivacyNotice,
  SecretCopyButton,
  SecretOutput,
  StrengthMeter,
  ToggleRow,
  ValueList,
} from './SecurityUi'
import { bandForBits, randomInt } from './seclib'
import { clamp, downloadBlob, formatNumber } from '@/lib/utils'

const MIN_DIGITS = 4
const MAX_DIGITS = 12
const MAX_COUNT = 200

/** The PINs that top every study of real card and phone unlock codes. */
const NOTORIOUS_PINS = new Set([
  '1234', '1111', '0000', '1212', '7777', '1004', '2000', '4444', '2222', '6969',
  '9999', '3333', '5555', '6666', '1122', '1313', '8888', '4321', '2001', '1010',
  '1230', '1998', '1999', '2020', '2010', '1984', '0007', '1379', '2580', '1595',
])

interface WeakRule {
  id: string
  name: string
  applies: (pin: string) => boolean
  detail: string
}

function isRun(pin: string): boolean {
  if (pin.length < 3) return false
  const delta = pin.charCodeAt(1) - pin.charCodeAt(0)
  if (delta !== 1 && delta !== -1) return false
  for (let i = 2; i < pin.length; i += 1) {
    if (pin.charCodeAt(i) - pin.charCodeAt(i - 1) !== delta) return false
  }
  return true
}

function isValidMonthDay(month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const lengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= lengths[month - 1]
}

const WEAK_RULES: WeakRule[] = [
  {
    id: 'same',
    name: 'One digit repeated',
    applies: (pin) => /^(\d)\1*$/.test(pin),
    detail: '0000, 1111, 8888: ten possibilities in total, and always tried first.',
  },
  {
    id: 'run',
    name: 'Straight run',
    applies: isRun,
    detail: '1234, 4321, 6789: a keypad walk in either direction.',
  },
  {
    id: 'block',
    name: 'Repeated block',
    applies: (pin) => /^(\d+?)\1+$/.test(pin),
    detail: '1212, 123123, 112112: the attacker guesses the block, then the length.',
  },
  {
    id: 'palindrome',
    name: 'Palindrome',
    applies: (pin) => pin === [...pin].reverse().join(''),
    detail: '1221, 45654: memorable, and a tenth of the search space of a random PIN.',
  },
  {
    id: 'notorious',
    name: 'Known common PIN',
    applies: (pin) => NOTORIOUS_PINS.has(pin),
    detail: 'The thirty four-digit codes that dominate every leaked PIN dataset.',
  },
  {
    id: 'year',
    name: 'Looks like a year',
    applies: (pin) => pin.length === 4 && /^(?:19|20)\d{2}$/.test(pin),
    detail: 'Birth and graduation years cover 1900–2099: 200 of the 10 000 four-digit codes.',
  },
  {
    id: 'date4',
    name: 'Looks like a day and month',
    applies: (pin) => {
      if (pin.length !== 4) return false
      const a = Number(pin.slice(0, 2))
      const b = Number(pin.slice(2))
      return isValidMonthDay(a, b) || isValidMonthDay(b, a)
    },
    detail: 'DDMM and MMDD birthdays. Roughly 700 codes, and the first thing a thief tries.',
  },
  {
    id: 'date6',
    name: 'Looks like a six-digit date',
    applies: (pin) => {
      if (pin.length !== 6) return false
      const first = Number(pin.slice(0, 2))
      const second = Number(pin.slice(2, 4))
      const last = Number(pin.slice(4))
      // DDMMYY, MMDDYY and YYMMDD respectively.
      return (
        isValidMonthDay(second, first) ||
        isValidMonthDay(first, second) ||
        isValidMonthDay(second, last)
      )
    },
    detail: 'DDMMYY, MMDDYY and YYMMDD patterns, which is how most people pick a six-digit code.',
  },
  {
    id: 'date8',
    name: 'Looks like a full date',
    applies: (pin) => {
      if (pin.length !== 8) return false
      if (/^(?:19|20)\d{2}$/.test(pin.slice(0, 4))) {
        return isValidMonthDay(Number(pin.slice(4, 6)), Number(pin.slice(6)))
      }
      if (/^(?:19|20)\d{2}$/.test(pin.slice(4))) {
        const a = Number(pin.slice(0, 2))
        const b = Number(pin.slice(2, 4))
        return isValidMonthDay(a, b) || isValidMonthDay(b, a)
      }
      return false
    },
    detail: 'DDMMYYYY and YYYYMMDD. An eight-digit birthday has under 40 000 possibilities.',
  },
]

function isWeak(pin: string): boolean {
  return WEAK_RULES.some((rule) => rule.applies(pin))
}

function randomPin(digits: number): string {
  let out = ''
  for (let i = 0; i < digits; i += 1) out += String(randomInt(10))
  return out
}

/** Exact for short PINs, sampled for long ones — labelled either way in the UI. */
function acceptedFraction(digits: number): { fraction: number; exact: boolean } {
  const total = 10 ** digits
  // 10 000 codes is instant; beyond that, enumeration would block the render.
  if (digits <= 4) {
    let allowed = 0
    for (let i = 0; i < total; i += 1) {
      if (!isWeak(String(i).padStart(digits, '0'))) allowed += 1
    }
    return { fraction: allowed / total, exact: true }
  }
  const samples = 30_000
  let allowed = 0
  for (let i = 0; i < samples; i += 1) {
    if (!isWeak(randomPin(digits))) allowed += 1
  }
  return { fraction: allowed / samples, exact: false }
}

export default function PinGenerator() {
  const [digits, setDigits] = useState(4)
  const [count, setCount] = useState(1)
  const [avoidWeak, setAvoidWeak] = useState(true)
  const [pins, setPins] = useState<string[]>([])
  const [seed, setSeed] = useState(0)
  const [exhausted, setExhausted] = useState(false)

  const space = useMemo(() => acceptedFraction(digits), [digits])

  useEffect(() => {
    const produced: string[] = []
    let ranOut = false
    for (let i = 0; i < count; i += 1) {
      let pin = randomPin(digits)
      if (avoidWeak) {
        let attempts = 0
        while (isWeak(pin) && attempts < 5000) {
          pin = randomPin(digits)
          attempts += 1
        }
        if (attempts >= 5000) ranOut = true
      }
      produced.push(pin)
    }
    setExhausted(ranOut)
    setPins(produced)
  }, [avoidWeak, count, digits, seed])

  const combinations = avoidWeak ? 10 ** digits * space.fraction : 10 ** digits
  const bits = combinations > 1 ? Math.log2(combinations) : 0
  const band = bandForBits(bits)
  const primary = pins[0] ?? ''
  const allText = pins.join('\n')
  const applicableRules = WEAK_RULES.filter((rule) => {
    if (rule.id === 'year' || rule.id === 'date4' || rule.id === 'notorious') return digits === 4
    if (rule.id === 'date6') return digits === 6
    if (rule.id === 'date8') return digits === 8
    return true
  })

  return (
    <div className="flex flex-col gap-6">
      <PrivacyNotice>
        Your PIN is generated in this tab. The digits come from your browser’s{' '}
        <code className="font-mono text-[0.85em]">crypto.getRandomValues</code>, not from{' '}
        <code className="font-mono text-[0.85em]">Math.random</code>, and are never sent to a server,
        written to storage or added to your browser history.
      </PrivacyNotice>

      <ToolPanel
        title={pins.length === 1 ? 'Your PIN' : `${pins.length} PINs`}
        description="Rejection sampling is used for the weak-pattern filter, so every remaining code is still exactly as likely as any other."
      >
        {pins.length === 1 ? (
          <SecretOutput
            value={primary}
            ariaLabel="Generated PIN"
            actions={
              <>
                <SecretCopyButton value={primary} label="Copy PIN" variant="default" size="default" />
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
        ) : (
          <>
            <ValueList values={pins} ariaLabel="Generated PINs" />
            <div className="flex flex-wrap gap-2">
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
                onClick={() => setSeed((previous) => previous + 1)}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Regenerate
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() =>
                  downloadBlob(
                    new Blob([`${allText}\n`], { type: 'text/plain;charset=utf-8' }),
                    'pins.txt',
                  )
                }
              >
                <Download className="size-4" aria-hidden="true" />
                Download .txt
              </Button>
            </div>
          </>
        )}

        {exhausted && (
          <ErrorNote
            title="Could not avoid every weak pattern"
            message="Almost every code of this length trips one of the rules, so some of the PINs above may still match a pattern. Use more digits, or turn the filter off."
          />
        )}

        <div aria-live="polite">
          <StrengthMeter bits={bits} band={band} max={40} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <ResultStat
            label="Possible codes"
            value={formatNumber(Math.round(combinations), 0)}
            hint={
              avoidWeak
                ? `${space.exact ? '' : '≈ '}after removing weak patterns`
                : 'all codes of this length'
            }
            emphasis
          />
          <ResultStat label="Entropy" value={`${formatNumber(bits, 1)} bits`} hint="log2 of the codes above" />
          <ResultStat
            label="Filter cost"
            value={avoidWeak ? `−${formatNumber((1 - space.fraction) * 100, 1)}%` : '–'}
            hint={avoidWeak ? 'of the raw space removed' : 'filter is off'}
          />
        </div>
      </ToolPanel>

      <ToolPanel title="Options">
        <Field
          label={`Digits: ${digits}`}
          hint="Four digits is the banking standard. Six is the phone standard. Anything you type on a touchscreen leaves smudges, so more digits genuinely help."
        >
          <Slider
            min={MIN_DIGITS}
            max={MAX_DIGITS}
            step={1}
            value={[digits]}
            onValueChange={(value) => setDigits(clamp(value[0] ?? 4, MIN_DIGITS, MAX_DIGITS))}
            aria-label="Number of digits"
          />
        </Field>

        <ToggleRow
          label="Avoid weak patterns"
          description="Rejects the code and draws again if it matches any of the rules below. Because rejected codes are simply redrawn, the survivors stay uniformly distributed."
          checked={avoidWeak}
          onCheckedChange={setAvoidWeak}
        />

        <Field label="How many" htmlFor="pin-count" hint={`Up to ${MAX_COUNT} at once.`}>
          <Input
            id="pin-count"
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

      <ToolPanel
        title="What counts as a weak pattern"
        description={`Rules applied at ${digits} digits. Together they remove ${space.exact ? '' : 'about '}${formatNumber((1 - space.fraction) * 100, 1)}% of the raw space.`}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[11rem]">Pattern</TableHead>
                <TableHead className="min-w-[18rem]">Why it is rejected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applicableRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell className="text-sm text-pretty text-muted-foreground">
                    {rule.detail}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ToolPanel>

      <ToolPanel
        title="How long would this take to guess?"
        description="A PIN is safe only because something limits the number of attempts: three tries at a cash machine, ten on a phone. The offline rows show what happens when that limit is missing."
      >
        <CrackTimeTable bits={bits} />
      </ToolPanel>
    </div>
  )
}
