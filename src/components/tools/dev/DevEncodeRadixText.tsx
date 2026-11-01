import { useCallback, useMemo, useState } from 'react'
import { ArrowUpDown, FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { formatBytes, formatNumber } from '@/lib/utils'
import { EncodeField, EncodePane, ProofPanel, StatChips } from './dev-encode-ui'
import {
  BASE32_ALPHABETS,
  base32Decode,
  base32Encode,
  parseHex,
  utf8Decode,
  utf8Encode,
} from './dev-encode-core'
import type { Base32Variant } from './dev-encode-core'

export type Radix = 'hex' | 'octal' | 'decimal' | 'base32'
type Direction = 'decode' | 'encode'
type Charset = 'utf-8' | 'latin1'
type Delimiter = 'space' | 'none' | 'comma' | 'newline'

interface Props {
  /** Which numeric/text encoding sits on the coded side. */
  radix?: Radix
  /** `decode` puts the coded value in the top pane; `encode` puts plain text there. */
  direction?: Direction
  /** Labels the coded side "ASCII" and defaults to the single-byte charset. */
  asciiFlavour?: boolean
}

const RADIX_BASE: Record<Exclude<Radix, 'base32'>, number> = { hex: 16, octal: 8, decimal: 10 }
const RADIX_WIDTH: Record<Exclude<Radix, 'base32'>, number> = { hex: 2, octal: 3, decimal: 3 }

const DELIMITERS: Record<Delimiter, string> = {
  space: ' ',
  none: '',
  comma: ', ',
  newline: '\n',
}

const RADIX_LABEL: Record<Radix, string> = {
  hex: 'Hex',
  octal: 'Octal',
  decimal: 'Decimal',
  base32: 'Base32',
}

/* ------------------------------------------------------------------ */
/* Conversion                                                          */
/* ------------------------------------------------------------------ */

function textToBytes(text: string, charset: Charset): Uint8Array {
  if (charset === 'utf-8') return utf8Encode(text)
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i += 1) {
    const code = text.codePointAt(i) ?? 0
    if (code > 255) {
      throw new Error(
        `“${text[i]}” (U+${code.toString(16).toUpperCase().padStart(4, '0')}) does not fit in one byte. Switch the character set to UTF-8 to encode it.`,
      )
    }
    out[i] = code
  }
  return out
}

function bytesToText(bytes: Uint8Array, charset: Charset): string {
  if (charset === 'utf-8') return utf8Decode(bytes)
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i])
  return out
}

function bytesToRadix(
  bytes: Uint8Array,
  radix: Radix,
  options: {
    delimiter: Delimiter
    prefix: boolean
    uppercase: boolean
    pad: boolean
    base32Variant: Base32Variant
  },
): string {
  if (radix === 'base32') return base32Encode(bytes, options.base32Variant)
  const base = RADIX_BASE[radix]
  const width = RADIX_WIDTH[radix]
  const parts: string[] = []
  for (let i = 0; i < bytes.length; i += 1) {
    let token = bytes[i].toString(base)
    if (options.pad || radix === 'hex') token = token.padStart(width, '0')
    if (options.uppercase) token = token.toUpperCase()
    if (options.prefix) token = (radix === 'hex' ? '0x' : radix === 'octal' ? '0o' : '') + token
    parts.push(token)
  }
  return parts.join(DELIMITERS[options.delimiter])
}

