import { useState } from 'react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber } from '@/lib/utils'
import { BusyNote, OutputBox, Segmented, StatTile, TextEditor, ToggleRow, useComputed } from './common'
import { mapLinesChunked } from './text-core'

const SAMPLE = `Never odd or even
Was it a car or a cat I saw?
Step on no pets`

const MODES = [
  { value: 'characters', label: 'Characters' },
  { value: 'words', label: 'Word order' },
  { value: 'lines', label: 'Line order' },
  { value: 'mirror', label: 'Mirror text' },
  { value: 'upside', label: 'Upside down' },
] as const

type Mode = (typeof MODES)[number]['value']

const MODE_HELP: Record<Mode, string> = {
  characters:
    'Reverses the character order. Emoji, accented letters and other multi-code-point characters are kept intact.',
  words: 'Keeps every word spelled correctly but reverses the order they appear in.',
  lines: 'Keeps each line as it is and reverses the order of the lines: last line first.',
  mirror:
    'Reverses the characters and swaps each one for its mirrored Unicode look-alike, so the result reads correctly in a mirror.',
  upside:
    'Rotates the text 180°: characters are reversed and replaced with their upside-down look-alikes. Paste it anywhere that accepts Unicode.',
}

const MIRROR_MAP: Record<string, string> = {
  a: 'ɒ', b: 'd', c: 'ɔ', d: 'b', e: 'ɘ', f: 'ꟻ', g: 'ǫ', h: 'ʜ', i: 'i', j: 'ꞁ', k: 'ʞ',
  l: 'l', m: 'm', n: 'n', o: 'o', p: 'q', q: 'p', r: 'ɿ', s: 'ƨ', t: 'ƚ', u: 'u', v: 'v',
  w: 'w', x: 'x', y: 'ʏ', z: 'z',
  A: 'A', B: 'ᙠ', C: 'Ɔ', D: 'ᗡ', E: 'Ǝ', F: 'ꟻ', G: 'Ә', H: 'H', I: 'I', J: 'Ⴑ', K: '⋊',
  L: '⅃', M: 'M', N: 'И', O: 'O', P: 'ꟼ', Q: 'Ọ', R: 'Я', S: 'Ƨ', T: 'T', U: 'U', V: 'V',
  W: 'W', X: 'X', Y: 'Y', Z: 'Ƹ',
  '1': '1', '2': 'S', '3': 'Ɛ', '4': 'ᔭ', '5': 'ट', '6': 'მ', '7': '٢', '8': '8', '9': 'P',
  '0': '0',
  '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<',
  '/': '\\', '\\': '/', '?': '⸮', '&': '⅋',
}

const FLIP_MAP: Record<string, string> = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ',
  l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ',
  w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  A: '∀', B: 'ᗺ', C: 'Ɔ', D: 'ᗡ', E: 'Ǝ', F: 'Ⅎ', G: '⅁', H: 'H', I: 'I', J: 'ſ', K: 'ʞ',
  L: '˥', M: 'W', N: 'N', O: 'O', P: 'Ԁ', Q: 'Q', R: 'ᴚ', S: 'S', T: '⊥', U: '∩', V: 'Λ',
  W: 'M', X: 'X', Y: '⅄', Z: 'Z',
  '1': 'Ɩ', '2': 'ᄅ', '3': 'Ɛ', '4': 'ㄣ', '5': 'ϛ', '6': '9', '7': 'ㄥ', '8': '8', '9': '6',
  '0': '0',
  '.': '˙', ',': "'", "'": ',', '"': '„', '`': ',', '?': '¿', '!': '¡', '(': ')', ')': '(',
  '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', '&': '⅋', '_': '‾',
}

/** Splits into user-perceived characters so emoji and accents survive reversal. */
function graphemes(input: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter
  if (typeof Segmenter === 'function') {
    const segmenter = new Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(input), (segment) => segment.segment)
  }
  return Array.from(input)
}

function reverseCharacters(line: string): string {
  return graphemes(line).reverse().join('')
}

function mapReverse(line: string, map: Record<string, string>): string {
  return graphemes(line)
    .reverse()
    .map((g) => (g.length === 1 ? (map[g] ?? g) : g))
    .join('')
}

export default function ReverseText() {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<Mode>('characters')
  const [perLine, setPerLine] = useState(true)
  const [trimResult, setTrimResult] = useState(false)

  const { value: output, busy, progress } = useComputed<string>(
    '',
    async (ctx) => {
      if (text === '') return ''
      const ctxOpts = { progress: ctx.progress, cancelled: ctx.cancelled }

      if (mode === 'lines') {
        const lines = await mapLinesChunked(text, (line) => line, ctxOpts)
        return lines.reverse().join('\n')
      }

      const transform = (line: string): string => {
        switch (mode) {
          case 'characters':
            return reverseCharacters(line)
          case 'words':
            return line.split(/(\s+)/).reverse().join('')
          case 'mirror':
            return mapReverse(line, MIRROR_MAP)
          case 'upside':
            return mapReverse(line, FLIP_MAP)
          default:
            return line
        }
      }

      if (!perLine && (mode === 'characters' || mode === 'mirror' || mode === 'upside')) {
        // Reverse the whole document, line breaks included.
        const whole = transform(text)
        return trimResult ? whole.trim() : whole
      }

      const lines = await mapLinesChunked(text, transform, ctxOpts)
      const joined = lines.join('\n')
      return trimResult ? joined.trim() : joined
    },
    [text, mode, perLine, trimResult],
  )

  const perLineApplies = mode === 'characters' || mode === 'mirror' || mode === 'upside'

  return (
    <div className="space-y-6">
      <ToolPanel>
        <TextEditor
          label="Your text"
          value={text}
          onChange={setText}
          rows={10}
          sample={SAMPLE}
          hint="Handy for checking palindromes, building mirrored graphics, or making a message that reads upside down."
        />
        <BusyNote busy={busy} progress={progress} label="Reversing…" />

        <Segmented label="Reverse by" value={mode} options={MODES} onChange={setMode} />
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground text-pretty">
          {MODE_HELP[mode]}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow
            label="Reverse each line separately"
            description="Off reverses the whole text, so the last line ends up first."
            checked={perLine}
            onChange={setPerLine}
            disabled={!perLineApplies}
          />
          <ToggleRow
            label="Trim the result"
            description="Removes whitespace that ends up at the start or end."
            checked={trimResult}
            onChange={setTrimResult}
          />
        </div>
      </ToolPanel>

      <ToolPanel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Characters" value={formatNumber(output.length, 0)} accent />
          <StatTile label="Lines" value={formatNumber(output === '' ? 0 : output.split('\n').length, 0)} />
          <StatTile
            label="Palindrome"
            value={
              text.trim() === ''
                ? '–'
                : text.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase() ===
                    reverseCharacters(text.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase())
                  ? 'Yes'
                  : 'No'
            }
            hint="ignoring case, spaces and punctuation"
          />
          <StatTile label="Mode" value={MODES.find((m) => m.value === mode)?.label ?? ''} />
        </div>
        <OutputBox
          label="Reversed text"
          value={output}
          filename="reversed-text.txt"
          rows={10}
          mono={mode === 'mirror' || mode === 'upside'}
          empty="Type or paste something above to see it reversed."
        />
      </ToolPanel>
    </div>
  )
}
