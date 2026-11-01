import { useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatBytes, formatNumber } from '@/lib/utils'
import { BusyNote, Segmented, StatTile, TextEditor, useComputed } from './common'
import { countWords, forEachLineChunked, smsInfo, utf8Bytes } from './text-core'

interface CharStats {
  characters: number
  withoutSpaces: number
  withoutWhitespace: number
  letters: number
  digits: number
  spaces: number
  punctuation: number
  other: number
  words: number
  lines: number
  bytes: number
}

const EMPTY: CharStats = {
  characters: 0,
  withoutSpaces: 0,
  withoutWhitespace: 0,
  letters: 0,
  digits: 0,
  spaces: 0,
  punctuation: 0,
  other: 0,
  words: 0,
  lines: 0,
  bytes: 0,
}

const LETTER = /\p{L}/u
const DIGIT = /\p{N}/u
const PUNCT = /[\p{P}\p{S}]/u

const PRESETS = [
  { value: 'twitter', label: 'X / Twitter', limit: 280 },
  { value: 'meta', label: 'Meta description', limit: 155 },
  { value: 'title', label: 'Title tag', limit: 60 },
  { value: 'sms', label: 'SMS', limit: 160 },
  { value: 'custom', label: 'Custom', limit: 0 },
] as const

type PresetId = (typeof PRESETS)[number]['value']

const SAMPLE =
  'Short, specific and finished: that is what a good meta description looks like. Aim for roughly 150 characters so Google can show the whole thing.'

function ProgressRing({ used, limit }: { used: number; limit: number }) {
  const ratio = limit > 0 ? used / limit : 0
  const pct = Math.min(1, ratio)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const over = limit > 0 && used > limit
  const remaining = limit - used

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={`${used} of ${limit} characters used`}>
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            strokeWidth="10"
            className="stroke-muted"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className="stroke-foreground transition-all duration-300"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            transform="rotate(-90 70 70)"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'text-3xl font-semibold tabular-nums',
              'text-foreground',
            )}
          >
            {formatNumber(used, 0)}
          </span>
          <span className="text-xs text-muted-foreground">of {formatNumber(limit, 0)}</span>
        </div>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn('flex items-center gap-1.5 text-sm font-medium', over ? 'text-foreground' : 'text-muted-foreground')}
      >
        {over ? <TriangleAlert className="size-4 shrink-0" aria-hidden="true" /> : null}
        {limit <= 0
          ? 'Set a limit to track it'
          : over
            ? `${formatNumber(-remaining, 0)} characters over`
            : `${formatNumber(remaining, 0)} characters left`}
      </p>
    </div>
  )
}

