/**
 * OCR on the device: tesseract (LSTM engine only) with its worker, core and
 * English data served from this site and kept in Cache Storage (assets.ts),
 * so it works offline after the first use.
 *
 *   await loadOcr((loaded, total) => ...)          // download, once
 *   const words = await readImage(canvas, (p) => ...)
 *   // words: { text, confidence 0..100, x, y, w, h } in image pixels
 *   const lines = groupLines(words)
 *
 * readImage reads the image up to three ways and merges the words: as it
 * is, inverted (light text on dark, as in dark mode), and with colored text
 * darkened (links, chat bubbles).
 */
import { isCached, loadFile, wireBytes } from '../assets'

export interface OcrWord {
  text: string
  confidence: number
  x: number
  y: number
  w: number
  h: number
}

export interface OcrLine {
  words: OcrWord[]
  text: string
  /** Offset of each word in `text`. */
  starts: number[]
  x: number
  y: number
  w: number
  h: number
}

const WORKER = '/ocr/7.0.0/worker.min.js'
const CORE_DIR = '/ocr/core-7.0.0/'
const LANG = '/ocr/lang/4.0.0_best_int/eng.traineddata.gz'

// Minimal modules that only validate where the feature exists.
const SIMD = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])
const RELAXED = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 15, 1, 13, 0, 65, 1, 253, 15, 65, 2, 253, 15, 253, 128, 2, 11])

function corePath(): string {
  const ok = (m: Uint8Array) => {
    try {
      return WebAssembly.validate(m)
    } catch {
      return false
    }
  }
  const build = ok(RELAXED) ? 'relaxedsimd-lstm' : ok(SIMD) ? 'simd-lstm' : 'lstm'
  return `${CORE_DIR}tesseract-core-${build}.wasm.js`
}

export function ocrFiles(): string[] {
  return [WORKER, corePath(), LANG]
}

export function ocrDownloadBytes(): number {
  return wireBytes(ocrFiles())
}

/** True when the worker and core are stored; the language data has its own store in tesseract. */
export function ocrIsCached(): Promise<boolean> {
  return isCached(ocrFiles().slice(0, 2)).catch(() => false)
}

type TessWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>

let job: Promise<TessWorker> | null = null
let stepListener: ((p: number) => void) | null = null

/** Starts tesseract once. Progress covers the three downloads. */
export function loadOcr(onProgress?: (loaded: number, total: number) => void): Promise<TessWorker> {
  if (job) return job
  const run = (async () => {
    const files = ocrFiles()
    const seen = new Map<string, number>()
    const total = wireBytes(files)
    const track = (path: string) => (loaded: number) => {
      seen.set(path, loaded)
      onProgress?.([...seen.values()].reduce((a, b) => a + b, 0), total)
    }
    const [worker, core] = await Promise.all(files.slice(0, 2).map((f) => loadFile(f, track(f))))
    const url = (buf: ArrayBuffer) => URL.createObjectURL(new Blob([buf], { type: 'text/javascript' }))
    const Tesseract = await import('tesseract.js')
    // The language data is fetched by tesseract itself (same origin) and kept in its own
    // IndexedDB store, so it also loads offline after the first time.
    const w = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
      workerPath: url(worker),
      // A blob URL has no ".js" ending; the fragment makes tesseract load it as a file. Fetches ignore it.
      corePath: `${url(core)}#core.js`,
      langPath: `${location.origin}${LANG.slice(0, LANG.lastIndexOf('/'))}`,
      workerBlobURL: false,
      cacheMethod: 'write',
      gzip: true,
      logger: (m) => {
        if (m.status === 'recognizing text') stepListener?.(m.progress)
        if (m.status === 'loading language traineddata') track(LANG)(m.progress * (wireBytes([LANG]) || 1))
      },
      errorHandler: () => {},
    })
    await w.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, preserve_interword_spaces: '1', user_defined_dpi: '144', debug_file: '/dev/null' })
    return w
  })()
  job = run
  run.catch(() => {
    if (job === run) job = null
  })
  return run
}

/* ------------------------------------------------------------------ */
/* Passes                                                              */
/* ------------------------------------------------------------------ */

type Pass = 'plain' | 'inverted' | 'colors'

/** Which extra passes the image needs, from a coarse sample of its pixels. */
function passesFor(data: Uint8ClampedArray): Pass[] {
  let dark = 0
  let colored = 0
  let n = 0
  for (let i = 0; i < data.length; i += 4 * 7) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if ((r * 54 + g * 183 + b * 19) >> 8 < 100) dark++
    if (max - min > 60) colored++
    n++
  }
  const passes: Pass[] = ['plain']
  if (dark / n > 0.15) passes.push('inverted')
  if (colored / n > 0.02) passes.push('colors')
  return passes
}

function prepare(src: HTMLCanvasElement, pass: Pass): HTMLCanvasElement {
  if (pass === 'plain') return src
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(src, 0, 0)
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    let v: number
    if (pass === 'inverted') v = 255 - ((d[i] * 54 + d[i + 1] * 183 + d[i + 2] * 19) >> 8)
    else {
      // Colored text gets dark: the weakest channel of a saturated color is low.
      const min = Math.min(d[i], d[i + 1], d[i + 2])
      const max = Math.max(d[i], d[i + 1], d[i + 2])
      v = max - min > 50 ? min * 0.6 : (d[i] * 54 + d[i + 1] * 183 + d[i + 2] * 19) >> 8
      if (max < 90) v = 255 - v // dark backgrounds with colored text: flip the rest
    }
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  return c
}

