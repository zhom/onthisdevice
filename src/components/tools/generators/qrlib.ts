import QRCode from 'qrcode'
import type { QRCodeErrorCorrectionLevel } from 'qrcode'

/** The four QR error-correction levels, in ascending redundancy. */
export type EccLevel = 'L' | 'M' | 'Q' | 'H'

export const ECC_LABEL: Record<EccLevel, string> = {
  L: 'L (recovers ~7%)',
  M: 'M (recovers ~15%)',
  Q: 'Q (recovers ~25%)',
  H: 'H (recovers ~30%)',
}

/** Largest fraction of the symbol a centre logo may cover, per ECC level. */
export const ECC_MAX_LOGO: Record<EccLevel, number> = { L: 0.1, M: 0.16, Q: 0.22, H: 0.28 }

export interface QrMatrix {
  /** Module count per side, excluding the quiet zone. */
  size: number
  /** Symbol version, 1…40. */
  version: number
  /** True when the module at (row, col) is dark. */
  get: (row: number, col: number) => boolean
}

export interface QrStyleOptions {
  /** Final bitmap edge length in CSS pixels, including the quiet zone. */
  size: number
  /** Quiet-zone width measured in modules. 4 is the spec minimum. */
  margin: number
  /** Dark-module colour as `#rrggbb`. */
  dark: string
  /** Background colour as `#rrggbb`, or `null` for a transparent background. */
  light: string | null
}

export interface QrLogo {
  /** Already-decoded image to stamp in the centre. */
  image: CanvasImageSource
  /** Logo edge length as a fraction (0.05…0.3) of the symbol width. */
  scale: number
  /** Paint a background plate behind the logo so quiet space is preserved. */
  padded: boolean
  /** Intrinsic aspect ratio (width / height) so the logo is never distorted. */
  aspect: number
}

export class QrTooLongError extends Error {
  constructor(level: EccLevel) {
    super(
      `That is too much data for one QR code at error-correction level ${level}. Shorten the text, or drop to a lower correction level.`,
    )
    this.name = 'QrTooLongError'
  }
}

/**
 * Build the module matrix. Throws {@link QrTooLongError} when the payload
 * cannot fit in a version-40 symbol at the requested correction level.
 */
export function createMatrix(text: string, level: EccLevel): QrMatrix {
  if (text.length === 0) throw new Error('There is nothing to encode yet.')
  let qr
  try {
    qr = QRCode.create(text, { errorCorrectionLevel: level as QRCodeErrorCorrectionLevel })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/too big|big to be stored|code length overflow/i.test(message)) throw new QrTooLongError(level)
    throw new Error(`This text could not be encoded as a QR code: ${message}`)
  }
  const { size, data } = qr.modules
  return {
    size,
    version: qr.version,
    get: (row, col) => data[row * size + col] === 1,
  }
}

/** Bytes the payload occupies, useful for a "how full is this symbol" readout. */
export function payloadByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/**
 * Draw a QR symbol onto a canvas at device-pixel resolution.
 * The canvas is resized to `style.size` CSS pixels square.
 */
