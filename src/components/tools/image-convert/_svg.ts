/**
 * SVG rasterisation. Main thread only — it needs `DOMParser`, `Image` and the
 * browser's own SVG renderer, none of which exist inside a worker.
 *
 * The SVG is parsed, its intrinsic size resolved from `width`/`height`/`viewBox`,
 * then re-serialised with explicit pixel dimensions and painted into a canvas.
 * Because the file is loaded through a blob: URL it stays same-origin, so the
 * canvas is never tainted and `getImageData` works.
 */
import { ImageError, get2dContext } from './_engine'

export type SvgSizeMode = 'scale' | 'width' | 'height'

export interface SvgSizing {
  mode: SvgSizeMode
  /** Multiplier applied to the intrinsic size when `mode === 'scale'`. */
  scale: number
  /** Target width in pixels when `mode === 'width'`. */
  width: number
  /** Target height in pixels when `mode === 'height'`. */
  height: number
}

export const DEFAULT_SVG_SIZING: SvgSizing = { mode: 'scale', scale: 2, width: 1024, height: 1024 }

export interface SvgIntrinsic {
  width: number
  height: number
  /** True when the size came from a viewBox rather than explicit dimensions. */
  fromViewBox: boolean
}

/** CSS absolute units, in px. */
const UNIT_PX: Record<string, number> = {
  '': 1,
  px: 1,
  pt: 96 / 72,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  q: 96 / 101.6,
}

function parseLength(value: string | null): number | null {
  if (!value) return null
  const match = /^\s*([+-]?[\d.]+)\s*([a-z%]*)\s*$/i.exec(value)
  if (!match) return null
  const n = Number(match[1])
  if (!Number.isFinite(n) || n <= 0) return null
  const unit = match[2].toLowerCase()
  if (unit === '%') return null
  const factor = UNIT_PX[unit]
  return factor === undefined ? null : n * factor
}

export function parseSvg(text: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new ImageError('That SVG could not be parsed. The XML inside it is malformed.')
  }
  const root = doc.documentElement
  if (!root || root.nodeName.toLowerCase() !== 'svg') {
    throw new ImageError('That file is not an SVG. Its root element is not <svg>.')
  }
  return root as unknown as SVGSVGElement
}

/** Work out the SVG's natural pixel size, falling back to the CSS default 300×150. */
export function intrinsicSize(root: SVGSVGElement): SvgIntrinsic {
  const w = parseLength(root.getAttribute('width'))
  const h = parseLength(root.getAttribute('height'))
  if (w && h) return { width: w, height: h, fromViewBox: false }

  const viewBox = root.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n)) && parts[2] > 0 && parts[3] > 0) {
      const ratio = parts[2] / parts[3]
      if (w) return { width: w, height: w / ratio, fromViewBox: true }
      if (h) return { width: h * ratio, height: h, fromViewBox: true }
      return { width: parts[2], height: parts[3], fromViewBox: true }
    }
  }

  if (w) return { width: w, height: w, fromViewBox: false }
  if (h) return { width: h, height: h, fromViewBox: false }
  return { width: 300, height: 150, fromViewBox: false }
}

/** Apply the user's sizing choice to an intrinsic size. Aspect ratio is preserved. */
export function resolveTargetSize(intrinsic: SvgIntrinsic, sizing: SvgSizing): { width: number; height: number } {
  const ratio = intrinsic.width / intrinsic.height
  let width: number
  let height: number

  if (sizing.mode === 'width') {
    width = sizing.width
    height = width / ratio
  } else if (sizing.mode === 'height') {
    height = sizing.height
    width = height * ratio
  } else {
    width = intrinsic.width * sizing.scale
    height = intrinsic.height * sizing.scale
  }

  width = Math.max(1, Math.round(width))
  height = Math.max(1, Math.round(height))

  if (width > 16384 || height > 16384) {
    throw new ImageError(
      `That would render at ${width}×${height} px, beyond the 16384 px canvas limit. Lower the scale or width.`,
    )
  }
  return { width, height }
}

function loadSvgImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'sync'
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(
        new ImageError(
          'The browser refused to render that SVG. It may rely on external fonts or images, which cannot be fetched offline.',
        ),
      )
    img.src = url
  })
}

export interface RasterisedSvg {
  pixels: ImageData
  width: number
  height: number
  intrinsic: SvgIntrinsic
}

/** Parse, size and paint an SVG into raw RGBA pixels. */
export async function rasteriseSvg(text: string, sizing: SvgSizing): Promise<RasterisedSvg> {
  const root = parseSvg(text)
  const intrinsic = intrinsicSize(root)
  const { width, height } = resolveTargetSize(intrinsic, sizing)

  if (!root.getAttribute('viewBox')) {
    root.setAttribute('viewBox', `0 0 ${intrinsic.width} ${intrinsic.height}`)
  }
  root.setAttribute('width', String(width))
  root.setAttribute('height', String(height))
  if (!root.getAttribute('xmlns')) {
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }

  const serialised = new XMLSerializer().serializeToString(root)
  const url = URL.createObjectURL(new Blob([serialised], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    const img = await loadSvgImage(url)
    const ctx = get2dContext(width, height)
    ctx.drawImage(img, 0, 0, width, height)
    let pixels: ImageData
    try {
      pixels = ctx.getImageData(0, 0, width, height)
    } catch {
      throw new ImageError(
        'The rendered SVG could not be read back from the canvas, usually because it embeds a remote image.',
      )
    }
    return { pixels, width, height, intrinsic }
  } finally {
    URL.revokeObjectURL(url)
  }
}
