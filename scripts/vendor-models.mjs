#!/usr/bin/env node
/**
 * Puts every detection model and engine file into public/ so the site serves them
 * itself (CSP connect-src 'self'; no CDN, no model hub at runtime). Never shipped.
 *
 *   node scripts/vendor-models.mjs            # download what is missing, rewrite the manifest
 *   node scripts/vendor-models.mjs --force    # download everything again
 *   node scripts/vendor-models.mjs --only /models/minishlab   # only paths with this prefix; the
 *                                             manifest stays as it is (CI builds need just this)
 *
 * The host serves no file over 25 MiB. A larger file is stored gzip-compressed when that
 * brings it under the limit (`<path>.gz`), otherwise as numbered parts (`<path>.partN`).
 * src/lib/ml/manifest.json records each logical file; src/lib/ml/assets.ts reads it.
 * Licences of everything vendored here: public/licenses/models.txt.
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { packModel, quantizeRows, readSafetensor } from '../src/lib/search/semantic/format.ts'
import { SEARCH_MODEL, SEARCH_MODEL_DIMS, SEARCH_MODEL_REPO, SEARCH_MODEL_TOKENS } from '../src/lib/search/semantic/paths.ts'

const ROOT = path.resolve('public')
const LIMIT = 24 * 1024 * 1024
const force = process.argv.includes('--force')
const onlyAt = process.argv.indexOf('--only')
const only = onlyAt > -1 ? process.argv[onlyAt + 1] : null

const ORT_VERSION = JSON.parse(fs.readFileSync('node_modules/onnxruntime-web/package.json', 'utf8')).version
const OCR_VERSION = JSON.parse(fs.readFileSync('node_modules/tesseract.js/package.json', 'utf8')).version
const TRANSFORMERS_VERSION = JSON.parse(fs.readFileSync('node_modules/@huggingface/transformers/package.json', 'utf8')).version
const OCR_CORE_VERSION = JSON.parse(fs.readFileSync('node_modules/tesseract.js-core/package.json', 'utf8')).version

const hf = (repo, file) => `https://huggingface.co/${repo}/resolve/main/${file}`
/** Exports made on this Mac before they are published (see `exported` below). */
const EXPORTS = 'scripts/.tmp/exports'

const WHISPER_REQUIRED = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'preprocessor_config.json', 'generation_config.json']
const WHISPER_FILES = [
  ...WHISPER_REQUIRED,
  'special_tokens_map.json',
  'added_tokens.json',
  'normalizer.json',
  'vocab.json',
  'merges.txt',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
]
/** English voices of Kokoro; the list in src/lib/ml/voice/voices.ts must match. */
const KOKORO_VOICES = ['af_heart', 'af_bella', 'af_nicole', 'af_sarah', 'am_michael', 'am_fenrir', 'am_puck', 'bf_emma', 'bf_isabella', 'bm_george', 'bm_fable']
/** OCR languages besides English; src/lib/ml/read/languages.ts lists the same codes. */
const OCR_LANGS = ['spa', 'fra', 'deu', 'ita', 'por', 'nld', 'pol', 'rus', 'ukr', 'tur', 'ara', 'hin', 'chi_sim', 'chi_tra', 'jpn', 'kor', 'vie', 'ind']
/** Files this repo publishes itself (exports that exist nowhere else). */
const RELEASE = 'https://github.com/zhom/onthisdevice/releases/download/models-v1'

