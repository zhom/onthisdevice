/**
 * Small private helpers for the `pdf-secure` batch. Deliberately self-contained
 * so this batch never reaches into another agent's module.
 */

export async function readFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}

/** pdf.js takes ownership of the buffer it is handed, so give it a copy. */
export function copyBytes(bytes: Uint8Array): Uint8Array {
  return bytes.slice()
}

/** Wrap bytes in a Blob backed by a plain ArrayBuffer. */
export function bytesToBlob(bytes: Uint8Array, type = 'application/pdf'): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type })
}

export function stripExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i <= 0 ? name : name.slice(0, i)
}

export function outputName(source: string, suffix: string, extension = 'pdf'): string {
  const base = stripExt(source).trim() || 'document'
  return `${base}${suffix}.${extension}`
}

/** Turn an unknown thrown value into something a person can act on. */
export function humanPdfError(err: unknown, filename?: string): string {
  const where = filename ? `“${filename}”` : 'This file'
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  const msg = raw.toLowerCase()

  if (msg.includes('cancelled-by-user')) return 'Cancelled. Nothing was changed.'
  if (msg.includes('password') || msg.includes('encrypt')) {
    return `${where} is password-protected. Remove the password with Unlock PDF first, then come back.`
  }
  if (msg.includes('invalid pdf') || msg.includes('no pdf header') || msg.includes('formaterror')) {
    return `${where} is not a readable PDF. It may be damaged, or it may be a renamed file of another type.`
  }
  if (msg.includes('out of memory') || msg.includes('allocation') || msg.includes('array buffer')) {
    return 'Your browser ran out of memory for this document. Close other tabs, or try it on a desktop browser.'
  }
  if (msg.includes('worker')) {
    return 'The PDF renderer could not start. Reload the page. An extension that blocks web workers can cause this.'
  }
  return `${where} could not be processed. ${raw}`
}

/** Human error text for the spreadsheet and document tools in this batch. */
export function humanFileError(err: unknown, filename?: string): string {
  const where = filename ? `“${filename}”` : 'That file'
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  if (raw.toLowerCase().includes('out of memory')) {
    return 'Your browser ran out of memory. Try a smaller file or a desktop browser.'
  }
  return `${where} could not be read. ${raw}`
}

export function percentSaved(before: number, after: number): number {
  if (before <= 0) return 0
  return Math.max(0, Math.round(((before - after) / before) * 100))
}

/** "1.2 MB" for a byte count, matching the site's formatting. */
export function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`
}
