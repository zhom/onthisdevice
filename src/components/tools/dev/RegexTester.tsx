import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { BookOpen, CircleAlert, Regex as RegexIcon, TimerReset } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { CodePane, Field, StatChips } from './DevUi'
import { formatNumber } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Worker — a hard timeout is the only real defence against            */
/* catastrophic backtracking, because a running regex cannot be         */
/* interrupted on the main thread.                                      */
/* ------------------------------------------------------------------ */

const WORKER_SOURCE = `
const MAX_MATCHES = 5000;
function toInfo(m) {
  return {
    index: m.index,
    match: m[0],
    groups: Array.prototype.slice.call(m, 1),
    named: m.groups ? Object.assign({}, m.groups) : null
  };
}
self.onmessage = function (event) {
  var req = event.data;
  var re;
  try {
    re = new RegExp(req.pattern, req.flags);
  } catch (err) {
    self.postMessage({ id: req.id, ok: false, error: (err && err.message) ? err.message : String(err) });
    return;
  }
  var matches = [];
  var truncated = false;
  try {
    if (req.flags.indexOf('g') >= 0 || req.flags.indexOf('y') >= 0) {
      var m;
      while ((m = re.exec(req.text)) !== null) {
        matches.push(toInfo(m));
        if (m[0] === '') { re.lastIndex += 1; }
        if (matches.length >= MAX_MATCHES) { truncated = true; break; }
      }
    } else {
      var single = re.exec(req.text);
      if (single) { matches.push(toInfo(single)); }
    }
    var replaced = null;
    if (req.doReplace) {
      replaced = req.text.replace(new RegExp(req.pattern, req.flags), req.replacement);
    }
    self.postMessage({ id: req.id, ok: true, matches: matches, truncated: truncated, replaced: replaced });
  } catch (err) {
    self.postMessage({ id: req.id, ok: false, error: (err && err.message) ? err.message : String(err) });
  }
};
`

interface MatchInfo {
  index: number
  match: string
  groups: (string | undefined)[]
  named: Record<string, string | undefined> | null
}

type WorkerResponse =
  | { id: number; ok: true; matches: MatchInfo[]; truncated: boolean; replaced: string | null }
  | { id: number; ok: false; error: string }

const TIMEOUT_MS = 2000

/* ------------------------------------------------------------------ */
/* Static content                                                      */
/* ------------------------------------------------------------------ */

const FLAGS: { flag: string; name: string; description: string }[] = [
  { flag: 'g', name: 'global', description: 'Find every match, not just the first' },
  { flag: 'i', name: 'ignore case', description: 'Match regardless of upper or lower case' },
  { flag: 'm', name: 'multiline', description: '^ and $ match at every line break' },
  { flag: 's', name: 'dotAll', description: '. also matches newline characters' },
  { flag: 'u', name: 'unicode', description: 'Treat the pattern as Unicode code points; enables \\p{…}' },
  { flag: 'y', name: 'sticky', description: 'Each attempt must start exactly at lastIndex' },
]

const PRESETS: { label: string; pattern: string; flags: string; sample?: string }[] = [
  {
    label: 'Email address',
    pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.-]+',
    flags: 'gi',
    sample: 'Write to ada@example.com or support+billing@mail.example.co.uk today.',
  },
  {
    label: 'URL (http/https)',
    pattern: 'https?://[^\\s<>"\']+',
    flags: 'gi',
    sample: 'See https://onthisdevice.com/regex-tester and http://example.org/a?b=1 for more.',
  },
  {
    label: 'IPv4 address',
    pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b',
    flags: 'g',
    sample: 'Allowed: 192.168.1.10, 10.0.0.255. Rejected: 999.1.1.1',
  },
  {
    label: 'ISO date (YYYY-MM-DD)',
    pattern: '(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])',
    flags: 'g',
    sample: 'Shipped 2026-08-16, invoiced 2026-09-01, void 2026-13-40.',
  },
  {
    label: 'Hex colour',
    pattern: '#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\\b',
    flags: 'gi',
    sample: 'Palette: #fff, #1A2B3C, #12345678, #xyz.',
  },
  {
    label: 'UUID',
    pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}',
    flags: 'gi',
    sample: 'id=0195c1f4-1b2c-7a3d-9e4f-5a6b7c8d9e0f ref=not-a-uuid',
  },
  {
    label: 'Duplicated word',
    pattern: '\\b(\\w+)\\s+\\1\\b',
    flags: 'gi',
    sample: 'This this sentence has has a couple of repeated repeated words.',
  },
  {
    label: 'HTML tag',
    pattern: '</?([a-z][a-z0-9]*)\\b[^>]*>',
    flags: 'gi',
    sample: '<p class="intro">Hello <strong>world</strong></p>',
  },
]