/** Each entry: logical path under public/, and either a URL or a local file. */
const FILES = [
  // ONNX Runtime (the version in package.json; every model on the site runs on this one copy).
  ...[
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.mjs',
    'ort-wasm-simd-threaded.jsep.wasm',
    'ort-wasm-simd-threaded.jsep.mjs',
    'ort-wasm-simd-threaded.asyncify.wasm',
    'ort-wasm-simd-threaded.asyncify.mjs',
    'ort-wasm-simd-threaded.jspi.wasm',
    'ort-wasm-simd-threaded.jspi.mjs',
  ].map((f) => ({ to: `/ort/${ORT_VERSION}/${f}`, local: `node_modules/onnxruntime-web/dist/${f}` })),

  // OCR engine and English LSTM data.
  { to: `/ocr/${OCR_VERSION}/worker.min.js`, local: 'node_modules/tesseract.js/dist/worker.min.js' },
  ...['simd-lstm', 'relaxedsimd-lstm', 'lstm'].flatMap((v) => [
    { to: `/ocr/core-${OCR_CORE_VERSION}/tesseract-core-${v}.wasm`, local: `node_modules/tesseract.js-core/tesseract-core-${v}.wasm` },
    { to: `/ocr/core-${OCR_CORE_VERSION}/tesseract-core-${v}.js`, local: `node_modules/tesseract.js-core/tesseract-core-${v}.js` },
    { to: `/ocr/core-${OCR_CORE_VERSION}/tesseract-core-${v}.wasm.js`, local: `node_modules/tesseract.js-core/tesseract-core-${v}.wasm.js` },
  ]),
  { to: '/ocr/lang/4.0.0_best_int/eng.traineddata.gz', local: 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz' },

  // Face detection: YuNet with dynamic input size (MIT).
  {
    to: '/models/yunet/face_detection_yunet_2026may.onnx',
    url: 'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2026may.onnx',
    fallback: hf('pollen-robotics/face_detection_yunet_2026may', 'face_detection_yunet_2026may.onnx'),
  },

  // Licence plate detection: DEIMv2 nano (MIT).
  { to: '/models/plate/deimv2-nano-plate.onnx', url: hf('KienNguyen2k1/DEIMv2_nano_license_plate', 'best_stg2_3.onnx') },

  // Personal data entities: token classification for transformers.js (Apache-2.0).
  ...['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'onnx/model_quantized.onnx'].map((f) => ({
    to: `/models/Mozilla/smart-pii-redactor-v1-onnx/${f}`,
    url: hf('Mozilla/smart-pii-redactor-v1-onnx', f),
    optional: f === 'special_tokens_map.json',
  })),

  // Signature detection: YOLOS-tiny fine-tuned on signatures (Apache-2.0). The repo has no ONNX, so it is
  // exported on this Mac first:
  //   optimum-cli export onnx --model mdefrance/yolos-tiny-signature-detection --task object-detection OUT
  // with OUT = scripts/.tmp/exports/yolos-sig (plus preprocessor_config.json from the repo). The export is
  // published as assets of the GitHub release `models-v1` of this repo, so a clean build can fetch it. fp32 only:
  // a dynamic uint8 copy (9 MB) moved boxes 10-25 px on 150 dpi pages and disagreed on 9 of 26 boxes
  // on real scans (scripts/.tmp/wave2/sig-eval.mjs).
  ...['config.json', 'preprocessor_config.json', 'onnx/model.onnx'].map((f) => ({
    to: `/models/mdefrance/yolos-tiny-signature-detection/${f}`,
    url: `${RELEASE}/yolos-sig-${path.basename(f)}`,
  })),

  // Speech to text with word times (MIT).
  ...WHISPER_FILES.map((f) => ({
    to: `/models/onnx-community/whisper-tiny_timestamped/${f}`,
    url: hf('onnx-community/whisper-tiny_timestamped', f),
    optional: !f.startsWith('onnx/') && !WHISPER_REQUIRED.includes(f),
  })),

  // Search by meaning: static embeddings (MIT), cut and packed as int8 here (see packSearchModel).
  { to: SEARCH_MODEL, make: packSearchModel },

  // ---- AI tools (src/lib/ml/cutout, upscale, inpaint, depth, voice, translate, denoise, transcribe, read) ----

  // Background removal: ISNet general use (DIS, Apache-2.0) with only its main mask output and its
  // weights stored as fp16, cast to fp32 when the session loads (half the download, fp32 masks). Made here
  // from the rembg release copy (scripts/models/half-weights-isnet.py).
  { to: '/models/isnet/isnet-general-use-f16w.onnx', url: `${RELEASE}/isnet-general-use-f16w.onnx`, exported: 'isnet-general-use-f16w.onnx' },

  // Super resolution: Real-ESRGAN compact models (BSD-3-Clause), exported to ONNX with dynamic size here
  // (scripts/models/export-realesr.py, from the .pth files of the Real-ESRGAN v0.2.5.0 release).
  ...['realesr-general-x4v3.onnx', 'realesr-animevideov3.onnx'].map((f) => ({ to: `/models/realesrgan/${f}`, url: `${RELEASE}/${f}`, exported: f })),

  // Object removal: MI-GAN with its pre- and post-processing in the graph (MIT).
  { to: '/models/migan/migan_pipeline_v2.onnx', url: hf('andraniksargsyan/migan', 'migan_pipeline_v2.onnx') },

  // Depth: Depth Anything V2 small, uint8 weights (Apache-2.0).
  { to: '/models/onnx-community/depth-anything-v2-small/onnx/model_quantized.onnx', url: hf('onnx-community/depth-anything-v2-small', 'onnx/model_quantized.onnx') },

  // Speech to text, the "accurate" choice: Whisper base with word times (MIT).
  ...WHISPER_FILES.map((f) => ({
    to: `/models/onnx-community/whisper-base_timestamped/${f}`,
    url: hf('onnx-community/whisper-base_timestamped', f),
    optional: !f.startsWith('onnx/') && !WHISPER_REQUIRED.includes(f),
  })),

  // Text to speech: Kokoro 82M, uint8 weights, and English voices (Apache-2.0). Words to phonemes with the
  // US and UK lexicons of misaki (Apache-2.0), merged and packed here (see packLexicon).
  ...['tokenizer.json', 'onnx/model_quantized.onnx', ...KOKORO_VOICES.map((v) => `voices/${v}.bin`)].map((f) => ({
    to: `/models/onnx-community/Kokoro-82M-v1.0-ONNX/${f}`,
    url: hf('onnx-community/Kokoro-82M-v1.0-ONNX', f),
  })),
  { to: '/models/kokoro/lexicon-us.tsv', make: () => packLexicon('us') },
  { to: '/models/kokoro/lexicon-gb.tsv', make: () => packLexicon('gb') },

  // Speech noise removal: DTLN, two stateful ONNX models (MIT).
  ...['model_1.onnx', 'model_2.onnx'].map((f) => ({ to: `/models/dtln/${f}`, url: `https://raw.githubusercontent.com/breizhn/DTLN/master/pretrained_model/${f}` })),

  // More OCR languages: Tesseract LSTM data, best models as integers (Apache-2.0).
  ...OCR_LANGS.map((l) => ({
    to: `/ocr/lang/4.0.0_best_int/${l}.traineddata.gz`,
    url: `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`,
  })),

  // transformers.js for the speech model (Apache-2.0). The npm build imports onnxruntime-web/webgpu,
  // and that bundle makes Vite copy a 26.8 MB wasm into /_astro/ (over the host limit). This copy
  // takes the runtime from globalThis[Symbol.for('onthisdevice.ort')] instead;
  // src/lib/ml/speech/speech.worker.ts sets it to the shared runtime of ort.ts before the import.
  // (Not transformers' own Symbol.for('onnxruntime') hook: with that it offers no 'wasm' device.)
  {
    to: `/models/transformers/${TRANSFORMERS_VERSION}/transformers.web.min.mjs`,
    local: 'node_modules/@huggingface/transformers/dist/transformers.web.min.js',
    patch: patchTransformers,
  },
]

