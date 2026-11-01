import { useCallback, useMemo, useState } from 'react'
import { ArrowUpDown, FileUp, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ResultStat } from '@/components/shared/ResultStat'
import { Formula } from '@/components/shared/Formula'
import { CopyButton } from '@/components/shared/CopyButton'
import { formatBytes, formatNumber } from '@/lib/utils'
import { EncodeField, EncodePane, ProofPanel, Segmented, StatChips } from '../dev/dev-encode-ui'
import { utf8Decode, utf8Encode } from '../dev/dev-encode-core'

type Kind = 'text' | 'number'
type Direction = 'encode' | 'decode'
type Charset = 'utf-8' | 'ascii'
type Delimiter = 'space' | 'none' | 'newline'

interface Props {
  /** `text` converts characters to bit patterns; `number` converts integers. */
  kind?: Kind
  direction?: Direction
  /** Flip direction automatically depending on what the visitor pastes. */
  autoDetect?: boolean
}

const DELIMITERS: Record<Delimiter, string> = { space: ' ', none: '', newline: '\n' }

/* ------------------------------------------------------------------ */
/* Text ⇄ binary                                                       */
/* ------------------------------------------------------------------ */

function textToBinary(
  text: string,
  charset: Charset,
  bits: 7 | 8,
  delimiter: Delimiter,
): string {
  const parts: string[] = []
  if (charset === 'utf-8') {
    const bytes = utf8Encode(text)
    for (const byte of bytes) parts.push(byte.toString(2).padStart(8, '0'))
  } else {
    for (const char of text) {
      const code = char.codePointAt(0) ?? 0
      const max = bits === 7 ? 127 : 255
      if (code > max) {
        throw new Error(
          `“${char}” is character number ${code}, which does not fit in ${bits} bits (max ${max}). Switch the character set to UTF-8 to encode it.`,
        )
      }
      parts.push(code.toString(2).padStart(bits, '0'))
    }
  }
  return parts.join(DELIMITERS[delimiter])
}

function binaryToText(input: string, charset: Charset, bits: 7 | 8): string {
  const cleaned = input.replace(/[^01]/g, '')
  if (cleaned.length === 0) return ''
  const groupSize = charset === 'utf-8' ? 8 : bits
  if (cleaned.length % groupSize !== 0) {
    const spare = cleaned.length % groupSize
    throw new Error(
      `This is ${formatNumber(cleaned.length, 0)} bits, which is not a whole number of ${groupSize}-bit groups: ${spare} bit${spare === 1 ? '' : 's'} left over. Check for a missing digit, or switch the group size.`,
    )
  }
  const bytes = new Uint8Array(cleaned.length / groupSize)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(cleaned.slice(i * groupSize, (i + 1) * groupSize), 2)
  }
  if (charset === 'utf-8') return utf8Decode(bytes)
  let out = ''
  for (const byte of bytes) out += String.fromCharCode(byte)
  return out
}

/* ------------------------------------------------------------------ */
/* Number ⇄ binary                                                     */
/* ------------------------------------------------------------------ */

interface NumberResult {
  decimal: bigint
  binary: string
  hex: string
  octal: string
  bitLength: number
  negative: boolean
  twosComplement: string | null
  steps: { value: bigint; quotient: bigint; remainder: bigint }[]
}

function parseIntegerInput(input: string, from: 'decimal' | 'binary'): bigint {
  const cleaned = input.replace(/[\s,_]/g, '')
  if (cleaned.length === 0) throw new Error('Enter a number.')
  const negative = cleaned.startsWith('-')
  const digits = negative ? cleaned.slice(1) : cleaned
  if (from === 'decimal') {
    if (!/^[0-9]+$/.test(digits)) {
      throw new Error(
        `“${input.trim()}” is not a whole decimal number. Use digits 0-9 only. This converter works on integers, so 12.5 has no exact binary form here.`,
      )
    }
    return negative ? -BigInt(digits) : BigInt(digits)
  }
  if (!/^[01]+$/.test(digits)) {
    const bad = digits.match(/[^01]/)
    throw new Error(
      `Binary uses only 0 and 1, so “${bad?.[0]}” is not allowed. Spaces, commas and underscores are ignored, so 1010 1101 is fine.`,
    )
  }
  const value = BigInt(`0b${digits}`)
  return negative ? -value : value
}

