/**
 * Page side of text to speech.
 *
 *   await speaker.call('load', { voice }, { onProgress })
 *   await speaker.call('speak', { text, voice, speed }, { onEvent: ({ audio, done, total }) => ... })
 */
import { workerClient } from '../runtime/rpc'
import type { VoiceApi } from './voice.worker'

export const speaker = workerClient<VoiceApi>(() => new Worker(new URL('./voice.worker.ts', import.meta.url), { type: 'module', name: 'voice' }))
