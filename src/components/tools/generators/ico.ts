/**
 * Minimal ICO container writer.
 *
 * An .ico file is an ICONDIR header, one 16-byte ICONDIRENTRY per image, then
 * the image payloads back to back. Since Windows Vista the payload may be a
 * complete PNG file rather than a headerless DIB, which is what this writes —
 * every current browser and every Windows version still in support reads it.
 */

export interface IcoEntry {
  /** Square edge length in pixels. 256 is the maximum an ICO can describe. */
  size: number
  /** A complete PNG file. */
  png: Uint8Array
}

const HEADER_BYTES = 6
const ENTRY_BYTES = 16

export function buildIco(entries: IcoEntry[]): Uint8Array {
  if (entries.length === 0) throw new Error('An ICO file needs at least one image.')
  for (const entry of entries) {
    if (entry.size < 1 || entry.size > 256) {
      throw new Error(`ICO images must be between 1 and 256 pixels square; got ${entry.size}.`)
    }
  }

  const sorted = [...entries].sort((a, b) => a.size - b.size)
  const payloadOffset = HEADER_BYTES + ENTRY_BYTES * sorted.length
  const total = payloadOffset + sorted.reduce((sum, entry) => sum + entry.png.byteLength, 0)

  const buffer = new ArrayBuffer(total)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // ICONDIR
  view.setUint16(0, 0, true) // reserved, always 0
  view.setUint16(2, 1, true) // 1 = icon (2 would be a cursor)
  view.setUint16(4, sorted.length, true)

  let entryAt = HEADER_BYTES
  let dataAt = payloadOffset

  for (const entry of sorted) {
    // 256 is stored as 0 — the field is a single byte.
    view.setUint8(entryAt + 0, entry.size === 256 ? 0 : entry.size)
    view.setUint8(entryAt + 1, entry.size === 256 ? 0 : entry.size)
    view.setUint8(entryAt + 2, 0) // palette size, 0 for true colour
    view.setUint8(entryAt + 3, 0) // reserved
    view.setUint16(entryAt + 4, 1, true) // colour planes
    view.setUint16(entryAt + 6, 32, true) // bits per pixel
    view.setUint32(entryAt + 8, entry.png.byteLength, true)
    view.setUint32(entryAt + 12, dataAt, true)

    bytes.set(entry.png, dataAt)

    entryAt += ENTRY_BYTES
    dataAt += entry.png.byteLength
  }

  return bytes
}