/** Intersection over the smaller box: a fragment read inside a word counts as the same word. */
function overlap(a: OcrWord, b: OcrWord): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (w <= 0 || h <= 0) return 0
  return (w * h) / Math.min(a.w * a.h, b.w * b.h)
}

interface TessWordLike {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

function wordsOf(data: unknown): TessWordLike[] {
  const out: TessWordLike[] = []
  const blocks = (data as { blocks?: { paragraphs: { lines: { words: TessWordLike[] }[] }[] }[] | null }).blocks ?? []
  for (const b of blocks) for (const p of b.paragraphs) for (const l of p.lines) out.push(...l.words)
  return out
}

/**
 * Words with boxes in the pixels of `source`. Small images are enlarged
 * first, which helps the recognizer with small UI text.
 */
export async function readImage(source: CanvasImageSource & { width: number; height: number }, onProgress?: (p: number) => void, minConfidence = 45): Promise<OcrWord[]> {
  const worker = await loadOcr()
  const scale = Math.max(source.width, source.height) < 1400 ? 2 : 1
  const base = document.createElement('canvas')
  base.width = Math.round(source.width * scale)
  base.height = Math.round(source.height * scale)
  const ctx = base.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, base.width, base.height)
  const sample = ctx.getImageData(0, 0, base.width, base.height).data
  const passes = passesFor(sample)
  const all: OcrWord[] = []
  for (let k = 0; k < passes.length; k++) {
    stepListener = (p) => onProgress?.((k + p) / passes.length)
    const input = prepare(base, passes[k])
    const result = await worker.recognize(input, {}, { blocks: true, text: false })
    for (const w of wordsOf(result.data)) {
      const text = w.text.trim()
      // Keys and IDs read with low confidence (the recognizer cannot predict random letters); keep long token-like words.
      const tokenLike = text.length >= 6 && /^[\w@.:/+=-]+$/.test(text) && w.confidence >= 20
      if (!text || (w.confidence < minConfidence && !tokenLike)) continue
      if (!/[\p{L}\p{N}]/u.test(text)) continue // icons and edges read as symbols
      const word: OcrWord = {
        text,
        confidence: w.confidence,
        x: w.bbox.x0 / scale,
        y: w.bbox.y0 / scale,
        w: (w.bbox.x1 - w.bbox.x0) / scale,
        h: (w.bbox.y1 - w.bbox.y0) / scale,
      }
      // A later pass only adds words where earlier passes read nothing; where they overlap,
      // the more confident reading of the same size wins.
      const hits = all.filter((a) => overlap(a, word) > 0.3)
      if (hits.length === 0) all.push(word)
      else if (hits.length === 1 && hits[0].confidence + 5 < word.confidence && Math.abs(hits[0].w - word.w) < word.h) all[all.indexOf(hits[0])] = word
    }
  }
  stepListener = null
  onProgress?.(1)
  return all
}

/** Groups words into lines: vertical overlap, left to right, split at wide gaps. */
export function groupLines(words: OcrWord[]): OcrLine[] {
  const sorted = [...words].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2))
  const rows: OcrWord[][] = []
  for (const w of sorted) {
    const cy = w.y + w.h / 2
    const row = rows.find((r) => {
      const ry = r.reduce((s, x) => s + x.y + x.h / 2, 0) / r.length
      const rh = r.reduce((s, x) => s + x.h, 0) / r.length
      return Math.abs(ry - cy) < Math.min(rh, w.h) * 0.5
    })
    if (row) row.push(w)
    else rows.push([w])
  }
  const lines: OcrLine[] = []
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x)
    // A gap wider than three letter heights starts a new line (two columns, a bubble and a time).
    let cur: OcrWord[] = []
    const flush = () => {
      if (!cur.length) return
      let text = ''
      const starts: number[] = []
      for (const w of cur) {
        if (text) text += ' '
        starts.push(text.length)
        text += w.text
      }
      const x = Math.min(...cur.map((w) => w.x))
      const y = Math.min(...cur.map((w) => w.y))
      lines.push({ words: cur, text, starts, x, y, w: Math.max(...cur.map((w) => w.x + w.w)) - x, h: Math.max(...cur.map((w) => w.y + w.h)) - y })
      cur = []
    }
    for (const w of row) {
      const last = cur[cur.length - 1]
      if (last && w.x - (last.x + last.w) > Math.max(last.h, w.h) * 3) flush()
      cur.push(w)
    }
    flush()
  }
  return lines.sort((a, b) => a.y - b.y || a.x - b.x)
}

/** Boxes (in image pixels) that cover text range [start, end) of a line, one per word touched. */
export function lineRangeBoxes(line: OcrLine, start: number, end: number): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = []
  line.words.forEach((w, i) => {
    const a = line.starts[i]
    const b = a + w.text.length
    if (b <= start || a >= end) return
    // Part of a word: cut the box in proportion, as letters in UI fonts are close to even.
    const from = Math.max(0, start - a) / w.text.length
    const to = Math.min(w.text.length, end - a) / w.text.length
    out.push({ x: w.x + w.w * from, y: w.y, w: w.w * (to - from), h: w.h })
  })
  // Neighbouring word boxes on one line merge into one.
  const merged: typeof out = []
  for (const b of out) {
    const last = merged[merged.length - 1]
    if (last && b.x - (last.x + last.w) < Math.max(last.h, b.h) * 1.2) {
      const x = Math.min(last.x, b.x)
      const y = Math.min(last.y, b.y)
      last.w = Math.max(last.x + last.w, b.x + b.w) - x
      last.h = Math.max(last.y + last.h, b.y + b.h) - y
      last.x = x
      last.y = y
    } else merged.push({ ...b })
  }
  return merged
}
