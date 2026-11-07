/**
 * Output files of the AI tools: canvas to an image file, several files to one ZIP, text and
 * audio files.
 */
import { encodeCanvas } from '@/components/tools/image-edit/image-utils'

export type ImageFormat = 'png' | 'jpeg' | 'webp'

/** Encodes a canvas; JPG has no alpha, so transparent pixels become white first. */
export async function canvasBlob(canvas: HTMLCanvasElement, format: ImageFormat, quality = 0.92): Promise<Blob> {
  if (format !== 'jpeg') return encodeCanvas(canvas, format, quality)
  const flat = document.createElement('canvas')
  flat.width = canvas.width
  flat.height = canvas.height
  const ctx = flat.getContext('2d')
  if (!ctx) throw new Error('Your browser blocked canvas drawing, so the image cannot be saved.')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, flat.width, flat.height)
  ctx.drawImage(canvas, 0, 0)
  return encodeCanvas(flat, 'jpeg', quality)
}

/** One ZIP of several files; names that repeat get a number. */
export async function zipBlobs(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const { zip } = await import('fflate')
  const used = new Map<string, number>()
  const entries: Record<string, Uint8Array> = {}
  for (const f of files) {
    const n = used.get(f.name) ?? 0
    used.set(f.name, n + 1)
    const name = n ? f.name.replace(/(\.[^.]+)?$/, `-${n + 1}$1`) : f.name
    entries[name] = new Uint8Array(await f.blob.arrayBuffer())
  }
  const data = await new Promise<Uint8Array>((resolve, reject) => zip(entries, { level: 0 }, (err, out) => (err ? reject(err) : resolve(out))))
  return new Blob([data as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}

export function textBlob(text: string, type = 'text/plain'): Blob {
  return new Blob([text], { type: `${type};charset=utf-8` })
}

/** 16-bit PCM WAV of mono samples. */
export function wavBlob(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  text(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true)
  return new Blob([buf], { type: 'audio/wav' })
}

/** Joins sample arrays into one. */
export function joinSamples(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
