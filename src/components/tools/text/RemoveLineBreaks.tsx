import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber } from '@/lib/utils'
import { BusyNote, OutputBox, Segmented, StatTile, TextEditor, ToggleRow, useComputed } from './common'
import { countLines, forEachLineChunked } from './text-core'

const SAMPLE = `Dear Ms Okafor,

Thank you for sending
the revised schedule. I have
shared it with the team and
we are happy with the dates.


One small change: the review
on Thursday needs to move to
the afternoon.

Kind regards,
Sam`

const MODES = [
  { value: 'unwrap', label: 'Unwrap paragraphs' },
  { value: 'all', label: 'Remove every break' },
  { value: 'normalise', label: 'Normalise only' },
] as const

type Mode = (typeof MODES)[number]['value']

const MODE_HELP: Record<Mode, string> = {
  unwrap:
    'Joins the hard-wrapped lines inside each paragraph, but keeps the blank line between paragraphs. This is the fix for text copied out of a PDF or an email client.',
  all: 'Collapses the entire text onto a single line, joined by the separator you choose.',
  normalise:
    'Keeps the structure and only tidies it: converts Windows and old Mac line endings to Unix ones and limits runs of blank lines.',
}

const JOINERS = [
  { value: 'space', label: 'Space' },
  { value: 'none', label: 'Nothing' },
  { value: 'comma', label: 'Comma + space' },
  { value: 'pipe', label: 'Pipe' },
  { value: 'custom', label: 'Custom' },
] as const

type Joiner = (typeof JOINERS)[number]['value']

const ENDINGS = [
  { value: 'lf', label: 'LF (Unix)' },
  { value: 'crlf', label: 'CRLF (Windows)' },
] as const

type Ending = (typeof ENDINGS)[number]['value']

interface Result {
  text: string
  linesIn: number
  linesOut: number
  breaksRemoved: number
  blankLinesRemoved: number
}

const EMPTY: Result = { text: '', linesIn: 0, linesOut: 0, breaksRemoved: 0, blankLinesRemoved: 0 }

export default function RemoveLineBreaks() {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<Mode>('unwrap')
  const [joiner, setJoiner] = useState<Joiner>('space')
  const [customJoiner, setCustomJoiner] = useState(' / ')
  const [collapseSpaces, setCollapseSpaces] = useState(true)
  const [trimLines, setTrimLines] = useState(true)
  const [maxBlank, setMaxBlank] = useState(true)
  const [ending, setEnding] = useState<Ending>('lf')

  const { value: result, busy, progress } = useComputed<Result>(
    EMPTY,
    async (ctx) => {
      if (text === '') return EMPTY

      const joinString =
        joiner === 'space' ? ' ' : joiner === 'none' ? '' : joiner === 'comma' ? ', ' : joiner === 'pipe' ? ' | ' : customJoiner

      const raw: string[] = []
      await forEachLineChunked(text, (line) => raw.push(line), {
        progress: (p) => ctx.progress(p * 0.7),
        cancelled: ctx.cancelled,
      })

      const lines = raw.map((line) => {
        let value = trimLines ? line.trim() : line
        if (collapseSpaces) value = value.replace(/[^\S\n]{2,}/g, ' ')
        return value
      })

      let blankLinesRemoved = 0
      let out = ''

      if (mode === 'all') {
        const parts = lines.filter((line) => line.trim() !== '')
        blankLinesRemoved = lines.length - parts.length
        out = parts.join(joinString)
      } else if (mode === 'unwrap') {
        const paragraphs: string[] = []
        let current: string[] = []
        for (const line of lines) {
          if (line.trim() === '') {
            if (current.length > 0) {
              paragraphs.push(current.join(joinString))
              current = []
            } else {
              blankLinesRemoved++
            }
          } else {
            current.push(line)
          }
        }
        if (current.length > 0) paragraphs.push(current.join(joinString))
        out = paragraphs.join('\n\n')
      } else {
        const kept: string[] = []
        let blankRun = 0
        for (const line of lines) {
          if (line.trim() === '') {
            blankRun++
            if (maxBlank && blankRun > 1) {
              blankLinesRemoved++
              continue
            }
          } else {
            blankRun = 0
          }
          kept.push(line)
        }
        while (kept.length > 0 && kept[kept.length - 1].trim() === '') kept.pop()
        out = kept.join('\n')
      }

      if (collapseSpaces) out = out.replace(/[^\S\n]{2,}/g, ' ')
      out = out.replace(/[^\S\n]+$/gm, '')
      if (ending === 'crlf') out = out.replace(/\n/g, '\r\n')

      ctx.progress(100)
      const linesOut = countLines(out)
      return {
        text: out,
        linesIn: raw.length,
        linesOut,
        breaksRemoved: Math.max(0, raw.length - linesOut),
        blankLinesRemoved,
      }
    },
    [text, mode, joiner, customJoiner, collapseSpaces, trimLines, maxBlank, ending],
  )

  return (
    <div className="space-y-6">
      <ToolPanel>
        <TextEditor
          label="Text with unwanted line breaks"
          value={text}
          onChange={setText}
          rows={12}
          sample={SAMPLE}
          hint="Typical source: text copied out of a PDF, an email, or a terminal that hard-wraps at 72 characters."
        />
        <BusyNote busy={busy} progress={progress} label="Rewrapping…" />

        <div className="grid gap-3 sm:grid-cols-2">
          <Segmented label="What to do" value={mode} options={MODES} onChange={setMode} />
          <Segmented
            label="Join lines with"
            value={joiner}
            options={JOINERS}
            onChange={setJoiner}
            className={mode === 'normalise' ? 'pointer-events-none opacity-50' : ''}
          />
        </div>

        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground text-pretty">
          {MODE_HELP[mode]}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="custom-joiner" className="text-sm font-medium">
              Custom separator
            </Label>
            <Input
              id="custom-joiner"
              value={customJoiner}
              disabled={joiner !== 'custom' || mode === 'normalise'}
              className="font-mono"
              onChange={(event) => setCustomJoiner(event.target.value)}
            />
          </div>
          <Segmented label="Line endings in the result" value={ending} options={ENDINGS} onChange={setEnding} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <ToggleRow
            label="Trim each line"
            description="Removes leading and trailing spaces before joining."
            checked={trimLines}
            onChange={setTrimLines}
          />
          <ToggleRow
            label="Collapse repeated spaces"
            description="Turns runs of spaces or tabs into a single space."
            checked={collapseSpaces}
            onChange={setCollapseSpaces}
          />
          <ToggleRow
            label="Limit blank lines to one"
            description="Only used by “Normalise only”."
            checked={maxBlank}
            onChange={setMaxBlank}
            disabled={mode !== 'normalise'}
          />
        </div>
      </ToolPanel>

      <ToolPanel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Lines in" value={formatNumber(result.linesIn, 0)} />
          <StatTile label="Lines out" value={formatNumber(result.linesOut, 0)} accent />
          <StatTile label="Breaks removed" value={formatNumber(result.breaksRemoved, 0)} />
          <StatTile label="Blank lines removed" value={formatNumber(result.blankLinesRemoved, 0)} />
        </div>
        <OutputBox
          label="Cleaned text"
          value={result.text}
          filename="cleaned-text.txt"
          rows={12}
          mono={false}
          empty="Paste text above to strip or tidy its line breaks."
        />
      </ToolPanel>
    </div>
  )
}
