import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, Lightbulb, Pause, Play, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { CopyButton } from '@/components/shared/CopyButton'
import { cn, formatNumber } from '@/lib/utils'
import { EncodeField, EncodePane, StatChips } from '../dev/dev-encode-ui'

type Mode = 'morse' | 'nato'

interface Props {
  mode?: Mode
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
  '"': '.-..-.', $: '...-..-', '@': '.--.-.',
  // Accented letters in common international use
  À: '.--.-', Ä: '.-.-', É: '..-..', Ñ: '--.--', Ö: '---.', Ü: '..--',
}

const MORSE_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE).map(([letter, code]) => [code, letter]),
)

const PROSIGNS: { code: string; meaning: string }[] = [
  { code: '.-.-.', meaning: 'AR (end of message)' },
  { code: '...-.-', meaning: 'SK (end of contact)' },
  { code: '-...-', meaning: 'BT (new paragraph)' },
  { code: '........', meaning: 'HH (error, start again)' },
  { code: '...---...', meaning: 'SOS (distress)' },
]

const NATO: Record<string, string> = {
  A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot',
  G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima',
  M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo',
  S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey',
  X: 'X-ray', Y: 'Yankee', Z: 'Zulu',
}

const NATO_DIGITS_PLAIN: Record<string, string> = {
  '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
  '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine',
}

const NATO_DIGITS_AVIATION: Record<string, string> = {
  '0': 'Zero', '1': 'Wun', '2': 'Too', '3': 'Tree', '4': 'Fower',
  '5': 'Fife', '6': 'Six', '7': 'Seven', '8': 'Ait', '9': 'Niner',
}

const NATO_PUNCTUATION: Record<string, string> = {
  '.': 'Decimal', '-': 'Dash', '/': 'Slash', '@': 'At', ',': 'Comma',
}

const NATO_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(NATO).map(([letter, word]) => [word.toLowerCase(), letter]),
)

/* ------------------------------------------------------------------ */
/* Morse conversion                                                    */
/* ------------------------------------------------------------------ */

interface MorseEncodeResult {
  code: string
  unsupported: string[]
}

function textToMorse(text: string): MorseEncodeResult {
  const unsupported = new Set<string>()
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean)
  const encoded = words.map((word) =>
    Array.from(word)
      .map((char) => {
        const code = MORSE[char]
        if (!code) {
          unsupported.add(char)
          return ''
        }
        return code
      })
      .filter(Boolean)
      .join(' '),
  )
  return { code: encoded.filter(Boolean).join(' / '), unsupported: [...unsupported] }
}

/** Accepts the unicode dot/dash variants that copy out of most Morse websites. */
function normaliseMorse(code: string): string {
  return code.replace(/[·•]/g, '.').replace(/[—–_]/g, '-').replace(/\|/g, '/').trim()
}

function morseToText(code: string): string {
  const normalised = normaliseMorse(code)
  if (!normalised) return ''
  return normalised
    .split(/\s*\/\s*|\s{3,}/)
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((symbol) => MORSE_REVERSE[symbol] ?? '█')
        .join(''),
    )
    .filter(Boolean)
    .join(' ')
}

/* ------------------------------------------------------------------ */
/* Audio                                                               */
/* ------------------------------------------------------------------ */

interface Slot {
  start: number
  duration: number
  tone: boolean
}

/**
 * ARRL Farnsworth timing: characters are sent at `charWpm`, then the gaps
 * between characters and words are stretched so the overall rate is `wpm`.
 */
function buildTimeline(code: string, wpm: number, charWpm: number): { slots: Slot[]; total: number } {
  const unit = 1.2 / charWpm
  const effective = Math.min(wpm, charWpm)
  const gapUnit =
    effective >= charWpm ? unit : (60 * charWpm - 37.2 * effective) / (19 * effective * charWpm)

  const slots: Slot[] = []
  let cursor = 0
  const push = (duration: number, tone: boolean) => {
    if (duration <= 0) return
    slots.push({ start: cursor, duration, tone })
    cursor += duration
  }

  const words = code.split('/')
  words.forEach((word, wordIndex) => {
    const letters = word.trim().split(/\s+/).filter(Boolean)
    letters.forEach((letter, letterIndex) => {
      Array.from(letter).forEach((symbol, symbolIndex) => {
        if (symbolIndex > 0) push(unit, false)
        push(symbol === '-' ? unit * 3 : unit, true)
      })
      if (letterIndex < letters.length - 1) push(gapUnit * 3, false)
    })
    if (wordIndex < words.length - 1) push(gapUnit * 7, false)
  })

  return { slots, total: cursor }
}