/**
 * Patches the transformers.js web build:
 * - its two runtime imports read the shared runtime from globalThis[Symbol.for('onthisdevice.ort')];
 * - word times from cross-attention: the rows of the first generated token start one row earlier
 *   (the row of the last prompt token predicts it; without this every word gets the time of the
 *   next token, about 0.3 s late), and the short-form path passes encoder frames (num_frames / 2),
 *   so the alignment does not run into the padding after the speech.
 * Each pattern must match, so an update of transformers.js that changes them fails here.
 */
function patchTransformers(src) {
  const replaceOnce = (text, re, to, name, count = 1) => {
    const found = text.match(new RegExp(re.source, 'g'))?.length ?? 0
    if (found !== count) throw new Error(`transformers.js patch "${name}": ${found} matches, expected ${count}`)
    return text.replace(new RegExp(re.source, 'g'), to)
  }
  const web = /import\*as (\w+) from"onnxruntime-web\/webgpu";?/
  const common = /import\{Tensor as (\w+)\}from"onnxruntime-common";?/
  const ortName = web.exec(src)?.[1]
  const tensorName = common.exec(src)?.[1]
  if (!ortName || !tensorName) throw new Error('transformers.js: runtime imports not found; update patchTransformers()')
  const head =
    `const ${ortName}=globalThis[Symbol.for("onthisdevice.ort")];` +
    `if(!${ortName})throw new Error("Set globalThis[Symbol.for('onthisdevice.ort')] before loading transformers.js.");` +
    `const{Tensor:${tensorName}}=${ortName};`
  let out = head + src.replace(web, '').replace(common, '')
  if (/from"onnxruntime|import\(?"onnxruntime/.test(out)) throw new Error('transformers.js: an onnxruntime import is left')
  out = replaceOnce(
    out,
    /let (\w+)=(\w+)>0\?(\w+)\.slice\(null,null,\[\2,\3\.dims\[2\]\],null\):\3/,
    'let $1=$2>0?$3.slice(null,null,[$2-1,$3.dims[2]],null):$3',
    'first attention row',
  )
  out = replaceOnce(out, /(\w+)\[(\w+)\]\.data\.set\((\w+)\)\}return \1\}/, '$1[$2].data.set($3.slice(0,$1[$2].data.length))}return $1}', 'timestamp length')
  out = replaceOnce(
    out,
    /(this\._extract_token_timestamps\(\w+,(\w+)\.alignment_heads,)\2\.num_frames,/,
    '$1$2.num_frames&&Math.ceil($2.num_frames/2),',
    'encoder frames',
  )
  return out
}

