/**
 * Round-2 batch `pdf-edit` — annotation flattening.
 *
 * pdf-lib flattens *form fields* out of the box. Everything else a reader draws
 * on top of a page — highlights, sticky notes, stamps, ink, free text, redaction
 * marks left by other tools — lives in an annotation's appearance stream and is
 * simply dropped by naive "flatteners".
 *
 * The routine below draws each of those appearance streams into the page's own
 * content stream first, using the transform the PDF specification prescribes
 * (ISO 32000-1, 12.5.5 "Appearance streams"), and only then removes the
 * annotation. That is what makes a comment survive printing and emailing.
 */
import type { PDFDict, PDFDocument, PDFRef } from 'pdf-lib'
import type { PdfLib } from './pdf-edit-core'

/** Annotation flags, ISO 32000-1 table 165. */
const FLAG_HIDDEN = 1 << 1
const FLAG_NOVIEW = 1 << 5

export interface AnnotationScan {
  total: number
  /** Subtype -> count, e.g. { Highlight: 12, Text: 3, Link: 8 }. */
  bySubtype: Record<string, number>
  /** How many carry a drawable normal appearance stream. */
  drawable: number
  links: number
}

interface Located {
  pageIndex: number
  dict: PDFDict
  ref: PDFRef | null
  subtype: string
  flags: number
}

