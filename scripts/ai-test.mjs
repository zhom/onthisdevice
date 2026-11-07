#!/usr/bin/env node
/**
 * Known-answer tests for the pure parts of the AI tools (src/lib/ml): text to phonemes,
 * numbers in words, subtitle cues and formats, image tiles, the FFT of the noise remover,
 * half floats and model input sizes. The models themselves are tested in a browser.
 *
 *   node scripts/ai-test.mjs [-v]
 */
import './search-test/loader.mjs'

const verbose = process.argv.includes('-v')
const g2p = await import('../src/lib/ml/voice/g2p.ts')
const captions = await import('../src/lib/ml/transcribe/captions.ts')
const tiles = await import('../src/lib/ml/upscale/tiles.ts')
const { Fft } = await import('../src/lib/ml/denoise/fft.ts')
const dtln = await import('../src/lib/ml/denoise/dtln.ts')
const pixels = await import('../src/lib/ml/runtime/pixels.ts')
const depth = await import('../src/lib/ml/depth/size.ts')
const { tidy } = await import('../src/lib/ml/read/text.ts')

let failed = 0
let passed = 0
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) passed++
  else failed++
  if (!ok || verbose) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`)
}
const near = (a, b, tol) => Math.abs(a - b) <= tol

/* Numbers and text normalisation */
eq('numberWords 0', g2p.numberWords(0), 'zero')
eq('numberWords 15', g2p.numberWords(15), 'fifteen')
eq('numberWords 42', g2p.numberWords(42), 'forty-two')
eq('numberWords 105', g2p.numberWords(105), 'one hundred and five')
eq('numberWords 1234', g2p.numberWords(1234), 'one thousand two hundred and thirty-four')
eq('numberWords 2000005', g2p.numberWords(2000005), 'two million and five')
eq('numberWords -7', g2p.numberWords(-7), 'minus seven')
eq('yearWords 1984', g2p.yearWords(1984), 'nineteen eighty-four')
eq('yearWords 2005', g2p.yearWords(2005), 'two thousand and five')
eq('yearWords 1905', g2p.yearWords(1905), 'nineteen oh five')
eq('yearWords 2024', g2p.yearWords(2024), 'twenty twenty-four')
eq('yearWords 1900', g2p.yearWords(1900), 'nineteen hundred')
eq('ordinal 1', g2p.ordinalWords(1), 'first')
eq('ordinal 22', g2p.ordinalWords(22), 'twenty-second')
eq('ordinal 30', g2p.ordinalWords(30), 'thirtieth')
eq('ordinal 112', g2p.ordinalWords(112), 'one hundred and twelfth')
eq('normalize money', g2p.normalize('$4.50'), 'four dollars and fifty cents')
eq('normalize pounds', g2p.normalize('£1.01'), 'one pound and one penny')
eq('normalize time', g2p.normalize('at 10:30'), 'at ten thirty')
eq('normalize time pm', g2p.normalize('7:05 pm'), 'seven oh five P M')
eq('normalize percent', g2p.normalize('25% off'), 'twenty-five percent off')
eq('normalize year', g2p.normalize('in 1984'), 'in nineteen eighty-four')
eq('normalize decade', g2p.normalize('the 1990s'), 'the nineteen nineties')
eq('normalize decimal', g2p.normalize('3.14'), 'three point one four')
eq('normalize thousands', g2p.normalize('1,250 people'), 'one thousand two hundred and fifty people')
eq('normalize ordinal', g2p.normalize('March 3rd'), 'March third')
eq('normalize title', g2p.normalize('Dr. Smith & Mr. Lee'), 'doctor Smith and mister Lee')

/* Words to phonemes with a small lexicon */
const lex = g2p.parseLexicon('key\tkˈi\nboard\tbˈɔɹd\ncat\tkˈæt\nwatch\twˈɑʧ\nplay\tplˈA\nhello\thəlˈO\nNASA\tnˈæsə\n')
eq('lexicon hit', g2p.wordPhonemes(lex, 'hello'), 'həlˈO')
eq('lexicon capital', g2p.wordPhonemes(lex, 'Hello'), 'həlˈO')
eq('plural voiceless', g2p.wordPhonemes(lex, 'cats'), 'kˈæts')
eq('plural sibilant', g2p.wordPhonemes(lex, 'watches'), 'wˈɑʧᵻz')
eq('past tense', g2p.wordPhonemes(lex, 'played'), 'plˈAd')
eq('gerund', g2p.wordPhonemes(lex, 'playing'), 'plˈAɪŋ')
eq('compound', g2p.wordPhonemes(lex, 'keyboard'), 'kˈibˌɔɹd')
eq('acronym in lexicon', g2p.wordPhonemes(lex, 'NASA'), 'nˈæsə')
eq('acronym spelled', g2p.wordPhonemes(lex, 'XYZ'), 'ˈɛkswˈIzˈi')
eq('by sound', g2p.spellBySound('Kowalski'), 'kˈOælskɪ')
eq('by sound soft c', g2p.spellBySound('cinema'), 'sˈɪnɛmæ')
eq('phonemize punctuation', g2p.phonemize(lex, 'Hello, cat!'), 'həlˈO, kˈæt!')
eq('chunks', g2p.chunkText('One. Two? Three!', 9), ['One. Two?', 'Three!'])
eq('chunk long sentence', g2p.chunkText('aaaa, bbbb, cccc', 11), ['aaaa, bbbb,', 'cccc'])

/* Subtitles and transcripts */
const words = [
  { text: ' Hello', start: 0, end: 0.4 },
  { text: ' world.', start: 0.45, end: 0.9 },
  { text: ' Next', start: 2.0, end: 2.3 },
  { text: ' line', start: 2.35, end: 2.7 },
]
const cues = captions.toCues(words)
eq('cues split at pause', cues.map((c) => c.text), ['Hello world.', 'Next line'])
eq('cue times', cues.map((c) => [c.start, c.end]), [[0, 0.9], [2.0, 2.7]])
eq('srt', captions.toSrt(cues), '1\n00:00:00,000 --> 00:00:00,900\nHello world.\n\n2\n00:00:02,000 --> 00:00:02,700\nNext line\n')
eq('vtt', captions.toVtt(cues), 'WEBVTT\n\n00:00:00.000 --> 00:00:00.900\nHello world.\n\n00:00:02.000 --> 00:00:02.700\nNext line\n')
eq('clock', [captions.clock(65), captions.clock(3725)], ['1:05', '1:02:05'])
eq('text paragraphs', captions.toText(words, { gap: 1 }), 'Hello world.\n\nNext line')
eq('text stamps', captions.toText(words, { gap: 1, timestamps: true }), '[0:00] Hello world.\n\n[0:02] Next line')
const long = Array.from({ length: 20 }, (_, i) => ({ text: ' word', start: i * 0.3, end: i * 0.3 + 0.25 }))
eq('cues max 42 chars', captions.toCues(long).every((c) => c.text.length <= 42), true)
eq('cues no overlap', captions.toCues(long).every((c, i, a) => !a[i + 1] || c.end <= a[i + 1].start), true)

/* Upscale tiles */
const t = tiles.tilesFor(300, 200, 128, 10)
eq('tile count', t.length, 6)
let covered = 0
for (const x of t) covered += x.w * x.h
eq('tiles cover the image once', covered, 300 * 200)
eq('tile padding clamped', [t[0].px, t[0].py, t[0].pw, t[0].ph], [0, 0, 138, 138])
eq('halve averages', [...tiles.halve(new Uint8ClampedArray([0, 0, 0, 0, 100, 100, 100, 100, 200, 200, 200, 200, 100, 100, 100, 100]), 2, 2)], [100, 100, 100, 100])
// One tile through an identity "model" (nearest 4x) comes back as the input.
{
  const w = 5
  const h = 3
  const rgba = new Uint8ClampedArray(w * h * 4).map((_, i) => (i * 37) % 256)
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255
  const [tile] = tiles.tilesFor(w, h, 8, 2)
  const input = tiles.tileInput(rgba, w, tile)
  const s = 4
  const res = new Float32Array(3 * tile.pw * s * tile.ph * s)
  const n = tile.pw * tile.ph
  const rn = tile.pw * s * tile.ph * s
  for (let c = 0; c < 3; c++)
    for (let y = 0; y < tile.ph * s; y++)
      for (let x = 0; x < tile.pw * s; x++) res[c * rn + y * tile.pw * s + x] = input[c * n + Math.floor(y / s) * tile.pw + Math.floor(x / s)]
  const out = new Uint8ClampedArray(w * s * h * s * 4)
  tiles.placeTile(out, w * s, res, tile, s)
  let same = true
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) if (out[((y * s) * w * s + x * s) * 4 + c] !== rgba[(y * w + x) * 4 + c]) same = false
  eq('tile round trip', same, true)
}

/* FFT and the noise remover mix */
{
  const fft = new Fft(8)
  const re = new Float32Array([1, 2, 3, 4, 0, -1, 0.5, 2])
  const im = new Float32Array(8)
  const orig = re.slice()
  fft.transform(re, im)
  eq('fft dc', near(re[0], 11.5, 1e-5) && near(im[0], 0, 1e-5), true)
  // Bin 1 by the definition sum x[n] e^(-2 pi i k n / N).
  let r1 = 0
  let i1 = 0
  for (let n = 0; n < 8; n++) {
    r1 += orig[n] * Math.cos((2 * Math.PI * n) / 8)
    i1 -= orig[n] * Math.sin((2 * Math.PI * n) / 8)
  }
  eq('fft bin 1', near(re[1], r1, 1e-4) && near(im[1], i1, 1e-4), true)
  fft.transform(re, im, true)
  eq('fft round trip', [...re].every((v, k) => near(v, orig[k], 1e-5)), true)
}
eq('dtln delay', dtln.DELAY, 384)
{
  const a = new Float32Array([1, 2, 3])
  const c = new Float32Array(3 + dtln.DELAY)
  c.set([10, 20, 30], dtln.DELAY)
  eq('mix aligns the delay', [...dtln.mix(a, c, 1)], [10, 20, 30])
  eq('mix half', [...dtln.mix(a, c, 0.5)], [5.5, 11, 16.5])
}

/* Half floats, depth input size, OCR text */
eq('half 1.0', pixels.toHalf(1), 0x3c00)
eq('half -2.5', pixels.toHalf(-2.5), 0xc100)
eq('half round trip', [0, 0.5, 0.333, 65504, -1e-3].map((v) => +pixels.fromHalf(pixels.toHalf(v)).toPrecision(3)), [0, 0.5, 0.333, 65500, -0.001])
eq('depth input 4:3', depth.inputSize(800, 600, 518), { w: 686, h: 518 })
eq('depth input multiple of 14', Object.values(depth.inputSize(1920, 1080, 518)).every((v) => v % 14 === 0), true)
eq('ocr tidy', tidy('  line one   \n\n\n\nline two  \n'), 'line one\n\nline two')

console.log(`ai: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