export default function CharacterCounter() {
  const [text, setText] = useState('')
  const [preset, setPreset] = useState<PresetId>('twitter')
  const [customLimit, setCustomLimit] = useState('500')
  const [countSpaces, setCountSpaces] = useState(true)

  const limit = useMemo(() => {
    if (preset === 'custom') {
      const parsed = Number.parseInt(customLimit, 10)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
    }
    return PRESETS.find((p) => p.value === preset)?.limit ?? 0
  }, [preset, customLimit])

  const { value: stats, busy, progress } = useComputed<CharStats>(
    EMPTY,
    async (ctx) => {
      if (text === '') return EMPTY
      const next: CharStats = { ...EMPTY }
      let lineCount = 0
      await forEachLineChunked(
        text,
        (line) => {
          lineCount++
          next.words += countWords(line)
          for (const ch of line) {
            if (ch === ' ' || ch === '\t') {
              next.spaces++
            } else if (LETTER.test(ch)) next.letters++
            else if (DIGIT.test(ch)) next.digits++
            else if (PUNCT.test(ch)) next.punctuation++
            else next.other++
          }
        },
        { progress: ctx.progress, cancelled: ctx.cancelled },
      )
      next.characters = text.length
      next.lines = lineCount
      next.withoutSpaces = text.length - next.spaces
      next.withoutWhitespace = next.letters + next.digits + next.punctuation + next.other
      next.bytes = utf8Bytes(text)
      return next
    },
    [text],
  )

  const used = countSpaces ? stats.characters : stats.withoutSpaces
  const sms = useMemo(() => smsInfo(text), [text])

  const summary = [
    `Characters (with spaces): ${formatNumber(stats.characters, 0)}`,
    `Characters (no spaces): ${formatNumber(stats.withoutSpaces, 0)}`,
    `Words: ${formatNumber(stats.words, 0)}`,
    `Lines: ${formatNumber(stats.lines, 0)}`,
    `UTF-8 bytes: ${formatNumber(stats.bytes, 0)}`,
    `Letters: ${formatNumber(stats.letters, 0)} · Digits: ${formatNumber(stats.digits, 0)} · Punctuation: ${formatNumber(stats.punctuation, 0)}`,
    `SMS: ${sms.segments} segment(s), ${sms.encoding}`,
  ].join('\n')

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_200px]">
          <div className="space-y-3">
            <TextEditor
              label="Your text"
              value={text}
              onChange={setText}
              rows={12}
              sample={SAMPLE}
              spellCheck
              hint="Counts update as you type. The page also works offline."
            />
            <BusyNote busy={busy} progress={progress} label="Counting characters…" />
          </div>
          <div className="flex flex-col items-center justify-start gap-4 lg:pt-8">
            <ProgressRing used={used} limit={limit} />
            <CopyButton value={summary} label="Copy counts" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Segmented
            label="Character limit"
            value={preset}
            options={PRESETS.map((p) => ({
              value: p.value,
              label: p.value === 'custom' ? 'Custom' : `${p.label} (${p.limit})`,
            }))}
            onChange={setPreset}
          />
          <div className="space-y-1.5">
            <Label htmlFor="custom-limit" className="text-sm font-medium">
              Custom limit
            </Label>
            <Input
              id="custom-limit"
              type="number"
              min={1}
              inputMode="numeric"
              value={customLimit}
              disabled={preset !== 'custom'}
              onChange={(event) => setCustomLimit(event.target.value)}
            />
            <label className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={countSpaces}
                onChange={(event) => setCountSpaces(event.target.checked)}
              />
              Count spaces towards the limit
            </label>
          </div>
        </div>
      </ToolPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <ToolPanel title="Counts" description="Every figure updates on each keystroke.">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="With spaces" value={formatNumber(stats.characters, 0)} accent />
            <StatTile label="Without spaces" value={formatNumber(stats.withoutSpaces, 0)} />
            <StatTile label="Words" value={formatNumber(stats.words, 0)} />
            <StatTile label="Lines" value={formatNumber(stats.lines, 0)} />
            <StatTile
              label="UTF-8 bytes"
              value={formatNumber(stats.bytes, 0)}
              hint={formatBytes(stats.bytes)}
            />
            <StatTile
              label="SMS segments"
              value={formatNumber(sms.segments, 0)}
              hint={`${sms.encoding} · ${formatNumber(sms.perSegment, 0)} per part`}
            />
          </div>
        </ToolPanel>

        <ToolPanel
          title="Character breakdown"
          description="Useful when a field counts bytes, or when a stray symbol breaks an encoding."
        >
          <div className="space-y-3">
            {[
              { label: 'Letters', value: stats.letters, className: 'bg-chart-1' },
              { label: 'Digits', value: stats.digits, className: 'bg-chart-2' },
              { label: 'Punctuation & symbols', value: stats.punctuation, className: 'bg-chart-3' },
              { label: 'Spaces & tabs', value: stats.spaces, className: 'bg-chart-4' },
              { label: 'Other characters', value: stats.other, className: 'bg-chart-5' },
            ].map((row) => {
              const total = stats.characters || 1
              const pct = (row.value / total) * 100
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-foreground">{row.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatNumber(row.value, 0)} · {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', row.className)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground text-pretty">
            UTF-8 bytes differ from characters whenever you use accents (2 bytes), most CJK
            characters (3 bytes) or emoji (4 bytes and often more than one code point). Database
            columns such as <code className="font-mono">VARCHAR(255)</code> usually count bytes,
            not characters.
          </p>
        </ToolPanel>
      </div>
    </div>
  )
}
