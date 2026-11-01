import { useCallback, useMemo, useState } from 'react'
import { Check, Copy, CornerDownLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { cn, formatNumber } from '@/lib/utils'
import { BusyNote, CountBar, OutputBox, TextEditor, useComputed } from './common'
import {
  countWords,
  mapLinesChunked,
  toAlternatingCase,
  toCamelCase,
  toConstantCase,
  toDotCase,
  toInverseCase,
  toKebabCase,
  toPascalCase,
  toSentenceCase,
  toSnakeCase,
  toTitleCase,
} from './text-core'

const SAMPLE = `the quick brown fox jumps over the lazy dog
user profile settings
HTTP response code`

interface CaseDef {
  id: string
  label: string
  description: string
  transform: (line: string) => string
}

const CASES: CaseDef[] = [
  {
    id: 'upper',
    label: 'UPPER CASE',
    description: 'Every letter capitalised.',
    transform: (line) => line.toUpperCase(),
  },
  {
    id: 'lower',
    label: 'lower case',
    description: 'Every letter in lowercase.',
    transform: (line) => line.toLowerCase(),
  },
  {
    id: 'title',
    label: 'Title Case',
    description: 'Headline style. Short words such as “of” and “the” stay lowercase.',
    transform: (line) => toTitleCase(line),
  },
  {
    id: 'capitalized',
    label: 'Capitalised Each Word',
    description: 'Every word capitalised, with no small-word exceptions.',
    transform: (line) => line.toLowerCase().replace(/(^|[\s"'([{])(\p{L})/gu, (_m, pre: string, c: string) => pre + c.toUpperCase()),
  },
  {
    id: 'sentence',
    label: 'Sentence case',
    description: 'First letter of each sentence capitalised, the rest lowercase.',
    transform: (line) => toSentenceCase(line),
  },
  {
    id: 'camel',
    label: 'camelCase',
    description: 'Joined words, first one lowercase. Common in JavaScript.',
    transform: (line) => toCamelCase(line),
  },
  {
    id: 'pascal',
    label: 'PascalCase',
    description: 'Joined words, every one capitalised. Class names, React components.',
    transform: (line) => toPascalCase(line),
  },
  {
    id: 'snake',
    label: 'snake_case',
    description: 'Lowercase words joined with underscores. Python, SQL columns.',
    transform: (line) => toSnakeCase(line),
  },
  {
    id: 'kebab',
    label: 'kebab-case',
    description: 'Lowercase words joined with hyphens. URLs, CSS classes.',
    transform: (line) => toKebabCase(line),
  },
  {
    id: 'constant',
    label: 'CONSTANT_CASE',
    description: 'Uppercase with underscores. Environment variables.',
    transform: (line) => toConstantCase(line),
  },
  {
    id: 'dot',
    label: 'dot.case',
    description: 'Lowercase words joined with dots. Config keys, namespaces.',
    transform: (line) => toDotCase(line),
  },
  {
    id: 'alternating',
    label: 'aLtErNaTiNg',
    description: 'Alternating lower and upper letters.',
    transform: (line) => toAlternatingCase(line),
  },
  {
    id: 'inverse',
    label: 'iNVERSE cASE',
    description: 'Swaps the case of every letter. Fixes text typed with Caps Lock on by mistake.',
    transform: (line) => toInverseCase(line),
  },
]

const PREVIEW_CHARS = 90

function previewOf(text: string, transform: (line: string) => string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== '') ?? ''
  const slice = firstLine.slice(0, 400)
  const out = transform(slice)
  return out.length > PREVIEW_CHARS ? `${out.slice(0, PREVIEW_CHARS)}…` : out
}

/** Clipboard fallback for browsers without a secure-context clipboard API. */
function legacyCopy(value: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  textarea.remove()
  return ok
}

/** Copies a value produced on demand, so huge inputs are only converted once. */
function QuickCopy({ produce, label }: { produce: () => Promise<string>; label: string }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1.5"
      aria-label={label}
      onClick={async () => {
        let value = ''
        try {
          value = await produce()
          if (window.isSecureContext && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value)
          } else if (!legacyCopy(value)) {
            throw new Error('clipboard unavailable')
          }
          setFailed(false)
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        } catch {
          if (value !== '' && legacyCopy(value)) {
            setCopied(true)
            setTimeout(() => setCopied(false), 1800)
            return
          }
          setFailed(true)
          setTimeout(() => setFailed(false), 2500)
        }
      }}
    >
      {copied ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
      <span className="text-xs">{copied ? 'Copied' : failed ? 'Press Ctrl+C' : 'Copy'}</span>
    </Button>
  )
}

export default function CaseConverter() {
  const [text, setText] = useState('')
  const [activeId, setActiveId] = useState('title')

  const active = useMemo(() => CASES.find((c) => c.id === activeId) ?? CASES[0], [activeId])

  const convert = useCallback(
    async (
      transform: (line: string) => string,
      ctx?: { progress?: (p: number) => void; cancelled?: () => boolean },
    ) => {
      if (text === '') return ''
      const lines = await mapLinesChunked(text, transform, ctx)
      return lines.join('\n')
    },
    [text],
  )

  const { value: output, busy, progress } = useComputed<string>(
    '',
    (ctx) => convert(active.transform, { progress: ctx.progress, cancelled: ctx.cancelled }),
    [text, activeId],
  )

  const stats = useMemo(
    () => ({ characters: text.length, words: countWords(text), lines: text === '' ? 0 : text.split(/\r\n|\r|\n/).length }),
    [text],
  )

  return (
    <div className="space-y-6">
      <ToolPanel>
        <TextEditor
          label="Your text"
          value={text}
          onChange={setText}
          rows={8}
          sample={SAMPLE}
          hint="Each line is converted on its own, so a list of headings or variable names all convert at once."
        />
        <CountBar
          items={[
            { label: 'Characters', value: stats.characters },
            { label: 'Words', value: stats.words },
            { label: 'Lines', value: stats.lines },
          ]}
        />
      </ToolPanel>

      <ToolPanel
        title="Pick a case"
        description="Previews use the first line of your text. Copy any style directly, or select it to see the full conversion."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {CASES.map((caseDef) => {
            const selected = caseDef.id === active.id
            const preview = text.trim() === '' ? caseDef.label : previewOf(text, caseDef.transform)
            return (
              <div
                key={caseDef.id}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg p-2.5 transition-colors',
                  selected ? 'ring-2 ring-foreground' : 'hover:bg-muted',
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveId(caseDef.id)}
                  aria-pressed={selected}
                  className="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{caseDef.label}</span>
                    {selected && (
                      <span className="text-xs font-medium text-muted-foreground">
                        Shown below
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                    {preview || '–'}
                  </span>
                </button>
                <QuickCopy
                  label={`Copy text as ${caseDef.label}`}
                  produce={() => convert(caseDef.transform)}
                />
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground text-pretty">
          Title Case keeps articles, conjunctions and short prepositions lowercase unless they
          start or end the line, and leaves existing acronyms such as NASA or API untouched.
        </p>
      </ToolPanel>

      <ToolPanel>
        <BusyNote busy={busy} progress={progress} label="Converting…" />
        <OutputBox
          label={`Result: ${active.label}`}
          value={output}
          filename={`text-${active.id}-case.txt`}
          rows={10}
          empty="Enter some text above and pick a case to see the converted result."
          actions={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={output === ''}
              onClick={() => setText(output)}
            >
              <CornerDownLeft className="size-4" aria-hidden="true" />
              Use as input
            </Button>
          }
        >
          <p className="text-xs text-muted-foreground">
            {formatNumber(output.length, 0)} characters ·{' '}
            {active.description}
          </p>
        </OutputBox>
      </ToolPanel>
    </div>
  )
}
