import { useCallback, useMemo, useState } from 'react'
import { ArrowLeftRight, Link2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { CodePane, Field, Segmented, StatChips } from './DevUi'
import { utf8Decode, utf8Encode } from './devlib'
import { formatNumber } from '@/lib/utils'

type Direction = 'encode' | 'decode'
type EncodeMode = 'component' | 'uri' | 'form'

const MODE_LABEL: Record<EncodeMode, string> = {
  component: 'encodeURIComponent',
  uri: 'encodeURI',
  form: 'form (application/x-www-form-urlencoded)',
}

/* ------------------------------------------------------------------ */
/* Encoding / decoding with precise errors                             */
/* ------------------------------------------------------------------ */

function formEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function encodeWith(mode: EncodeMode, value: string): string {
  if (mode === 'uri') return encodeURI(value)
  if (mode === 'form') return formEncode(value)
  return encodeURIComponent(value)
}

/**
 * A percent-decoder that reports the exact position of a malformed escape,
 * instead of the browser's bare "URI malformed".
 */
export function percentDecode(input: string, plusAsSpace: boolean): string {
  const bytes: number[] = []
  let buffer = ''
  const flush = () => {
    if (!buffer) return
    for (const byte of utf8Encode(buffer)) bytes.push(byte)
    buffer = ''
  }

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '%') {
      flush()
      const hex = input.slice(i + 1, i + 3)
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
        throw new Error(
          `Broken escape at position ${i + 1}: “%” must be followed by two hexadecimal digits, but the input has “${input.slice(i, i + 3)}”. A literal percent sign has to be written as %25.`,
        )
      }
      bytes.push(Number.parseInt(hex, 16))
      i += 2
    } else if (plusAsSpace && ch === '+') {
      flush()
      bytes.push(0x20)
    } else {
      buffer += ch
    }
  }
  flush()

  try {
    return utf8Decode(new Uint8Array(bytes))
  } catch {
    throw new Error(
      'The escaped bytes are not valid UTF-8. A multi-byte sequence is probably truncated. Check that every %XX of a character is present.',
    )
  }
}

/* ------------------------------------------------------------------ */
/* Query string model                                                  */
/* ------------------------------------------------------------------ */

interface Param {
  id: number
  key: string
  value: string
}

interface ParsedUrl {
  base: string
  params: Param[]
  hash: string
}

let paramId = 0
const nextParamId = () => ++paramId

function parseUrl(input: string): ParsedUrl {
  const trimmed = input.trim()
  let rest = trimmed
  let base = ''
  let hash = ''

  const hashAt = rest.indexOf('#')
  if (hashAt >= 0) {
    hash = rest.slice(hashAt + 1)
    rest = rest.slice(0, hashAt)
  }

  const queryAt = rest.indexOf('?')
  if (queryAt >= 0) {
    base = rest.slice(0, queryAt)
    rest = rest.slice(queryAt + 1)
  } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(rest) || rest.startsWith('/')) {
    base = rest
    rest = ''
  }

  const safeDecode = (part: string): string => {
    try {
      return percentDecode(part, true)
    } catch {
      return part
    }
  }

  const params: Param[] = rest
    .split(/[&;]/)
    .filter((pair) => pair.length > 0)
    .map((pair) => {
      const eq = pair.indexOf('=')
      const rawKey = eq >= 0 ? pair.slice(0, eq) : pair
      const rawValue = eq >= 0 ? pair.slice(eq + 1) : ''
      return { id: nextParamId(), key: safeDecode(rawKey), value: safeDecode(rawValue) }
    })

  return { base, params, hash }
}

