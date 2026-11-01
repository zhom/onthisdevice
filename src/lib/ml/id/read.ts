/**
 * Reads the machine-readable zone of a document image with the shared OCR
 * engine (../ocr/ocr.ts), in a second pass limited to the zone's alphabet
 * (A-Z, 0-9 and <) on the lines that look like it.
 *
 *   readMrz(canvas, lines) -> { mrz, rect }   rect in canvas pixels, or null
 */
import { loadOcr } from '../ocr/ocr'
import type { OcrLine } from '../ocr/ocr'
import { parseMrz } from './mrz'
import type { Mrz } from './mrz'
import type { Rect } from './fields'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'

/** A line the general pass read from the zone: runs of fillers (often read as K or «) or a long code. */
function looksLikeZone(text: string): boolean {
  const t = text.replace(/\s/g, '')
  return /<{2,}|«|K{3,}|<K|K</.test(t) || (t.length >= 26 && /^[A-Z0-9<«]+$/.test(t))
}

interface TessLine {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

function linesOf(data: unknown): TessLine[] {
  const out: TessLine[] = []
  const blocks = (data as { blocks?: { paragraphs: { lines: TessLine[] }[] }[] | null }).blocks ?? []
  for (const b of blocks) for (const p of b.paragraphs) out.push(...p.lines)
  return out
}

export async function readMrz(source: HTMLCanvasElement, lines: readonly OcrLine[]): Promise<{ mrz: Mrz | null; rect: Rect | null }> {
  const W = source.width
  const H = source.height
  const zone = lines.filter((l) => looksLikeZone(l.text))
  let region: Rect
  let lineH = 0
  if (zone.length) {
    lineH = zone.reduce((s, l) => s + l.h, 0) / zone.length
    // The general pass often misses a line of the zone: reach one line past what it saw. More
    // than that brings in printed text, which the single-block pass then mixes into the zone.
    const y0 = Math.max(0, Math.min(...zone.map((l) => l.y)) - lineH * 2.6)
    const y1 = Math.min(H, Math.max(...zone.map((l) => l.y + l.h)) + lineH * 2.6)
    region = { x: 0, y: y0, w: W, h: y1 - y0 }
  } else {
    region = { x: 0, y: H * 0.5, w: W, h: H * 0.5 }
  }
  // About 30 to 40 px per text line suits the recognizer.
  const scale = lineH ? Math.min(3, Math.max(1, 30 / lineH)) : Math.min(2, 2200 / Math.max(1, region.w))
  const crop = document.createElement('canvas')
  crop.width = Math.max(1, Math.round(region.w * scale))
  crop.height = Math.max(1, Math.round(region.h * scale))
  const ctx = crop.getContext('2d')
  if (!ctx) return { mrz: null, rect: null }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, region.x, region.y, region.w, region.h, 0, 0, crop.width, crop.height)
  const [worker, { PSM }] = await Promise.all([loadOcr(), import('tesseract.js')])
  let found: TessLine[]
  try {
    await worker.setParameters({ tessedit_char_whitelist: ALPHABET, tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
    found = linesOf((await worker.recognize(crop, {}, { blocks: true, text: false })).data)
  } finally {
    // The general pass expects sparse text and every character.
    await worker.setParameters({ tessedit_char_whitelist: '', tessedit_pageseg_mode: PSM.SPARSE_TEXT })
    crop.width = 0
  }
  const texts = found.map((l) => l.text.replace(/\s/g, ''))
  const mrz = parseMrz(texts)
  if (!mrz) return { mrz: null, rect: null }
  const used = found.filter((l, i) => texts[i].length >= 25 && texts[i].includes('<'))
  if (!used.length) return { mrz, rect: null }
  const x0 = Math.min(...used.map((l) => l.bbox.x0)) / scale + region.x
  const y0 = Math.min(...used.map((l) => l.bbox.y0)) / scale + region.y
  const x1 = Math.max(...used.map((l) => l.bbox.x1)) / scale + region.x
  const y1 = Math.max(...used.map((l) => l.bbox.y1)) / scale + region.y
  return { mrz, rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } }
}
