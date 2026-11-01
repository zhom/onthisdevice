import { Fragment, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { Button } from '@/components/ui/button'
import { cn, formatNumber, nextFrame } from '@/lib/utils'
import { BusyNote, OutputBox, Segmented, StatTile, TextEditor, ToggleRow, useComputed } from './common'
import { escapeRegExp, unescapeLiteral } from './text-core'

const SAMPLE = `Invoice 1042, ACME Ltd, due 2026-03-01
Invoice 1043, ACME Ltd, due 2026-03-15
Invoice 1044, Globex Inc, due 2026-04-01`

const MODES = [
  { value: 'text', label: 'Plain text' },
  { value: 'regex', label: 'Regular expression' },
] as const

type Mode = (typeof MODES)[number]['value']

const MAX_MATCHES = 200_000
const PREVIEW_CHARS = 6000
const MAX_LISTED = 20

interface Segment {
  text: string
  changed: boolean
}

interface MatchSample {
  found: string
  replaced: string
  line: number
}

interface Result {
  output: string
  matches: number
  error: string | null
  before: Segment[]
  after: Segment[]
  previewTruncated: boolean
  samples: MatchSample[]
}

const EMPTY: Result = {
  output: '',
  matches: 0,
  error: null,
  before: [],
  after: [],
  previewTruncated: false,
  samples: [],
}

/** Expands `$1`, `$<name>`, `$&`, `` $` ``, `$'` and `$$` like String.replace does. */
function expandReplacement(template: string, match: RegExpExecArray, input: string): string {
  return template.replace(
    /\$(\$|&|`|'|<([^>]*)>|\d{1,2})/g,
    (whole: string, token: string, name: string | undefined) => {
      if (token === '$') return '$'
      if (token === '&') return match[0]
      if (token === '`') return input.slice(0, match.index)
      if (token === "'") return input.slice(match.index + match[0].length)
      if (name !== undefined) return match.groups?.[name] ?? ''
      const index = Number.parseInt(token, 10)
      if (index >= 1 && index < match.length) return match[index] ?? ''
      return whole
    },
  )
}

function buildRegex(
  pattern: string,
  mode: Mode,
  options: { caseSensitive: boolean; wholeWord: boolean; multiline: boolean; dotAll: boolean },
): RegExp {
  let source = mode === 'regex' ? pattern : escapeRegExp(unescapeLiteral(pattern))
  if (options.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`
  let flags = 'gu'
  if (!options.caseSensitive) flags += 'i'
  if (options.multiline) flags += 'm'
  if (options.dotAll) flags += 's'
  try {
    return new RegExp(source, flags)
  } catch (error) {
    // The `u` flag rejects some legacy escapes (\d inside classes is fine, but
    // things like \- are not). Retry without it before giving up.
    if (options.wholeWord) source = `\\b(?:${mode === 'regex' ? pattern : escapeRegExp(unescapeLiteral(pattern))})\\b`
    const fallbackFlags = flags.replace('u', '')
    try {
      return new RegExp(source, fallbackFlags)
    } catch {
      throw error instanceof Error ? error : new Error('Invalid pattern')
    }
  }
}

export default function FindAndReplace() {
  const [text, setText] = useState('')
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [mode, setMode] = useState<Mode>('text')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [multiline, setMultiline] = useState(true)
  const [dotAll, setDotAll] = useState(false)

  const { value: result, busy, progress } = useComputed<Result>(
    EMPTY,
    async (ctx) => {
      if (text === '' || find === '') {
        return { ...EMPTY, output: text, before: text ? [{ text: text.slice(0, PREVIEW_CHARS), changed: false }] : [] }
      }

      let regex: RegExp
      try {
        regex = buildRegex(find, mode, { caseSensitive, wholeWord, multiline, dotAll })
      } catch (error) {
        return {
          ...EMPTY,
          output: text,
          error:
            mode === 'regex'
              ? `That regular expression is not valid: ${error instanceof Error ? error.message.replace(/^Invalid regular expression: /, '') : 'unknown error'}`
              : 'That search pattern could not be used.',
        }
      }

      // In plain-text mode a literal "$1" must stay a literal "$1".
      const replacementTemplate =
        mode === 'regex' ? unescapeLiteral(replace) : unescapeLiteral(replace).replace(/\$/g, '$$$$')
      const pieces: string[] = []
      const before: Segment[] = []
      const after: Segment[] = []
      const samples: MatchSample[] = []

      let cursor = 0
      let matches = 0
      let previewChars = 0
      let previewTruncated = false
      let lineNumber = 1
      let scannedForLine = 0

      const pushSegment = (list: Segment[], value: string, changed: boolean) => {
        if (previewChars >= PREVIEW_CHARS) {
          previewTruncated = true
          return
        }
        const room = PREVIEW_CHARS - previewChars
        const slice = value.length > room ? `${value.slice(0, room)}…` : value
        if (value.length > room) previewTruncated = true
        const last = list[list.length - 1]
        if (last && last.changed === changed) last.text += slice
        else list.push({ text: slice, changed })
      }

      let match: RegExpExecArray | null
      regex.lastIndex = 0
      while ((match = regex.exec(text)) !== null) {
        if (matches >= MAX_MATCHES) break
        const start = match.index
        const end = start + match[0].length
        const gap = text.slice(cursor, start)
        pieces.push(gap)

        const replacement = expandReplacement(replacementTemplate, match, text)

        if (previewChars < PREVIEW_CHARS) {
          pushSegment(before, gap, false)
          pushSegment(after, gap, false)
          pushSegment(before, match[0], true)
          pushSegment(after, replacement, true)
          previewChars += gap.length + Math.max(match[0].length, replacement.length)
        } else {
          previewTruncated = true
        }

        if (samples.length < MAX_LISTED) {
          for (let i = scannedForLine; i < start; i++) if (text.charCodeAt(i) === 10) lineNumber++
          scannedForLine = start
          samples.push({ found: match[0], replaced: replacement, line: lineNumber })
        }

        pieces.push(replacement)
        matches++

        if (end === start) {
          // Zero-length match: copy one character and step forward.
          if (start >= text.length) {
            cursor = start
            break
          }
          pieces.push(text[start])
          cursor = start + 1
          regex.lastIndex = cursor
        } else {
          cursor = end
        }

        if (matches % 2000 === 0) {
          if (ctx.cancelled()) return EMPTY
          ctx.progress(Math.min(99, (cursor / text.length) * 100))
          await nextFrame()
        }
      }

      const tail = text.slice(cursor)
      pieces.push(tail)
      pushSegment(before, tail, false)
      pushSegment(after, tail, false)

      ctx.progress(100)
      return {
        output: pieces.join(''),
        matches,
        error: null,
        before,
        after,
        previewTruncated,
        samples,
      }
    },
    [text, find, replace, mode, caseSensitive, wholeWord, multiline, dotAll],
    200,
  )

  const noMatches = find !== '' && text !== '' && result.matches === 0 && result.error === null

  return (
    <div className="space-y-6">
      <ToolPanel>
        <TextEditor
          label="Your text"
          value={text}
          onChange={setText}
          rows={10}
          mono
          sample={SAMPLE}
          hint="The search runs on the copy of the text in this tab."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="find-input" className="text-sm font-medium">
              Find
            </Label>
            <Input
              id="find-input"
              value={find}
              spellCheck={false}
              className="font-mono"
              placeholder={mode === 'regex' ? 'Invoice (\\d+)' : 'ACME Ltd'}
              onChange={(event) => setFind(event.target.value)}
              aria-invalid={result.error !== null}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="replace-input" className="text-sm font-medium">
              Replace with
            </Label>
            <Input
              id="replace-input"
              value={replace}
              spellCheck={false}
              className="font-mono"
              placeholder={mode === 'regex' ? 'INV-$1' : 'ACME Limited'}
              onChange={(event) => setReplace(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Segmented label="Match mode" value={mode} options={MODES} onChange={setMode} />
          <div className="flex items-end">
            <p className="text-xs text-muted-foreground text-pretty">
              {mode === 'regex' ? (
                <>
                  JavaScript regex syntax. Use <code className="font-mono">(…)</code> to capture and{' '}
                  <code className="font-mono">$1</code>, <code className="font-mono">$2</code> or{' '}
                  <code className="font-mono">$&lt;name&gt;</code> in the replacement.
                </>
              ) : (
                <>
                  Plain text matching. Escapes such as <code className="font-mono">\n</code> and{' '}
                  <code className="font-mono">\t</code> are still understood in both fields.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ToggleRow
            label="Case sensitive"
            description="Off matches “acme” and “ACME” alike."
            checked={caseSensitive}
            onChange={setCaseSensitive}
          />
          <ToggleRow
            label="Whole words only"
            description="“cat” will not match inside “category”."
            checked={wholeWord}
            onChange={setWholeWord}
          />
          <ToggleRow
            label="Multiline (^ and $)"
            description="Anchors match at every line, not just the whole text."
            checked={multiline}
            onChange={setMultiline}
            disabled={mode !== 'regex'}
          />
          <ToggleRow
            label="Dot matches newline"
            description="The . wildcard also spans line breaks."
            checked={dotAll}
            onChange={setDotAll}
            disabled={mode !== 'regex'}
          />
        </div>
        <BusyNote busy={busy} progress={progress} label="Searching…" />
      </ToolPanel>

      {result.error && <ErrorNote title="Invalid pattern" message={result.error} />}

      <ToolPanel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Matches" value={formatNumber(result.matches, 0)} accent />
          <StatTile label="Characters before" value={formatNumber(text.length, 0)} />
          <StatTile label="Characters after" value={formatNumber(result.output.length, 0)} />
          <StatTile
            label="Difference"
            value={`${result.output.length - text.length >= 0 ? '+' : ''}${formatNumber(result.output.length - text.length, 0)}`}
          />
        </div>

        {noMatches && (
          <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm text-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            No matches for that pattern. Check the case-sensitivity and whole-word options, or
            switch match mode.
          </p>
        )}

        {result.matches > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">Before</span>
              <div className="max-h-64 overflow-auto rounded-md bg-background p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                {result.before.map((segment, i) => (
                  <Fragment key={i}>
                    {segment.changed ? (
                      <mark className="rounded-sm bg-transparent px-0.5 font-semibold text-foreground line-through decoration-2">
                        {segment.text}
                      </mark>
                    ) : (
                      segment.text
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">After</span>
              <div className="max-h-64 overflow-auto rounded-md bg-background p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                {result.after.map((segment, i) => (
                  <Fragment key={i}>
                    {segment.changed ? (
                      <mark className="rounded-sm bg-transparent px-0.5 font-semibold text-foreground underline decoration-2 underline-offset-2">
                        {segment.text}
                      </mark>
                    ) : (
                      segment.text
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        )}
        {result.previewTruncated && (
          <p className="text-xs text-muted-foreground">
            The highlighted preview is limited to the first {formatNumber(PREVIEW_CHARS, 0)}{' '}
            characters. The full result below is complete.
          </p>
        )}

        {result.samples.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-80 border-collapse text-sm">
              <caption className="mb-2 text-left text-xs text-muted-foreground">
                First {result.samples.length} of {formatNumber(result.matches, 0)} matches
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-3 font-medium">Line</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Match</th>
                  <th scope="col" className="py-1.5 font-medium">Becomes</th>
                </tr>
              </thead>
              <tbody>
                {result.samples.map((sample, i) => (
                  <tr key={i} className="border-b border-border last:border-0 align-top">
                    <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">{sample.line}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs break-all">{sample.found}</td>
                    <td className={cn('py-1.5 font-mono text-xs break-all', sample.replaced === '' && 'text-muted-foreground')}>
                      {sample.replaced === '' ? '(removed)' : sample.replaced}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <OutputBox
          label="Result"
          value={result.output}
          filename="find-and-replace.txt"
          rows={12}
          empty="Enter some text and a search term to see the replacement."
          actions={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={result.output === '' || result.matches === 0}
              onClick={() => setText(result.output)}
            >
              Apply to input
            </Button>
          }
        />
      </ToolPanel>
    </div>
  )
}
