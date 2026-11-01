/**
 * Scanned-document redactor: OCR on each page, then the text tools' pattern
 * rules and language model on the page text; each item found becomes a box
 * over its words. The boxes are derived from the OCR results, the chosen
 * types and the always-hide list, with the user's edits on top, so changing
 * a type or the list never needs a new OCR pass.
 */
import { useCallback, useMemo, useState } from 'react'
import { loadOcr, ocrDownloadBytes, ocrIsCached } from '@/lib/ml/ocr/ocr'
import { nerClient, nerDownloadBytes, nerIsCached } from '@/lib/ml/text/ner-client'
import { defaultTypes } from '@/lib/ml/text/types'
import type { EntityType, Span } from '@/lib/ml/text/types'
import { findTextItems, modelSpans, readScreen } from '../text/screen-detect'
import type { ScreenText } from '../text/screen-detect'
import { HideList, TypePicker, hideTerms } from '../text/Options'
import { boxId } from '../shared/boxes'
import type { EditorBox } from '../shared/boxes'
import { DocRedactor } from './DocRedactor'
import type { PageFinder } from './DocRedactor'

interface PageRead {
  st: ScreenText
  model: Span[]
  width: number
  height: number
}

/** A user's change to one found box: kept visible, or moved. */
interface Edit {
  keep?: boolean
  box?: { x: number; y: number; w: number; h: number }
}

const NAMES = { text: 'Text' }

type Rect = { x: number; y: number; w: number; h: number }

/**
 * Grows a box to the whole OCR words it touches. A rule can match part of
 * what OCR read as one word ("4242" in "ending4242"); half a number must not
 * stay visible.
 */
function wholeWords(r: Rect, words: readonly Rect[]): Rect {
  let x0 = r.x
  let x1 = r.x + r.w
  for (const w of words) {
    const vy = Math.min(r.y + r.h, w.y + w.h) - Math.max(r.y, w.y)
    const vx = Math.min(x1, w.x + w.w) - Math.max(x0, w.x)
    if (vy < w.h * 0.5 || vx <= 0) continue
    const m = w.h * 0.4
    x0 = Math.min(x0, w.x - m)
    x1 = Math.max(x1, w.x + w.w + m)
  }
  return { x: x0, y: r.y, w: x1 - x0, h: r.h }
}

export default function RedactScannedDocument() {
  const [reads, setReads] = useState<ReadonlyMap<string, PageRead>>(new Map())
  const [manual, setManual] = useState<ReadonlyMap<string, EditorBox[]>>(new Map())
  const [edits, setEdits] = useState<ReadonlyMap<string, Edit>>(new Map())
  const [types, setTypes] = useState<Set<EntityType>>(defaultTypes)
  const [listText, setListText] = useState('')
  const list = useMemo(() => hideTerms(listText), [listText])

  const finder = useMemo<PageFinder>(
    () => ({
      downloadBytes: () => ocrDownloadBytes() + nerDownloadBytes(),
      isCached: async () => (await ocrIsCached()) && (await nerIsCached()),
      async load(onProgress) {
        const ocrTotal = ocrDownloadBytes()
        const nerTotal = nerDownloadBytes()
        let ocr = 0
        let ner = 0
        const report = () => onProgress(ocr + ner, ocrTotal + nerTotal)
        await loadOcr((l) => {
          ocr = Math.min(l, ocrTotal)
          report()
        })
        await nerClient().load((l, t) => {
          ner = t > 0 ? (nerTotal * l) / t : 0
          report()
        })
      },
      dpi: 200,
      maxSide: 3000,
      verb: 'Reading',
      async find(canvas, page, onStep) {
        const bitmap = await createImageBitmap(canvas)
        try {
          const st = await readScreen(bitmap, (p) => onStep(p * 0.85))
          onStep(0.9)
          const model = await modelSpans(st)
          setReads((prev) => new Map(prev).set(page.id, { st, model, width: canvas.width, height: canvas.height }))
        } finally {
          bitmap.close()
        }
      },
    }),
    [],
  )

  /* Found items as boxes, per page, with the user's edits applied. */
  const found = useMemo(() => {
    const out = new Map<string, { boxes: EditorBox[]; counts: Map<EntityType, number> }>()
    for (const [pageId, r] of reads) {
      const items = findTextItems(r.st, { types, hide: list, model: r.model, chat: false, height: r.height })
      const boxes: EditorBox[] = []
      const counts = new Map<EntityType, number>()
      for (const item of items) {
        if (item.type) counts.set(item.type, (counts.get(item.type) ?? 0) + 1)
        item.rects.forEach((raw, k) => {
          const id = `${pageId}|${item.id}#${k}`
          const e = edits.get(id)
          const rect = wholeWords(raw, r.st.words)
          const b = e?.box ?? { x: rect.x / r.width, y: rect.y / r.height, w: rect.w / r.width, h: rect.h / r.height }
          boxes.push({ id, ...b, kind: 'text', keep: e?.keep ?? false, label: item.label })
        })
      }
      out.set(pageId, { boxes, counts })
    }
    return out
  }, [reads, types, list, edits])

  const counts = useMemo(() => {
    const all = new Map<EntityType, number>()
    for (const { counts: c } of found.values()) for (const [t, n] of c) all.set(t, (all.get(t) ?? 0) + n)
    return all
  }, [found])

  const boxesOf = useCallback((pageId: string) => [...(found.get(pageId)?.boxes ?? []), ...(manual.get(pageId) ?? [])], [found, manual])

  const onEdit = useCallback(
    (pageId: string, next: EditorBox[]) => {
      const before = found.get(pageId)?.boxes ?? []
      const nextById = new Map(next.map((b) => [b.id, b]))
      setEdits((prev) => {
        const out = new Map(prev)
        for (const b of before) {
          const n = nextById.get(b.id)
          if (!n) out.set(b.id, { ...out.get(b.id), keep: true })
          else if (n.keep !== b.keep || n.x !== b.x || n.y !== b.y || n.w !== b.w || n.h !== b.h) out.set(b.id, { keep: n.keep, box: { x: n.x, y: n.y, w: n.w, h: n.h } })
        }
        return out
      })
      setManual((prev) => new Map(prev).set(pageId, next.filter((b) => !b.id.includes('|')).map((b) => (b.kind === 'manual' ? b : { ...b, id: boxId(), kind: 'manual' }))))
    },
    [found],
  )

  return (
    <DocRedactor
      finder={finder}
      boxesOf={boxesOf}
      onEdit={onEdit}
      onReset={() => {
        setReads(new Map())
        setManual(new Map())
        setEdits(new Map())
      }}
      names={NAMES}
      dropTitle="Drop a scanned PDF or page images"
      rasterAll
      title={(_page, boxes, scanned) => {
        if (!scanned) return 'Reading this page'
        const n = boxes.filter((b) => !b.keep).length
        return n === 0 ? 'Nothing to hide found on this page' : `${n} ${n === 1 ? 'area' : 'areas'} hidden on this page`
      }}
      description="Click a box to keep that text visible. Drag on the page to cover anything else."
      options={
        <>
          <TypePicker types={types} onChange={setTypes} counts={counts} />
          <HideList value={listText} onChange={setListText} />
        </>
      }
    />
  )
}
