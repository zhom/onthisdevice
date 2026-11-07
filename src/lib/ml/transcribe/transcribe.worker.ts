/// <reference lib="webworker" />
/**
 * Worker that turns speech into text with word or phrase times, in the spoken language or
 * translated to English. Talk to it through ./client.ts.
 */
import type * as Transformers from '@huggingface/transformers'
import { serve } from '../runtime/rpc'
import type { Ctx } from '../runtime/rpc'
import { loadTransformers } from '../runtime/transformers'
import { splitAtPauses } from '../speech/chunks'
import type { Word } from '../speech/types'
import { SPEECH_MODELS, modelFiles } from './models'
import type { SpeechModel } from './models'

type Asr = Transformers.AutomaticSpeechRecognitionPipeline
interface AsrChunk {
  text: string
  timestamp: [number, number | null]
}

const RATE = 16000
/** Pieces quieter than this (about -54 dBFS) are skipped: the model invents words in silence. */
const SILENT_RMS = 0.002
/** Non-speech notes such as "[BLANK_AUDIO]" or "(music)". */
const NOTE = /^\s*[[(].*[\])]\s*$/

interface Engine {
  asr: Asr
  T: typeof Transformers
}

const pipelines = new Map<SpeechModel, Promise<Engine>>()

function pipeline(model: SpeechModel, onProgress?: (done: number, total: number) => void): Promise<Engine> {
  const existing = pipelines.get(model)
  if (existing) return existing
  const job = (async () => {
    const T = await loadTransformers('wasm', modelFiles(model), onProgress)
    const asr = await T.pipeline('automatic-speech-recognition', SPEECH_MODELS[model].id, {
      device: 'wasm',
      dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
    })
    return { asr: asr as Asr, T }
  })()
  pipelines.set(model, job)
  job.catch(() => pipelines.delete(model))
  return job
}

export interface Piece {
  /** Two-letter code of the spoken language (detected when none was given). */
  language: string
  words: Word[]
  /** Seconds of audio done and in total. */
  done: number
  total: number
}

const round = (t: number) => Math.round(t * 1000) / 1000

interface WhisperConfig {
  decoder_start_token_id: number
  lang_to_id: Record<string, number>
}

/**
 * The spoken language, from the first token Whisper would write after "start of transcript"
 * for up to 30 s of the loudest speech: the language token with the highest score.
 */
async function detectLanguage({ asr, T }: Engine, audio: Float32Array): Promise<string> {
  const pieces = splitAtPauses(audio, RATE).filter((p) => p.rms >= SILENT_RMS)
  const piece = pieces.sort((a, b) => b.rms - a.rms)[0]
  if (!piece) return 'en'
  const { input_features } = (await asr.processor(piece.audio)) as { input_features: Transformers.Tensor }
  const config = asr.model.generation_config as unknown as WhisperConfig
  const start = new T.Tensor('int64', BigInt64Array.from([BigInt(config.decoder_start_token_id)]), [1, 1])
  const out = (await asr.model({ input_features, decoder_input_ids: start })) as { logits: Transformers.Tensor }
  const logits = out.logits.data as Float32Array
  const vocab = out.logits.dims[2]
  const row = logits.subarray(logits.length - vocab)
  let best = 'en'
  let score = -Infinity
  for (const [token, id] of Object.entries(config.lang_to_id)) {
    if (row[id] > score) {
      score = row[id]
      best = token.slice(2, -2)
    }
  }
  return best
}

const handlers = {
  async load(args: { model: SpeechModel }, ctx: Ctx) {
    await pipeline(args.model, ctx.progress)
  },

  /**
   * `language` is a two-letter code, or '' to let the model detect it. `translate` writes
   * English whatever the spoken language; its times are per phrase, not per word.
   */
  async transcribe(args: { model: SpeechModel; audio: Float32Array; language: string; translate: boolean }, ctx: Ctx<Piece>) {
    const engine = await pipeline(args.model)
    const { asr } = engine
    const language = args.language || (await detectLanguage(engine, args.audio))
    ctx.emit({ words: [], done: 0, total: args.audio.length / RATE, language })
    const pieces = splitAtPauses(args.audio, RATE)
    const total = args.audio.length / RATE
    const all: Word[] = []
    for (const piece of pieces) {
      ctx.check()
      let words: Word[] = []
      if (piece.rms >= SILENT_RMS) {
        const out = await asr(piece.audio, {
          return_timestamps: args.translate ? true : 'word',
          language,
          task: args.translate ? 'translate' : 'transcribe',
        })
        const result = Array.isArray(out) ? out[0] : out
        words = ((result.chunks ?? []) as AsrChunk[])
          .filter((c) => c.text.trim() && !NOTE.test(c.text))
          .map((c) => {
            const [a, b] = c.timestamp
            const start = piece.start + (a ?? 0)
            const end = piece.start + (b ?? a ?? 0)
            return { text: args.translate ? ` ${c.text.trim()}` : c.text, start: round(start), end: round(Math.max(end, start + 0.05)) }
          })
      }
      all.push(...words)
      ctx.emit({ words, done: Math.min(total, piece.start + piece.audio.length / RATE), total, language })
    }
    return all
  },
}

export type TranscribeApi = typeof handlers
serve(handlers)