/** Kokoro lexicon of one dialect ('us' or 'gb'): `word<TAB>phonemes` lines. */
async function packLexicon(dialect) {
  const get = async (file) => {
    const url = `https://raw.githubusercontent.com/hexgrad/misaki/main/misaki/data/${file}`
    const res = await fetch(url, { headers: headersFor(url) })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return res.json()
  }
  // Gold entries win over silver ones. A word with phonemes per part of speech keeps its default.
  const merged = { ...(await get(`${dialect}_silver.json`)), ...(await get(`${dialect}_gold.json`)) }
  const lines = []
  for (const [word, value] of Object.entries(merged)) {
    const phonemes = typeof value === 'string' ? value : value?.DEFAULT
    if (phonemes && !/[\t\n]/.test(word)) lines.push(`${word}\t${phonemes}`)
  }
  lines.sort()
  return Buffer.from(lines.join('\n') + '\n')
}

/**
 * The search model: the first SEARCH_MODEL_TOKENS rows (the vocabulary is ordered by frequency
 * after the base word pieces) and the first SEARCH_MODEL_DIMS dimensions (they are PCA
 * components, largest first) of the float32 embeddings, int8 with one scale per row.
 */
async function packSearchModel() {
  const get = async (file) => {
    const res = await fetch(hf(SEARCH_MODEL_REPO, file), { redirect: 'follow', headers: { 'User-Agent': 'onthisdevice-vendor/1' } })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${SEARCH_MODEL_REPO}/${file}`)
    return new Uint8Array(await res.arrayBuffer())
  }
  const tokenizer = JSON.parse(new TextDecoder().decode(await get('tokenizer.json')))
  const { data, shape } = readSafetensor(await get('model.safetensors'), 'embeddings')
  const [rows, width] = shape
  const count = Math.min(SEARCH_MODEL_TOKENS, rows)
  const dims = SEARCH_MODEL_DIMS
  const vocab = []
  for (const [piece, id] of Object.entries(tokenizer.model.vocab)) if (id < count) vocab[id] = piece
  const cut = new Float32Array(count * dims)
  for (let r = 0; r < count; r++) cut.set(data.subarray(r * width, r * width + dims), r * dims)
  return Buffer.from(packModel({ ...quantizeRows(cut, count, dims), vocab }))
}

/** HF_TOKEN (optional) raises the rate limit of huggingface.co; it is sent there only. */
function headersFor(url) {
  const headers = { 'User-Agent': 'onthisdevice-vendor/1' }
  if (process.env.HF_TOKEN && new URL(url).hostname === 'huggingface.co') headers.Authorization = `Bearer ${process.env.HF_TOKEN}`
  return headers
}

async function fetchTo(url, dest) {
  const res = await fetch(url, { redirect: 'follow', headers: headersFor(url) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  // Git LFS pointers are small text files; refuse them.
  if (buf.length < 400 && buf.toString('utf8').startsWith('version https://git-lfs')) throw new Error(`LFS pointer at ${url}`)
  fs.writeFileSync(dest, buf)
  return buf.length
}

/** Writes the stored form next to the logical file and returns the manifest entry. */
function store(abs) {
  const bytes = fs.statSync(abs).size
  for (const old of fs.readdirSync(path.dirname(abs))) {
    const base = path.basename(abs)
    if (old === `${base}.gz` || old.startsWith(`${base}.part`)) fs.rmSync(path.join(path.dirname(abs), old))
  }
  if (bytes <= LIMIT) return { bytes, wire: bytes }
  const data = fs.readFileSync(abs)
  const gz = zlib.gzipSync(data, { level: 9 })
  fs.rmSync(abs)
  if (gz.length <= LIMIT) {
    fs.writeFileSync(`${abs}.gz`, gz)
    return { bytes, wire: gz.length, gzip: true }
  }
  const parts = Math.ceil(bytes / LIMIT)
  for (let i = 0; i < parts; i++) fs.writeFileSync(`${abs}.part${i}`, data.subarray(i * LIMIT, (i + 1) * LIMIT))
  return { bytes, wire: bytes, parts }
}

const manifestPath = path.resolve('src/lib/ml/manifest.json')
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {}

for (const f of FILES) {
  if (only && !f.to.startsWith(only)) continue
  const abs = path.join(ROOT, f.to)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  const stored = manifest[f.to] && (fs.existsSync(abs) || fs.existsSync(`${abs}.gz`) || fs.existsSync(`${abs}.part0`))
  if (stored && !force) continue
  try {
    if (f.make) fs.writeFileSync(abs, await f.make())
    else if (f.local && f.patch) fs.writeFileSync(abs, f.patch(fs.readFileSync(f.local, 'utf8')))
    else if (f.local) fs.copyFileSync(f.local, abs)
    else {
      try {
        await fetchTo(f.url, abs)
      } catch (err) {
        // An export of this repo that is not published yet: use the copy on this Mac.
        if (f.exported && fs.existsSync(path.join(EXPORTS, f.exported))) fs.copyFileSync(path.join(EXPORTS, f.exported), abs)
        else if (f.fallback) await fetchTo(f.fallback, abs)
        else throw err
      }
    }
  } catch (err) {
    if (f.optional) {
      delete manifest[f.to]
      continue
    }
    throw new Error(`${f.to}: ${err.message}`)
  }
  manifest[f.to] = store(abs)
  const m = manifest[f.to]
  console.log(`${f.to}  ${(m.bytes / 1048576).toFixed(2)} MiB${m.gzip ? ` (gz ${(m.wire / 1048576).toFixed(2)})` : ''}${m.parts ? ` (${m.parts} parts)` : ''}`)
}

if (only) process.exit(0)

// Drop entries (and their files) that are no longer in the list, for example an old ORT version.
const wanted = new Set(FILES.map((f) => f.to))
for (const key of Object.keys(manifest)) {
  if (wanted.has(key)) continue
  const abs = path.join(ROOT, key)
  for (const file of [abs, `${abs}.gz`, ...Array.from({ length: manifest[key].parts ?? 0 }, (_, i) => `${abs}.part${i}`)]) fs.rmSync(file, { force: true })
  delete manifest[key]
  console.log(`removed ${key}`)
}
for (const dir of ['ort', 'ocr']) {
  for (const sub of fs.existsSync(path.join(ROOT, dir)) ? fs.readdirSync(path.join(ROOT, dir)) : []) {
    const full = path.join(ROOT, dir, sub)
    if (fs.statSync(full).isDirectory() && fs.readdirSync(full).length === 0) fs.rmdirSync(full)
  }
}

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
fs.writeFileSync(manifestPath, JSON.stringify(sorted, null, 2) + '\n')
const total = Object.values(sorted).reduce((s, m) => s + m.wire, 0)
console.log(`manifest: ${Object.keys(sorted).length} files, ${(total / 1048576).toFixed(1)} MiB on the wire`)
console.log(`ORT ${ORT_VERSION}, tesseract.js ${OCR_VERSION}, core ${OCR_CORE_VERSION}`)