function renderPcm(slots: Slot[], total: number, sampleRate: number, frequency: number): Float32Array {
  const samples = new Float32Array(Math.max(1, Math.ceil((total + 0.05) * sampleRate)))
  const ramp = Math.round(sampleRate * 0.005)
  for (const slot of slots) {
    if (!slot.tone) continue
    const from = Math.round(slot.start * sampleRate)
    const count = Math.round(slot.duration * sampleRate)
    for (let i = 0; i < count; i += 1) {
      const index = from + i
      if (index >= samples.length) break
      let envelope = 1
      if (i < ramp) envelope = i / ramp
      else if (i > count - ramp) envelope = Math.max(0, (count - i) / ramp)
      samples[index] = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0.45 * envelope
    }
  }
  return samples
}

function pcmToWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const SAMPLE_RATE = 16000

export default function DevEncodeMorse({ mode = 'morse' }: Props) {
  const [direction, setDirection] = useState<'encode' | 'decode'>('encode')
  const [input, setInput] = useState('')
  const [wpm, setWpm] = useState(18)
  const [charWpm, setCharWpm] = useState(18)
  const [frequency, setFrequency] = useState(700)
  const [playing, setPlaying] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [flashMode, setFlashMode] = useState(false)
  const [aviationDigits, setAviationDigits] = useState(false)
  const [search, setSearch] = useState('')
  const [audioError, setAudioError] = useState<string | null>(null)

  const contextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)

  /* ------------------------------------------------------ morse text */
  const morse = useMemo(() => {
    if (mode !== 'morse') return null
    if (direction === 'encode') {
      const { code, unsupported } = textToMorse(input)
      return { output: code, unsupported, decodedGaps: 0 }
    }
    const text = morseToText(input)
    return { output: text, unsupported: [], decodedGaps: (text.match(/█/g) ?? []).length }
  }, [mode, direction, input])

  const morseCode =
    mode === 'morse' ? (direction === 'encode' ? (morse?.output ?? '') : normaliseMorse(input)) : ''

  const timeline = useMemo(() => {
    if (mode !== 'morse' || !morseCode.trim()) return null
    return buildTimeline(morseCode, wpm, Math.max(wpm, charWpm))
  }, [mode, morseCode, wpm, charWpm])

  const wavBlob = useMemo(() => {
    if (!timeline || timeline.total === 0 || timeline.total > 300) return null
    return pcmToWav(renderPcm(timeline.slots, timeline.total, SAMPLE_RATE, frequency), SAMPLE_RATE)
  }, [timeline, frequency])

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop()
      } catch {
        /* already stopped */
      }
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setPlaying(false)
    setFlashOn(false)
  }, [])

  useEffect(() => stop, [stop])

  const play = useCallback(async () => {
    if (!timeline || timeline.total === 0) return
    setAudioError(null)
    stop()
    try {
      const context = contextRef.current ?? new AudioContext()
      contextRef.current = context
      if (context.state === 'suspended') await context.resume()

      const samples = renderPcm(timeline.slots, timeline.total, context.sampleRate, frequency)
      const buffer = context.createBuffer(1, samples.length, context.sampleRate)
      buffer.getChannelData(0).set(samples)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      const startedAt = context.currentTime
      source.start()
      sourceRef.current = source
      setPlaying(true)
      source.onended = () => {
        setPlaying(false)
        setFlashOn(false)
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }

      const tick = () => {
        const elapsed = context.currentTime - startedAt
        const active = timeline.slots.some(
          (slot) => slot.tone && elapsed >= slot.start && elapsed < slot.start + slot.duration,
        )
        setFlashOn(active)
        if (elapsed <= timeline.total) rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch (error) {
      setAudioError(
        error instanceof Error
          ? `Audio could not start: ${error.message}`
          : 'Audio could not start in this browser.',
      )
      setPlaying(false)
    }
  }, [timeline, frequency, stop])

  /* ------------------------------------------------------- nato text */
  const natoOutput = useMemo(() => {
    if (mode !== 'nato') return ''
    const digits = aviationDigits ? NATO_DIGITS_AVIATION : NATO_DIGITS_PLAIN
    if (direction === 'encode') {
      return input
        .split(/(\s+)/)
        .map((chunk) => {
          if (/^\s+$/.test(chunk)) return chunk.includes('\n') ? '\n' : ' / '
          return Array.from(chunk)
            .map((char) => {
              const upper = char.toUpperCase()
              return NATO[upper] ?? digits[upper] ?? NATO_PUNCTUATION[upper] ?? upper
            })
            .join(' ')
        })
        .join('')
        .trim()
    }
    return input
      .split(/[\s/,]+/)
      .filter(Boolean)
      .map((word) => {
        const key = word.toLowerCase().replace(/[^a-z-]/g, '')
        if (NATO_REVERSE[key]) return NATO_REVERSE[key]
        const digitEntry = Object.entries(aviationDigits ? NATO_DIGITS_AVIATION : NATO_DIGITS_PLAIN)
          .concat(Object.entries(NATO_DIGITS_PLAIN))
          .find(([, value]) => value.toLowerCase() === key)
        if (digitEntry) return digitEntry[0]
        return '?'
      })
      .join('')
  }, [mode, direction, input, aviationDigits])

  const natoRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const rows = Object.entries(NATO).map(([letter, word]) => ({
      letter,
      word,
      morse: MORSE[letter],
    }))
    if (!query) return rows
    return rows.filter(
      (row) => row.letter.toLowerCase().includes(query) || row.word.toLowerCase().includes(query),
    )
  }, [search])

  /* ------------------------------------------------------------ view */
  if (mode === 'nato') {
    return (
      <div className="space-y-5">
        <ToolPanel
          title={direction === 'encode' ? 'Text → NATO phonetic' : 'NATO phonetic → text'}
          description="Spell out a booking reference, licence plate, postcode or password over the phone without being misheard."
        >
          <EncodePane
            label={direction === 'encode' ? 'Text to spell out' : 'Phonetic words'}
            value={input}
            onChange={setInput}
            rows={4}
            placeholder={direction === 'encode' ? 'BK7 4TQ' : 'Bravo Kilo Seven'}
          />
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInput(natoOutput)
                setDirection((value) => (value === 'encode' ? 'decode' : 'encode'))
              }}
              disabled={natoOutput.length === 0}
            >
              <ArrowUpDown className="mr-1.5 size-4" aria-hidden="true" />
              Swap direction
            </Button>
          </div>
          <EncodePane
            label={direction === 'encode' ? 'Phonetic spelling' : 'Decoded text'}
            value={natoOutput}
            readOnly
            rows={4}
            footer={
              direction === 'encode'
                ? 'Words are separated by spaces, and a slash marks a space in the original.'
                : 'A ? marks a word that is not in the ICAO alphabet.'
            }
          />
          <div className="flex items-center gap-2">
            <Switch
              id="aviation-digits"
              checked={aviationDigits}
              onCheckedChange={setAviationDigits}
            />
            <label htmlFor="aviation-digits" className="text-sm text-foreground">
              Aviation number pronunciation (Wun, Too, Tree, Fower, Fife, Niner)
            </label>
          </div>
        </ToolPanel>

        <ToolPanel
          title="The ICAO alphabet"
          description="Adopted in 1956 and unchanged since. The same 26 words are used by NATO, aviation, shipping and emergency services worldwide."
        >
          <EncodeField label="Filter" htmlFor="nato-search">
            <Input
              id="nato-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search a letter or a word"
            />
          </EncodeField>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Letter</TableHead>
                  <TableHead>Code word</TableHead>
                  <TableHead>Morse</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {natoRows.map((row) => (
                  <TableRow key={row.letter}>
                    <TableCell className="font-mono font-semibold">{row.letter}</TableCell>
                    <TableCell>{row.word}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{row.morse}</TableCell>
                  </TableRow>
                ))}
                {natoRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      Nothing matches “{search}”.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      </div>
    )
  }

  const symbolCount = morseCode.replace(/[^.-]/g, '').length

  return (
    <div className="space-y-5">
      <ToolPanel
        title={direction === 'encode' ? 'Text → Morse' : 'Morse → text'}
        description="Dots, dashes and slashes are all accepted on input, along with the Unicode variants (·, •, em dash and en dash) that copy out of most websites."
      >
        <EncodePane
          label={direction === 'encode' ? 'Plain text' : 'Morse code'}
          value={input}
          onChange={setInput}
          rows={4}
          placeholder={direction === 'encode' ? 'SOS' : '... --- ...'}
        />

        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setInput(morse?.output ?? '')
              setDirection((value) => (value === 'encode' ? 'decode' : 'encode'))
            }}
            disabled={!morse?.output}
          >
            <ArrowUpDown className="mr-1.5 size-4" aria-hidden="true" />
            Swap direction
          </Button>
        </div>

        <EncodePane
          label={direction === 'encode' ? 'Morse code' : 'Decoded text'}
          value={morse?.output ?? ''}
          readOnly
          rows={4}
          footer="One space separates letters, a slash separates words."
        />

        {morse && morse.unsupported.length > 0 ? (
          <Alert role="status" variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Some characters have no Morse equivalent</AlertTitle>
            <AlertDescription>
              Skipped: {morse.unsupported.map((char) => `“${char}”`).join(', ')}. International Morse
              covers A-Z, 0-9 and a short list of punctuation. There is no code for emoji, tabs or
              most symbols.
            </AlertDescription>
          </Alert>
        ) : null}

        {morse && morse.decodedGaps > 0 ? (
          <Alert role="status" variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>
              {morse.decodedGaps} symbol{morse.decodedGaps === 1 ? '' : 's'} not recognised
            </AlertTitle>
            <AlertDescription>
              Each █ marks a group that is not valid Morse. The usual cause is single spaces where
              letters should be separated, or a slash missing between words.
            </AlertDescription>
          </Alert>
        ) : null}

        {symbolCount > 0 ? (
          <StatChips
            items={[
              { label: 'Symbols', value: formatNumber(symbolCount, 0) },
              {
                label: 'Transmission',
                value: timeline ? `${timeline.total.toFixed(1)} s` : '–',
              },
              { label: 'Speed', value: `${wpm} WPM` },
            ]}
          />
        ) : null}
      </ToolPanel>

      <ToolPanel
        title="Play it"
        description="A sidetone made with the Web Audio API at the exact ARRL timings. The waveform is built in this tab."
      >
        <div
          className={cn(
            'flex h-24 items-center justify-center rounded-lg transition-colors duration-75',
            flashOn && flashMode
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
          role="status"
          aria-live="off"
        >
          <span className="text-sm font-medium">
            {playing ? (flashOn ? 'Tone on' : 'Silence') : 'Idle'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={playing ? stop : play} disabled={!timeline}>
            {playing ? (
              <Pause className="mr-1.5 size-4" aria-hidden="true" />
            ) : (
              <Play className="mr-1.5 size-4" aria-hidden="true" />
            )}
            {playing ? 'Stop' : 'Play Morse'}
          </Button>
          <DownloadButton
            blob={wavBlob}
            filename="morse.wav"
            label="Download WAV"
            variant="outline"
          />
          <CopyButton value={morse?.output ?? ''} label="Copy result" />
          <div className="flex items-center gap-2">
            <Switch id="flash-mode" checked={flashMode} onCheckedChange={setFlashMode} />
            <label
              htmlFor="flash-mode"
              className="flex items-center gap-1.5 text-sm text-foreground"
            >
              <Lightbulb className="size-4" aria-hidden="true" />
              Visual flash
            </label>
          </div>
        </div>

        {audioError ? <ErrorNote message={audioError} onRetry={play} /> : null}
        {timeline && timeline.total > 300 ? (
          <p className="text-sm text-muted-foreground">
            This message is {Math.round(timeline.total)} seconds long, so the WAV download is
            disabled to avoid building a very large file. Playback still works.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <EncodeField
            label={`Overall speed: ${wpm} WPM`}
            htmlFor="wpm"
            hint="Words per minute, measured on the standard word PARIS."
          >
            <Slider
              id="wpm"
              min={5}
              max={40}
              step={1}
              value={[wpm]}
              onValueChange={([value]) => {
                setWpm(value)
                if (value > charWpm) setCharWpm(value)
              }}
            />
          </EncodeField>
          <EncodeField
            label={`Character speed: ${Math.max(wpm, charWpm)} WPM`}
            htmlFor="char-wpm"
            hint="Set this higher than the overall speed for Farnsworth practice: full-speed characters, longer gaps."
          >
            <Slider
              id="char-wpm"
              min={5}
              max={40}
              step={1}
              value={[Math.max(wpm, charWpm)]}
              onValueChange={([value]) => setCharWpm(Math.max(value, wpm))}
            />
          </EncodeField>
          <EncodeField
            label={`Tone: ${frequency} Hz`}
            htmlFor="tone"
            hint="600–800 Hz is the usual amateur-radio sidetone range."
          >
            <Slider
              id="tone"
              min={300}
              max={1200}
              step={10}
              value={[frequency]}
              onValueChange={([value]) => setFrequency(value)}
            />
          </EncodeField>
        </div>
      </ToolPanel>

      <ToolPanel title="Reference" description="International Morse, plus the prosigns you will meet on air.">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(MORSE)
            .filter(([char]) => /^[A-Z0-9]$/.test(char))
            .map(([char, code]) => (
              <div
                key={char}
                className="flex items-baseline justify-between gap-2 rounded-md bg-muted px-3 py-1.5"
              >
                <span className="font-mono text-sm font-semibold text-foreground">{char}</span>
                <span className="font-mono text-sm text-muted-foreground">{code}</span>
              </div>
            ))}
        </div>
        <h3 className="pt-2 text-sm font-semibold text-foreground">Prosigns</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {PROSIGNS.map((prosign) => (
            <li key={prosign.meaning}>
              <code className="font-mono text-foreground">{prosign.code}</code>: {prosign.meaning}
            </li>
          ))}
        </ul>
      </ToolPanel>
    </div>
  )
}
