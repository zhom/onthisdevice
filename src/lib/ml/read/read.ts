/**
 * Reads the text of an image (document, screenshot or photo) with Tesseract on this device, in
 * one or more languages, with the page layout kept: blocks, lines and words with their boxes.
 *
 *   const page = await readText(canvas, ['eng', 'spa'], (stage, p) => ...)
 *
 * The worker and core files are the ones of ../ocr/ocr.ts; the language data downloads once
 * per language (1 to 3 MB each) and tesseract keeps it in its own browser store.
 */
import { loadFile, wireBytes } from '../assets'
import { ocrFiles } from '../ocr/ocr'
import { LANG_DIR, langFile } from './languages'
import { tidy } from './text'

export interface ReadWord {
  text: string
  confidence: number
  x: number
  y: number
  w: number
  h: number
}

export interface ReadPage {
  text: string
  words: ReadWord[]
  /** Mean word confidence, 0..100. */
  confidence: number
}

type TessWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>
interface TessWord {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

export type ReadProgress = (stage: 'download' | 'read', done: number, total: number) => void

let worker: Promise<TessWorker> | null = null
let loaded = ''
let listener: ReadProgress | null = null

export function readDownloadBytes(langs: string[]): number {
  return wireBytes([...ocrFiles().slice(0, 2), ...langs.map(langFile)])
}

async function start(): Promise<TessWorker> {
  const [workerJs, core] = await Promise.all(ocrFiles().slice(0, 2).map((f) => loadFile(f)))
  const url = (buf: ArrayBuffer) => URL.createObjectURL(new Blob([buf], { type: 'text/javascript' }))
  const Tesseract = await import('tesseract.js')
  return Tesseract.createWorker([], Tesseract.OEM.LSTM_ONLY, {
    workerPath: url(workerJs),
    // A blob URL has no ".js" ending; the fragment makes tesseract load it as a file.
    corePath: `${url(core)}#core.js`,
    langPath: `${location.origin}${LANG_DIR}`,
    workerBlobURL: false,
    cacheMethod: 'write',
    gzip: true,
    logger: (m) => {
      if (m.status === 'recognizing text') listener?.('read', m.progress, 1)
      else if (m.status.startsWith('loading language')) listener?.('download', m.progress, 1)
    },
    errorHandler: () => {},
  })
}

async function ready(langs: string[], onProgress?: ReadProgress): Promise<TessWorker> {
  listener = onProgress ?? null
  if (!worker) {
    const job = start()
    worker = job
    job.catch(() => {
      if (worker === job) worker = null
    })
  }
  const w = await worker
  const key = langs.join('+')
  if (key !== loaded) {
    const { PSM } = await import('tesseract.js')
    await w.reinitialize(key)
    // Automatic page layout: columns, paragraphs and lines in reading order.
    await w.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1', debug_file: '/dev/null' })
    loaded = key
  }
  return w
}

export async function readText(image: HTMLCanvasElement, langs: string[], onProgress?: ReadProgress): Promise<ReadPage> {
  const w = await ready(langs, onProgress)
  const result = await w.recognize(image, {}, { text: true, blocks: true })
  listener = null
  const words: ReadWord[] = []
  const blocks = (result.data as { blocks?: { paragraphs: { lines: { words: TessWord[] }[] }[] }[] | null }).blocks ?? []
  for (const b of blocks)
    for (const p of b.paragraphs)
      for (const l of p.lines)
        for (const word of l.words) {
          if (!word.text.trim()) continue
          words.push({ text: word.text, confidence: word.confidence, x: word.bbox.x0, y: word.bbox.y0, w: word.bbox.x1 - word.bbox.x0, h: word.bbox.y1 - word.bbox.y0 })
        }
  const confidence = words.length ? words.reduce((s, x) => s + x.confidence, 0) / words.length : 0
  return { text: tidy(result.data.text ?? ''), words, confidence }
}
