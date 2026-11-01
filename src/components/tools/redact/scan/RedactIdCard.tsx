/**
 * ID redactor: reads a passport, ID card or driving licence (OCR, the
 * machine-readable zone with its check digits, the portrait with the face
 * detector, the signature with the signature model), then lets the user
 * choose which fields to hide and add a watermark line.
 */
import { useCallback, useMemo, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { wireBytes } from '@/lib/ml/assets'
import { FIELDS, findFields } from '@/lib/ml/id/fields'
import type { FieldId, Rect } from '@/lib/ml/id/fields'
import type { Mrz } from '@/lib/ml/id/mrz'
import { readMrz } from '@/lib/ml/id/read'
import { groupLines, loadOcr, ocrDownloadBytes, ocrIsCached, readImage } from '@/lib/ml/ocr/ocr'
import { ORT_FILES } from '@/lib/ml/ort'
import { signatureClient } from '@/lib/ml/signature/client'
import { signatureDownloadBytes, signatureIsCached } from '@/lib/ml/signature/model'
import { modelDownloadBytes, modelIsCached, visionClient } from '@/lib/ml/vision/client'
import { boxId } from '../shared/boxes'
import type { BoxKind, EditorBox } from '../shared/boxes'
import { DocRedactor } from './DocRedactor'
import type { PageFinder } from './DocRedactor'

const FIELD_NAME = new Map(FIELDS.map((f) => [f.id, f.name]))

interface Found {
  field: FieldId
  rect: Rect
}

interface PageResult {
  found: Found[]
  mrz: Mrz | null
  width: number
  height: number
}

/** Until the editor shows its own labels: the photo is a 'face', every other field 'text'. */
const NAMES = { face: 'Photo', text: 'Field' }
const kindOf = (f: FieldId): BoxKind => (f === 'portrait' ? 'face' : 'text')

/** Margin around a field, as a share of its height, so no edge of a letter shows. */
function pad(r: Rect, k: number, width: number, height: number): Rect {
  const m = r.h * k
  const x = Math.max(0, r.x - m)
  const y = Math.max(0, r.y - m)
  return { x, y, w: Math.min(width, r.x + r.w + m) - x, h: Math.min(height, r.y + r.h + m) - y }
}

/** Diagonal lines of text across the whole image. */
function watermark(text: string) {
  return (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const size = Math.max(14, Math.round(Math.min(width, height) * 0.05))
    ctx.save()
    ctx.translate(width / 2, height / 2)
    ctx.rotate(-Math.PI / 7)
    ctx.font = `600 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = Math.max(1, size / 14)
    const span = Math.hypot(width, height)
    const step = Math.ceil(ctx.measureText(text).width + size * 3)
    for (let y = -span / 2, row = 0; y <= span / 2; y += size * 3.2, row++) {
      for (let x = -span / 2 - (row % 2) * (step / 2); x <= span / 2 + step; x += step) {
        ctx.strokeText(text, x, y)
        ctx.fillText(text, x, y)
      }
    }
    ctx.restore()
  }
}

export default function RedactIdCard() {
  const [results, setResults] = useState<ReadonlyMap<string, PageResult>>(new Map())
  const [manual, setManual] = useState<ReadonlyMap<string, EditorBox[]>>(new Map())
  const [kept, setKept] = useState<ReadonlyMap<string, boolean>>(new Map())
  const [chosen, setChosen] = useState<Set<FieldId>>(() => new Set(FIELDS.filter((f) => f.defaultOn).map((f) => f.id)))
  const [mark, setMark] = useState('')
  const markText = useDebouncedValue(mark.trim(), 300)

  const finder = useMemo<PageFinder>(
    () => ({
      // The runtime is shared by the face and signature models: count it once.
      downloadBytes: () => ocrDownloadBytes() + modelDownloadBytes('face') + signatureDownloadBytes() - wireBytes(ORT_FILES),
      isCached: async () => (await ocrIsCached()) && (await modelIsCached('face')) && (await signatureIsCached()),
      async load(onProgress) {
        const parts = [ocrDownloadBytes(), modelDownloadBytes('face'), signatureDownloadBytes()]
        const total = parts.reduce((a, b) => a + b, 0)
        const done = [0, 0, 0]
        const step = (i: number) => (l: number, t: number) => {
          done[i] = t > 0 ? (parts[i] * l) / t : 0
          onProgress(done.reduce((a, b) => a + b, 0), total)
        }
        await loadOcr(step(0))
        await visionClient().load('face', step(1))
        await signatureClient().load(step(2))
      },
      dpi: 300,
      maxSide: 2400,
      verb: 'Reading the document',
      async find(canvas, page, onStep) {
        const W = canvas.width
        const H = canvas.height
        const words = await readImage(canvas, (p) => onStep(p * 0.5))
        const lines = groupLines(words)
        onStep(0.55)
        const zone = await readMrz(canvas, lines)
        onStep(0.7)
        const found: Found[] = []
        for (const f of findFields(lines, zone.mrz)) for (const r of f.rects) found.push({ field: f.field, rect: pad(r, 0.3, W, H) })
        if (zone.rect) found.push({ field: 'mrz', rect: pad(zone.rect, 0.25, W, H) })
        const faces = await visionClient().detect(await createImageBitmap(canvas), { model: 'face' })
        // An ID photo shows head and shoulders: about twice the face wide and two and a half times high.
        for (const d of faces) found.push({ field: 'portrait', rect: pad({ x: d.x - d.w * 0.5, y: d.y - d.h * 0.6, w: d.w * 2, h: d.h * 2.5 }, 0, W, H) })
        onStep(0.85)
        const marks = await signatureClient().detect(await createImageBitmap(canvas), { stamps: false })
        // The signature model sometimes takes the photo for a signature.
        const onFace = (r: Rect) => faces.some((f) => {
          const ix = Math.max(0, Math.min(r.x + r.w, f.x + f.w) - Math.max(r.x, f.x))
          const iy = Math.max(0, Math.min(r.y + r.h, f.y + f.h) - Math.max(r.y, f.y))
          return ix * iy > f.w * f.h * 0.3
        })
        for (const d of marks.signatures) if (!onFace(d)) found.push({ field: 'signature', rect: pad(d, 0.12, W, H) })
        setResults((prev) => new Map(prev).set(page.id, { found, mrz: zone.mrz, width: W, height: H }))
      },
    }),
    [],
  )

  const derived = useMemo(() => {
    const out = new Map<string, EditorBox[]>()
    for (const [pageId, r] of results) {
      out.set(
        pageId,
        r.found
          .map((f, i) => ({ f, id: `${pageId}|${f.field}#${i}` }))
          .filter(({ f }) => chosen.has(f.field))
          .map(({ f, id }) => ({ id, x: f.rect.x / r.width, y: f.rect.y / r.height, w: f.rect.w / r.width, h: f.rect.h / r.height, kind: kindOf(f.field), keep: kept.get(id) ?? false, label: FIELD_NAME.get(f.field) })),
      )
    }
    return out
  }, [results, chosen, kept])

  const counts = useMemo(() => {
    const c = new Map<FieldId, number>()
    for (const r of results.values()) for (const f of new Set(r.found.map((x) => x.field))) c.set(f, (c.get(f) ?? 0) + 1)
    return c
  }, [results])

  const boxesOf = useCallback((pageId: string) => [...(derived.get(pageId) ?? []), ...(manual.get(pageId) ?? [])], [derived, manual])

  const onEdit = useCallback(
    (pageId: string, next: EditorBox[]) => {
      const before = derived.get(pageId) ?? []
      const byId = new Map(next.map((b) => [b.id, b]))
      setKept((prev) => {
        const out = new Map(prev)
        for (const b of before) out.set(b.id, byId.get(b.id)?.keep ?? true)
        return out
      })
      // A found box that was moved or resized becomes a drawn box.
      const moved = next.filter((b) => {
        const was = before.find((o) => o.id === b.id)
        return was && (was.x !== b.x || was.y !== b.y || was.w !== b.w || was.h !== b.h)
      })
      if (moved.length) setKept((prev) => new Map([...prev, ...moved.map((b) => [b.id, true] as const)]))
      setManual((prev) =>
        new Map(prev).set(pageId, [
          ...next.filter((b) => !b.id.includes('|')),
          ...moved.map((b) => ({ ...b, id: boxId(), kind: 'manual' as const })),
        ]),
      )
    },
    [derived],
  )

  const decorate = useMemo(() => (markText ? watermark(markText) : undefined), [markText])
  const zone = [...results.values()].find((r) => r.mrz)?.mrz ?? null

  return (
    <DocRedactor
      finder={finder}
      boxesOf={boxesOf}
      onEdit={onEdit}
      onReset={() => {
        setResults(new Map())
        setManual(new Map())
        setKept(new Map())
      }}
      names={NAMES}
      dropTitle="Drop a photo or scan of your ID"
      rasterAll
      defaultFormat="jpeg"
      decorate={decorate}
      title={(_page, boxes, scanned) => {
        if (!scanned) return 'Reading the document'
        const n = boxes.filter((b) => !b.keep).length
        return n === 0 ? 'Nothing hidden yet' : `${n} ${n === 1 ? 'area' : 'areas'} hidden`
      }}
      description="Choose the fields to hide. Click a box to keep it visible, or drag on the image to cover more."
      options={
        <>
          <fieldset className="space-y-2.5">
            <legend className="mb-2 text-sm font-[600]">Hide</legend>
            {FIELDS.map((f) => (
              <div key={f.id} className="flex items-center gap-2.5">
                <Checkbox
                  id={`id-field-${f.id}`}
                  checked={chosen.has(f.id)}
                  onCheckedChange={(v) =>
                    setChosen((prev) => {
                      const next = new Set(prev)
                      if (v === true) next.add(f.id)
                      else next.delete(f.id)
                      return next
                    })
                  }
                />
                <Label htmlFor={`id-field-${f.id}`} className="font-normal">
                  {f.name}
                  {results.size > 0 && !counts.has(f.id) ? <span className="ml-1.5 text-muted-foreground">not found</span> : null}
                </Label>
              </div>
            ))}
          </fieldset>
          {zone && (
            <p className="text-sm text-muted-foreground">
              {zone.valid
                ? `Machine-readable zone read: ${zone.format}, all check digits pass.`
                : 'Machine-readable zone found, but some check digits fail. Check the boxes by eye.'}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="id-mark">Watermark</Label>
            <Input id="id-mark" value={mark} onChange={(e) => setMark(e.target.value)} placeholder="Copy for Acme Ltd, 30 Oct 2026" autoComplete="off" />
          </div>
        </>
      }
    />
  )
}
