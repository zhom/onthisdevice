import { useCallback, useMemo, useRef, useState } from 'react'
import { FileUp, RotateCcw, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import {
  DfCodePane,
  DfField,
  DfProofPanel,
  DfStatChips,
  DfStatus,
  readTextFile,
} from './dev-format-ui'
import {
  DEFAULT_XML_FORMAT,
  SOAP_SAMPLE,
  XML_SAMPLE,
  buildXmlTree,
  escapeXml,
  formatXml,
  minifyXml,
  parseXml,
  unescapeXml,
  type XmlTreeNode,
} from './dev-format-xml'
import { formatBytes } from '@/lib/utils'

export type XmlToolMode = 'format' | 'validate' | 'minify' | 'viewer' | 'escape' | 'unescape'

export interface DevFormatXmlProps {
  mode?: XmlToolMode
}

const COPY: Record<XmlToolMode, { title: string; description: string }> = {
  format: {
    title: 'Format XML',
    description:
      'Pretty-print any XML, SOAP envelope, WSDL or config file with real indentation. Elements that mix text and children are left untouched, because their whitespace is significant.',
  },
  validate: {
    title: 'Validate XML',
    description:
      "Check well-formedness with the browser's own XML parser and get the line, column and a plain-English explanation of the first error.",
  },
  minify: {
    title: 'Minify XML',
    description:
      'Remove insignificant whitespace and, optionally, comments. The document is parsed first, so a result means the input was well-formed.',
  },
  viewer: {
    title: 'XML tree viewer',
    description:
      'Explore a large document as a collapsible tree: element names, attributes and text values, with everything expandable from the keyboard.',
  },
  escape: {
    title: 'Escape XML',
    description:
      'Convert &, <, > and quotes into their entity references so a fragment can be embedded safely in element text or an attribute value.',
  },
  unescape: {
    title: 'Unescape XML',
    description:
      'Turn entity references back into characters, including numeric references such as &#160; and &#x00A0;.',
  },
}

const INDENTS = [
  { value: '2', label: '2 spaces' },
  { value: '4', label: '4 spaces' },
  { value: '0', label: 'Tab' },
]

function TreeBranch({ node, depth }: { node: XmlTreeNode; depth: number }) {
  const hasChildren = node.children.length > 0
  const label = (
    <span className="font-mono text-[13px]">
      <span className="text-muted-foreground">&lt;</span>
      <span className="font-semibold text-primary">{node.name}</span>
      {node.attributes.map((attr) => (
        <span key={attr.name}>
          {' '}
          <span className="text-muted-foreground">{attr.name}</span>
          <span className="text-muted-foreground">=</span>
          <span className="text-foreground">"{attr.value}"</span>
        </span>
      ))}
      <span className="text-muted-foreground">&gt;</span>
      {node.text ? <span className="ml-2 text-foreground">{node.text}</span> : null}
    </span>
  )

  if (!hasChildren) {
    return (
      <li className="py-0.5" style={{ paddingLeft: `${depth * 12}px` }}>
        <span className="inline-block pl-[22px]">{label}</span>
      </li>
    )
  }

  return (
    <li style={{ paddingLeft: `${depth * 12}px` }}>
      <details open={depth < 2} className="group">
        <summary className="flex cursor-pointer list-none items-start gap-1.5 rounded py-0.5 hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
          <span
            className="mt-0.5 inline-block w-4 shrink-0 text-center font-mono text-xs text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden="true"
          >
            ▶
          </span>
          {label}
          <span className="ml-1 shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {node.children.length}
          </span>
        </summary>
        <ul>
          {node.children.map((child) => (
            <TreeBranch key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      </details>
    </li>
  )
}

export default function DevFormatXml({ mode = 'format' }: DevFormatXmlProps) {
  const [input, setInput] = useState('')
  const [indent, setIndent] = useState('2')
  const [keepComments, setKeepComments] = useState(true)
  const [selfClose, setSelfClose] = useState(true)
  const [collapseText, setCollapseText] = useState(true)
  const [escapeQuotes, setEscapeQuotes] = useState(true)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const copy = COPY[mode]
  const isTextMode = mode === 'escape' || mode === 'unescape'

  const outcome = useMemo(() => {
    if (input.trim() === '') return null
    if (mode === 'escape') return { kind: 'text' as const, text: escapeXml(input, escapeQuotes) }
    if (mode === 'unescape') return { kind: 'text' as const, text: unescapeXml(input) }

    if (mode === 'minify') {
      const result = minifyXml(input, {
        stripComments: !keepComments,
        collapseText,
        keepDeclaration: true,
        selfClose,
      })
      if ('ok' in result) return { kind: 'error' as const, error: result }
      const minified = result
      return {
        kind: 'xml' as const,
        text: minified.xml,
        notes: [] as string[],
        chips: [
          { label: 'Before', value: formatBytes(minified.before) },
          { label: 'After', value: formatBytes(minified.after) },
          {
            label: 'Saved',
            value: `${Math.max(0, Math.round((1 - minified.after / minified.before) * 100))}%`,
          },
        ],
      }
    }

    if (mode === 'viewer') {
      const parsed = parseXml(input)
      if (!parsed.ok) return { kind: 'error' as const, error: parsed }
      return { kind: 'tree' as const, tree: buildXmlTree(parsed.doc) }
    }

    const result = formatXml(input, {
      ...DEFAULT_XML_FORMAT,
      indent: Number(indent),
      keepComments,
      selfClose,
    })
    if ('ok' in result) return { kind: 'error' as const, error: result }
    const formatted = result
    return {
      kind: 'xml' as const,
      text: formatted.xml,
      notes: formatted.notes,
      chips: [
        { label: 'Elements', value: formatted.elements.toLocaleString() },
        { label: 'Attributes', value: formatted.attributes.toLocaleString() },
        { label: 'Max depth', value: String(formatted.maxDepth + 1) },
        { label: 'Size', value: formatBytes(formatted.xml.length) },
      ],
    }
  }, [collapseText, escapeQuotes, indent, input, keepComments, mode, selfClose])

  const output: string =
    outcome && (outcome.kind === 'text' || outcome.kind === 'xml') ? outcome.text : ''

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    setFileError(null)
    try {
      setInput(await readTextFile(file, 24 * 1024 * 1024))
    } catch (caught) {
      setFileError(caught instanceof Error ? caught.message : 'That file could not be read.')
    }
  }, [])

  const blob = useMemo(
    () => (output ? new Blob([output], { type: isTextMode ? 'text/plain' : 'application/xml' }) : null),
    [isTextMode, output],
  )

  /** Three lines around the reported error line, with a gutter. */
  const errorExcerpt = useMemo(() => {
    if (outcome?.kind !== 'error') return null
    const line = outcome.error.line
    if (line === null) return null
    const lines = input.split('\n')
    const from = Math.max(0, line - 2)
    const to = Math.min(lines.length, line + 1)
    const gutter = String(to).length
    return lines
      .slice(from, to)
      .map((text, i) => `${String(from + i + 1).padStart(gutter, ' ')} │ ${text}`)
      .join('\n')
  }, [input, outcome])

  return (
    <div className="space-y-6">
      <ToolPanel title={copy.title} description={copy.description}>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" aria-hidden="true" />
            Load file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xml,.svg,.wsdl,.xsd,.rss,.atom,.config,.plist,.txt,application/xml,text/xml"
            className="sr-only"
            aria-label="Load an XML file"
            onChange={(event) => {
              void onFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => setInput(XML_SAMPLE)}>
            <Wand2 className="size-4" aria-hidden="true" />
            Load sample
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setInput(SOAP_SAMPLE)}>
            Load SOAP sample
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={input === ''}
            onClick={() => {
              setInput('')
              setFileError(null)
            }}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Clear
          </Button>
        </div>

        {fileError ? <ErrorNote message={fileError} onRetry={() => setFileError(null)} /> : null}

        {mode === 'format' ? (
          <div className="flex flex-wrap items-end gap-4">
            <DfField label="Indent" htmlFor="xml-indent" className="w-40">
              <Select value={indent} onValueChange={setIndent}>
                <SelectTrigger id="xml-indent" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDENTS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DfField>
            <div className="flex items-center gap-3 pb-1">
              <Switch id="xml-comments" checked={keepComments} onCheckedChange={setKeepComments} />
              <Label htmlFor="xml-comments" className="text-sm">
                Keep comments
              </Label>
            </div>
            <div className="flex items-center gap-3 pb-1">
              <Switch id="xml-selfclose" checked={selfClose} onCheckedChange={setSelfClose} />
              <Label htmlFor="xml-selfclose" className="text-sm">
                Collapse empty tags to &lt;a/&gt;
              </Label>
            </div>
          </div>
        ) : null}

        {mode === 'minify' ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <Switch
                id="xml-min-comments"
                checked={!keepComments}
                onCheckedChange={(checked) => setKeepComments(!checked)}
              />
              <Label htmlFor="xml-min-comments" className="text-sm">
                Remove comments
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="xml-collapse" checked={collapseText} onCheckedChange={setCollapseText} />
              <Label htmlFor="xml-collapse" className="text-sm">
                Collapse whitespace inside text
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="xml-min-self" checked={selfClose} onCheckedChange={setSelfClose} />
              <Label htmlFor="xml-min-self" className="text-sm">
                Self-close empty tags
              </Label>
            </div>
          </div>
        ) : null}

        {mode === 'escape' ? (
          <div className="flex items-center gap-3">
            <Switch id="xml-quotes" checked={escapeQuotes} onCheckedChange={setEscapeQuotes} />
            <Label htmlFor="xml-quotes" className="text-sm">
              Also escape " and ' (needed inside attribute values)
            </Label>
          </div>
        ) : null}

        <div className={mode === 'viewer' ? 'space-y-4' : 'grid gap-4 lg:grid-cols-2'}>
          <DfCodePane
            label={isTextMode ? 'Input' : 'Your XML'}
            value={input}
            onChange={setInput}
            rows={mode === 'viewer' ? 10 : 16}
            wrap={false}
            invalid={outcome?.kind === 'error'}
            placeholder={'<?xml version="1.0"?>\n<root>\n  <item id="1">Hello</item>\n</root>'}
          />

          {mode === 'viewer' ? (
            <div className="rounded-lg bg-card">
              <div className="px-4 py-2 text-sm font-medium text-foreground">
                Document tree
              </div>
              <div className="max-h-[28rem] overflow-auto p-3">
                {outcome?.kind === 'tree' ? (
                  <ul>
                    {outcome.tree.map((node) => (
                      <TreeBranch key={node.id} node={node} depth={0} />
                    ))}
                  </ul>
                ) : (
                  <p className="p-4 text-sm text-muted-foreground">
                    Paste or load an XML document to explore it here. Every branch is a native
                    disclosure element, so Tab and Enter expand it without a mouse.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <DfCodePane
              label={
                mode === 'minify'
                  ? 'Minified'
                  : mode === 'escape'
                    ? 'Escaped'
                    : mode === 'unescape'
                      ? 'Unescaped'
                      : 'Formatted'
              }
              value={output}
              readOnly
              rows={16}
              wrap={mode === 'minify'}
              actions={
                output ? (
                  <DownloadButton
                    blob={blob}
                    filename={isTextMode ? 'output.txt' : mode === 'minify' ? 'document.min.xml' : 'document.xml'}
                    label="Download"
                    variant="outline"
                    size="sm"
                  />
                ) : null
              }
              placeholder="The result appears here."
            />
          )}
        </div>

        {outcome?.kind === 'xml' && outcome.chips.length > 0 ? (
          <DfStatChips items={outcome.chips} />
        ) : null}

        {outcome?.kind === 'error' ? (
          <div className="space-y-2">
            <DfStatus ok={false}>
              {outcome.error.message}
              {outcome.error.line !== null ? (
                <>
                  {' '}
                  <span className="font-medium">
                    (line {outcome.error.line}
                    {outcome.error.column !== null ? `, column ${outcome.error.column}` : ''})
                  </span>
                </>
              ) : null}
            </DfStatus>
            {errorExcerpt ? (
              <div className="overflow-x-auto rounded-lg bg-muted px-4 py-3">
                <pre className="w-max min-w-full font-mono text-[13px] whitespace-pre text-foreground">
                  {errorExcerpt}
                </pre>
              </div>
            ) : null}
            {outcome.error.raw ? (
              <details className="rounded-lg bg-card px-4 py-2 text-sm">
                <summary className="cursor-pointer font-medium text-foreground">
                  Raw parser message
                </summary>
                <p className="mt-2 font-mono text-xs break-words text-muted-foreground">
                  {outcome.error.raw}
                </p>
              </details>
            ) : null}
          </div>
        ) : null}

        {outcome && outcome.kind !== 'error' && !isTextMode ? (
          <DfStatus ok>Well-formed XML. The browser&rsquo;s own parser accepted this document.</DfStatus>
        ) : null}

        {outcome?.kind === 'xml' && outcome.notes.length > 0 ? (
          <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            {outcome.notes.map((note) => (
              <p key={note} className="text-pretty">
                {note}
              </p>
            ))}
          </div>
        ) : null}

        {output ? (
          <div className="flex flex-wrap gap-2">
            <CopyButton value={output} label="Copy result" />
            <Button type="button" variant="outline" size="sm" onClick={() => setInput(output)}>
              Replace input with result
            </Button>
          </div>
        ) : null}
      </ToolPanel>

      <DfProofPanel subject="XML" />
    </div>
  )
}