function radixToBytes(
  input: string,
  radix: Radix,
  base32Variant: Base32Variant,
): Uint8Array {
  if (radix === 'base32') return base32Decode(input, base32Variant)
  if (radix === 'hex') return parseHex(input)

  const base = RADIX_BASE[radix]
  const width = RADIX_WIDTH[radix]
  const cleaned = input.replace(/0o/gi, ' ').trim()
  if (cleaned.length === 0) return new Uint8Array(0)

  const separated = /[\s,;:|]/.test(cleaned)
  const tokens = separated
    ? cleaned.split(/[\s,;:|]+/).filter(Boolean)
    : (cleaned.match(new RegExp(`.{1,${width}}`, 'g')) ?? [])

  if (!separated && cleaned.length % width !== 0) {
    throw new Error(
      `Without separators every value must be exactly ${width} digits, so the total length has to be a multiple of ${width}. This input is ${cleaned.length} characters. Add spaces between the numbers, or pad the short ones with leading zeros.`,
    )
  }

  const digitPattern = radix === 'octal' ? /^[0-7]+$/ : /^[0-9]+$/
  const out = new Uint8Array(tokens.length)
  tokens.forEach((token, index) => {
    if (!digitPattern.test(token)) {
      throw new Error(
        `“${token}” is not a valid ${radix} number. ${radix === 'octal' ? 'Octal digits are 0-7.' : 'Decimal digits are 0-9.'}`,
      )
    }
    const value = Number.parseInt(token, base)
    if (!Number.isFinite(value) || value > 255) {
      throw new Error(
        `“${token}” is ${value}, which is larger than one byte (max ${radix === 'octal' ? '377' : '255'}). Each value here represents a single byte.`,
      )
    }
    out[index] = value
  })
  return out
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function DevEncodeRadixText({
  radix = 'hex',
  direction: initialDirection = 'decode',
  asciiFlavour = false,
}: Props) {
  const [direction, setDirection] = useState<Direction>(initialDirection)
  const [input, setInput] = useState('')
  const [charset, setCharset] = useState<Charset>(asciiFlavour ? 'latin1' : 'utf-8')
  const [delimiter, setDelimiter] = useState<Delimiter>('space')
  const [prefix, setPrefix] = useState(false)
  const [uppercase, setUppercase] = useState(false)
  const [pad, setPad] = useState(true)
  const [base32Variant, setBase32Variant] = useState<Base32Variant>('rfc4648')
  const [fileNote, setFileNote] = useState<string | null>(null)

  const codedLabel = radix === 'hex' && asciiFlavour ? 'Hex' : RADIX_LABEL[radix]
  const plainLabel = asciiFlavour ? 'ASCII text' : 'Text'

  const result = useMemo(() => {
    if (input.trim().length === 0) return { output: '', bytes: 0, error: null as string | null }
    try {
      if (direction === 'encode') {
        const bytes = textToBytes(input, charset)
        return {
          output: bytesToRadix(bytes, radix, {
            delimiter,
            prefix,
            uppercase,
            pad,
            base32Variant,
          }),
          bytes: bytes.length,
          error: null,
        }
      }
      const bytes = radixToBytes(input, radix, base32Variant)
      return { output: bytesToText(bytes, charset), bytes: bytes.length, error: null }
    } catch (error) {
      return {
        output: '',
        bytes: 0,
        error: error instanceof Error ? error.message : 'That input could not be converted.',
      }
    }
  }, [input, direction, charset, radix, delimiter, prefix, uppercase, pad, base32Variant])

  const swap = useCallback(() => {
    setInput(result.output)
    setDirection((value) => (value === 'encode' ? 'decode' : 'encode'))
    setFileNote(null)
  }, [result.output])

  const handleFile = useCallback(
    async (files: File[]) => {
      const file = files[0]
      if (!file) return
      setFileNote(null)
      if (direction === 'encode') {
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        const truncated = bytes.length > 512 * 1024
        const slice = bytes.subarray(0, 512 * 1024)
        setFileNote(
          `${file.name} (${formatBytes(bytes.length)}) was read as raw bytes${
            truncated ? ' and truncated to the first 512 KB so the page stays responsive' : ''
          }. The input pane shows those bytes as Latin-1 characters (many are unprintable), and the ${codedLabel.toLowerCase()} dump is in the output pane.`,
        )
        // Round-trip through the plain pane so the coded pane shows the dump.
        setCharset('latin1')
        setInput(bytesToText(slice, 'latin1'))
      } else {
        const text = await file.text()
        setInput(text)
      }
    },
    [direction, codedLabel],
  )

  const codedOnTop = direction === 'decode'
  const inputLabel = codedOnTop ? codedLabel : plainLabel
  const outputLabel = codedOnTop ? plainLabel : codedLabel

  return (
    <div className="space-y-5">
      <ToolPanel
        title={`${inputLabel} → ${outputLabel}`}
        description="Conversion runs as you type. Use Swap to send the result back into the input and reverse the direction."
      >
        <EncodePane
          label={inputLabel}
          value={input}
          onChange={(value) => {
            setInput(value)
            setFileNote(null)
          }}
          rows={6}
          invalid={result.error !== null}
          placeholder={
            codedOnTop
              ? radix === 'hex'
                ? '48 65 6c 6c 6f'
                : radix === 'octal'
                  ? '110 145 154 154 157'
                  : radix === 'decimal'
                    ? '72 101 108 108 111'
                    : 'JBSWY3DPEBLW64TMMQ======'
              : 'Hello'
          }
        />

        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={swap} disabled={result.output.length === 0}>
            <ArrowUpDown className="mr-1.5 size-4" aria-hidden="true" />
            Swap direction
          </Button>
        </div>

        <EncodePane
          label={outputLabel}
          value={result.output}
          readOnly
          rows={6}
          footer={
            result.output.length > 0
              ? `${formatNumber(result.output.length, 0)} characters`
              : 'The converted value appears here.'
          }
        />

        {result.error ? <ErrorNote title="Check the input" message={result.error} /> : null}
        {fileNote ? (
          <Alert role="status">
            <AlertTitle>File loaded as raw bytes</AlertTitle>
            <AlertDescription>{fileNote}</AlertDescription>
          </Alert>
        ) : null}

        {result.bytes > 0 && !result.error ? (
          <StatChips
            items={[
              { label: 'Bytes', value: formatNumber(result.bytes, 0) },
              { label: 'Size', value: formatBytes(result.bytes) },
              { label: 'Charset', value: charset === 'utf-8' ? 'UTF-8' : 'ASCII / Latin-1' },
            ]}
          />
        ) : null}
      </ToolPanel>

      <ToolPanel title="Options">
        <div className="grid gap-4 sm:grid-cols-2">
          <EncodeField
            label="Character set"
            htmlFor="charset"
            hint={
              charset === 'utf-8'
                ? 'Accents, CJK and emoji become multiple bytes each, exactly as they are stored on disk.'
                : 'One byte per character, 0-255. Anything above U+00FF is rejected rather than mangled.'
            }
          >
            <Select value={charset} onValueChange={(value) => setCharset(value as Charset)}>
              <SelectTrigger id="charset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utf-8">UTF-8 (recommended)</SelectItem>
                <SelectItem value="latin1">ASCII / Latin-1 (single byte)</SelectItem>
              </SelectContent>
            </Select>
          </EncodeField>

          {radix === 'base32' ? (
            <EncodeField
              label="Alphabet"
              htmlFor="b32-variant"
              hint={
                base32Variant === 'rfc4648'
                  ? `Standard RFC 4648 (${BASE32_ALPHABETS.rfc4648.slice(0, 8)}…). It has no 0, 1 or 8, so it survives being read aloud.`
                  : 'Extended hex alphabet (RFC 4648 §7): sorts in the same order as the underlying bytes.'
              }
            >
              <Select
                value={base32Variant}
                onValueChange={(value) => setBase32Variant(value as Base32Variant)}
              >
                <SelectTrigger id="b32-variant">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rfc4648">RFC 4648 standard (A-Z, 2-7)</SelectItem>
                  <SelectItem value="base32hex">base32hex (0-9, A-V)</SelectItem>
                </SelectContent>
              </Select>
            </EncodeField>
          ) : (
            <EncodeField
              label="Separator between values"
              htmlFor="delimiter"
              hint="Applies to the generated output. Input is parsed with or without separators."
            >
              <Select value={delimiter} onValueChange={(value) => setDelimiter(value as Delimiter)}>
                <SelectTrigger id="delimiter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="space">Space</SelectItem>
                  <SelectItem value="none">None (continuous)</SelectItem>
                  <SelectItem value="comma">Comma</SelectItem>
                  <SelectItem value="newline">New line</SelectItem>
                </SelectContent>
              </Select>
            </EncodeField>
          )}
        </div>

        {radix !== 'base32' ? (
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {radix === 'hex' ? (
              <div className="flex items-center gap-2">
                <Switch id="uppercase" checked={uppercase} onCheckedChange={setUppercase} />
                <label htmlFor="uppercase" className="text-sm text-foreground">
                  Uppercase digits
                </label>
              </div>
            ) : null}
            {radix !== 'decimal' ? (
              <div className="flex items-center gap-2">
                <Switch id="prefix" checked={prefix} onCheckedChange={setPrefix} />
                <label htmlFor="prefix" className="text-sm text-foreground">
                  {radix === 'hex' ? '0x prefix' : '0o prefix'}
                </label>
              </div>
            ) : null}
            {radix !== 'hex' ? (
              <div className="flex items-center gap-2">
                <Switch id="pad" checked={pad} onCheckedChange={setPad} />
                <label htmlFor="pad" className="text-sm text-foreground">
                  Pad to {RADIX_WIDTH[radix as Exclude<Radix, 'base32'>]} digits
                </label>
              </div>
            ) : null}
          </div>
        ) : null}
      </ToolPanel>

      <ToolPanel
        title={direction === 'encode' ? 'Dump a file' : 'Load a text file'}
        description={
          direction === 'encode'
            ? 'Drop a binary file to see its bytes. Large files are truncated to the first 512 KB.'
            : `Drop a .txt containing ${codedLabel.toLowerCase()} values and they are parsed straight away.`
        }
      >
        <FileDropzone
          onFiles={handleFile}
          icon={FileUp}
          title="Drop a file here"
          hint="or click to browse"
          maxSizeMb={64}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setInput(
                codedOnTop
                  ? radix === 'hex'
                    ? '48 65 6c 6c 6f 20 77 6f 72 6c 64'
                    : radix === 'octal'
                      ? '110 145 154 154 157'
                      : radix === 'decimal'
                        ? '72 101 108 108 111'
                        : 'JBSWY3DPEBLW64TMMQ======'
                  : 'Hello world',
              )
            }
          >
            Load sample
          </Button>
        </div>
      </ToolPanel>

      <ProofPanel subject="Your text" />
    </div>
  )
}