export function drawQr(
  canvas: HTMLCanvasElement,
  matrix: QrMatrix,
  style: QrStyleOptions,
  logo?: QrLogo | null,
  dpr = 1,
): void {
  const total = matrix.size + style.margin * 2
  const pixel = Math.max(1, Math.floor((style.size * dpr) / total))
  const edge = pixel * total

  canvas.width = edge
  canvas.height = edge

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser blocked the 2D canvas this tool needs to draw the code.')

  ctx.clearRect(0, 0, edge, edge)
  if (style.light) {
    ctx.fillStyle = style.light
    ctx.fillRect(0, 0, edge, edge)
  }

  ctx.fillStyle = style.dark
  for (let row = 0; row < matrix.size; row++) {
    let runStart = -1
    for (let col = 0; col <= matrix.size; col++) {
      const dark = col < matrix.size && matrix.get(row, col)
      if (dark && runStart === -1) runStart = col
      if (!dark && runStart !== -1) {
        ctx.fillRect(
          (runStart + style.margin) * pixel,
          (row + style.margin) * pixel,
          (col - runStart) * pixel,
          pixel,
        )
        runStart = -1
      }
    }
  }

  if (logo) {
    const logoW = Math.round(matrix.size * logo.scale * pixel)
    const logoH = Math.round(logoW / (logo.aspect || 1))
    const cx = edge / 2
    const cy = edge / 2
    if (logo.padded) {
      const padX = Math.round(logoW * 0.12)
      const padY = Math.round(logoH * 0.12)
      ctx.fillStyle = style.light ?? '#ffffff'
      roundRect(
        ctx,
        cx - logoW / 2 - padX,
        cy - logoH / 2 - padY,
        logoW + padX * 2,
        logoH + padY * 2,
        Math.round(pixel * 1.5),
      )
      ctx.fill()
    }
    ctx.drawImage(logo.image, cx - logoW / 2, cy - logoH / 2, logoW, logoH)
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

export interface QrSvgLogo {
  /** Data URI of the logo — remote URLs would break the offline promise. */
  href: string
  scale: number
  padded: boolean
  aspect: number
}

/**
 * Serialise the symbol as a standalone SVG. Modules are merged into horizontal
 * runs, which keeps the file an order of magnitude smaller than one rect each.
 */
export function qrToSvg(
  matrix: QrMatrix,
  style: QrStyleOptions,
  logo?: QrSvgLogo | null,
): string {
  const total = matrix.size + style.margin * 2
  const parts: string[] = []

  for (let row = 0; row < matrix.size; row++) {
    let runStart = -1
    for (let col = 0; col <= matrix.size; col++) {
      const dark = col < matrix.size && matrix.get(row, col)
      if (dark && runStart === -1) runStart = col
      if (!dark && runStart !== -1) {
        parts.push(`M${runStart + style.margin} ${row + style.margin}h${col - runStart}v1h-${col - runStart}z`)
        runStart = -1
      }
    }
  }

  const background = style.light
    ? `<rect width="${total}" height="${total}" fill="${style.light}"/>`
    : ''

  let overlay = ''
  if (logo) {
    const w = matrix.size * logo.scale
    const h = w / (logo.aspect || 1)
    const x = (total - w) / 2
    const y = (total - h) / 2
    if (logo.padded) {
      const padX = w * 0.12
      const padY = h * 0.12
      overlay += `<rect x="${fmt(x - padX)}" y="${fmt(y - padY)}" width="${fmt(w + padX * 2)}" height="${fmt(
        h + padY * 2,
      )}" rx="1" fill="${style.light ?? '#ffffff'}"/>`
    }
    overlay += `<image x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(
      h,
    )}" preserveAspectRatio="xMidYMid meet" href="${escapeXml(logo.href)}"/>`
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${style.size}" height="${style.size}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="QR code">`,
    background,
    `<path fill="${style.dark}" d="${parts.join('')}"/>`,
    overlay,
    `</svg>`,
    '',
  ].join('\n')
}

function fmt(n: number): string {
  return String(Math.round(n * 1000) / 1000)
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Canvas → PNG Blob. */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The browser could not turn the canvas into a PNG.'))
    }, 'image/png')
  })
}

export interface LoadedImage {
  image: HTMLImageElement
  aspect: number
  /** PNG data URI of the decoded bitmap — safe to embed in an exported SVG. */
  dataUri: string
}

/** Decode a File into something drawable, with its aspect ratio and a data URI. */
export async function loadImage(file: Blob): Promise<LoadedImage> {
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('That image could not be decoded. Try a PNG, JPG or SVG.'))
      img.src = url
    })
    const aspect = image.naturalWidth / Math.max(1, image.naturalHeight)
    // Copy into a canvas so the object URL can be revoked immediately.
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth || 256
    canvas.height = image.naturalHeight || 256
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const dataUri = canvas.toDataURL('image/png')
    const clone = new Image()
    clone.src = dataUri
    await new Promise<void>((resolve) => {
      clone.onload = () => resolve()
      clone.onerror = () => resolve()
    })
    return { image: clone, aspect: Number.isFinite(aspect) && aspect > 0 ? aspect : 1, dataUri }
  } finally {
    URL.revokeObjectURL(url)
  }
}
