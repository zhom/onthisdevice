/**
 * Splits 16 kHz mono audio into pieces of at most 30 s (the window of the
 * speech model), cut at the quietest moment near the end of each piece so no
 * word is cut in two. Each piece is transcribed on its own and its word times
 * are offset by `start`.
 */

export interface AudioPiece {
  /** Seconds from the start of the recording. */
  start: number
  audio: Float32Array
  /** Root mean square level; near 0 means silence. */
  rms: number
}

const FRAME_S = 0.02

/** RMS level per 20 ms frame. */
function frameLevels(audio: Float32Array, rate: number): Float32Array {
  const size = Math.round(rate * FRAME_S)
  const n = Math.ceil(audio.length / size)
  const out = new Float32Array(n)
  for (let f = 0; f < n; f++) {
    let e = 0
    const end = Math.min(audio.length, (f + 1) * size)
    for (let i = f * size; i < end; i++) e += audio[i] * audio[i]
    out[f] = Math.sqrt(e / Math.max(1, end - f * size))
  }
  return out
}

function rmsOf(audio: Float32Array): number {
  let e = 0
  for (let i = 0; i < audio.length; i++) e += audio[i] * audio[i]
  return Math.sqrt(e / Math.max(1, audio.length))
}

/**
 * `maxS` is the longest piece; the cut is searched in the last `searchS`
 * seconds of it, at the 200 ms stretch with the least energy.
 */
export function splitAtPauses(audio: Float32Array, rate: number, maxS = 28, searchS = 8): AudioPiece[] {
  const levels = frameLevels(audio, rate)
  const frameSize = Math.round(rate * FRAME_S)
  const maxFrames = Math.floor(maxS / FRAME_S)
  const searchFrames = Math.floor(searchS / FRAME_S)
  const smooth = 10
  const cuts: number[] = [0]
  let at = 0
  while (levels.length - at > maxFrames) {
    let best = at + maxFrames
    let bestLevel = Infinity
    for (let f = at + maxFrames - searchFrames; f <= at + maxFrames - smooth; f++) {
      let sum = 0
      for (let k = 0; k < smooth; k++) sum += levels[f + k]
      if (sum < bestLevel) {
        bestLevel = sum
        best = f + smooth / 2
      }
    }
    cuts.push(best)
    at = best
  }
  cuts.push(levels.length)
  const pieces: AudioPiece[] = []
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i] * frameSize
    const b = Math.min(audio.length, cuts[i + 1] * frameSize)
    if (b - a < rate * 0.2) continue
    const slice = audio.subarray(a, b)
    pieces.push({ start: a / rate, audio: slice, rms: rmsOf(slice) })
  }
  return pieces
}
