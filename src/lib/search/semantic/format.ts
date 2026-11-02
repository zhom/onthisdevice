/**
 * Binary files for search by meaning. One module writes and reads both, so the format lives in
 * one place: scripts/vendor-models.mjs packs the model, src/lib/search/build.ts packs the tool
 * vectors, and the browser reads both. No imports, so Node can load it with type stripping.
 *
 * Model (static embeddings, int8 with one scale per token row):
 *   "OTDSEM01" | u32 tokens | u32 dims | u32 vocab bytes | u32 0 | f32 scale[tokens]
 *   | i8 rows[tokens * dims] | vocab (UTF-8, one token per line, in id order)
 * Vectors (one per tool, int8 with one scale each, in search-index order):
 *   "OTDVEC01" | u32 count | u32 dims | u32 0 | u32 0 | f32 scale[count] | i8 rows[count * dims]
 */

const MODEL_MAGIC = 'OTDSEM01'
const VECTORS_MAGIC = 'OTDVEC01'
const HEAD = 24

export interface Int8Rows {
  count: number
  dims: number
  scales: Float32Array
  rows: Int8Array
}

export interface PackedModel extends Int8Rows {
  vocab: string[]
}

function writeHead(view: DataView, magic: string, a: number, b: number, c: number): void {
  for (let i = 0; i < 8; i++) view.setUint8(i, magic.charCodeAt(i))
  view.setUint32(8, a, true)
  view.setUint32(12, b, true)
  view.setUint32(16, c, true)
  view.setUint32(20, 0, true)
}

function readHead(buf: ArrayBuffer, magic: string): DataView {
  const view = new DataView(buf)
  for (let i = 0; i < 8; i++) {
    if (view.getUint8(i) !== magic.charCodeAt(i)) throw new Error(`Not a ${magic} file`)
  }
  return view
}

/** Symmetric int8 per row: row ≈ scale * int8. */
export function quantizeRows(data: Float32Array, count: number, dims: number): Int8Rows {
  const scales = new Float32Array(count)
  const rows = new Int8Array(count * dims)
  for (let r = 0; r < count; r++) {
    let max = 0
    for (let j = 0; j < dims; j++) max = Math.max(max, Math.abs(data[r * dims + j]))
    const scale = max / 127 || 1
    scales[r] = scale
    for (let j = 0; j < dims; j++) rows[r * dims + j] = Math.round(data[r * dims + j] / scale)
  }
  return { count, dims, scales, rows }
}

export function packModel(m: PackedModel): Uint8Array<ArrayBuffer> {
  const vocab = new TextEncoder().encode(m.vocab.join('\n'))
  const out = new Uint8Array(HEAD + m.count * 4 + m.count * m.dims + vocab.length)
  writeHead(new DataView(out.buffer), MODEL_MAGIC, m.count, m.dims, vocab.length)
  out.set(new Uint8Array(m.scales.buffer, m.scales.byteOffset, m.count * 4), HEAD)
  out.set(new Uint8Array(m.rows.buffer, m.rows.byteOffset, m.count * m.dims), HEAD + m.count * 4)
  out.set(vocab, HEAD + m.count * 4 + m.count * m.dims)
  return out
}

export function parseModel(buf: ArrayBuffer): PackedModel {
  const view = readHead(buf, MODEL_MAGIC)
  const count = view.getUint32(8, true)
  const dims = view.getUint32(12, true)
  const vocabBytes = view.getUint32(16, true)
  const scales = new Float32Array(buf.slice(HEAD, HEAD + count * 4))
  const rows = new Int8Array(buf, HEAD + count * 4, count * dims)
  const at = HEAD + count * 4 + count * dims
  const vocab = new TextDecoder().decode(new Uint8Array(buf, at, vocabBytes)).split('\n')
  if (vocab.length !== count) throw new Error('Model vocabulary does not match its rows')
  return { count, dims, scales, rows, vocab }
}

export function packVectors(v: Int8Rows): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(HEAD + v.count * 4 + v.count * v.dims)
  writeHead(new DataView(out.buffer), VECTORS_MAGIC, v.count, v.dims, 0)
  out.set(new Uint8Array(v.scales.buffer, v.scales.byteOffset, v.count * 4), HEAD)
  out.set(new Uint8Array(v.rows.buffer, v.rows.byteOffset, v.count * v.dims), HEAD + v.count * 4)
  return out
}

export function parseVectors(buf: ArrayBuffer): Int8Rows {
  const view = readHead(buf, VECTORS_MAGIC)
  const count = view.getUint32(8, true)
  const dims = view.getUint32(12, true)
  return {
    count,
    dims,
    scales: new Float32Array(buf.slice(HEAD, HEAD + count * 4)),
    rows: new Int8Array(buf, HEAD + count * 4, count * dims),
  }
}

/** The F32 tensor `name` of a .safetensors file. */
export function readSafetensor(file: Uint8Array, name: string): { data: Float32Array; shape: number[] } {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength)
  const headLen = Number(view.getBigUint64(0, true))
  const head = JSON.parse(new TextDecoder().decode(file.subarray(8, 8 + headLen))) as Record<
    string,
    { dtype: string; shape: number[]; data_offsets: [number, number] }
  >
  const t = head[name]
  if (!t || t.dtype !== 'F32') throw new Error(`safetensors: no F32 tensor "${name}"`)
  const [a, b] = t.data_offsets
  const bytes = file.slice(8 + headLen + a, 8 + headLen + b)
  return { data: new Float32Array(bytes.buffer, bytes.byteOffset, (b - a) / 4), shape: t.shape }
}
