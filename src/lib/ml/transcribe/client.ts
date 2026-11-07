/**
 * Page side of speech recognition.
 *
 *   await transcriber.call('load', { model }, { onProgress })
 *   const words = await transcriber.call('transcribe', { model, audio, language, translate }, { onEvent, transfer: [audio.buffer] })
 */
import { workerClient } from '../runtime/rpc'
import type { TranscribeApi } from './transcribe.worker'

export const transcriber = workerClient<TranscribeApi>(() => new Worker(new URL('./transcribe.worker.ts', import.meta.url), { type: 'module', name: 'transcribe' }))
