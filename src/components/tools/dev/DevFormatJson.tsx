import { useCallback, useMemo, useRef, useState } from 'react'
import { FileUp, RotateCcw, Sparkles, TriangleAlert, Wand2 } from 'lucide-react'
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
  JSON_BROKEN_SAMPLE,
  JSON_SAMPLE,
  escapeAsJsonString,
  indentString,
  jsonExcerpt,
  repairJson,
  sortKeysDeep,
  toOneLine,
  unescapeJsonString,
  validateJson,
  type IndentChoice,
} from './dev-format-json'
import { formatBytes } from '@/lib/utils'

export type JsonToolMode = 'validate' | 'lint' | 'minify' | 'oneline' | 'escape' | 'unescape'

export interface DevFormatJsonProps {
  mode?: JsonToolMode
}

const INDENTS: { value: IndentChoice; label: string }[] = [
  { value: '2', label: '2 spaces' },
  { value: '3', label: '3 spaces' },
  { value: '4', label: '4 spaces' },
  { value: 'tab', label: 'Tab' },
]

const TITLES: Record<JsonToolMode, { title: string; description: string; button: string }> = {
  validate: {
    title: 'Validate JSON',
    description:
      'Paste JSON and get the line, column and cause of the first problem. A repair button fixes the mistakes that cause most failures.',
    button: 'Validate',
  },
  lint: {
    title: 'Lint JSON',
    description:
      'A stricter read than a plain parse: syntax errors with position, plus warnings for duplicate keys and integers too large to survive a round trip.',
    button: 'Lint',
  },
  minify: {
    title: 'Minify JSON',
    description:
      'Strip every optional byte of whitespace. The document is parsed first, so a minified result is also a validity guarantee.',
    button: 'Minify',
  },
  oneline: {
    title: 'JSON to one line',
    description:
      'Collapse a formatted document onto a single line for a log field, an environment variable or a shell argument.',
    button: 'Collapse',
  },
  escape: {
    title: 'Escape JSON',
    description:
      'Turn any text, including a whole JSON document, into one JSON string literal that you can put inside another payload.',
    button: 'Escape',
  },
  unescape: {
    title: 'Unescape JSON',
    description:
      'Reverse an escaped string: turn \\" back into ", \\n back into a real newline, and \\uXXXX back into the character.',
    button: 'Unescape',
  },
}

