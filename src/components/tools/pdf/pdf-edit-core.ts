/**
 * Round-2 batch `pdf-edit` — private helpers.
 *
 * Self-contained on purpose: this batch shares the `pdf/` directory with the
 * round-1 islands but must not import their internals, so the handful of
 * routines below are its own copies. Nothing here touches the network.
 */

export type PdfLib = typeof import('pdf-lib')

/** Lazily load pdf-lib so it stays out of the initial island payload. */
export function loadPdfLib(): Promise<PdfLib> {
  return import('pdf-lib')
}

/** Lazily load the configured pdf.js renderer. */
export async function loadPdfJs() {
  const { pdfjs } = await import('./pdf-edit-pdfjs')
  return pdfjs
}

const byteCache = new WeakMap<File, Promise<Uint8Array>>()

/** Read a File into bytes once; treat the result as read-only. */
export function readPdfBytes(file: File): Promise<Uint8Array> {
  const cached = byteCache.get(file)
  if (cached) return cached
  const pending = file
    .arrayBuffer()
    .then((buffer) => new Uint8Array(buffer))
    .catch((err: unknown) => {
      byteCache.delete(file)
      throw err
    })
  byteCache.set(file, pending)
  return pending
}

/** pdf.js detaches the buffer it is handed, so every call gets a fresh copy. */
export function copyBytes(bytes: Uint8Array): Uint8Array {
  return bytes.slice()
}

export function pdfBlob(bytes: Uint8Array): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type: 'application/pdf' })
}

/** Turn an unknown thrown value into a sentence a human can act on. */
export function humanPdfError(err: unknown, filename?: string): string {
  const where = filename ? `“${filename}”` : 'This file'
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  const msg = raw.toLowerCase()

  if (msg.includes('password') || msg.includes('encrypt')) {
    return `${where} is password-protected, so it cannot be edited until the password is removed. Open it in a reader with the password and re-save it, then try again.`
  }
  if (msg.includes('invalid pdf') || msg.includes('no pdf header') || msg.includes('formaterror')) {
    return `${where} is not a readable PDF. It may be damaged, or it may be another file type with a .pdf name.`
  }
  if (msg.includes('cannot encode') || msg.includes('winansi')) {
    return 'Those characters cannot be drawn with the fonts built into every PDF reader, which cover Western European alphabets only. Remove them, or place the text as an image instead.'
  }
  if (msg.includes('out of memory') || msg.includes('allocation') || msg.includes('array buffer')) {
    return 'Your browser ran out of memory for this document. Close other tabs, lower the output quality, or try it on a desktop browser.'
  }
  if (msg.includes('worker')) {
    return 'The PDF renderer could not start. Reload the page. An extension that blocks web workers is the usual cause.'
  }
  return `${where} could not be processed. ${raw}`
}

/** Safe-ish output filename: keeps the stem, swaps in a suffix and extension. */
export function outputName(original: string, suffix: string, ext = 'pdf'): string {
  const stem =
    original.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'document'
  return `${stem}${suffix}.${ext}`
}

export function normalizeAngle(angle: number): number {
  return ((Math.round(angle) % 360) + 360) % 360
}

/** "#4f46e5" -> { r, g, b } in the 0-1 range pdf-lib expects. */
export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const clean = hex.trim().replace(/^#/, '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const value = Number.parseInt(full.slice(0, 6).padEnd(6, '0'), 16)
  if (!Number.isFinite(value)) return { r: 0, g: 0, b: 0 }
  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  }
}

/**
 * The 14 built-in PDF fonts cover WinAnsi only. Find the first character that
 * would make pdf-lib throw, so we can say something useful first.
 */
export function findUnsupportedCharacter(text: string): string | null {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code === 10 || code === 13 || code === 9) continue
    if (code > 0x2122) return char
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Page geometry                                                       */
/* ------------------------------------------------------------------ */

/**
 * Everything the overlay layer needs to know about one page.
 *
 * `displayW` / `displayH` are the page as the *reader shows it* — the crop box
 * with the page's own /Rotate applied — measured in PostScript points. Every
 * object the user places is stored in that space, with the origin at the
 * top-left and y running downwards, because that is how the DOM overlay works.
 */
export interface PageGeometry {
  index: number
  /** Crop-box size before rotation, in points. */
  boxW: number
  boxH: number
  /** Crop-box offset inside user space, in points. */
  boxX: number
  boxY: number
  rotation: number
  displayW: number
  displayH: number
}

export function displayDims(boxW: number, boxH: number, rotation: number) {
  return normalizeAngle(rotation) % 180 === 0
    ? { displayW: boxW, displayH: boxH }
    : { displayW: boxH, displayH: boxW }
}

/**
 * Map a point given in *displayed* page space (x from the left, y from the
 * bottom, both in points) into the PDF's own unrotated user space.
 *
 * Derivation, for /Rotate 90 (the page is turned clockwise for display): the
 * unrotated bottom-right corner ends up bottom-left on screen, so screen-x
 * runs along user +y and screen-y runs along user −x.
 */
