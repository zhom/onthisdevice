/// <reference lib="webworker" />
/**
 * Worker that speaks English text with Kokoro: text to phonemes (./g2p.ts), phonemes to
 * token ids, then the model with the style vector of the voice for that length. Sends the
 * audio sentence group by sentence group. Talk to it through ./client.ts.
 */
import { loadFile } from '../assets'
import { serve } from '../runtime/rpc'
import type { Ctx } from '../runtime/rpc'
import { loadRuntime, openSession } from '../runtime/runtime'
import { chunkText, parseLexicon, phonemize } from './g2p'
import type { Lexicon } from './g2p'
import { KOKORO_MODEL, KOKORO_TOKENIZER, VOICES, lexiconFile, voiceFile } from './voices'
import type { Accent } from './voices'

const STYLE = 256
const MAX_TOKENS = 510

const lexicons = new Map<Accent, Promise<Lexicon>>()
let vocab: Promise<Map<string, number>> | null = null
const styles = new Map<string, Promise<Float32Array>>()

function lexicon(accent: Accent): Promise<Lexicon> {
  let job = lexicons.get(accent)
  if (!job) {
    job = loadFile(lexiconFile(accent)).then((b) => parseLexicon(new TextDecoder().decode(b)))
    lexicons.set(accent, job)
  }
  return job
}

function tokens(): Promise<Map<string, number>> {
  vocab ??= loadFile(KOKORO_TOKENIZER).then((b) => {
    const json = JSON.parse(new TextDecoder().decode(b)) as { model: { vocab: Record<string, number> } }
    return new Map(Object.entries(json.model.vocab))
  })
  return vocab
}

function style(id: string): Promise<Float32Array> {
  let job = styles.get(id)
  if (!job) {
    job = loadFile(voiceFile(id)).then((b) => new Float32Array(b))
    styles.set(id, job)
  }
  return job
}

function accentOf(id: string): Accent {
  return VOICES.find((v) => v.id === id)?.accent ?? 'us'
}

export interface Spoken {
  /** 24 kHz mono samples of one group of sentences. */
  audio: Float32Array
  /** Characters of the text done and in total. */
  done: number
  total: number
}

const handlers = {
  async load(args: { voice: string }, ctx: Ctx) {
    await Promise.all([
      openSession(KOKORO_MODEL, 'wasm', { onProgress: ctx.progress }),
      lexicon(accentOf(args.voice)),
      tokens(),
      style(args.voice),
    ])
  },

  async speak(args: { text: string; voice: string; speed: number }, ctx: Ctx<Spoken>) {
    const [session, ort, lex, ids, voice] = await Promise.all([
      openSession(KOKORO_MODEL, 'wasm'),
      loadRuntime('wasm'),
      lexicon(accentOf(args.voice)),
      tokens(),
      style(args.voice),
    ])
    const chunks = chunkText(args.text)
    const total = chunks.reduce((s, c) => s + c.length, 0)
    let done = 0
    let samples = 0
    for (const chunk of chunks) {
      ctx.check()
      const phonemes = phonemize(lex, chunk)
      const seq = [...phonemes].map((p) => ids.get(p)).filter((v): v is number => v !== undefined).slice(0, MAX_TOKENS - 2)
      done += chunk.length
      if (!seq.length) continue
      const input = new ort.Tensor('int64', BigInt64Array.from([0, ...seq, 0].map(BigInt)), [1, seq.length + 2])
      const row = Math.min(seq.length, MAX_TOKENS - 1)
      const styleT = new ort.Tensor('float32', voice.slice(row * STYLE, (row + 1) * STYLE), [1, STYLE])
      const speed = new ort.Tensor('float32', new Float32Array([args.speed]), [1])
      const out = await session.run({ input_ids: input, style: styleT, speed })
      input.dispose()
      styleT.dispose()
      speed.dispose()
      const wave = out[session.outputNames[0]]
      const audio = new Float32Array(wave.data as Float32Array)
      wave.dispose()
      samples += audio.length
      ctx.emit({ audio, done, total }, [audio.buffer])
    }
    return { samples }
  },
}

export type VoiceApi = typeof handlers
serve(handlers)
