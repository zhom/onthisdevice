import { useMemo, useState } from 'react'
import { Download, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { cn, downloadBlob, formatNumber } from '@/lib/utils'
import {
  BusyNote,
  Segmented,
  StatTile,
  TextEditor,
  ToggleRow,
  useComputed,
} from './common'
import {
  analyzeText,
  EMPTY_STATS,
  formatDuration,
  smsInfo,
  type TextStats,
} from './text-core'

const SAMPLE = `The best time to plant a tree was twenty years ago. The second best time is now.

Writing well is mostly rewriting. Cut the words that do no work, keep the ones that carry meaning, and read the result out loud. If you run out of breath, the sentence is too long.

Word counters are useful precisely because they are boring: they turn a vague feeling that a draft is "too long" into a number you can act on.`

const READING_SPEEDS = [
  { value: '150', label: 'Slow · 150 wpm' },
  { value: '238', label: 'Average · 238 wpm' },
  { value: '350', label: 'Fast · 350 wpm' },
] as const

const PHRASE_OPTIONS = [
  { value: '1', label: '1 word' },
  { value: '2', label: '2 words' },
  { value: '3', label: '3 words' },
] as const

interface LimitDef {
  name: string
  limit: number
  note: string
}

const LIMITS: LimitDef[] = [
  { name: 'X / Twitter post', limit: 280, note: 'Standard post limit' },
  { name: 'Meta description', limit: 155, note: 'Before Google truncates' },
  { name: 'Title tag', limit: 60, note: 'Typical SERP cut-off' },
  { name: 'Instagram caption', limit: 2200, note: 'Hard limit' },
  { name: 'LinkedIn post', limit: 3000, note: 'Hard limit' },
]

function LimitBar({ used, limit, name, note }: { used: number; limit: number; name: string; note: string }) {
  const pct = Math.min(100, (used / limit) * 100)
  const over = used > limit
  const remaining = limit - used
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">{name}</span>
        <span className={cn('tabular-nums', over ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
          {formatNumber(used, 0)} / {formatNumber(limit, 0)}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${name}: ${used} of ${limit} characters used`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {over ? <TriangleAlert className="size-3.5 shrink-0 text-foreground" aria-hidden="true" /> : null}
        <span>{over ? `${formatNumber(-remaining, 0)} over the limit` : `${formatNumber(remaining, 0)} left`} · {note}</span>
      </p>
    </div>
  )
}

function buildReport(text: string, stats: TextStats): string {
  const sms = smsInfo(text)
  const lines = [
    'Text statistics from onthisdevice.com/word-counter',
    '',
    `Words:                    ${formatNumber(stats.words, 0)}`,
    `Unique words:             ${formatNumber(stats.uniqueWords, 0)}`,
    `Characters (with spaces): ${formatNumber(stats.characters, 0)}`,
    `Characters (no spaces):   ${formatNumber(stats.charactersNoSpaces, 0)}`,
    `Sentences:                ${formatNumber(stats.sentences, 0)}`,
    `Paragraphs:               ${formatNumber(stats.paragraphs, 0)}`,
    `Lines:                    ${formatNumber(stats.lines, 0)}`,
    `Bytes (UTF-8):            ${formatNumber(stats.bytes, 0)}`,
    '',
    `Reading time:             ${formatDuration(stats.readingSeconds)}`,
    `Speaking time:            ${formatDuration(stats.speakingSeconds)}`,
    `Average word length:      ${stats.averageWordLength.toFixed(1)} characters`,
    `Average sentence length:  ${stats.averageSentenceWords.toFixed(1)} words`,
    `Longest sentence:         ${formatNumber(stats.longestSentenceWords, 0)} words`,
    `Longest word:             ${stats.longestWord || '–'}`,
    `Flesch reading ease:      ${Number.isNaN(stats.readingEase) ? '–' : stats.readingEase.toFixed(1)}`,
    `Flesch-Kincaid grade:     ${Number.isNaN(stats.gradeLevel) ? '–' : stats.gradeLevel.toFixed(1)}`,
    `SMS:                      ${sms.segments} segment(s), ${sms.encoding}`,
    '',
    'Top keywords',
    ...stats.keywords.map(
      (k, i) => `${String(i + 1).padStart(2, ' ')}. ${k.term}: ${k.count} (${k.density.toFixed(2)}%)`,
    ),
  ]
  return lines.join('\n')
}

export default function WordCounter() {
  const [text, setText] = useState('')
  const [phrase, setPhrase] = useState<'1' | '2' | '3'>('1')
  const [excludeStopWords, setExcludeStopWords] = useState(true)
  const [readingWpm, setReadingWpm] = useState<'150' | '238' | '350'>('238')

  const { value: stats, busy, progress } = useComputed<TextStats>(
    EMPTY_STATS,
    (ctx) =>
      analyzeText(
        text,
        {
          phraseLength: Number(phrase) as 1 | 2 | 3,
          excludeStopWords,
          readingWpm: Number(readingWpm),
          topKeywords: 20,
        },
        { progress: ctx.progress, cancelled: ctx.cancelled },
      ),
    [text, phrase, excludeStopWords, readingWpm],
  )

  const sms = useMemo(() => smsInfo(text), [text])
  const hasText = text.trim() !== ''
  const readability = useMemo(() => {
    if (Number.isNaN(stats.readingEase)) return null
    const score = stats.readingEase
    if (score >= 90) return 'Very easy (5th grade)'
    if (score >= 80) return 'Easy (6th grade)'
    if (score >= 70) return 'Fairly easy (7th grade)'
    if (score >= 60) return 'Plain English (8th/9th grade)'
    if (score >= 50) return 'Fairly difficult (10th–12th grade)'
    if (score >= 30) return 'Difficult (college level)'
    return 'Very difficult (graduate level)'
  }, [stats.readingEase])

  return (
    <div className="space-y-6">
      <ToolPanel>
        <TextEditor
          label="Your text"
          value={text}
          onChange={setText}
          rows={14}
          sample={SAMPLE}
          spellCheck
          hint="Counts update as you type. Drop a .txt, .md or .csv file onto the box to load it."
        />
        <BusyNote busy={busy} progress={progress} label="Counting…" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Words" value={formatNumber(stats.words, 0)} accent />
          <StatTile
            label="Characters"
            value={formatNumber(stats.characters, 0)}
            hint={`${formatNumber(stats.charactersNoSpaces, 0)} without spaces`}
          />
          <StatTile label="Sentences" value={formatNumber(stats.sentences, 0)} />
          <StatTile label="Paragraphs" value={formatNumber(stats.paragraphs, 0)} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Lines" value={formatNumber(stats.lines, 0)} />
          <StatTile label="Unique words" value={formatNumber(stats.uniqueWords, 0)} />
          <StatTile
            label="Reading time"
            value={formatDuration(stats.readingSeconds)}
            hint={`at ${readingWpm} wpm`}
          />
          <StatTile
            label="Speaking time"
            value={formatDuration(stats.speakingSeconds)}
            hint="at 140 wpm"
          />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <Segmented
            label="Reading speed"
            value={readingWpm}
            options={READING_SPEEDS}
            onChange={setReadingWpm}
          />
          <div className="flex flex-wrap gap-2">
            <CopyButton value={buildReport(text, stats)} label="Copy report" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!hasText}
              onClick={() =>
                downloadBlob(
                  new Blob([buildReport(text, stats)], { type: 'text/plain;charset=utf-8' }),
                  'word-count-report.txt',
                )
              }
            >
              <Download className="size-4" aria-hidden="true" />
              Download report
            </Button>
          </div>
        </div>
      </ToolPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <ToolPanel
          title="Length checks"
          description="Live character budgets for the places this text is most likely to end up."
        >
          <div className="space-y-4">
            {LIMITS.map((limit) => (
              <LimitBar
                key={limit.name}
                name={limit.name}
                limit={limit.limit}
                used={stats.characters}
                note={limit.note}
              />
            ))}
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-foreground">SMS</span>
                <span className="tabular-nums text-muted-foreground">
                  {sms.segments} segment{sms.segments === 1 ? '' : 's'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground text-pretty">
                {sms.encoding} encoding · {formatNumber(sms.units, 0)} of{' '}
                {formatNumber(sms.perSegment * Math.max(1, sms.segments), 0)} units used ·{' '}
                {formatNumber(sms.remaining, 0)} left before another segment is billed.
                {sms.encoding === 'UCS-2'
                  ? ' A non-GSM character (often an emoji or a curly quote) forced 16-bit encoding, which cuts each segment to 70 characters.'
                  : ''}
              </p>
            </div>
          </div>
        </ToolPanel>

        <ToolPanel
          title="Structure and readability"
          description="Averages that tell you whether the writing is dense or easy going."
        >
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Avg word length"
              value={`${stats.averageWordLength.toFixed(1)}`}
              hint="characters"
            />
            <StatTile
              label="Avg sentence"
              value={`${stats.averageSentenceWords.toFixed(1)}`}
              hint="words per sentence"
            />
            <StatTile
              label="Longest sentence"
              value={formatNumber(stats.longestSentenceWords, 0)}
              hint="words"
            />
            <StatTile
              label="Longest word"
              value={stats.longestWord ? stats.longestWord : '–'}
              hint={stats.longestWord ? `${stats.longestWord.length} characters` : undefined}
            />
          </div>
          <div className="rounded-lg bg-muted p-3">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">Flesch reading ease</span>
              <span className="tabular-nums text-foreground">
                {Number.isNaN(stats.readingEase) ? '–' : stats.readingEase.toFixed(1)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground text-pretty">
              {readability
                ? `${readability}. Flesch-Kincaid grade level ${stats.gradeLevel.toFixed(1)}.`
                : 'Add at least ten words and one full sentence to score readability.'}
            </p>
          </div>
        </ToolPanel>
      </div>

      <ToolPanel
        title="Keyword density"
        description="The 20 most frequent terms, with each one's share of all counted terms."
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Segmented
            label="Phrase length"
            value={phrase}
            options={PHRASE_OPTIONS}
            onChange={setPhrase}
          />
          <div className="min-w-56 flex-1">
            <ToggleRow
              label="Ignore common stop words"
              description="Drops “the”, “and”, “of” and friends from the ranking."
              checked={excludeStopWords}
              onChange={setExcludeStopWords}
            />
          </div>
        </div>

        {stats.keywords.length === 0 ? (
          <p className="rounded-md bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
            Keyword density appears once you have entered some text.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-100 border-collapse text-sm">
              <caption className="sr-only">Top keywords by frequency</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">#</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Term</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Count</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Density</th>
                  <th scope="col" className="w-1/3 py-2 font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {stats.keywords.map((keyword, index) => (
                  <tr key={keyword.term} className="border-b border-border last:border-0">
                    <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">{index + 1}</td>
                    <td className="py-1.5 pr-3 font-medium text-foreground break-all">{keyword.term}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{formatNumber(keyword.count, 0)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{keyword.density.toFixed(2)}%</td>
                    <td className="py-1.5">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-chart-1"
                          style={{
                            width: `${Math.max(2, (keyword.count / (stats.keywords[0]?.count || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground text-pretty">
          Density is each term&rsquo;s share of{' '}
          {formatNumber(stats.keywordTotal, 0)} counted terms
          {excludeStopWords ? ' after stop words were removed' : ''}. For SEO copy, 0.5–2.5% for
          your main phrase is a healthy range; above about 4% reads as stuffing.
        </p>
      </ToolPanel>
    </div>
  )
}