export function displayToUser(
  geo: PageGeometry,
  dx: number,
  dyFromBottom: number,
): { x: number; y: number } {
  const { boxW, boxH, boxX, boxY } = geo
  switch (normalizeAngle(geo.rotation)) {
    case 90:
      return { x: boxX + boxW - dyFromBottom, y: boxY + dx }
    case 180:
      return { x: boxX + boxW - dx, y: boxY + boxH - dyFromBottom }
    case 270:
      return { x: boxX + dyFromBottom, y: boxY + boxH - dx }
    default:
      return { x: boxX + dx, y: boxY + dyFromBottom }
  }
}

/**
 * The exact inverse of {@link displayToUser}: take a point in the PDF's own
 * user space and say where it sits on the page as the reader sees it, measured
 * from the top-left corner with y running downwards.
 */
export function userToDisplay(geo: PageGeometry, ux: number, uy: number): { x: number; y: number } {
  const { boxW, boxH, boxX, boxY, displayH } = geo
  let dx: number
  let dyFromBottom: number
  switch (normalizeAngle(geo.rotation)) {
    case 90:
      dx = uy - boxY
      dyFromBottom = boxX + boxW - ux
      break
    case 180:
      dx = boxX + boxW - ux
      dyFromBottom = boxY + boxH - uy
      break
    case 270:
      dx = boxY + boxH - uy
      dyFromBottom = ux - boxX
      break
    default:
      dx = ux - boxX
      dyFromBottom = uy - boxY
  }
  return { x: dx, y: displayH - dyFromBottom }
}

/**
 * The rotation, in pdf-lib's counter-clockwise degrees, that makes content
 * drawn in user space appear upright on a rotated page.
 */
export function drawAngleFor(rotation: number): number {
  return normalizeAngle(rotation)
}

/** Read the geometry of every page of a loaded pdf-lib document. */
export function geometryFromPdfLib(pages: ReadonlyArray<{
  getCropBox(): { x: number; y: number; width: number; height: number }
  getRotation(): { angle: number }
}>): PageGeometry[] {
  return pages.map((page, index) => {
    const box = page.getCropBox()
    const rotation = normalizeAngle(page.getRotation().angle)
    const { displayW, displayH } = displayDims(box.width, box.height, rotation)
    return {
      index,
      boxW: box.width,
      boxH: box.height,
      boxX: box.x,
      boxY: box.y,
      rotation,
      displayW,
      displayH,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Canvas helpers                                                      */
/* ------------------------------------------------------------------ */

export function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('This browser would not give us a 2D canvas to draw on.')
  }
  return ctx
}

/**
 * Encode a canvas as JPEG bytes.
 *
 * The browser's own encoder is tried first, deliberately: it is hardware
 * accelerated and roughly an order of magnitude faster than mozjpeg in
 * WebAssembly, which matters when a hundred-page document is being rasterised
 * a page at a time. mozjpeg (via Squoosh) is the fallback — it produces
 * somewhat smaller files at the same quality, so it is worth having, but not at
 * the cost of a minute of extra work on a long document. Both run entirely on
 * this device.
 */
export async function encodeCanvasJpeg(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  if (blob) return new Uint8Array(await blob.arrayBuffer())

  const { encode } = await import('@jsquash/jpeg')
  const data = get2dContext(canvas).getImageData(0, 0, canvas.width, canvas.height)
  const buffer = await encode(data, { quality: Math.round(quality * 100) })
  return new Uint8Array(buffer)
}

export async function encodeCanvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('The browser could not encode the rendered page as a PNG.')
  return new Uint8Array(await blob.arrayBuffer())
}

/** Detect the image type from its magic bytes — file extensions lie. */
export function sniffImageType(bytes: Uint8Array): 'png' | 'jpg' | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) return 'png'
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg'
  return null
}

/**
 * Re-encode any browser-decodable image (GIF, BMP, WebP, SVG…) as PNG bytes so
 * pdf-lib can embed it. PNG and JPEG pass straight through untouched.
 */
export async function toEmbeddableImage(
  file: File,
): Promise<{ bytes: Uint8Array; type: 'png' | 'jpg'; width: number; height: number }> {
  const raw = new Uint8Array(await file.arrayBuffer())
  const bitmap = await loadBitmap(file)
  const sniffed = sniffImageType(raw)
  if (sniffed) {
    const result = { bytes: raw, type: sniffed, width: bitmap.width, height: bitmap.height }
    bitmap.close?.()
    return result
  }
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  get2dContext(canvas).drawImage(bitmap, 0, 0)
  bitmap.close?.()
  return {
    bytes: await encodeCanvasPng(canvas),
    type: 'png',
    width: canvas.width,
    height: canvas.height,
  }
}

/** Decode any browser-readable image file onto a canvas at its natural size. */
export async function decodeImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await loadBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, bitmap.width)
  canvas.height = Math.max(1, bitmap.height)
  get2dContext(canvas).drawImage(bitmap, 0, 0)
  bitmap.close?.()
  return canvas
}

interface ClosableBitmap {
  width: number
  height: number
  close?: () => void
}

async function loadBitmap(file: File): Promise<CanvasImageSource & ClosableBitmap> {
  if (typeof createImageBitmap === 'function' && file.type !== 'image/svg+xml') {
    try {
      return await createImageBitmap(file)
    } catch {
      /* fall through to the <img> path */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'sync'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () =>
        reject(new Error(`“${file.name}” could not be decoded as an image by this browser.`))
      img.src = url
    })
    return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight })
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

/** 12345678 -> "12,345,678" without pulling in a formatter. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
