/// <reference lib="webworker" />
/**
 * Worker that transcribes speech with word times. Talk to it through ./client.ts.
 *
 * transformers.js is loaded from a static file that takes the ONNX runtime
 * from globalThis[Symbol.for('onthisdevice.ort')] (see scripts/vendor-models.mjs);
 * this worker sets that to the shared runtime of ../ort.ts first. Every model file is loaded through
 * ../assets.ts (Cache Storage, one progress bar) before transformers.js asks
 * for it, and its cache adapter answers those requests.
 */
import type * as Transformers from '@huggingface/transformers'
import { loadFiles, modelCache, wireBytes } from '../assets'
import { ORT_FILES, loadOrt } from '../ort'
import { splitAtPauses } from './chunks'
import { MODEL_FILES, MODEL_ROOT, SPEECH_MODEL, TRANSFORMERS_FILE } from './model'
import type { Word } from './types'

export type SpeechRequest =
  | { id: number; type: 'load' }
  | { id: number; type: 'transcribe'; audio: Float32Array; language: string }
  | { id: number; type: 'cancel' }

export type SpeechResponse =
  | { id: number; type: 'progress'; loaded: number; total: number }
  | { id: number; type: 'loaded' }
  /** Words of one more piece; `done` and `total` are seconds of audio. */
  | { id: number; type: 'words'; words: Word[]; done: number; total: number }
  | { id: number; type: 'result' }
  | { id: number; type: 'error'; message: string; cancelled?: boolean }

type Asr = Transformers.AutomaticSpeechRecognitionPipeline
/** One word of the pipeline output with return_timestamps: 'word'. */
interface AsrWord {
  text: string
  timestamp: [number, number | null]
}

const scope = self as unknown as DedicatedWorkerGlobalScope
const RATE = 16000
/** Pieces quieter than this (about -54 dBFS) are skipped: the model invents words in silence. */
const SILENT_RMS = 0.002
/** Non-speech notes such as "[BLANK_AUDIO]" or "(music)". */
const NOTE = /^\s*[[(].*[\])]\s*$/

let engine: Promise<Asr> | null = null
const cancelled = new Set<number>()

function post(msg: SpeechResponse) {
  scope.postMessage(msg)
}

function load(id: number): Promise<Asr> {
  if (engine) return engine
  const job = (async () => {
    const files = [TRANSFORMERS_FILE, ...MODEL_FILES]
    const total = wireBytes([...ORT_FILES, ...files])
    let ortLoaded = 0
    let filesLoaded = 0
    const report = () => post({ id, type: 'progress', loaded: Math.min(total, ortLoaded + filesLoaded), total })
    const [ort, [source]] = await Promise.all([
      loadOrt((l) => {
        ortLoaded = l
        report()
      }),
      loadFiles(files, (l) => {
        filesLoaded = l
        report()
      }),
    ])
    ;(globalThis as unknown as Record<symbol, unknown>)[Symbol.for('onthisdevice.ort')] = ort
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
    let T: typeof Transformers
    try {
      T = (await import(/* @vite-ignore */ url)) as typeof Transformers
    } finally {
      URL.revokeObjectURL(url)
    }
    T.env.allowRemoteModels = false
    T.env.allowLocalModels = true
    T.env.localModelPath = MODEL_ROOT
    T.env.useBrowserCache = false
    T.env.useCustomCache = true
    T.env.customCache = modelCache
    const asr = await T.pipeline('automatic-speech-recognition', SPEECH_MODEL, {
      device: 'wasm',
      dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
    })
    return asr as Asr
  })()
  engine = job
  job.catch(() => {
    if (engine === job) engine = null
  })
  return job
}

function message(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  if (/memory|allocation|OOM/i.test(text)) return 'The device ran out of memory for the speech model. Close other tabs and try again.'
  return `The speech model stopped: ${text.slice(0, 200)}`
}

async function transcribe(id: number, audio: Float32Array, language: string) {
  const asr = await load(id)
  const pieces = splitAtPauses(audio, RATE)
  const total = audio.length / RATE
  for (const piece of pieces) {
    if (cancelled.has(id)) throw new DOMException('Cancelled', 'AbortError')
    let words: Word[] = []
    if (piece.rms >= SILENT_RMS) {
      const out = await asr(piece.audio, { return_timestamps: 'word', language, task: 'transcribe' })
      const result = Array.isArray(out) ? out[0] : out
      words = ((result.chunks ?? []) as AsrWord[])
        .filter((c) => c.text.trim() && !NOTE.test(c.text))
        .map((c) => {
          const [a, b] = c.timestamp
          const start = piece.start + (a ?? 0)
          const end = piece.start + (b ?? a ?? 0)
          return { text: c.text, start: round(start), end: round(Math.max(end, start + 0.05)) }
        })
    }
    post({ id, type: 'words', words, done: Math.min(total, piece.start + piece.audio.length / RATE), total })
  }
}

function round(t: number) {
  return Math.round(t * 1000) / 1000
}

scope.onmessage = async (event: MessageEvent<SpeechRequest>) => {
  const req = event.data
  if (req.type === 'cancel') {
    cancelled.add(req.id)
    return
  }
  try {
    if (req.type === 'load') {
      await load(req.id)
      post({ id: req.id, type: 'loaded' })
    } else {
      await transcribe(req.id, req.audio, req.language)
      post({ id: req.id, type: 'result' })
    }
  } catch (err) {
    const isCancel = err instanceof DOMException && err.name === 'AbortError'
    post({ id: req.id, type: 'error', message: isCancel ? 'Cancelled' : message(err), cancelled: isCancel })
  } finally {
    cancelled.delete(req.id)
  }
}