function locateAnnotations(lib: PdfLib, doc: PDFDocument): Located[] {
  const out: Located[] = []
  doc.getPages().forEach((page, pageIndex) => {
    const annots = page.node.Annots()
    if (!annots) return
    for (let i = 0; i < annots.size(); i++) {
      const entry = annots.get(i)
      const ref = entry instanceof lib.PDFRef ? entry : null
      const resolved = ref ? doc.context.lookup(ref) : entry
      if (!(resolved instanceof lib.PDFDict)) continue
      const subtypeObj = resolved.get(lib.PDFName.of('Subtype'))
      const subtype =
        subtypeObj instanceof lib.PDFName ? subtypeObj.asString().replace(/^\//, '') : 'Unknown'
      const flagsObj = resolved.get(lib.PDFName.of('F'))
      const flags = flagsObj instanceof lib.PDFNumber ? flagsObj.asNumber() : 0
      out.push({ pageIndex, dict: resolved, ref, subtype, flags })
    }
  })
  return out
}

/** Resolve the annotation's normal appearance to a stream reference, if any. */
function normalAppearanceRef(lib: PdfLib, doc: PDFDocument, dict: PDFDict): PDFRef | null {
  const apEntry = dict.get(lib.PDFName.of('AP'))
  const ap =
    apEntry instanceof lib.PDFRef ? doc.context.lookup(apEntry) : apEntry
  if (!(ap instanceof lib.PDFDict)) return null

  const resolve = (value: unknown): PDFRef | null => {
    if (value instanceof lib.PDFRef) {
      return doc.context.lookup(value) instanceof lib.PDFStream ? value : null
    }
    if (value instanceof lib.PDFStream) return doc.context.register(value)
    return null
  }

  const n = ap.get(lib.PDFName.of('N'))
  const direct = resolve(n)
  if (direct) return direct

  // /N can be a dictionary of appearance states keyed by /AS (checkboxes,
  // radio buttons, and any annotation with an on/off look).
  const states = n instanceof lib.PDFRef ? doc.context.lookup(n) : n
  if (!(states instanceof lib.PDFDict)) return null
  const asObj = dict.get(lib.PDFName.of('AS'))
  if (asObj instanceof lib.PDFName) {
    const picked = resolve(states.get(asObj))
    if (picked) return picked
  }
  for (const [key, value] of states.entries()) {
    if (key.asString() === '/Off') continue
    const picked = resolve(value)
    if (picked) return picked
  }
  return null
}

function numbersFrom(lib: PdfLib, doc: PDFDocument, value: unknown): number[] | null {
  const arr = value instanceof lib.PDFRef ? doc.context.lookup(value) : value
  if (!(arr instanceof lib.PDFArray)) return null
  const out: number[] = []
  for (let i = 0; i < arr.size(); i++) {
    const item = arr.get(i)
    const resolved = item instanceof lib.PDFRef ? doc.context.lookup(item) : item
    if (!(resolved instanceof lib.PDFNumber)) return null
    out.push(resolved.asNumber())
  }
  return out
}

function applyMatrix(m: number[], x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

export function scanAnnotations(lib: PdfLib, doc: PDFDocument): AnnotationScan {
  const located = locateAnnotations(lib, doc)
  const bySubtype: Record<string, number> = {}
  let drawable = 0
  let links = 0
  for (const item of located) {
    bySubtype[item.subtype] = (bySubtype[item.subtype] ?? 0) + 1
    if (item.subtype === 'Link') links += 1
    if (item.subtype !== 'Popup' && normalAppearanceRef(lib, doc, item.dict)) drawable += 1
  }
  return { total: located.length, bySubtype, drawable, links }
}

export interface FlattenAnnotationsOptions {
  /** Leave Link annotations in place so the PDF stays clickable. */
  keepLinks: boolean
}

export interface FlattenAnnotationsResult {
  drawn: number
  removed: number
  skipped: number
}

/**
 * Draw every drawable annotation into its page and delete it from /Annots.
 *
 * The transform follows the spec: the appearance's /BBox is mapped through its
 * /Matrix, the resulting bounding box is fitted to the annotation's /Rect, and
 * that fitting matrix is what we concatenate before invoking the form XObject.
 */
export function flattenAnnotations(
  lib: PdfLib,
  doc: PDFDocument,
  options: FlattenAnnotationsOptions,
): FlattenAnnotationsResult {
  const pages = doc.getPages()
  const located = locateAnnotations(lib, doc)
  const removeSet = new Set<PDFDict>()
  let drawn = 0
  let skipped = 0

  for (const item of located) {
    const page = pages[item.pageIndex]
    if (!page) continue

    if (item.subtype === 'Popup') {
      // Popups are the note window, never rendered on the page itself.
      removeSet.add(item.dict)
      continue
    }
    if (item.subtype === 'Link' && options.keepLinks) continue
    if ((item.flags & FLAG_HIDDEN) !== 0 || (item.flags & FLAG_NOVIEW) !== 0) {
      removeSet.add(item.dict)
      continue
    }

    const apRef = normalAppearanceRef(lib, doc, item.dict)
    if (!apRef) {
      // A Link with no appearance is invisible anyway; anything else we leave
      // alone rather than silently discarding it.
      if (item.subtype === 'Link') removeSet.add(item.dict)
      else skipped += 1
      continue
    }

    const stream = doc.context.lookup(apRef)
    if (!(stream instanceof lib.PDFStream)) {
      skipped += 1
      continue
    }

    const rect = numbersFrom(lib, doc, item.dict.get(lib.PDFName.of('Rect')))
    const bbox = numbersFrom(lib, doc, stream.dict.get(lib.PDFName.of('BBox')))
    if (!rect || rect.length < 4 || !bbox || bbox.length < 4) {
      skipped += 1
      continue
    }

    const matrix = numbersFrom(lib, doc, stream.dict.get(lib.PDFName.of('Matrix'))) ?? [
      1, 0, 0, 1, 0, 0,
    ]

    const corners: [number, number][] = [
      applyMatrix(matrix, bbox[0], bbox[1]),
      applyMatrix(matrix, bbox[2], bbox[1]),
      applyMatrix(matrix, bbox[2], bbox[3]),
      applyMatrix(matrix, bbox[0], bbox[3]),
    ]
    const tx0 = Math.min(...corners.map((c) => c[0]))
    const tx1 = Math.max(...corners.map((c) => c[0]))
    const ty0 = Math.min(...corners.map((c) => c[1]))
    const ty1 = Math.max(...corners.map((c) => c[1]))

    const rx0 = Math.min(rect[0], rect[2])
    const rx1 = Math.max(rect[0], rect[2])
    const ry0 = Math.min(rect[1], rect[3])
    const ry1 = Math.max(rect[1], rect[3])

    const sx = tx1 - tx0 === 0 ? 1 : (rx1 - rx0) / (tx1 - tx0)
    const sy = ty1 - ty0 === 0 ? 1 : (ry1 - ry0) / (ty1 - ty0)

    const name = page.node.newXObject('FlatAnnot', apRef)
    page.pushOperators(
      lib.pushGraphicsState(),
      lib.concatTransformationMatrix(sx, 0, 0, sy, rx0 - tx0 * sx, ry0 - ty0 * sy),
      lib.drawObject(name),
      lib.popGraphicsState(),
    )
    removeSet.add(item.dict)
    drawn += 1
  }

  let removed = 0
  for (const page of pages) {
    const annots = page.node.Annots()
    if (!annots) continue
    for (let i = annots.size() - 1; i >= 0; i--) {
      const entry = annots.get(i)
      const resolved = entry instanceof lib.PDFRef ? doc.context.lookup(entry) : entry
      if (resolved instanceof lib.PDFDict && removeSet.has(resolved)) {
        annots.remove(i)
        removed += 1
      }
    }
    if (annots.size() === 0) page.node.delete(lib.PDFName.of('Annots'))
  }

  return { drawn, removed, skipped }
}