function describeNumber(value: bigint, width: number): NumberResult {
  const negative = value < 0n
  const magnitude = negative ? -value : value
  const binary = magnitude.toString(2)
  const steps: NumberResult['steps'] = []
  let cursor = magnitude
  while (cursor > 0n && steps.length < 72) {
    steps.push({ value: cursor, quotient: cursor / 2n, remainder: cursor % 2n })
    cursor /= 2n
  }
  let twosComplement: string | null = null
  if (negative) {
    const modulus = 1n << BigInt(width)
    if (magnitude <= modulus / 2n) {
      twosComplement = ((modulus + value) % modulus).toString(2).padStart(width, '0')
    }
  }
  return {
    decimal: value,
    binary: negative ? `-${binary}` : binary,
    hex: (negative ? '-' : '') + magnitude.toString(16).toUpperCase(),
    octal: (negative ? '-' : '') + magnitude.toString(8),
    bitLength: binary === '0' ? 1 : binary.length,
    negative,
    twosComplement,
    steps,
  }
}

function groupBits(binary: string, size: number): string {
  const negative = binary.startsWith('-')
  const digits = negative ? binary.slice(1) : binary
  if (size <= 0) return binary
  const padded = digits.padStart(Math.ceil(digits.length / size) * size, '0')
  const chunks = padded.match(new RegExp(`.{${size}}`, 'g')) ?? [padded]
  return (negative ? '-' : '') + chunks.join(' ')
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function DevEncodeBinary({
  kind = 'text',
  direction: initialDirection = 'encode',
  autoDetect = false,
}: Props) {
  const [direction, setDirection] = useState<Direction>(initialDirection)
  const [input, setInput] = useState('')
  const [charset, setCharset] = useState<Charset>('utf-8')
  const [bits, setBits] = useState<'7' | '8'>('8')
  const [delimiter, setDelimiter] = useState<Delimiter>('space')
  const [grouped, setGrouped] = useState(true)
  const [width, setWidth] = useState('8')
  const [fileNote, setFileNote] = useState<string | null>(null)

  /* ------------------------------- text mode */
  const textResult = useMemo(() => {
    if (kind !== 'text' || input.length === 0) {
      return { output: '', bits: 0, error: null as string | null }
    }
    try {
      if (direction === 'encode') {
        const output = textToBinary(input, charset, Number(bits) as 7 | 8, delimiter)
        return { output, bits: output.replace(/[^01]/g, '').length, error: null }
      }
      const output = binaryToText(input, charset, Number(bits) as 7 | 8)
      return { output, bits: input.replace(/[^01]/g, '').length, error: null }
    } catch (error) {
      return {
        output: '',
        bits: 0,
        error: error instanceof Error ? error.message : 'That input could not be converted.',
      }
    }
  }, [kind, input, direction, charset, bits, delimiter])

  /* ----------------------------- number mode */
  const numberResult = useMemo(() => {
    if (kind !== 'number' || input.trim().length === 0) return null
    try {
      const value = parseIntegerInput(input, direction === 'encode' ? 'decimal' : 'binary')
      return { value: describeNumber(value, Number(width)), error: null as string | null }
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : 'That number could not be converted.',
      }
    }
  }, [kind, input, direction, width])

  const handleInput = useCallback(
    (value: string) => {
      setInput(value)
      setFileNote(null)
      if (autoDetect) {
        const looksBinary = /^[01\s]+$/.test(value.trim()) && /[01]/.test(value)
        setDirection(looksBinary ? 'decode' : 'encode')
      }
    },
    [autoDetect],
  )

  const swap = useCallback(() => {
    const numeric = numberResult?.value
    const next =
      kind === 'text'
        ? textResult.output
        : direction === 'encode'
          ? (numeric?.binary ?? '')
          : (numeric?.decimal.toString() ?? '')
    setInput(next)
    setDirection((value) => (value === 'encode' ? 'decode' : 'encode'))
  }, [kind, textResult.output, numberResult, direction])

  const handleFile = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    if (file.size > 64 * 1024) {
      setFileNote(
        `${file.name} is ${formatBytes(file.size)}. Only the first 64 KB were loaded. A binary dump is eight characters per byte, so a bigger file would produce megabytes of digits.`,
      )
    } else {
      setFileNote(null)
    }
    const text = await file.slice(0, 64 * 1024).text()
    handleInput(text)
  }, [handleInput])

  const codedLabel = 'Binary'
  const plainLabel = kind === 'text' ? 'Text' : 'Decimal'
  const inputLabel = direction === 'encode' ? plainLabel : codedLabel
  const outputLabel = direction === 'encode' ? codedLabel : plainLabel

  /* ----------------------------------------------------- text render */
  if (kind === 'text') {
    return (
      <div className="space-y-5">
        <ToolPanel
          title={`${inputLabel} → ${outputLabel}`}
          description="Translation happens as you type. Swap sends the result back into the input and reverses the direction."
        >
          <EncodePane
            label={inputLabel}
            value={input}
            onChange={handleInput}
            rows={6}
            invalid={textResult.error !== null}
            placeholder={direction === 'encode' ? 'Hello' : '01001000 01100101 01101100'}
          />

          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={swap}
              disabled={textResult.output.length === 0}
            >
              <ArrowUpDown className="mr-1.5 size-4" aria-hidden="true" />
              Swap direction
            </Button>
          </div>

          <EncodePane
            label={outputLabel}
            value={textResult.output}
            readOnly
            rows={6}
            footer={
              textResult.output.length > 0
                ? `${formatNumber(textResult.bits, 0)} bits · ${formatNumber(textResult.bits / 8, 0)} bytes`
                : 'The translation appears here.'
            }
          />

          {textResult.error ? (
            <ErrorNote title="Check the input" message={textResult.error} />
          ) : null}

          {textResult.bits > 0 && !textResult.error ? (
            <StatChips
              items={[
                { label: 'Bits', value: formatNumber(textResult.bits, 0) },
                { label: 'Bytes', value: formatNumber(textResult.bits / 8, 0) },
                { label: 'Charset', value: charset === 'utf-8' ? 'UTF-8' : `ASCII ${bits}-bit` },
              ]}
            />
          ) : null}
        </ToolPanel>

        <ToolPanel title="Options">
          <div className="grid gap-4 sm:grid-cols-2">
            <EncodeField
              label="Character set"
              htmlFor="binary-charset"
              hint={
                charset === 'utf-8'
                  ? 'Always eight bits per byte. Accented letters, CJK and emoji take two to four bytes each, the same bits that a file on disk holds.'
                  : 'One group per character. Choose 7-bit for classic ASCII tables or 8-bit for extended Latin-1.'
              }
            >
              <Select value={charset} onValueChange={(value) => setCharset(value as Charset)}>
                <SelectTrigger id="binary-charset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utf-8">UTF-8 (handles any character)</SelectItem>
                  <SelectItem value="ascii">ASCII / Latin-1</SelectItem>
                </SelectContent>
              </Select>
            </EncodeField>

            <EncodeField
              label="Separator"
              htmlFor="binary-delimiter"
              hint="Applies to generated output. Input is parsed with any spacing, and each non-binary character is ignored."
            >
              <Select value={delimiter} onValueChange={(value) => setDelimiter(value as Delimiter)}>
                <SelectTrigger id="binary-delimiter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="space">Space between groups</SelectItem>
                  <SelectItem value="none">None (continuous)</SelectItem>
                  <SelectItem value="newline">One group per line</SelectItem>
                </SelectContent>
              </Select>
            </EncodeField>
          </div>

          {charset === 'ascii' ? (
            <EncodeField label="Bits per character" htmlFor="binary-bits">
              <Segmented
                label="Bits per character"
                value={bits}
                onChange={setBits}
                options={[
                  { value: '7', label: '7-bit ASCII' },
                  { value: '8', label: '8-bit byte' },
                ]}
              />
            </EncodeField>
          ) : null}
        </ToolPanel>

        <ToolPanel
          title="Load from a file"
          description="Drop a .txt file to translate its contents."
        >
          <FileDropzone
            accept=".txt,.log,.csv,.md,text/plain"
            onFiles={handleFile}
            icon={FileUp}
            title="Drop a text file here"
            hint="First 64 KB are loaded"
            maxSizeMb={16}
          />
          {fileNote ? <p className="text-sm text-muted-foreground">{fileNote}</p> : null}
        </ToolPanel>

        <ProofPanel subject="Your text" />
      </div>
    )
  }

  /* --------------------------------------------------- number render */
  const number = numberResult?.value ?? null

  return (
    <div className="space-y-5">
      <ToolPanel
        title={`${inputLabel} → ${outputLabel}`}
        description="Arbitrary precision: numbers larger than 2⁵³ are handled exactly using BigInt, so a 200-digit value converts without rounding."
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <EncodeField
            label={`${inputLabel} value`}
            htmlFor="number-input"
            hint={
              direction === 'encode'
                ? 'Whole numbers only. Spaces, commas and underscores are ignored.'
                : 'Binary digits only. Grouping like 1010 1101 is fine.'
            }
          >
            <Input
              id="number-input"
              value={input}
              onChange={(event) => handleInput(event.target.value)}
              inputMode={direction === 'encode' ? 'numeric' : 'text'}
              placeholder={direction === 'encode' ? '2026' : '11111101010'}
              className="font-mono"
              aria-invalid={numberResult?.error ? true : undefined}
            />
          </EncodeField>
          <Button variant="outline" onClick={swap} disabled={!number}>
            <ArrowUpDown className="mr-1.5 size-4" aria-hidden="true" />
            Swap
          </Button>
        </div>

        {numberResult?.error ? (
          <ErrorNote title="Check the number" message={numberResult.error} />
        ) : null}

        {number ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat
                label="Binary"
                value={
                  <span className="font-mono text-lg break-all">
                    {grouped ? groupBits(number.binary, 4) : number.binary}
                  </span>
                }
                hint={`${number.bitLength} bit${number.bitLength === 1 ? '' : 's'}`}
                emphasis
              />
              <ResultStat
                label="Decimal"
                value={<span className="font-mono text-lg break-all">{number.decimal.toString()}</span>}
                hint="Base 10"
              />
              <ResultStat
                label="Hexadecimal"
                value={<span className="font-mono break-all">0x{number.hex}</span>}
                hint="Base 16"
              />
              <ResultStat
                label="Octal"
                value={<span className="font-mono break-all">0o{number.octal}</span>}
                hint="Base 8"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch id="group-bits" checked={grouped} onCheckedChange={setGrouped} />
                <label htmlFor="group-bits" className="text-sm text-foreground">
                  Group binary in nibbles
                </label>
              </div>
              <CopyButton value={number.binary} label="Copy binary" />
              <CopyButton value={number.decimal.toString()} label="Copy decimal" />
            </div>

            {number.negative ? (
              <div className="space-y-3 rounded-lg bg-muted p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <EncodeField
                    label="Two's complement width"
                    htmlFor="tc-width"
                    className="max-w-40"
                  >
                    <Select value={width} onValueChange={setWidth}>
                      <SelectTrigger id="tc-width">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="8">8-bit</SelectItem>
                        <SelectItem value="16">16-bit</SelectItem>
                        <SelectItem value="32">32-bit</SelectItem>
                        <SelectItem value="64">64-bit</SelectItem>
                      </SelectContent>
                    </Select>
                  </EncodeField>
                  <p className="text-sm text-muted-foreground">
                    Negative numbers have no sign bit of their own in memory. They are stored as
                    two's complement.
                  </p>
                </div>
                {number.twosComplement ? (
                  <Formula caption={`2^${width} − ${(-number.decimal).toString()} = the pattern above, written in ${width} bits.`}>
                    {`${width}-bit two's complement of ${number.decimal.toString()}\n= ${grouped ? groupBits(number.twosComplement, 4) : number.twosComplement}`}
                  </Formula>
                ) : (
                  <p className="flex items-start gap-2 text-sm text-foreground">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                      {number.decimal.toString()} does not fit in {width} bits. Choose a wider size.
                    </span>
                  </p>
                )}
              </div>
            ) : null}

            {direction === 'encode' && number.steps.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  The working: repeated division by 2
                </h3>
                <p className="text-sm text-muted-foreground">
                  Divide by two, write down the remainder, repeat until the quotient is zero. Read
                  the remainders bottom to top and you have the binary number.
                </p>
                <div className="max-h-80 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Value</TableHead>
                        <TableHead>÷ 2</TableHead>
                        <TableHead className="text-right">Remainder (bit)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {number.steps.map((step, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">{step.value.toString()}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {step.quotient.toString()}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {step.remainder.toString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reading the remainder column from the bottom row upwards gives{' '}
                  <code className="font-mono">{number.binary.replace('-', '')}</code>.
                </p>
              </div>
            ) : null}

            {direction === 'decode' ? (
              <Formula caption="Each 1 contributes its place value; the places are powers of two.">
                {(() => {
                  const digits = number.binary.replace('-', '')
                  const terms: string[] = []
                  for (let i = 0; i < digits.length; i += 1) {
                    if (digits[i] === '1') {
                      const power = digits.length - 1 - i
                      terms.push(`2^${power}`)
                    }
                  }
                  const values: string[] = terms.map((term) =>
                    (1n << BigInt(term.slice(2))).toString(),
                  )
                  return `${digits}\n= ${terms.join(' + ') || '0'}\n= ${values.join(' + ') || '0'}\n= ${number.decimal.toString()}`
                })()}
              </Formula>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Enter a value above. Binary, decimal, hexadecimal, octal and the full working appear
            here.
          </p>
        )}
      </ToolPanel>

      <ProofPanel subject="Your numbers" />
    </div>
  )
}
