import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, FileUp, RotateCcw, TriangleAlert, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import {
  DfCodePane,
  DfField,
  DfProofPanel,
  DfStatus,
  readTextFile,
} from './dev-format-ui'
import {
  DEFAULT_JSON_TO_XML,
  DEFAULT_XML_TO_JSON,
  JSON_TO_XML_SAMPLE,
  XML_TO_JSON_SAMPLE,
  jsonToXml,
  xmlToJson,
} from './dev-format-xmljson'
import { jsonExcerpt, validateJson } from './dev-format-json'

export type XmlJsonDirection = 'xml-to-json' | 'json-to-xml'

export interface DevFormatXmlJsonProps {
  direction?: XmlJsonDirection
}

export default function DevFormatXmlJson({ direction = 'xml-to-json' }: DevFormatXmlJsonProps) {
  const [mode, setMode] = useState<XmlJsonDirection>(direction)
  const [input, setInput] = useState('')
  const [attributePrefix, setAttributePrefix] = useState('@')
  const [textKey, setTextKey] = useState('#text')
  const [forceArray, setForceArray] = useState('')
  const [coerceScalars, setCoerceScalars] = useState(false)
  const [stripNamespaces, setStripNamespaces] = useState(false)
  const [keepComments, setKeepComments] = useState(false)
  const [rootName, setRootName] = useState('root')
  const [declaration, setDeclaration] = useState(true)
  const [indent, setIndent] = useState(2)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const result = useMemo(() => {
    if (input.trim() === '') return null

    if (mode === 'xml-to-json') {
      const converted = xmlToJson(input, {
        ...DEFAULT_XML_TO_JSON,
        attributePrefix,
        textKey,
        forceArray: forceArray.split(',').map((s) => s.trim()).filter(Boolean),
        coerceScalars,
        stripNamespaces,
        keepComments,
      })
      if (!converted.ok) {
        return { kind: 'error' as const, message: converted.message, excerpt: null }
      }
      return {
        kind: 'ok' as const,
        text: JSON.stringify(converted.value, null, indent === 0 ? '\t' : indent),
        notes: converted.notes,
        renamed: [] as { from: string; to: string }[],
      }
    }

    const validation = validateJson(input)
    if (!validation.ok) {
      return {
        kind: 'error' as const,
        message: validation.error.message,
        excerpt: jsonExcerpt(input, validation.error),
      }
    }
    const converted = jsonToXml(validation.value, {
      ...DEFAULT_JSON_TO_XML,
      rootName: rootName || 'root',
      attributePrefix,
      textKey,
      indent,
      declaration,
    })
    return {
      kind: 'ok' as const,
      text: converted.xml,
      notes: [] as string[],
      renamed: converted.renamedKeys,
    }
  }, [
    attributePrefix,
    coerceScalars,
    declaration,
    forceArray,
    indent,
    input,
    keepComments,
    mode,
    rootName,
    stripNamespaces,
    textKey,
  ])

  const output = result?.kind === 'ok' ? result.text : ''

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    setFileError(null)
    try {
      setInput(await readTextFile(file, 24 * 1024 * 1024))
    } catch (caught) {
      setFileError(caught instanceof Error ? caught.message : 'That file could not be read.')
    }
  }, [])

  const blob = useMemo(() => {
    if (!output) return null
    return new Blob([output], {
      type: mode === 'xml-to-json' ? 'application/json' : 'application/xml',
    })
  }, [mode, output])

  const swap = useCallback(() => {
    setMode((current) => (current === 'xml-to-json' ? 'json-to-xml' : 'xml-to-json'))
    setInput(output)
  }, [output])

  const toJson = mode === 'xml-to-json'

  return (
    <div className="space-y-6">
      <ToolPanel
        title={toJson ? 'XML to JSON' : 'JSON to XML'}
        description={
          toJson
            ? 'Convert an XML document into JSON with configurable attribute and text keys. Every lossy decision is an option you control, and the tool tells you when the mapping could not be faithful.'
            : 'Build XML from JSON: keys prefixed with the attribute marker become attributes, the text key becomes element text, and arrays repeat their element.'
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={swap} className="gap-2">
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            {toJson ? 'Switch to JSON → XML' : 'Switch to XML → JSON'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" aria-hidden="true" />
            Load file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xml,.json,.txt,application/xml,application/json,text/plain"
            className="sr-only"
            aria-label="Load a file"
            onChange={(event) => {
              void onFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setInput(toJson ? XML_TO_JSON_SAMPLE : JSON_TO_XML_SAMPLE)}
          >
            <Wand2 className="size-4" aria-hidden="true" />
            Load sample
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={input === ''}
            onClick={() => setInput('')}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Clear
          </Button>
        </div>

        {fileError ? <ErrorNote message={fileError} onRetry={() => setFileError(null)} /> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DfField
            label="Attribute prefix"
            htmlFor="xj-prefix"
            hint="Marks which JSON keys came from XML attributes. Common choices: @, $, _."
          >
            <Input
              id="xj-prefix"
              value={attributePrefix}
              onChange={(event) => setAttributePrefix(event.target.value)}
              className="font-mono"
              maxLength={4}
            />
          </DfField>
          <DfField
            label="Text key"
            htmlFor="xj-textkey"
            hint="Holds an element's text when it also has attributes or children."
          >
            <Input
              id="xj-textkey"
              value={textKey}
              onChange={(event) => setTextKey(event.target.value)}
              className="font-mono"
            />
          </DfField>
          <DfField
            label="Indent"
            htmlFor="xj-indent"
            hint="Spaces of indentation per level. Enter 0 to indent with tabs."
          >
            <Input
              id="xj-indent"
              type="number"
              min={0}
              max={8}
              value={indent}
              onChange={(event) => setIndent(Math.max(0, Math.min(8, Number(event.target.value))))}
            />
          </DfField>

          {toJson ? (
            <DfField
              label="Always arrays"
              htmlFor="xj-force"
              hint="Comma-separated element names that must be arrays even with one occurrence. This fixes code that breaks when a list has exactly one item."
              className="sm:col-span-2"
            >
              <Input
                id="xj-force"
                value={forceArray}
                onChange={(event) => setForceArray(event.target.value)}
                placeholder="item, book, entry"
                className="font-mono"
              />
            </DfField>
          ) : (
            <DfField
              label="Root element name"
              htmlFor="xj-root"
              hint="Used only when the JSON does not already have a single top-level key."
            >
              <Input
                id="xj-root"
                value={rootName}
                onChange={(event) => setRootName(event.target.value)}
                className="font-mono"
              />
            </DfField>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {toJson ? (
            <>
              <div className="flex items-center gap-3">
                <Switch id="xj-coerce" checked={coerceScalars} onCheckedChange={setCoerceScalars} />
                <Label htmlFor="xj-coerce" className="text-sm">
                  Convert "42" to 42 and "true" to true
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="xj-ns" checked={stripNamespaces} onCheckedChange={setStripNamespaces} />
                <Label htmlFor="xj-ns" className="text-sm">
                  Strip namespace prefixes
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="xj-comments" checked={keepComments} onCheckedChange={setKeepComments} />
                <Label htmlFor="xj-comments" className="text-sm">
                  Keep comments
                </Label>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Switch id="xj-decl" checked={declaration} onCheckedChange={setDeclaration} />
              <Label htmlFor="xj-decl" className="text-sm">
                Include the &lt;?xml … ?&gt; declaration
              </Label>
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <DfCodePane
            label={toJson ? 'XML input' : 'JSON input'}
            value={input}
            onChange={setInput}
            rows={18}
            wrap={false}
            invalid={result?.kind === 'error'}
            placeholder={toJson ? '<root><item id="1">Hello</item></root>' : '{ "root": { "item": "Hello" } }'}
          />
          <DfCodePane
            label={toJson ? 'JSON output' : 'XML output'}
            value={output}
            readOnly
            rows={18}
            wrap={false}
            actions={
              output ? (
                <DownloadButton
                  blob={blob}
                  filename={toJson ? 'converted.json' : 'converted.xml'}
                  label="Download"
                  variant="outline"
                  size="sm"
                />
              ) : null
            }
            placeholder="The converted document appears here."
          />
        </div>

        {result?.kind === 'error' ? (
          <div className="space-y-2">
            <DfStatus ok={false}>{result.message}</DfStatus>
            {result.excerpt ? (
              <div className="overflow-x-auto rounded-lg bg-muted px-4 py-3">
                <pre className="w-max min-w-full font-mono text-[13px] whitespace-pre text-foreground">
                  {result.excerpt}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}

        {result?.kind === 'ok' && result.notes.length > 0 ? (
          <ul className="space-y-1.5 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
            {result.notes.map((note) => (
              <li key={note} className="flex items-start gap-2 text-pretty">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0">{note}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {result?.kind === 'ok' && result.renamed.length > 0 ? (
          <div className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
            <p className="flex items-start gap-2 font-medium">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                {result.renamed.length} JSON key
                {result.renamed.length === 1 ? ' was' : 's were'} renamed to be a legal XML element
                name:
              </span>
            </p>
            <ul className="mt-1 space-y-0.5 font-mono text-xs">
              {result.renamed.slice(0, 12).map((pair) => (
                <li key={pair.from}>
                  {pair.from} → {pair.to}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {output ? <CopyButton value={output} label="Copy result" /> : null}
      </ToolPanel>

      <DfProofPanel subject="document" />
    </div>
  )
}
