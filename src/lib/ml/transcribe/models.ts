/**
 * Speech recognition models: Whisper tiny and base with word times (MIT), run by
 * transformers.js on the processor. "fast" is the model the bleep tool uses too; "accurate"
 * makes about a third fewer mistakes and takes about three times as long.
 */
import { wireBytes } from '../assets'
import { TRANSFORMERS_FILE } from '../speech/model'
import { runtimeFiles } from '../runtime/runtime'

export type SpeechModel = 'fast' | 'accurate'

const FILES = ['config.json', 'generation_config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx']

export const SPEECH_MODELS: Record<SpeechModel, { id: string; name: string; label: string }> = {
  fast: { id: 'onnx-community/whisper-tiny_timestamped', name: 'Whisper tiny', label: 'Fast' },
  accurate: { id: 'onnx-community/whisper-base_timestamped', name: 'Whisper base', label: 'Accurate' },
}

export function modelFiles(model: SpeechModel): string[] {
  return FILES.map((f) => `/models/${SPEECH_MODELS[model].id}/${f}`)
}

/** Every file of a first run: runtime, transformers.js and the model. */
export function allFiles(model: SpeechModel): string[] {
  return [...runtimeFiles('wasm'), TRANSFORMERS_FILE, ...modelFiles(model)]
}

export function transcribeDownloadBytes(model: SpeechModel): number {
  return wireBytes(allFiles(model))
}

/** Seconds of audio per second of work on a laptop processor, for estimates. */
export const SPEED: Record<SpeechModel, number> = { fast: 6, accurate: 2 }
