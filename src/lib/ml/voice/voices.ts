/**
 * Kokoro 82M (Apache-2.0) and its English voices; scripts/vendor-models.mjs lists the same ids.
 */
import { wireBytes } from '../assets'
import { runtimeFiles } from '../runtime/runtime'

export const KOKORO_DIR = '/models/onnx-community/Kokoro-82M-v1.0-ONNX'
export const KOKORO_MODEL = `${KOKORO_DIR}/onnx/model_quantized.onnx`
export const KOKORO_TOKENIZER = `${KOKORO_DIR}/tokenizer.json`
export const SAMPLE_RATE = 24000

export type Accent = 'us' | 'gb'

export interface Voice {
  id: string
  name: string
  accent: Accent
  gender: 'female' | 'male'
}

export const VOICES: Voice[] = [
  { id: 'af_heart', name: 'Heart', accent: 'us', gender: 'female' },
  { id: 'af_bella', name: 'Bella', accent: 'us', gender: 'female' },
  { id: 'af_nicole', name: 'Nicole', accent: 'us', gender: 'female' },
  { id: 'af_sarah', name: 'Sarah', accent: 'us', gender: 'female' },
  { id: 'am_michael', name: 'Michael', accent: 'us', gender: 'male' },
  { id: 'am_fenrir', name: 'Fenrir', accent: 'us', gender: 'male' },
  { id: 'am_puck', name: 'Puck', accent: 'us', gender: 'male' },
  { id: 'bf_emma', name: 'Emma', accent: 'gb', gender: 'female' },
  { id: 'bf_isabella', name: 'Isabella', accent: 'gb', gender: 'female' },
  { id: 'bm_george', name: 'George', accent: 'gb', gender: 'male' },
  { id: 'bm_fable', name: 'Fable', accent: 'gb', gender: 'male' },
]

export const voiceFile = (id: string) => `${KOKORO_DIR}/voices/${id}.bin`
export const lexiconFile = (accent: Accent) => `/models/kokoro/lexicon-${accent}.tsv`

export function voiceFiles(voice: Voice): string[] {
  return [...runtimeFiles('wasm'), KOKORO_MODEL, KOKORO_TOKENIZER, lexiconFile(voice.accent), voiceFile(voice.id)]
}

export function voiceDownloadBytes(voice: Voice): number {
  return wireBytes(voiceFiles(voice))
}
