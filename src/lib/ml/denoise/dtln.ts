/**
 * DTLN speech noise removal (MIT, Nils Westhausen): two small stateful networks at 16 kHz.
 * Every 8 ms (128 samples) the last 32 ms (512 samples) are transformed: the first network
 * masks the spectrum, the second cleans the frame in its own learned domain, and the frames
 * are added back with overlap. The output is late by 384 samples.
 */
export const RATE = 16000
export const BLOCK = 512
export const SHIFT = 128
export const DELAY = BLOCK - SHIFT

/**
 * Mixes the cleaned and the original sound: `strength` 1 is only the cleaned sound, 0 the
 * original. The cleaned sound is shifted back by its delay.
 */
export function mix(original: Float32Array, cleaned: Float32Array, strength: number): Float32Array {
  const out = new Float32Array(original.length)
  for (let i = 0; i < out.length; i++) out[i] = strength * (cleaned[i + DELAY] ?? 0) + (1 - strength) * original[i]
  return out
}