function buildUrl(parsed: ParsedUrl, mode: EncodeMode): string {
  const encode = (value: string) => (mode === 'form' ? formEncode(value) : encodeURIComponent(value))
  const query = parsed.params
    .filter((p) => p.key.length > 0 || p.value.length > 0)
    .map((p) => `${encode(p.key)}=${encode(p.value)}`)
    .join('&')
  const hash = parsed.hash ? `#${parsed.hash}` : ''
  if (!query) return `${parsed.base}${hash}`
  return `${parsed.base}?${query}${hash}`
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const SAMPLE_URL =
  'https://example.com/search?q=caf%C3%A9%20cr%C3%A8me&page=2&tags=a%2Cb&utm_source=news+letter#results'

export default function UrlEncoderDecoder() {
  /* --- convert tab ------------------------------------------------ */
  const [direction, setDirection] = useState<Direction>('encode')
  const [mode, setMode] = useState<EncodeMode>('component')
  const [text, setText] = useState('')

  const converted = useMemo<{ output: string; error: string | null }>(() => {
    if (!text) return { output: '', error: null }
    try {
      if (direction === 'encode') return { output: encodeWith(mode, text), error: null }
      return { output: percentDecode(text, mode === 'form'), error: null }
    } catch (error) {
      return { output: '', error: error instanceof Error ? error.message : String(error) }
    }
  }, [text, direction, mode])

  const escapedCount = useMemo(
    () => (converted.output.match(/%[0-9a-fA-F]{2}/g)?.length ?? 0),
    [converted.output],
  )

  /* --- query tab -------------------------------------------------- */
  const [queryInput, setQueryInput] = useState(SAMPLE_URL)
  const [parsed, setParsed] = useState<ParsedUrl>(() => parseUrl(SAMPLE_URL))
  const [queryMode, setQueryMode] = useState<EncodeMode>('component')

  const reparse = useCallback((value: string) => {
    setQueryInput(value)
    setParsed(parseUrl(value))
  }, [])

  const updateParam = useCallback((id: number, patch: Partial<Omit<Param, 'id'>>) => {
    setParsed((current) => ({
      ...current,
      params: current.params.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }, [])

  const removeParam = useCallback((id: number) => {
    setParsed((current) => ({ ...current, params: current.params.filter((p) => p.id !== id) }))
  }, [])

  const addParam = useCallback(() => {
    setParsed((current) => ({
      ...current,
      params: [...current.params, { id: nextParamId(), key: '', value: '' }],
    }))
  }, [])

  const rebuilt = useMemo(() => buildUrl(parsed, queryMode), [parsed, queryMode])

  return (
    <Tabs defaultValue="convert" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="convert">Encode / decode</TabsTrigger>
        <TabsTrigger value="query">Query string</TabsTrigger>
      </TabsList>

      {/* ---------------------------------------------------------- */}
      <TabsContent value="convert" className="mt-4 flex flex-col gap-4">
        <ToolPanel
          title="Percent encoding"
          description="Pick the function that matches where the value is going: a whole URL, a single query value, or a form body."
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Segmented
              label="Direction"
              value={direction}
              onChange={setDirection}
              options={[
                { value: 'encode', label: 'Encode' },
                { value: 'decode', label: 'Decode' },
              ]}
            />
            <Segmented
              label="Encoding rule"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'component', label: 'Component', title: 'encodeURIComponent: escapes : / ? # & = too' },
                { value: 'uri', label: 'Full URL', title: 'encodeURI: keeps URL structure characters' },
                { value: 'form', label: 'Form (+)', title: 'application/x-www-form-urlencoded: spaces become +' },
              ]}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setText(converted.output || text)
                setDirection((d) => (d === 'encode' ? 'decode' : 'encode'))
              }}
            >
              <ArrowLeftRight className="size-4" aria-hidden="true" />
              Swap
            </Button>
          </div>

          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            {direction === 'encode' ? (
              <>
                Using <code className="font-mono">{MODE_LABEL[mode]}</code>.{' '}
                {mode === 'uri'
                  ? 'Reserved characters that give a URL its structure (: / ? # [ ] @ ! $ & ’ ( ) * + , ; =) are left alone.'
                  : mode === 'form'
                    ? 'Spaces become +, and ! ’ ( ) * are escaped as well, matching how browsers submit forms.'
                    : 'Everything except A-Z a-z 0-9 - _ . ! ~ * ’ ( ) is escaped, which is what a single query value needs.'}
              </>
            ) : (
              <>
                Decoding {mode === 'form' ? 'treats + as a space' : 'leaves + untouched'}. Switch to
                “Form (+)” if the value came from a submitted form.
              </>
            )}
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <CodePane
              label={direction === 'encode' ? 'Plain text or URL' : 'Encoded text'}
              value={text}
              onChange={setText}
              rows={8}
              copyable
              placeholder={
                direction === 'encode'
                  ? 'https://example.com/search?q=café crème'
                  : 'https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dcaf%C3%A9'
              }
              footer={`${formatNumber(text.length, 0)} characters`}
            />
            <CodePane
              label={direction === 'encode' ? 'Encoded' : 'Decoded'}
              value={converted.output}
              readOnly
              rows={8}
              footer={
                converted.output
                  ? `${formatNumber(converted.output.length, 0)} characters · ${formatNumber(escapedCount, 0)} escape sequences`
                  : undefined
              }
            />
          </div>

          {converted.error ? <ErrorNote title="Cannot decode" message={converted.error} /> : null}

          {!text ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setText(SAMPLE_URL)}
            >
              Load an example
            </Button>
          ) : null}
        </ToolPanel>
      </TabsContent>

      {/* ---------------------------------------------------------- */}
      <TabsContent value="query" className="mt-4 flex flex-col gap-4">
        <ToolPanel
          title="Query string parser and builder"
          description="Paste a URL or a bare query string. Every parameter becomes an editable row; the URL below rebuilds itself with correct encoding."
        >
          <Field label="URL or query string" htmlFor="qs-input">
            <Input
              id="qs-input"
              value={queryInput}
              onChange={(event) => reparse(event.target.value)}
              placeholder="https://example.com/path?a=1&b=two"
              className="font-mono text-[13px]"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </Field>

          <StatChips
            items={[
              { label: 'Base', value: parsed.base || '–' },
              { label: 'Parameters', value: formatNumber(parsed.params.length, 0) },
              { label: 'Fragment', value: parsed.hash || '–' },
            ]}
          />

          <div className="overflow-x-auto rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%] min-w-[8rem]">Key</TableHead>
                  <TableHead className="min-w-[10rem]">Value (decoded)</TableHead>
                  <TableHead className="w-12 text-right">
                    <span className="sr-only">Remove</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.params.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                      No query parameters found. Add one below.
                    </TableCell>
                  </TableRow>
                ) : (
                  parsed.params.map((param, index) => (
                    <TableRow key={param.id}>
                      <TableCell>
                        <Label htmlFor={`qs-key-${param.id}`} className="sr-only">
                          Parameter {index + 1} key
                        </Label>
                        <Input
                          id={`qs-key-${param.id}`}
                          value={param.key}
                          onChange={(event) => updateParam(param.id, { key: event.target.value })}
                          className="h-8 font-mono text-[13px]"
                          spellCheck={false}
                        />
                      </TableCell>
                      <TableCell>
                        <Label htmlFor={`qs-value-${param.id}`} className="sr-only">
                          Parameter {index + 1} value
                        </Label>
                        <Input
                          id={`qs-value-${param.id}`}
                          value={param.value}
                          onChange={(event) => updateParam(param.id, { value: event.target.value })}
                          className="h-8 font-mono text-[13px]"
                          spellCheck={false}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove parameter ${param.key || index + 1}`}
                          onClick={() => removeParam(param.id)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addParam}>
              <Plus className="size-4" aria-hidden="true" />
              Add parameter
            </Button>
            <Segmented
              label="Space encoding"
              value={queryMode}
              onChange={setQueryMode}
              options={[
                { value: 'component', label: '%20' },
                { value: 'form', label: '+' },
              ]}
              className="sm:ml-auto"
            />
          </div>

          <CodePane
            label="Rebuilt URL"
            value={rebuilt}
            readOnly
            rows={3}
            copyable={false}
            footer={`${formatNumber(rebuilt.length, 0)} characters`}
            actions={<CopyButton value={rebuilt} label="Copy URL" />}
          />

          {parsed.params.length === 0 && !parsed.base ? (
            <p className="flex items-center gap-2 rounded-lg bg-muted p-6 text-sm text-muted-foreground">
              <Link2 className="size-4 shrink-0" aria-hidden="true" />
              Paste a URL above to break its query string apart.
            </p>
          ) : null}
        </ToolPanel>
      </TabsContent>
    </Tabs>
  )
}
