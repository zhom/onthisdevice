/**
 * Signature redactor: finds handwritten signatures (model) and stamps (ink
 * heuristic) on PDF pages and scans, and covers them with solid fill.
 */
import { useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { signatureClient } from '@/lib/ml/signature/client'
import { signatureDownloadBytes, signatureIsCached } from '@/lib/ml/signature/model'
import { padBox } from '@/lib/ml/vision/geometry'
import type { Detection } from '@/lib/ml/vision/geometry'
import { boxId } from '../shared/boxes'
import type { BoxKind, EditorBox } from '../shared/boxes'
import { DocRedactor } from './DocRedactor'
import type { PageFinder } from './DocRedactor'

/** Until the editor has its own kinds: signatures use 'text', stamps 'plate'. */
const SIGNATURE: BoxKind = 'text'
const STAMP: BoxKind = 'plate'
const NAMES: Partial<Record<BoxKind, string>> = { [SIGNATURE]: 'Signature', [STAMP]: 'Stamp' }

function toBoxes(dets: Detection[], width: number, height: number, kind: BoxKind, padX: number, padY: number): EditorBox[] {
  return dets.map((d) => {
    const b = padBox(d, padX, padY, 0, { width, height })
    return { id: boxId(), x: b.x / width, y: b.y / height, w: b.w / width, h: b.h / height, kind, keep: false, score: d.score, label: NAMES[kind] }
  })
}

export default function RedactSignature() {
  const [boxes, setBoxes] = useState<ReadonlyMap<string, EditorBox[]>>(new Map())
  const [stamps, setStamps] = useState(true)

  const finder = useMemo<PageFinder>(
    () => ({
      downloadBytes: signatureDownloadBytes,
      isCached: signatureIsCached,
      load: (onProgress) => signatureClient().load(onProgress),
      dpi: 150,
      maxSide: 2400,
      verb: 'Finding signatures',
      async find(canvas, page, onStep) {
        const bitmap = await createImageBitmap(canvas)
        const marks = await signatureClient().detect(bitmap, { stamps }, (done, total) => onStep(done / Math.max(1, total)))
        const found = [
          ...toBoxes(marks.signatures, canvas.width, canvas.height, SIGNATURE, 0.06, 0.14),
          ...toBoxes(marks.stamps, canvas.width, canvas.height, STAMP, 0.04, 0.04),
        ]
        // Boxes drawn while the page was being checked stay.
        setBoxes((prev) => new Map(prev).set(page.id, [...found, ...(prev.get(page.id) ?? []).filter((b) => b.kind === 'manual')]))
      },
    }),
    [stamps],
  )

  return (
    <DocRedactor
      finder={finder}
      boxesOf={(id) => boxes.get(id) ?? []}
      onEdit={(id, next) => setBoxes((prev) => new Map(prev).set(id, next))}
      onReset={() => setBoxes(new Map())}
      names={NAMES}
      dropTitle="Drop scanned pages or a PDF"
      rasterAll={false}
      title={(_page, list, scanned) => {
        if (!scanned) return 'Checking this page'
        const sig = list.filter((b) => b.kind === SIGNATURE).length
        const st = list.filter((b) => b.kind === STAMP).length
        if (sig + st === 0) return 'No signature found on this page'
        const parts = [sig ? `${sig} ${sig === 1 ? 'signature' : 'signatures'}` : '', st ? `${st} ${st === 1 ? 'stamp' : 'stamps'}` : ''].filter(Boolean)
        return `Found ${parts.join(' and ')}`
      }}
      description="Click a box to keep that area visible. Drag on the page to cover anything else, such as initials."
      options={
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="sig-stamps">Find stamps</Label>
          <Switch id="sig-stamps" checked={stamps} onCheckedChange={setStamps} />
        </div>
      }
    />
  )
}
