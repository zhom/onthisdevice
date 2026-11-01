import { useState } from 'react'
import { Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber } from '@/lib/utils'
import { BusyNote, OutputBox, Segmented, StatTile, TextEditor, ToggleRow, useComputed } from './common'
import {
  alphabeticalCompare,
  forEachLineChunked,
  leadingNumber,
  localeCompare,
  naturalCompare,
  shuffle,
} from './text-core'

const SAMPLE = `chapter 10: the return
chapter 2: the road
Chapter 1: the beginning
chapter 21: the end

chapter 3: the detour`

const METHODS = [
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'natural', label: 'Natural' },
  { value: 'numeric', label: 'Numeric' },
  { value: 'length', label: 'By length' },
  { value: 'random', label: 'Shuffle' },
  { value: 'reverse', label: 'Reverse order' },
] as const

type Method = (typeof METHODS)[number]['value']

const DIRECTIONS = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
] as const

type Direction = (typeof DIRECTIONS)[number]['value']

const METHOD_HELP: Record<Method, string> = {
  alphabetical:
    'Plain A→Z. With case sensitivity on, uppercase letters sort before lowercase ones (code-point order), which matches most command-line sorts.',
  natural:
    'Digits inside a line are compared as numbers, so “item2” comes before “item10”. Best for filenames, versions and chapter lists.',
  numeric:
    'Sorts by the first number found on each line. Lines without a number are kept together at the end, in their original order.',
  length: 'Sorts by character count, shortest first. Ties keep their original order.',
  random: 'Fisher–Yates shuffle with a fresh seed each time you press Reshuffle.',
  reverse: 'No sorting. Reverses the current order of the lines.',
}

interface Result {
  text: string
  inputLines: number
  outputLines: number
  blanksRemoved: number
  duplicatesRemoved: number
}

const EMPTY: Result = {
  text: '',
  inputLines: 0,
  outputLines: 0,
  blanksRemoved: 0,
  duplicatesRemoved: 0,
}

export default function SortLines() {
  const [text, setText] = useState('')
  const [method, setMethod] = useState<Method>('alphabetical')
  const [direction, setDirection] = useState<Direction>('asc')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [removeBlank, setRemoveBlank] = useState(true)
  const [trimLines, setTrimLines] = useState(false)
  const [dedupe, setDedupe] = useState(false)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31))

  const { value: result, busy, progress } = useComputed<Result>(
    EMPTY,
    async (ctx) => {
      if (text === '') return EMPTY

      const lines: string[] = []
      await forEachLineChunked(
        text,
        (line) => lines.push(line),
        { progress: (p) => ctx.progress(p * 0.6), cancelled: ctx.cancelled },
      )

      let working = trimLines ? lines.map((l) => l.trim()) : lines.slice()
      const inputLines = lines.length

      let blanksRemoved = 0
      if (removeBlank) {
        const before = working.length
        working = working.filter((l) => l.trim() !== '')
        blanksRemoved = before - working.length
      }

      let duplicatesRemoved = 0
      if (dedupe) {
        const seen = new Set<string>()
        const unique: string[] = []
        for (const line of working) {
          const key = caseSensitive ? line : line.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          unique.push(line)
        }
        duplicatesRemoved = working.length - unique.length
        working = unique
      }

      if (ctx.cancelled()) return EMPTY
      ctx.progress(75)

      const withIndex = working.map((line, index) => ({ line, index }))
      const stable = (compare: (a: string, b: string) => number) => {
        withIndex.sort((a, b) => {
          const result2 = compare(a.line, b.line)
          return result2 !== 0 ? result2 : a.index - b.index
        })
      }

      switch (method) {
        case 'alphabetical':
          stable((a, b) => alphabeticalCompare(a, b, caseSensitive))
          break
        case 'natural':
          stable((a, b) => naturalCompare(a, b, caseSensitive))
          break
        case 'numeric':
          stable((a, b) => {
            const na = leadingNumber(a)
            const nb = leadingNumber(b)
            const aNaN = Number.isNaN(na)
            const bNaN = Number.isNaN(nb)
            if (aNaN && bNaN) return 0
            if (aNaN) return 1
            if (bNaN) return -1
            return na - nb
          })
          break
        case 'length':
          stable((a, b) => a.length - b.length || localeCompare(a, b, caseSensitive))
          break
        default:
          break
      }

      let sorted = withIndex.map((entry) => entry.line)

      if (method === 'random') sorted = shuffle(sorted, seed)
      else if (method === 'reverse') sorted.reverse()
      else if (direction === 'desc') sorted.reverse()

      ctx.progress(100)
      return {
        text: sorted.join('\n'),
        inputLines,
        outputLines: sorted.length,
        blanksRemoved,
        duplicatesRemoved,
      }
    },
    [text, method, direction, caseSensitive, removeBlank, trimLines, dedupe, seed],
  )

  const directionApplies = method !== 'random' && method !== 'reverse'

  return (
    <div className="space-y-6">
      <ToolPanel>
        <TextEditor
          label="Lines to sort"
          value={text}
          onChange={setText}
          rows={12}
          mono
          sample={SAMPLE}
          hint="One item per line. Sorting happens in this tab, so even a 100,000-line list never leaves your device."
        />
        <BusyNote busy={busy} progress={progress} label="Sorting…" />

        <div className="grid gap-3 sm:grid-cols-2">
          <Segmented label="Sort method" value={method} options={METHODS} onChange={setMethod} />
          <div className="space-y-2">
            <Segmented
              label="Direction"
              value={direction}
              options={DIRECTIONS}
              onChange={setDirection}
              className={directionApplies ? '' : 'pointer-events-none opacity-50'}
            />
            {method === 'random' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setSeed(Math.floor(Math.random() * 2 ** 31))}
              >
                <Shuffle className="size-4" aria-hidden="true" />
                Reshuffle
              </Button>
            )}
          </div>
        </div>

        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground text-pretty">
          {METHOD_HELP[method]}
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ToggleRow
            label="Case sensitive"
            description="Off sorts “apple” and “Apple” together."
            checked={caseSensitive}
            onChange={setCaseSensitive}
          />
          <ToggleRow
            label="Remove blank lines"
            description="Drops empty lines before sorting."
            checked={removeBlank}
            onChange={setRemoveBlank}
          />
          <ToggleRow
            label="Trim each line"
            description="Strips leading and trailing spaces."
            checked={trimLines}
            onChange={setTrimLines}
          />
          <ToggleRow
            label="Remove duplicates"
            description="Keeps the first occurrence of each line."
            checked={dedupe}
            onChange={setDedupe}
          />
        </div>
      </ToolPanel>

      <ToolPanel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Lines in" value={formatNumber(result.inputLines, 0)} />
          <StatTile label="Lines out" value={formatNumber(result.outputLines, 0)} accent />
          <StatTile label="Blank lines removed" value={formatNumber(result.blanksRemoved, 0)} />
          <StatTile label="Duplicates removed" value={formatNumber(result.duplicatesRemoved, 0)} />
        </div>
        <OutputBox
          label="Sorted result"
          value={result.text}
          filename="sorted-lines.txt"
          rows={12}
          empty="Paste a list above and it will be sorted instantly."
        />
      </ToolPanel>
    </div>
  )
}
