#!/usr/bin/env node
/**
 * Known-answer tests for the conversion tools (src/lib/convert, src/components/tools/convert):
 * unit factors and formulas, the electrical formulas, the image container writers, the FFmpeg
 * plans and the registry text rules.
 *
 *   node scripts/convert-test.mjs        all cases
 *   node scripts/convert-test.mjs -v     print every case
 */
import './search-test/loader.mjs'

const verbose = process.argv.includes('-v')
let passed = 0
let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) {
    passed++
    if (verbose) console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name}${detail ? `: ${detail}` : ''}`)
  }
}

const { D, convert, formatValue, parseNumber, splitParts, formulaFor } = await import('../src/lib/convert/units/engine.ts')
const { UNIT_PAIRS, UNIT_PAIR_BY_SLUG } = await import('../src/lib/convert/units/catalog.ts')
const { formulaLine } = await import('../src/lib/convert/units/describe.ts')

/** Converts `value` on the pair page `slug` and compares to `expected` at `digits` significant digits. */
function unit(slug, value, expected, digits = 12, binary = false) {
  const p = UNIT_PAIR_BY_SLUG.get(slug)
  if (!p) return check(`${slug} exists`, false)
  const got = convert(new D(value), p.from, p.to, binary)
  const want = new D(expected)
  const ok = got.toSignificantDigits(digits).equals(want.toSignificantDigits(digits))
  check(`${slug}: ${value} → ${expected}`, ok, `got ${got.toString()}`)
}

/* ---- units: exact definitions ---- */
unit('mm-to-cm', '25', '2.5')
unit('feet-to-cm', '6', '182.88')
unit('cm-to-feet', '30.48', '1')
unit('inches-to-feet', '18', '1.5')
unit('miles-to-feet', '1', '5280')
unit('nautical-miles-to-km', '1', '1.852')
unit('mils-to-mm', '1', '0.0254')
unit('pounds-to-ounces', '2.5', '40')
unit('grams-to-pounds', '453.59237', '1')
unit('tons-to-pounds', '1', '2000')
unit('tonnes-to-tons', '1', '1.10231131092', 12)
unit('troy-ounces-to-grams', '1', '31.1034768')
unit('carats-to-grams', '5', '1')
unit('stone-to-kg', '1', '6.35029318')
unit('grains-to-grams', '7000', '453.59237')
unit('gallons-to-liters', '1', '3.785411784')
unit('cups-to-ml', '1', '236.5882365')
unit('tablespoons-to-teaspoons', '1', '3')
unit('quarts-to-gallons', '4', '1')
unit('cubic-feet-to-cubic-meters', '1', '0.028316846592')
unit('cubic-yards-to-cubic-feet', '1', '27')
unit('cubic-inches-to-cc', '1', '16.387064')
unit('barrels-to-gallons', '1', '42')
unit('uk-gallons-to-us-gallons', '1', '1.20094992550', 12)
unit('sqft-to-sqm', '1', '0.09290304')
unit('acres-to-sqft', '1', '43560')
unit('acres-to-hectares', '1', '0.40468564224')
unit('square-miles-to-acres', '1', '640')
unit('mph-to-kmh', '60', '96.56064')
unit('kmh-to-meters-per-second', '36', '10')
unit('knots-to-kmh', '1', '1.852')
unit('feet-per-second-to-mph', '88', '60')
unit('kelvin-to-fahrenheit', '0', '-459.67')
unit('kelvin-to-fahrenheit', '373.15', '212')
unit('fahrenheit-to-kelvin', '32', '273.15')
unit('kelvin-to-celsius', '0', '-273.15')
unit('kb-to-mb', '1500', '1.5')
unit('kb-to-mb', '1536', '1.5', 12, true)
unit('tb-to-tib', '1', '0.909494701773', 12)
unit('gib-to-gb', '1', '1.073741824')
unit('megabits-to-megabytes', '100', '12.5')
unit('bits-to-bytes', '64', '8')
unit('kcal-to-kj', '1', '4.184')
unit('kwh-to-btu', '1', '3412.14163313', 12)
unit('kwh-to-joules', '1', '3600000')
unit('ev-to-joules', '1', '1.602176634e-19')
unit('therms-to-kwh', '1', '29.3071070172', 12)
unit('hp-to-kw', '1', '0.74569987158227022')
unit('tons-to-btu', '1', '12000')
unit('psi-to-bar', '1', '0.0689475729317', 12)
unit('atm-to-psi', '1', '14.6959487755', 12)
unit('mmhg-to-kpa', '760', '101.3250144354')
unit('inhg-to-hpa', '29.92', '1013.20748', 9)
unit('minutes-to-hours', '90', '1.5')
unit('days-to-years', '365.2425', '1')
unit('weeks-to-days', '2', '14')
unit('degrees-to-radians', '180', '3.14159265358979323846')
unit('radians-to-degrees', '1', '57.2957795130823208768')
unit('degrees-to-gradians', '90', '100')
unit('mpg-to-l-per-100km', '30', '7.84048611111', 12)
unit('l-per-100km-to-mpg', '5', '47.0429166667', 12)
unit('uk-mpg-to-us-mpg', '60', '49.9604510777', 12)
unit('mpg-to-km-per-l', '1', '0.425143707430', 12)
unit('pounds-to-newtons', '1', '4.4482216152605')
unit('kg-to-newtons', '1', '9.80665')
unit('ft-lbs-to-nm', '1', '1.3558179483314004')
unit('ft-lbs-to-in-lbs', '1', '12')
unit('gpm-to-lpm', '1', '3.785411784')
unit('cfm-to-m3h', '1', '1.69901079552')
unit('rpm-to-hz', '60', '1')
unit('foot-candles-to-lux', '1', '10.7639104167', 12)

/* every pair round-trips */
let roundTrip = true
for (const p of UNIT_PAIRS) {
  const v = new D(p.from.dflt ?? '1')
  const back = convert(convert(v, p.from, p.to), p.to, p.from)
  if (!back.toSignificantDigits(30).equals(v.toSignificantDigits(30))) {
    roundTrip = false
    console.log(`  round trip ${p.slug}: ${back}`)
  }
}
check(`${UNIT_PAIRS.length} pairs round-trip at 30 digits`, roundTrip)

/* formulas */
check('formula mm→cm divides by 10', formulaLine(UNIT_PAIR_BY_SLUG.get('mm-to-cm').from, UNIT_PAIR_BY_SLUG.get('mm-to-cm').to) === 'cm = mm ÷ 10')
check('formula minutes→hours divides by 60', formulaFor(UNIT_PAIR_BY_SLUG.get('minutes-to-hours').from, UNIT_PAIR_BY_SLUG.get('minutes-to-hours').to).kind === 'divide')
check('formula K→°F is affine', formulaLine(UNIT_PAIR_BY_SLUG.get('kelvin-to-fahrenheit').from, UNIT_PAIR_BY_SLUG.get('kelvin-to-fahrenheit').to) === '°F = K × 1.8 − 459.67')
check('formula mpg→L/100 km is reciprocal', formulaFor(UNIT_PAIR_BY_SLUG.get('mpg-to-l-per-100km').from, UNIT_PAIR_BY_SLUG.get('mpg-to-l-per-100km').to).kind === 'reciprocal')

/* parsing and formatting */
const parsed = (s) => parseNumber(s)?.toString() ?? null
check('parse 1,234.5', parsed('1,234.5') === '1234.5')
check('parse 1.234,5', parsed('1.234,5') === '1234.5')
check('parse 0,5', parsed('0,5') === '0.5')
check('parse 1 1/2', parsed('1 1/2') === '1.5')
check('parse ½', parsed('½') === '0.5')
check('parse 2.5e3', parsed('2.5e3') === '2500')
check('parse rejects abc', parsed('abc') === null)
check('format 1234567.891', formatValue(new D('1234567.891')) === '1,234,567.891')
check('format tiny uses ×10', formatValue(new D('1.602176634e-19')) === '1.602176634 × 10⁻¹⁹')
check('split 5.9999 ft', splitParts(new D('5.99999'), [12], ['ft', 'in'], 1) === '6 ft', splitParts(new D('5.99999'), [12], ['ft', 'in'], 1))
check('split 1.5 d', splitParts(new D('1.5'), [24, 60, 60], ['d', 'h', 'min', 's'], 0) === '1 d 12 h', splitParts(new D('1.5'), [24, 60, 60], ['d', 'h', 'min', 's'], 0))
check('split 12.5°', splitParts(new D('12.5'), [60, 60], ['°', '′', '″'], 0) === '12° 30′', splitParts(new D('12.5'), [60, 60], ['°', '′', '″'], 0))

/* ---- electrical ---- */
const { solve } = await import('../src/lib/convert/units/electrical.ts')
const near = (a, b, digits = 10) => a !== null && a.toSignificantDigits(digits).equals(new D(b).toSignificantDigits(digits))
check('1500 W at 120 V DC = 12.5 A', near(solve({ power: new D(1500), voltage: new D(120) }, 'current', 'dc', new D(1)), '12.5'))
check('1500 W at 120 V, PF 0.8 = 15.625 A', near(solve({ power: new D(1500), voltage: new D(120) }, 'current', 'ac1', new D('0.8')), '15.625'))
check('16 A at 400 V three-phase, PF 1 = 11085.1 W', near(solve({ current: new D(16), voltage: new D(400) }, 'power', 'ac3', new D(1)), '11085.12517', 10))
check('60 W at 5 A = 12 V', near(solve({ power: new D(60), current: new D(5) }, 'voltage', 'dc', new D(1)), '12'))

/* ---- image containers ---- */
const { encodeBmp, encodeTiff, encodeIco, muxAnimatedWebp } = await import('../src/lib/convert/image/codecs.ts')
const px = { width: 3, height: 2, data: new Uint8ClampedArray(3 * 2 * 4).fill(255) }
px.data[0] = 10
const bmp = encodeBmp(px)
check('BMP magic and size', bmp[0] === 0x42 && bmp[1] === 0x4d && new DataView(bmp.buffer).getUint32(2, true) === bmp.length)
check('BMP 24-bit rows padded to 4 bytes', bmp.length === 54 + 12 * 2)
const tiff = encodeTiff([px, px])
const UTIF = (await import('utif2')).default
const ifds = UTIF.decode(tiff.buffer)
UTIF.decodeImage(tiff.buffer, ifds[0])
const rgba = UTIF.toRGBA8(ifds[0])
check('TIFF has two pages', ifds.length === 2)
check('TIFF round-trips pixels (Deflate + predictor)', ifds[0].width === 3 && rgba[0] === 10 && rgba[4] === 255)
const ico = encodeIco([
  { size: 16, png: new Uint8Array([1, 2, 3]) },
  { size: 256, png: new Uint8Array([4, 5]) },
])
check('ICO directory', ico[2] === 1 && ico[4] === 2 && ico[6] === 16 && ico[22] === 0 && new DataView(ico.buffer).getUint32(18, true) === 38)
const still = new Uint8Array([...'RIFF'].map((c) => c.charCodeAt(0)).concat([12, 0, 0, 0], [...'WEBPVP8L'].map((c) => c.charCodeAt(0)), [0, 0, 0, 0]))
const anim = muxAnimatedWebp([{ webp: still, durationMs: 100 }, { webp: still, durationMs: 50 }], 3, 2, false)
const txt = new TextDecoder('latin1').decode(anim)
check('animated WebP has VP8X, ANIM and two ANMF', txt.startsWith('RIFF') && txt.includes('VP8X') && txt.includes('ANIM') && txt.split('ANMF').length === 3)
check('animated WebP RIFF size', new DataView(anim.buffer).getUint32(4, true) === anim.length - 8)

/* ---- FFmpeg plans ---- */
const { planFfmpeg } = await import('../src/lib/convert/media/plan.ts')
const base = { bitrate: 192, bitDepth: 16, flacLevel: 5, sampleRate: 0, channels: 0, quality: 'balanced', maxHeight: 0, forceEncode: false, gifFps: 12, gifWidth: 480, start: 0, length: 0 }
const probe = (v, a) => ({ duration: 10, videoCodec: v, audioCodec: a, width: 1280, height: 720 })
const has = (plan, ...parts) => parts.every((x) => plan.args.join(' ').includes(x))
check('wav→flac encodes FLAC', has(planFfmpeg('flac', 'in.wav', base, probe(null, 'pcm_s16le')), '-c:a flac'))
check('mp4→m4a copies AAC', has(planFfmpeg('m4a', 'in.mp4', base, probe('h264', 'aac')), '-c:a copy'))
check('flv h264+aac → mp4 copies both', has(planFfmpeg('mp4', 'in.flv', base, probe('h264', 'aac')), '-c:v copy', '-c:a copy'))
check('mts h264+ac3 → mp4 copies video, encodes AAC', has(planFfmpeg('mp4', 'in.mts', base, probe('h264', 'ac3')), '-c:v copy', '-c:a aac'))
check('wmv → mp4 encodes H.264', has(planFfmpeg('mp4', 'in.wmv', base, probe('wmv2', 'wmav2')), '-c:v libx264', '-movflags +faststart'))
check('mp4 → webm uses VP8 and Opus', has(planFfmpeg('webm', 'in.mp4', base, probe('h264', 'aac')), '-c:v libvpx', '-c:a libopus'))
check('720p limit re-encodes', has(planFfmpeg('mp4', 'in.mp4', { ...base, maxHeight: 480 }, probe('h264', 'aac')), 'scale=-2:480'))
check('gif uses palettegen', has(planFfmpeg('gif', 'in.mov', base, null), 'palettegen', 'paletteuse', 'fps=12'))

const { effectArgs } = await import('../src/components/tools/convert/media/effects.ts')
const eff = { speed: 4, keepPitch: true, gainDb: 6, limiter: true, lufs: -16, fadeIn: 2, fadeOut: 3, semitones: 12, start: 5, length: 30, format: 'same' }
const src = { ext: 'mp3', duration: 60, sampleRate: 44100 }
const args = (e, s = eff) => effectArgs(e, s, src, 'in.mp3').args.join(' ')
check('4× speed chains two atempo steps', args('speed').includes('atempo=2,atempo=2'))
check('fade out starts at 57 s', args('fade').includes('afade=t=out:st=57:d=3'))
check('pitch +12 doubles the rate and halves the tempo', args('pitch').includes('asetrate=88200,aresample=44100,atempo=0.5'))
check('normalize to −16 LUFS', args('normalize').includes('loudnorm=I=-16'))
check('ringtone trims and writes M4R', effectArgs('ringtone', { ...eff, format: 'm4r' }, src, 'in.mp3').args.join(' ').includes('-ss 5 -t 30') && effectArgs('ringtone', { ...eff, format: 'm4r' }, src, 'in.mp3').output === 'output.m4r')

/* ---- registry text rules ---- */
const { tools } = await import('../src/lib/tools/convert.ts')
const bad = []
for (const t of tools) {
  if (t.description.length < 110 || t.description.length > 155) bad.push(`${t.slug} description ${t.description.length}`)
  const f = t.faqs?.length ?? 0
  if (f < 3 || f > 5) bad.push(`${t.slug} ${f} FAQs`)
  if (/—|!/.test(t.description + JSON.stringify(t.faqs))) bad.push(`${t.slug} punctuation`)
  if (t.updated !== '2026-11-07') bad.push(`${t.slug} updated`)
}
check(`${tools.length} registry entries follow the text rules`, bad.length === 0, bad.slice(0, 5).join('; '))

console.log(`convert: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
