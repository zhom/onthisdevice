import { useState } from 'react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { cn, formatNumber } from '@/lib/utils'
import { BusyNote, OutputBox, Segmented, StatTile, TextEditor, ToggleRow, useComputed } from './common'
import { forEachLineChunked } from './text-core'

const SAMPLE = `alice@example.com
bob@example.com
Alice@example.com
carol@example.com
bob@example.com
  dave@example.com
carol@example.com`

const MODES = [
  { value: 'dedupe', label: 'Remove duplicates' },
  { value: 'duplicates', label: 'Show only duplicates' },
  { value: 'unique', label: 'Show only unique lines' },
] as const

type Mode = (typeof MODES)[number]['value']

const KEEP = [
  { value: 'first', label: 'Keep first occurrence' },
  { value: 'last', label: 'Keep last occurrence' },
] as const

type Keep = (typeof KEEP)[number]['value']

interface Result {
  text: string
  inputLines: number
  outputLines: number
  removed: number
  /** Lines that are a repeat of an earlier line. */
  repeats: number
  duplicateGroups: number
  blanksRemoved: number
}

const EMPTY: Result = {
  text: '',
  inputLines: 0,
  outputLines: 0,
  removed: 0,
  repeats: 0,
  duplicateGroups: 0,
  blanksRemoved: 0,
}

export default function RemoveDuplicateLines() {
  const [text, setText] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(true)
  const [trim, setTrim] = useState(true)
  const [removeBlank, setRemoveBlank] = useState(false)
  const [showCounts, setShowCounts] = useState(false)
  const [mode, setMode] = useState<Mode>('dedupe')
  const [keep, setKeep] = useState<Keep>('first')

  const { value: result, busy, progress } = useComputed<Result>(
    EMPTY,
    async (ctx) => {
      if (text === '') return EMPTY

      const lines: string[] = []
      await forEachLineChunked(
        text,
        (line) => {
          lines.push(line)
        },
        { progress: (p) => ctx.progress(p * 0.5), cancelled: ctx.cancelled },
      )

      const keyOf = (line: string) => {
        const value = trim ? line.trim() : line
        return caseSensitive ? value : value.toLowerCase()
      }

      const counts = new Map<string, number>()
      let blanksRemoved = 0
      const kept: string[] = []

      for (const line of lines) {
        if (removeBlank && line.trim() === '') {
          blanksRemoved++
          continue
        }
        kept.push(line)
        const key = keyOf(line)
        counts.set(key, (counts.get(key) ?? 0) + 1)
        if (ctx.cancelled()) break
      }

      let duplicateGroups = 0
      for (const count of counts.values()) if (count > 1) duplicateGroups++

      const out: string[] = []
      if (mode === 'dedupe') {
        const seen = new Set<string>()
        if (keep === 'first') {
          for (const line of kept) {
            const key = keyOf(line)
            if (seen.has(key)) continue
            seen.add(key)
            out.push(line)
          }
        } else {
          const lastIndex = new Map<string, number>()
          kept.forEach((line, index) => lastIndex.set(keyOf(line), index))
          kept.forEach((line, index) => {
            if (lastIndex.get(keyOf(line)) === index) out.push(line)
          })
        }
      } else if (mode === 'duplicates') {
        const seen = new Set<string>()
        for (const line of kept) {
          const key = keyOf(line)
          const count = counts.get(key) ?? 0
          if (count > 1 && !seen.has(key)) {
            seen.add(key)
            out.push(showCounts ? `${count}\t${line}` : line)
          }
        }
      } else {
        for (const line of kept) {
          if ((counts.get(keyOf(line)) ?? 0) === 1) out.push(line)
        }
      }

      ctx.progress(100)
      return {
        text: out.join('\n'),
        inputLines: lines.length,
        outputLines: out.length,
        removed: mode === 'dedupe' ? kept.length - out.length : 0,
        repeats: kept.length - counts.size,
        duplicateGroups,
        blanksRemoved,
      }
    },
    [text, caseSensitive, trim, removeBlank, showCounts, mode, keep],
  )

  return (
    <div className="space-y-6">
      <ToolPanel>
        <TextEditor
          label="Your list"
          value={text}
          onChange={setText}
          rows={12}
          mono
          sample={SAMPLE}
          hint="One item per line. Works on email lists, log files, keyword exports and other line-based text."
        />
        <BusyNote busy={busy} progress={progress} label="Scanning lines…" />

        <div className="grid gap-3 sm:grid-cols-2">
          <Segmented label="What to output" value={mode} options={MODES} onChange={setMode} />
          <Segmented
            label="When duplicates are removed"
            value={keep}
            options={KEEP}
            onChange={setKeep}
            className={cn(mode !== 'dedupe' && 'pointer-events-none opacity-50')}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ToggleRow
            label="Case sensitive"
            description="Off treats “Apple” and “apple” as the same line."
            checked={caseSensitive}
            onChange={setCaseSensitive}
          />
          <ToggleRow
            label="Trim each line"
            description="Ignores leading and trailing spaces when comparing."
            checked={trim}
            onChange={setTrim}
          />
          <ToggleRow
            label="Remove blank lines"
            description="Drops empty lines before comparing."
            checked={removeBlank}
            onChange={setRemoveBlank}
          />
          <ToggleRow
            label="Prefix duplicate counts"
            description="Adds “3⇥line” in duplicates-only mode."
            checked={showCounts}
            onChange={setShowCounts}
            disabled={mode !== 'duplicates'}
          />
        </div>
      </ToolPanel>

      <ToolPanel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Lines in" value={formatNumber(result.inputLines, 0)} />
          <StatTile label="Lines out" value={formatNumber(result.outputLines, 0)} accent />
          <StatTile
            label={mode === 'dedupe' ? 'Duplicates removed' : 'Repeated lines'}
            value={formatNumber(mode === 'dedupe' ? result.removed : result.repeats, 0)}
          />
          <StatTile
            label="Repeated values"
            value={formatNumber(result.duplicateGroups, 0)}
            hint="distinct lines seen more than once"
          />
        </div>
        {result.blanksRemoved > 0 && (
          <p className="text-xs text-muted-foreground">
            {formatNumber(result.blanksRemoved, 0)} blank line
            {result.blanksRemoved === 1 ? '' : 's'} removed.
          </p>
        )}

        <OutputBox
          label="Result"
          value={result.text}
          filename={mode === 'duplicates' ? 'duplicate-lines.txt' : 'deduplicated.txt'}
          rows={12}
          empty={
            text.trim() === ''
              ? 'Paste a list above to remove its duplicate lines.'
              : mode === 'duplicates'
                ? 'No line appears more than once with the current comparison settings.'
                : 'Nothing is left after filtering. Try less strict options.'
          }
        />
      </ToolPanel>
    </div>
  )
}
