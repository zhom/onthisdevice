/**
 * 16-bit PCM WAV from planar float samples, written in slices so a long
 * recording never needs one huge buffer. `process(channel, start, slice)` can
 * change each slice before it is written (the bleeps).
 */

const SLICE = 1 << 16

export function encodeWav(
  channels: readonly Float32Array[],
  rate: number,
  process?: (start: number, slices: Float32Array[]) => void,
): Blob {
  const frames = channels[0]?.length ?? 0
  const n = channels.length
  const dataBytes = frames * n * 2
  const header = new DataView(new ArrayBuffer(44))
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) header.setUint8(at + i, s.charCodeAt(i))
  }
  text(0, 'RIFF')
  header.setUint32(4, 36 + dataBytes, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  header.setUint32(16, 16, true)
  header.setUint16(20, 1, true)
  header.setUint16(22, n, true)
  header.setUint32(24, rate, true)
  header.setUint32(28, rate * n * 2, true)
  header.setUint16(32, n * 2, true)
  header.setUint16(34, 16, true)
  text(36, 'data')
  header.setUint32(40, dataBytes, true)

  const parts: BlobPart[] = [header.buffer]
  for (let start = 0; start < frames; start += SLICE) {
    const len = Math.min(SLICE, frames - start)
    const slices = channels.map((ch) => ch.slice(start, start + len))
    process?.(start, slices)
    const out = new Int16Array(len * n)
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < n; c++) {
        const v = Math.max(-1, Math.min(1, slices[c][i]))
        out[i * n + c] = v < 0 ? v * 0x8000 : v * 0x7fff
      }
    }
    parts.push(out.buffer)
  }
  return new Blob(parts, { type: 'audio/wav' })
}
