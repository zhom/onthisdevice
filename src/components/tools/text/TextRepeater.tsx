import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { clamp, formatBytes, formatNumber, nextFrame } from '@/lib/utils'
import { BusyNote, OutputBox, Segmented, StatTile, TextEditor, ToggleRow, useComputed } from './common'
import { Cancelled, utf8Bytes } from './text-core'

const SAMPLE = 'onthisdevice.com runs in your browser'

const SEPARATORS = [
  { value: 'newline', label: 'New line' },
  { value: 'space', label: 'Space' },
  { value: 'comma', label: 'Comma' },
  { value: 'blank', label: 'Blank line' },
  { value: 'none', label: 'Nothing' },
  { value: 'custom', label: 'Custom' },
] as const

type SeparatorId = (typeof SEPARATORS)[number]['value']

const MAX_OUTPUT_CHARS = 8_000_000
const MAX_REPEATS = 100_000

interface Result {
  text: string
  copies: number
  truncated: boolean
}

const EMPTY: Result = { text: '', copies: 0, truncated: false }

export default function TextRepeater() {
  const [text, setText] = useState('')
  const [times, setTimes] = useState(10)
  const [separator, setSeparator] = useState<SeparatorId>('newline')
  const [customSeparator, setCustomSeparator] = useState(' | ')
  const [numbered, setNumbered] = useState(false)
  const [template, setTemplate] = useState('{n}. {text}')
  const [startAt, setStartAt] = useState(1)
  const [trailing, setTrailing] = useState(false)

  const { value: result, busy, progress } = useComputed<Result>(
    EMPTY,
    async (ctx) => {
      if (text === '') return EMPTY
      const count = clamp(Math.floor(times), 1, MAX_REPEATS)
      const sep =
        separator === 'newline'
          ? '\n'
          : separator === 'space'
            ? ' '
            : separator === 'comma'
              ? ', '
              : separator === 'blank'
                ? '\n\n'
                : separator === 'none'
                  ? ''
                  : customSeparator

      const parts: string[] = []
      let length = 0
      let truncated = false
      let produced = 0

      for (let i = 0; i < count; i++) {
        const n = startAt + i
        const piece = numbered
          ? template.replaceAll('{n}', String(n)).replaceAll('{text}', text)
          : text
        const withSep = i === count - 1 && !trailing ? piece : piece + sep
        if (length + withSep.length > MAX_OUTPUT_CHARS) {
          truncated = true
          break
        }
        parts.push(withSep)
        length += withSep.length
        produced++

        if ((i + 1) % 2000 === 0) {
          if (ctx.cancelled()) throw new Cancelled()
          ctx.progress((i / count) * 100)
          await nextFrame()
        }
      }

      ctx.progress(100)
      return { text: parts.join(''), copies: produced, truncated }
    },
    [text, times, separator, customSeparator, numbered, template, startAt, trailing],
  )

  const bytes = utf8Bytes(result.text)

  return (
    <div className="space-y-6">
      <ToolPanel>
        <TextEditor
          label="Text to repeat"
          value={text}
          onChange={setText}
          rows={6}
          sample={SAMPLE}
          hint="Multi-line text also works. The whole block is repeated as one unit."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="repeat-times" className="text-sm font-medium">
              Number of copies
            </Label>
            <Input
              id="repeat-times"
              type="number"
              min={1}
              max={MAX_REPEATS}
              inputMode="numeric"
              value={times}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10)
                setTimes(Number.isFinite(parsed) ? clamp(parsed, 1, MAX_REPEATS) : 1)
              }}
            />
            <p className="text-xs text-muted-foreground">Up to {formatNumber(MAX_REPEATS, 0)} copies.</p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Segmented
              label="Separator between copies"
              value={separator}
              options={SEPARATORS}
              onChange={setSeparator}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="repeat-separator" className="text-sm font-medium">
              Custom separator
            </Label>
            <Input
              id="repeat-separator"
              value={customSeparator}
              disabled={separator !== 'custom'}
              className="font-mono"
              onChange={(event) => setCustomSeparator(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="repeat-template" className="text-sm font-medium">
              Numbering template
            </Label>
            <Input
              id="repeat-template"
              value={template}
              disabled={!numbered}
              className="font-mono"
              onChange={(event) => setTemplate(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              <code className="font-mono">{'{n}'}</code> is the counter,{' '}
              <code className="font-mono">{'{text}'}</code> is your text.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="repeat-start" className="text-sm font-medium">
              Start numbering at
            </Label>
            <Input
              id="repeat-start"
              type="number"
              inputMode="numeric"
              value={startAt}
              disabled={!numbered}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10)
                setStartAt(Number.isFinite(parsed) ? parsed : 1)
              }}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow
            label="Number each copy"
            description="Applies the template above to every repetition."
            checked={numbered}
            onChange={setNumbered}
          />
          <ToggleRow
            label="Separator after the last copy"
            description="Useful when you are building a CSV row or a padded block."
            checked={trailing}
            onChange={setTrailing}
          />
        </div>
        <BusyNote busy={busy} progress={progress} label="Building output…" />
      </ToolPanel>

      <ToolPanel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Copies" value={formatNumber(result.copies, 0)} accent />
          <StatTile label="Characters" value={formatNumber(result.text.length, 0)} />
          <StatTile label="Lines" value={formatNumber(result.text === '' ? 0 : result.text.split('\n').length, 0)} />
          <StatTile label="Size" value={formatBytes(bytes)} hint={`${formatNumber(bytes, 0)} bytes`} />
        </div>
        {result.truncated && (
          <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm text-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Output stopped at {formatNumber(MAX_OUTPUT_CHARS, 0)} characters so the page stays
              usable. Reduce the number of copies, or download what you have and repeat the file
              instead.
            </span>
          </p>
        )}
        <OutputBox
          label="Repeated text"
          value={result.text}
          filename="repeated-text.txt"
          rows={14}
          empty="Enter some text above and choose how many copies you need."
        />
      </ToolPanel>
    </div>
  )
}
