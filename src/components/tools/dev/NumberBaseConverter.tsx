import { useMemo, useState } from 'react'
import { Binary, TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { Field, Segmented, StatChips } from './DevUi'
import { formatNumber } from '@/lib/utils'

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

interface ParsedNumber {
  negative: boolean
  integer: bigint
  /** Fractional part as an exact rational: fracNumerator / fracDenominator. */
  fracNumerator: bigint
  fracDenominator: bigint
}

class BaseError extends Error {}

function digitValue(ch: string): number {
  return DIGITS.indexOf(ch.toLowerCase())
}

function parseInBase(raw: string, base: number): ParsedNumber {
  let text = raw.trim().replace(/[_\s,]/g, '')
  if (!text) throw new BaseError('Enter a number to convert.')

  let negative = false
  if (text.startsWith('-')) {
    negative = true
    text = text.slice(1)
  } else if (text.startsWith('+')) {
    text = text.slice(1)
  }

  const lower = text.toLowerCase()
  if (base === 16 && lower.startsWith('0x')) text = text.slice(2)
  else if (base === 2 && lower.startsWith('0b')) text = text.slice(2)
  else if (base === 8 && lower.startsWith('0o')) text = text.slice(2)

  if (!text) throw new BaseError('There are no digits after the sign or prefix.')

  const [intText, fracText = ''] = text.split('.')
  if (text.split('.').length > 2) {
    throw new BaseError('A number can only contain one decimal point.')
  }

  const check = (part: string, offset: number) => {
    for (let i = 0; i < part.length; i++) {
      const value = digitValue(part[i])
      if (value < 0 || value >= base) {
        throw new BaseError(
          `“${part[i]}” at position ${offset + i + 1} is not a valid digit in base ${base}. Base ${base} allows ${
            base <= 10 ? `0-${base - 1}` : `0-9 and a-${DIGITS[base - 1]}`
          }.`,
        )
      }
    }
  }
  check(intText, 0)
  check(fracText, intText.length + 1)

  const big = BigInt(base)
  let integer = 0n
  for (const ch of intText) integer = integer * big + BigInt(digitValue(ch))

  let fracNumerator = 0n
  let fracDenominator = 1n
  for (const ch of fracText) {
    fracNumerator = fracNumerator * big + BigInt(digitValue(ch))
    fracDenominator *= big
  }

  return { negative, integer, fracNumerator, fracDenominator }
}

function formatInBase(value: ParsedNumber, base: number, fractionDigits = 20): string {
  const intPart = value.integer.toString(base)
  let out = `${value.negative && (value.integer !== 0n || value.fracNumerator !== 0n) ? '-' : ''}${intPart}`

  if (value.fracNumerator > 0n) {
    let numerator = value.fracNumerator
    const denominator = value.fracDenominator
    const big = BigInt(base)
    let frac = ''
    for (let i = 0; i < fractionDigits && numerator > 0n; i++) {
      numerator *= big
      const digit = numerator / denominator
      numerator %= denominator
      frac += DIGITS[Number(digit)]
    }
    if (frac) out += `.${frac}`
  }
  return out
}

function group(text: string, size: number, separator = ' '): string {
  if (size <= 0) return text
  const [intPart, fracPart] = text.split('.')
  const sign = intPart.startsWith('-') ? '-' : ''
  const digits = sign ? intPart.slice(1) : intPart
  const chunks: string[] = []
  for (let end = digits.length; end > 0; end -= size) {
    chunks.unshift(digits.slice(Math.max(0, end - size), end))
  }
  const grouped = `${sign}${chunks.join(separator)}`
  return fracPart ? `${grouped}.${fracPart}` : grouped
}

const WIDTHS = ['8', '16', '32', '64'] as const
type Width = (typeof WIDTHS)[number]

interface Machine {
  unsigned: bigint
  signed: bigint
  binary: string
  hex: string
  overflow: boolean
}

function machineView(value: bigint, width: number): Machine {
  const span = 1n << BigInt(width)
  const mask = span - 1n
  const unsigned = ((value % span) + span) % span
  const signed = unsigned >= span / 2n ? unsigned - span : unsigned
  const overflow = value < -(span / 2n) || value > mask
  return {
    unsigned,
    signed,
    binary: (value & mask).toString(2).padStart(width, '0'),
    hex: unsigned.toString(16).toUpperCase().padStart(width / 4, '0'),
    overflow,
  }
}

type Operation = 'and' | 'or' | 'xor' | 'not' | 'shl' | 'shr' | 'ushr'

const OPERATIONS: { value: Operation; label: string; symbol: string; description: string }[] = [
  { value: 'and', label: 'AND', symbol: 'A & B', description: 'A bit is 1 only when it is 1 in both operands' },
  { value: 'or', label: 'OR', symbol: 'A | B', description: 'A bit is 1 when it is 1 in either operand' },
  { value: 'xor', label: 'XOR', symbol: 'A ^ B', description: 'A bit is 1 when the two operands differ' },
  { value: 'not', label: 'NOT', symbol: '~A', description: 'Every bit is flipped, within the chosen width' },
  { value: 'shl', label: 'Shift left', symbol: 'A << n', description: 'Bits move left; the low bits fill with zeros' },
  { value: 'shr', label: 'Arithmetic shift right', symbol: 'A >> n', description: 'Bits move right; the sign bit is copied in' },
  { value: 'ushr', label: 'Logical shift right', symbol: 'A >>> n', description: 'Bits move right; zeros fill from the left' },
]

const COMMON_BASES = [2, 8, 10, 16, 36]

export default function NumberBaseConverter() {
  const [value, setValue] = useState('255')
  const [fromBase, setFromBase] = useState('10')
  const [customBase, setCustomBase] = useState('12')
  const [grouped, setGrouped] = useState(true)
  const [width, setWidth] = useState<Width>('32')

  const [operandB, setOperandB] = useState('15')
  const [operation, setOperation] = useState<Operation>('and')
  const [shift, setShift] = useState('4')

  const base = Number(fromBase)

  const parsed = useMemo<{ value: ParsedNumber | null; error: string | null }>(() => {
    try {
      return { value: parseInBase(value, base), error: null }
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : String(error) }
    }
  }, [value, base])

  const signedValue = useMemo(() => {
    if (!parsed.value) return null
    return parsed.value.negative ? -parsed.value.integer : parsed.value.integer
  }, [parsed.value])

  const machine = useMemo(
    () => (signedValue === null ? null : machineView(signedValue, Number(width))),
    [signedValue, width],
  )

  const bitwise = useMemo(() => {
    if (signedValue === null) return null
    const bits = Number(width)
    const span = 1n << BigInt(bits)
    const mask = span - 1n
    let b = 0n
    try {
      const parsedB = parseInBase(operandB, base)
      b = parsedB.negative ? -parsedB.integer : parsedB.integer
    } catch {
      b = 0n
    }
    const shiftBy = BigInt(Math.max(0, Math.min(bits, Number(shift) || 0)))
    const a = signedValue & mask

    let result: bigint
    switch (operation) {
      case 'and':
        result = a & (b & mask)
        break
      case 'or':
        result = a | (b & mask)
        break
      case 'xor':
        result = a ^ (b & mask)
        break
      case 'not':
        result = ~a & mask
        break
      case 'shl':
        result = (a << shiftBy) & mask
        break
      case 'shr': {
        const signedA = a >= span / 2n ? a - span : a
        result = (signedA >> shiftBy) & mask
        break
      }
      case 'ushr':
      default:
        result = (a >> shiftBy) & mask
        break
    }
    return { result, bits }
  }, [signedValue, width, operandB, base, operation, shift])

  const bitCount = useMemo(() => {
    if (!machine) return 0
    return [...machine.binary].filter((c) => c === '1').length
  }, [machine])

  const rows = useMemo(() => {
    const number = parsed.value
    if (!number) return []
    const list = COMMON_BASES.map((b) => ({
      base: b,
      label:
        b === 2 ? 'Binary' : b === 8 ? 'Octal' : b === 10 ? 'Decimal' : b === 16 ? 'Hexadecimal' : 'Base 36',
      text: formatInBase(number, b),
    }))
    const custom = Number(customBase)
    if (custom >= 2 && custom <= 36 && !COMMON_BASES.includes(custom)) {
      list.push({ base: custom, label: `Base ${custom}`, text: formatInBase(number, custom) })
    }
    return list
  }, [parsed.value, customBase])

  return (
    <div className="flex flex-col gap-4">
      <ToolPanel
        title="Number to convert"
        description="Conversion uses BigInt, so 64-bit ids and 256-bit hashes convert exactly, with no floating-point rounding."
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Field
            label="Value"
            htmlFor="base-value"
            hint="Underscores, spaces and the 0x / 0b / 0o prefixes are ignored. A decimal point is allowed."
          >
            <Input
              id="base-value"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="255"
              className="font-mono text-base"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-invalid={parsed.error !== null}
            />
          </Field>
          <Field label="Input base" htmlFor="base-from">
            <Select value={fromBase} onValueChange={setFromBase}>
              <SelectTrigger id="base-from">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {Array.from({ length: 35 }, (_, i) => i + 2).map((b) => (
                  <SelectItem key={b} value={String(b)}>
                    Base {b}
                    {b === 2 ? ' · binary' : b === 8 ? ' · octal' : b === 10 ? ' · decimal' : b === 16 ? ' · hex' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {parsed.error ? <ErrorNote title="Cannot read that number" message={parsed.error} /> : null}

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="base-group" checked={grouped} onCheckedChange={setGrouped} />
            <Label htmlFor="base-group" className="text-sm">
              Group digits (bytes for binary, 4s for hex)
            </Label>
          </div>
          <Field label="Extra target base" htmlFor="base-custom" className="w-40">
            <Input
              id="base-custom"
              type="number"
              min={2}
              max={36}
              value={customBase}
              onChange={(event) => setCustomBase(event.target.value)}
              className="font-mono"
            />
          </Field>
        </div>

        {parsed.value ? (
          <div className="overflow-x-auto rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Base</TableHead>
                  <TableHead className="min-w-[14rem]">Value</TableHead>
                  <TableHead className="w-24 text-right">
                    <span className="sr-only">Copy</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const display = grouped
                    ? row.base === 2
                      ? group(row.text, 8)
                      : row.base === 16
                        ? group(row.text, 4)
                        : row.text
                    : row.text
                  return (
                    <TableRow key={row.base}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {row.label}
                        <span className="ml-1 text-xs text-muted-foreground">({row.base})</span>
                      </TableCell>
                      <TableCell>
                        <code className="break-all font-mono text-[13px]">{display}</code>
                      </TableCell>
                      <TableCell className="text-right">
                        <CopyButton value={row.text} label="Copy" />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {parsed.value ? (
          <StatChips
            items={[
              { label: 'Digits (base 10)', value: formatNumber(formatInBase(parsed.value, 10).replace('-', '').split('.')[0].length, 0) },
              { label: 'Bits set', value: formatNumber(bitCount, 0) },
              {
                label: 'Fits in',
                value:
                  signedValue === null
                    ? '–'
                    : (signedValue < 0n ? -signedValue : signedValue) < 256n
                      ? '8 bits'
                      : (signedValue < 0n ? -signedValue : signedValue) < 65536n
                        ? '16 bits'
                        : (signedValue < 0n ? -signedValue : signedValue) < 4294967296n
                          ? '32 bits'
                          : '64+ bits',
              },
            ]}
          />
        ) : null}
      </ToolPanel>

      {machine ? (
        <ToolPanel
          title="Machine representation"
          description="How the integer part is stored in a fixed-width register, including the two's-complement signed reading."
        >
          <Segmented
            label="Register width"
            value={width}
            onChange={setWidth}
            options={WIDTHS.map((w) => ({ value: w, label: `${w}-bit` }))}
          />

          {machine.overflow ? (
            <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                Overflow: this value does not fit in {width} bits. The figures below show the wrapped result, exactly
                as the hardware would store it.
              </span>
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-lg">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="w-44 font-medium">Unsigned</TableCell>
                  <TableCell className="font-mono text-[13px]">{machine.unsigned.toString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Signed (two's complement)</TableCell>
                  <TableCell className="font-mono text-[13px]">{machine.signed.toString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Hexadecimal</TableCell>
                  <TableCell className="font-mono text-[13px] break-all">
                    0x{grouped ? group(machine.hex, 4) : machine.hex}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Binary</TableCell>
                  <TableCell className="font-mono text-[13px] break-all">
                    {grouped ? group(machine.binary, 8) : machine.binary}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Sign bit</TableCell>
                  <TableCell className="text-sm">
                    {machine.binary[0] === '1'
                      ? '1 (negative when read as a signed integer)'
                      : '0 (positive when read as a signed integer)'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      ) : null}

      {bitwise ? (
        <ToolPanel
          title="Bitwise calculator"
          description="Operations are evaluated at the register width chosen above, then shown in every base."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Operation" htmlFor="bitwise-op">
              <Select value={operation} onValueChange={(v) => setOperation(v as Operation)}>
                <SelectTrigger id="bitwise-op">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATIONS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label} · {op.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {operation === 'and' || operation === 'or' || operation === 'xor' ? (
              <Field label={`Operand B (base ${base})`} htmlFor="bitwise-b">
                <Input
                  id="bitwise-b"
                  value={operandB}
                  onChange={(event) => setOperandB(event.target.value)}
                  className="font-mono"
                  spellCheck={false}
                />
              </Field>
            ) : null}

            {operation === 'shl' || operation === 'shr' || operation === 'ushr' ? (
              <Field label="Shift by (bits)" htmlFor="bitwise-shift">
                <Input
                  id="bitwise-shift"
                  type="number"
                  min={0}
                  max={Number(width)}
                  value={shift}
                  onChange={(event) => setShift(event.target.value)}
                  className="font-mono"
                />
              </Field>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground text-pretty">
            {OPERATIONS.find((op) => op.value === operation)?.description}
          </p>

          <div className="overflow-x-auto rounded-lg">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="w-36 font-medium">Result (decimal)</TableCell>
                  <TableCell className="font-mono text-[13px]">{bitwise.result.toString()}</TableCell>
                  <TableCell className="w-24 text-right">
                    <CopyButton value={bitwise.result.toString()} label="Copy" />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Hexadecimal</TableCell>
                  <TableCell className="font-mono text-[13px] break-all">
                    0x{bitwise.result.toString(16).toUpperCase().padStart(bitwise.bits / 4, '0')}
                  </TableCell>
                  <TableCell className="text-right">
                    <CopyButton
                      value={bitwise.result.toString(16).toUpperCase().padStart(bitwise.bits / 4, '0')}
                      label="Copy"
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Binary</TableCell>
                  <TableCell className="font-mono text-[13px] break-all">
                    {group(bitwise.result.toString(2).padStart(bitwise.bits, '0'), 8)}
                  </TableCell>
                  <TableCell className="text-right">
                    <CopyButton
                      value={bitwise.result.toString(2).padStart(bitwise.bits, '0')}
                      label="Copy"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      ) : (
        <p className="flex items-center gap-2 rounded-lg bg-muted p-6 text-sm text-muted-foreground">
          <Binary className="size-4 shrink-0" aria-hidden="true" />
          Enter a valid number above to unlock the machine and bitwise views.
        </p>
      )}
    </div>
  )
}