const CHEATSHEET: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Character classes',
    rows: [
      ['.', 'Any character except a newline (any character at all with the s flag)'],
      ['\\d \\D', 'A digit / anything that is not a digit'],
      ['\\w \\W', 'A word character [A-Za-z0-9_] / anything else'],
      ['\\s \\S', 'Whitespace / non-whitespace'],
      ['[abc]', 'Any one of a, b or c'],
      ['[^abc]', 'Any character except a, b or c'],
      ['[a-z]', 'Any character in the range a to z'],
      ['\\p{L}', 'Any Unicode letter (requires the u flag)'],
    ],
  },
  {
    title: 'Anchors and boundaries',
    rows: [
      ['^', 'Start of the string, or of a line with the m flag'],
      ['$', 'End of the string, or of a line with the m flag'],
      ['\\b \\B', 'A word boundary / a position that is not a word boundary'],
      ['(?=…)', 'Lookahead: the next text must match, but is not consumed'],
      ['(?!…)', 'Negative lookahead: the next text must not match'],
      ['(?<=…)', 'Lookbehind: the preceding text must match'],
      ['(?<!…)', 'Negative lookbehind'],
    ],
  },
  {
    title: 'Quantifiers',
    rows: [
      ['*', 'Zero or more'],
      ['+', 'One or more'],
      ['?', 'Zero or one'],
      ['{3}', 'Exactly three'],
      ['{2,}', 'Two or more'],
      ['{2,5}', 'Between two and five'],
      ['*? +? ??', 'Lazy versions: match as little as possible'],
    ],
  },
  {
    title: 'Groups and references',
    rows: [
      ['(…)', 'Capture group, numbered from 1 in order of opening bracket'],
      ['(?:…)', 'Non-capturing group: groups without allocating a number'],
      ['(?<name>…)', 'Named capture group, read back as groups.name'],
      ['\\1', 'Backreference to capture group 1'],
      ['\\k<name>', 'Backreference to a named group'],
      ['a|b', 'Alternation: a or b'],
    ],
  },
  {
    title: 'Replacement tokens',
    rows: [
      ['$&', 'The whole match'],
      ['$1 $2', 'Capture group 1, 2, …'],
      ['$<name>', 'A named capture group'],
      ['$`', 'The text before the match'],
      ["$'", 'The text after the match'],
      ['$$', 'A literal dollar sign'],
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Highlighting                                                        */
/* ------------------------------------------------------------------ */

const HIGHLIGHT_LIMIT = 1000

function highlightMatches(text: string, matches: MatchInfo[]): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0
  const shown = matches.slice(0, HIGHLIGHT_LIMIT)

  shown.forEach((m, i) => {
    if (m.index < cursor) return
    if (m.index > cursor) nodes.push(text.slice(cursor, m.index))
    if (m.match.length === 0) {
      nodes.push(
        <span
          key={`z${i}`}
          className="inline-block h-[1.15em] w-0.5 -mb-[0.2em] bg-foreground"
          title="Zero-length match"
        />,
      )
      cursor = m.index
    } else {
      nodes.push(
        <mark
          key={`m${i}`}
          className={
            i % 2 === 0
              ? 'rounded-sm bg-primary text-primary-foreground'
              : 'rounded-sm bg-background text-foreground underline decoration-2 underline-offset-2'
          }
        >
          {m.match}
        </mark>,
      )
      cursor = m.index + m.match.length
    }
  })

  nodes.push(text.slice(cursor))
  return nodes
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_PATTERN = '(?<word>\\b\\w{5,}\\b)'
const DEFAULT_TEXT =
  'Regular expressions are compact, powerful, and occasionally infuriating.\nTest them here before shipping them into production code.'

export default function RegexTester() {
  const [pattern, setPattern] = useState(DEFAULT_PATTERN)
  const [flags, setFlags] = useState('gm')
  const [text, setText] = useState(DEFAULT_TEXT)
  const [replacement, setReplacement] = useState('[$<word>]')
  const [showReplace, setShowReplace] = useState(false)

  const [matches, setMatches] = useState<MatchInfo[]>([])
  const [replaced, setReplaced] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState<number | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const urlRef = useRef<string | null>(null)
  const requestId = useRef(0)
  const timerRef = useRef<number | null>(null)

  const disposeWorker = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      disposeWorker()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [disposeWorker])

  const getWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current
    if (!urlRef.current) {
      urlRef.current = URL.createObjectURL(
        new Blob([WORKER_SOURCE], { type: 'text/javascript' }),
      )
    }
    const worker = new Worker(urlRef.current)
    workerRef.current = worker
    return worker
  }, [])

  const run = useCallback(() => {
    if (!pattern) {
      setMatches([])
      setReplaced(null)
      setError(null)
      setTimedOut(false)
      setTruncated(false)
      setElapsed(null)
      return
    }

    const id = ++requestId.current
    setRunning(true)
    setTimedOut(false)
    const started = performance.now()

    let worker: Worker
    try {
      worker = getWorker()
    } catch {
      setError('This browser blocked the background worker, so patterns cannot be run safely here.')
      setRunning(false)
      return
    }

    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      if (requestId.current !== id) return
      disposeWorker()
      setRunning(false)
      setTimedOut(true)
      setMatches([])
      setReplaced(null)
      setError(null)
      setElapsed(null)
    }, TIMEOUT_MS)

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data
      if (data.id !== requestId.current) return
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      setRunning(false)
      setElapsed(performance.now() - started)
      if (!data.ok) {
        setError(data.error)
        setMatches([])
        setReplaced(null)
        setTruncated(false)
        return
      }
      setError(null)
      setMatches(data.matches)
      setReplaced(data.replaced)
      setTruncated(data.truncated)
    }

    worker.onerror = () => {
      if (requestId.current !== id) return
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      setRunning(false)
      setError('The pattern crashed the matcher. Simplify it and try again.')
    }

    worker.postMessage({ id, pattern, flags, text, replacement, doReplace: showReplace })
  }, [pattern, flags, text, replacement, showReplace, getWorker, disposeWorker])

  useEffect(() => {
    const id = window.setTimeout(run, 180)
    return () => window.clearTimeout(id)
  }, [run])

  const toggleFlag = useCallback((flag: string, on: boolean) => {
    setFlags((current) => {
      const set = new Set(current.split(''))
      if (on) set.add(flag)
      else set.delete(flag)
      return FLAGS.map((f) => f.flag)
        .filter((f) => set.has(f))
        .join('')
    })
  }, [])

  const groupCount = useMemo(
    () => matches.reduce((max, m) => Math.max(max, m.groups.length), 0),
    [matches],
  )
  const namedKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const m of matches) {
      if (m.named) for (const key of Object.keys(m.named)) keys.add(key)
    }
    return [...keys]
  }, [matches])

  const applyPreset = useCallback((label: string) => {
    const preset = PRESETS.find((p) => p.label === label)
    if (!preset) return
    setPattern(preset.pattern)
    setFlags(preset.flags)
    if (preset.sample) setText(preset.sample)
  }, [])

  const highlighted = useMemo(() => highlightMatches(text, matches), [text, matches])

  return (
    <div className="flex flex-col gap-4">
      <ToolPanel
        title="Pattern"
        description="Written the way you would pass it to new RegExp(), without surrounding slashes."
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="regex-pattern" className="text-sm font-medium">
            Regular expression
          </Label>
          <div className="flex items-stretch gap-0 rounded-md border border-input bg-transparent focus-within:ring-2 focus-within:ring-ring">
            <span
              aria-hidden="true"
              className="flex items-center border-r border-border px-2 font-mono text-sm text-muted-foreground"
            >
              /
            </span>
            <Input
              id="regex-pattern"
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              placeholder="\b\w+@\w+\.\w+\b"
              className="rounded-none border-0 font-mono text-[13px] shadow-none focus-visible:border-0 focus-visible:ring-0"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
            <span
              aria-hidden="true"
              className="flex items-center border-l border-border px-2 font-mono text-sm text-muted-foreground"
            >
              /{flags}
            </span>
          </div>
        </div>

        <fieldset className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg bg-muted p-3">
          <legend className="px-1 text-sm font-medium">Flags</legend>
          {FLAGS.map((f) => (
            <div key={f.flag} className="flex items-center gap-2">
              <Checkbox
                id={`regex-flag-${f.flag}`}
                checked={flags.includes(f.flag)}
                onCheckedChange={(checked) => toggleFlag(f.flag, checked === true)}
              />
              <Label htmlFor={`regex-flag-${f.flag}`} className="text-sm font-normal" title={f.description}>
                <span className="font-mono font-medium">{f.flag}</span>
                <span className="text-muted-foreground"> {f.name}</span>
              </Label>
            </div>
          ))}
        </fieldset>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label="Load a common pattern" htmlFor="regex-preset" className="sm:max-w-xs sm:flex-1">
            <Select onValueChange={applyPreset}>
              <SelectTrigger id="regex-preset">
                <SelectValue placeholder="Choose an example…" />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((preset) => (
                  <SelectItem key={preset.label} value={preset.label}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center gap-2 pb-1">
            <Checkbox
              id="regex-show-replace"
              checked={showReplace}
              onCheckedChange={(checked) => setShowReplace(checked === true)}
            />
            <Label htmlFor="regex-show-replace" className="text-sm font-normal">
              Show replace preview
            </Label>
          </div>
        </div>

        {showReplace ? (
          <Field
            label="Replacement"
            htmlFor="regex-replacement"
            hint="Use $1 for a numbered group, $<name> for a named one, $& for the whole match."
          >
            <Input
              id="regex-replacement"
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
              className="font-mono text-[13px]"
              spellCheck={false}
            />
          </Field>
        ) : null}

        {error ? <ErrorNote title="Invalid regular expression" message={error} /> : null}

        {timedOut ? (
          <ErrorNote
            title="Stopped after 2 seconds"
            message={
              <>
                This pattern is backtracking catastrophically on the test string. It was cancelled
                before it could freeze the page. Nested quantifiers such as{' '}
                <code className="font-mono">(a+)+</code> or <code className="font-mono">{'(\\s*\\w+)*'}</code>{' '}
                are the usual cause. Rewrite the inner quantifier so it cannot match the same text two
                ways. For example, replace <code className="font-mono">{'(\\s*\\w+)*'}</code> with a single
                character class such as <code className="font-mono">{'[\\s\\w]*'}</code>.
              </>
            }
            onRetry={run}
          />
        ) : null}
      </ToolPanel>

      <ToolPanel
        title="Test string"
        description="Matches are highlighted live. Everything runs inside a background worker in your own browser."
      >
        <CodePane
          label="Text to match against"
          value={text}
          onChange={setText}
          rows={8}
          copyable
          placeholder="Paste the text you want to match…"
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" role="status" aria-live="polite">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <RegexIcon className="size-3.5" aria-hidden="true" />
            {running
              ? 'Matching…'
              : `${formatNumber(matches.length, 0)} match${matches.length === 1 ? '' : 'es'}`}
          </span>
          {truncated ? (
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <CircleAlert className="size-3.5" aria-hidden="true" />
              Stopped at the first 5000 matches
            </span>
          ) : null}
          {elapsed !== null && !running ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <TimerReset className="size-3.5" aria-hidden="true" />
              {elapsed < 1 ? '<1' : Math.round(elapsed)} ms
            </span>
          ) : null}
          {groupCount > 0 ? (
            <StatChips
              items={[
                { label: 'Capture groups', value: formatNumber(groupCount, 0) },
                ...(namedKeys.length > 0
                  ? [{ label: 'Named', value: namedKeys.join(', ') }]
                  : []),
              ]}
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Highlighted result</span>
          <div className="max-h-80 overflow-auto rounded-lg bg-muted p-3">
            <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-foreground">
              {text ? highlighted : <span className="text-muted-foreground">Nothing to match yet.</span>}
            </pre>
          </div>
          {matches.length > HIGHLIGHT_LIMIT ? (
            <p className="text-xs text-muted-foreground">
              Only the first {formatNumber(HIGHLIGHT_LIMIT, 0)} matches are highlighted to keep the page
              responsive; the count above is complete.
            </p>
          ) : null}
        </div>
      </ToolPanel>

      {matches.length > 0 ? (
        <ToolPanel
          title="Matches"
          description="Every match with its position and captured groups. Long lists are capped at 200 rows."
        >
          <div className="overflow-x-auto rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-24">Index</TableHead>
                  <TableHead className="min-w-[12rem]">Match</TableHead>
                  {Array.from({ length: groupCount }, (_, i) => (
                    <TableHead key={i} className="min-w-[8rem]">
                      ${i + 1}
                    </TableHead>
                  ))}
                  {namedKeys.map((key) => (
                    <TableHead key={key} className="min-w-[8rem]">
                      {`$<${key}>`}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.slice(0, 200).map((m, i) => (
                  <TableRow key={`${m.index}-${i}`}>
                    <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="tabular-nums">
                      {m.index}–{m.index + m.match.length}
                    </TableCell>
                    <TableCell className="font-mono text-[13px] break-all">
                      {m.match === '' ? (
                        <span className="text-muted-foreground">(zero-length)</span>
                      ) : (
                        m.match
                      )}
                    </TableCell>
                    {Array.from({ length: groupCount }, (_, g) => (
                      <TableCell key={g} className="font-mono text-[13px] break-all">
                        {m.groups[g] === undefined ? (
                          <span className="text-muted-foreground">undefined</span>
                        ) : (
                          m.groups[g]
                        )}
                      </TableCell>
                    ))}
                    {namedKeys.map((key) => (
                      <TableCell key={key} className="font-mono text-[13px] break-all">
                        {m.named?.[key] === undefined ? (
                          <span className="text-muted-foreground">undefined</span>
                        ) : (
                          m.named[key]
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <CopyButton
            value={matches.map((m) => m.match).join('\n')}
            label="Copy all matches"
            variant="outline"
          />
        </ToolPanel>
      ) : null}

      {showReplace && replaced !== null ? (
        <ToolPanel title="Replace preview" description="The test string with every match replaced.">
          <CodePane label="Result" value={replaced} readOnly rows={8} />
        </ToolPanel>
      ) : null}

      <ToolPanel title="Cheatsheet" description="The syntax you look up most often, in one place.">
        <Accordion type="multiple" className="w-full">
          {CHEATSHEET.map((section) => (
            <AccordionItem key={section.title} value={section.title}>
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <BookOpen className="size-4" aria-hidden="true" />
                  {section.title}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {section.rows.map(([token, meaning]) => (
                        <tr key={token} className="border-b border-border last:border-b-0">
                          <td className="w-32 py-1.5 pr-3 align-top font-mono text-[13px] text-foreground">
                            {token}
                          </td>
                          <td className="py-1.5 text-muted-foreground text-pretty">{meaning}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ToolPanel>
    </div>
  )
}
