/**
 * Files of the speech model: multilingual Whisper tiny with word times, run by
 * transformers.js. Both are static files on this site (see
 * scripts/vendor-models.mjs); the runtime is the shared one in ../ort.ts.
 */
import { isCached, wireBytes } from '../assets'
import { ORT_FILES } from '../ort'

export const SPEECH_MODEL = 'onnx-community/whisper-tiny_timestamped'
export const MODEL_ROOT = '/models/'
const DIR = `${MODEL_ROOT}${SPEECH_MODEL}/`

/** The transformers.js build that reads the runtime from globalThis[Symbol.for('onthisdevice.ort')]. */
export const TRANSFORMERS_FILE = '/models/transformers/4.3.2/transformers.web.min.mjs'

/** Every file transformers.js asks for, so they can be loaded with one progress bar first. */
export const MODEL_FILES = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
].map((f) => DIR + f)

const ALL_FILES = [...ORT_FILES, TRANSFORMERS_FILE, ...MODEL_FILES]

export function speechDownloadBytes(): number {
  return wireBytes(ALL_FILES)
}

export function speechIsCached(): Promise<boolean> {
  return isCached(ALL_FILES).catch(() => false)
}

/** Languages offered in the picker; Whisper takes the two-letter code. */
export const LANGUAGES: readonly { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ru', name: 'Russian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
]