export default function DevFormatJson({ mode = 'validate' }: DevFormatJsonProps) {
  const [input, setInput] = useState('')
  const [indent, setIndent] = useState<IndentChoice>('2')
  const [sortKeys, setSortKeys] = useState(false)
  const [spacedOneLine, setSpacedOneLine] = useState(true)
  const [wrapInQuotes, setWrapInQuotes] = useState(true)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const copy = TITLES[mode]
  const isTextMode = mode === 'escape' || mode === 'unescape'

  const validation = useMemo(() => (isTextMode ? null : validateJson(input)), [input, isTextMode])

  const output = useMemo(() => {
    if (input.trim() === '') return ''
    if (mode === 'escape') {
      const escaped = escapeAsJsonString(input)
      return wrapInQuotes ? escaped : escaped.slice(1, -1)
    }
    if (mode === 'unescape') {
      const result = unescapeJsonString(input)
      return result.ok ? result.value : ''
    }
    if (!validation || !validation.ok) return ''
    const value = sortKeys ? sortKeysDeep(validation.value) : validation.value
    if (mode === 'minify') return JSON.stringify(value)
    if (mode === 'oneline') return toOneLine(value, spacedOneLine)
    return JSON.stringify(value, null, indentString(indent))
  }, [indent, input, mode, sortKeys, spacedOneLine, validation, wrapInQuotes])

  const unescapeError = useMemo(() => {
    if (mode !== 'unescape' || input.trim() === '') return null
    const result = unescapeJsonString(input)
    return result.ok ? null : result.message
  }, [input, mode])

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    setFileError(null)
    try {
      setInput(await readTextFile(file, 24 * 1024 * 1024))
    } catch (caught) {
      setFileError(caught instanceof Error ? caught.message : 'That file could not be read.')
    }
  }, [])

  const applyRepair = useCallback(() => {
    setInput((current) => repairJson(current).text)
  }, [])

  const blob = useMemo(() => {
    if (!output) return null
    const type = isTextMode ? 'text/plain' : 'application/json'
    return new Blob([output], { type })
  }, [isTextMode, output])

  const chips = useMemo(() => {
    if (input.trim() === '') return []
    if (isTextMode) {
      return [
        { label: 'Input', value: formatBytes(input.length) },
        { label: 'Output', value: formatBytes(output.length) },
        { label: 'Characters', value: output.length.toLocaleString() },
      ]
    }
    if (!validation || !validation.ok) return []
    const items = [
      { label: 'Input', value: formatBytes(input.length) },
      { label: 'Output', value: formatBytes(output.length) },
      { label: 'Keys', value: validation.stats.keys.toLocaleString() },
      { label: 'Depth', value: String(validation.stats.depth) },
    ]
    if (mode === 'minify' || mode === 'oneline') {
      const saved = input.length > 0 ? Math.round((1 - output.length / input.length) * 100) : 0
      items.push({ label: 'Saved', value: `${Math.max(0, saved)}%` })
    }
    return items
  }, [input, isTextMode, mode, output, validation])

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
            accept=".json,.txt,.jsonl,application/json,text/plain"
            className="sr-only"
            aria-label="Load a JSON file"
            onChange={(event) => {
              void onFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setInput(mode === 'validate' || mode === 'lint' ? JSON_BROKEN_SAMPLE : JSON_SAMPLE)}
          >
            <Wand2 className="size-4" aria-hidden="true" />
            Load sample
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

        {!isTextMode ? (
          <div className="flex flex-wrap items-end gap-4">
            {mode !== 'minify' && mode !== 'oneline' ? (
              <DfField label="Indent" htmlFor="json-indent" className="w-40">
                <Select value={indent} onValueChange={(value) => setIndent(value as IndentChoice)}>
                  <SelectTrigger id="json-indent" className="w-full">
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
            ) : null}
            <div className="flex items-center gap-3 pb-1">
              <Switch id="json-sort" checked={sortKeys} onCheckedChange={setSortKeys} />
              <Label htmlFor="json-sort" className="text-sm">
                Sort keys A→Z
              </Label>
            </div>
            {mode === 'oneline' ? (
              <div className="flex items-center gap-3 pb-1">
                <Switch
                  id="json-spaced"
                  checked={spacedOneLine}
                  onCheckedChange={setSpacedOneLine}
                />
                <Label htmlFor="json-spaced" className="text-sm">
                  Keep a space after “:” and “,”
                </Label>
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === 'escape' ? (
          <div className="flex items-center gap-3">
            <Switch id="json-quotes" checked={wrapInQuotes} onCheckedChange={setWrapInQuotes} />
            <Label htmlFor="json-quotes" className="text-sm">
              Include the surrounding quotes
            </Label>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <DfCodePane
            label={isTextMode ? 'Input' : 'Your JSON'}
            value={input}
            onChange={setInput}
            rows={16}
            invalid={validation ? !validation.ok && input.trim() !== '' : false}
            placeholder={
              mode === 'unescape'
                ? '"{\\"id\\": 42, \\"name\\": \\"Ada\\"}"'
                : '{ "id": 42, "name": "Ada Lovelace" }'
            }
          />
          <DfCodePane
            label={
              mode === 'minify'
                ? 'Minified'
                : mode === 'oneline'
                  ? 'One line'
                  : mode === 'escape'
                    ? 'Escaped string'
                    : mode === 'unescape'
                      ? 'Unescaped text'
                      : 'Formatted'
            }
            value={output}
            readOnly
            rows={16}
            actions={
              output ? (
                <DownloadButton
                  blob={blob}
                  filename={isTextMode ? 'output.txt' : mode === 'minify' ? 'data.min.json' : 'data.json'}
                  label="Download"
                  variant="outline"
                  size="sm"
                />
              ) : null
            }
            placeholder="The result appears here."
          />
        </div>

        {chips.length > 0 ? <DfStatChips items={chips} /> : null}

        {unescapeError ? <ErrorNote message={unescapeError} /> : null}

        {validation && input.trim() !== '' ? (
          validation.ok ? (
            <div className="space-y-3">
              <DfStatus ok>
                Valid JSON. {validation.stats.objects.toLocaleString()} object
                {validation.stats.objects === 1 ? '' : 's'},{' '}
                {validation.stats.arrays.toLocaleString()} array
                {validation.stats.arrays === 1 ? '' : 's'}, {validation.stats.keys.toLocaleString()}{' '}
                key{validation.stats.keys === 1 ? '' : 's'}, nested {validation.stats.depth} level
                {validation.stats.depth === 1 ? '' : 's'} deep.
              </DfStatus>
              {validation.warnings.length > 0 ? (
                <ul className="space-y-1.5 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                  {validation.warnings.map((warning) => (
                    <li key={warning} className="flex items-start gap-2 text-pretty">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">{warning}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <DfStatus ok={false}>{validation.error.message}</DfStatus>
              {validation.error.hint ? (
                <p className="text-sm text-pretty text-muted-foreground">{validation.error.hint}</p>
              ) : null}
              <div className="overflow-x-auto rounded-lg bg-muted px-4 py-3">
                <pre className="w-max min-w-full font-mono text-[13px] leading-relaxed whitespace-pre text-foreground">
                  {jsonExcerpt(input, validation.error)}
                </pre>
              </div>
              {validation.repairs.length > 0 ? (
                <div className="rounded-lg bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground">
                    {validation.repairs.length} repairable problem
                    {validation.repairs.length === 1 ? '' : 's'} found
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {validation.repairs.map((repair) => (
                      <li key={repair.id} className="text-pretty">
                        {repair.label}{' '}
                        <span className="font-mono text-xs tabular-nums">×{repair.count}</span>
                      </li>
                    ))}
                  </ul>
                  <Button type="button" size="sm" className="mt-3 gap-2" onClick={applyRepair}>
                    <Sparkles className="size-4" aria-hidden="true" />
                    Fix all and re-validate
                  </Button>
                  <p className="mt-2 text-xs text-pretty text-muted-foreground">
                    The repair rewrites your input in place. Strings are never changed: a comma
                    inside <code className="font-mono">"a, b"</code> stays exactly where it is.
                  </p>
                </div>
              ) : null}
            </div>
          )
        ) : null}

        <div className="flex flex-wrap gap-2">
          <CopyButton value={output} label="Copy result" />
          {!isTextMode && output ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setInput(output)}>
              Replace input with result
            </Button>
          ) : null}
        </div>
      </ToolPanel>

      <DfProofPanel subject="JSON" />
    </div>
  )
}
