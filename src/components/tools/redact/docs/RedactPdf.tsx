import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Search, Trash2 } from 'lucide-react'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  copyBytes,
  geometryFromPdfLib,
  get2dContext,
  humanPdfError,
  loadPdfJs,
  loadPdfLib,
  outputName,
  pdfBlob,
  readPdfBytes,
} from '@/components/tools/pdf/pdf-edit-core'
import type { PageGeometry } from '@/components/tools/pdf/pdf-edit-core'
import { filterTypes, findListed, mergeSpans } from '@/lib/ml/text/merge'
import { findPii } from '@/lib/ml/text/pii-rules'
import { findSecrets } from '@/lib/ml/text/secret-rules'
import { TYPE_BY_ID, defaultTypes } from '@/lib/ml/text/types'
import type { EntityType, Span } from '@/lib/ml/text/types'
import { cn, formatBytes } from '@/lib/utils'
import { HideList, TypePicker, hideTerms } from '../text/Options'
import { ModelNote } from '../text/ModelNote'
import { keepKey } from '../text/RedactionView'
import { useNer } from '../text/useNer'
import { burnRedactions } from './pdf-burn'
import { rangeRects, readPageText, searchPage } from './pdf-text'
import type { PageText, Rect } from './pdf-text'

type PdfjsModule = Awaited<ReturnType<typeof loadPdfJs>>
type PdfJsDoc = Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>

interface DrawnBox extends Rect {
  id: string
  page: number
  source: 'drawn' | 'search'
  label?: string
}

interface Found {
  key: string
  page: number
  span: Span
  value: string
  rects: Rect[]
}

const DPI_OPTIONS = [
  { value: '120', label: '120 DPI, smallest file' },
  { value: '150', label: '150 DPI, for screens' },
  { value: '200', label: '200 DPI, for printing' },
  { value: '300', label: '300 DPI, archive quality' },
]
const MIN_BOX = 4
const PAGE_SEPARATOR = '\n\n'

let counter = 0
const boxId = () => `box-${++counter}`

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

export function RedactPdf() {
  const ids = useId()
  const [file, setFile] = useState<File | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [geos, setGeos] = useState<PageGeometry[]>([])
  const [pages, setPages] = useState<PageText[]>([])
  const [pageNo, setPageNo] = useState(1)
  const [drawn, setDrawn] = useState<DrawnBox[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [types, setTypes] = useState<Set<EntityType>>(() => defaultTypes())
  const [hide, setHide] = useState('')
  const [kept, setKept] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [searchNote, setSearchNote] = useState<string | null>(null)
  const [dpi, setDpi] = useState('150')
  const [quality, setQuality] = useState('0.85')
  const [rasterAll, setRasterAll] = useState(false)
  const [opening, setOpening] = useState<{ label: string; value?: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ blob: Blob; bytes: Uint8Array; rasterPages: number[]; leaks: string[] } | null>(null)
  const [frameW, setFrameW] = useState(720)

  const docRef = useRef<PdfJsDoc | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const verifyRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef<{ id: string; x: number; y: number; pointerId: number } | null>(null)
  const cancelRef = useRef({ cancelled: false })

  const geo = geos[pageNo - 1] ?? null
  const scale = geo ? frameW / geo.displayW : 1

  /* ---------------- text and detection ---------------- */

  // All pages as one text, so the model reads them in one run; offsets map back to pages.
  const joined = useMemo(() => {
    const starts: number[] = []
    let text = ''
    for (const p of pages) {
      if (text) text += PAGE_SEPARATOR
      starts.push(text.length)
      text += p.text
    }
    return { text, starts }
  }, [pages])
  const ner = useNer(joined.text, pages.length > 0)
  const terms = useMemo(() => hideTerms(hide), [hide])

  const rulesByPage = useMemo(() => pages.map((p) => [...findPii(p.text), ...findSecrets(p.text)]), [pages])

  const allFound = useMemo(() => {
    const out: Found[] = []
    const model = ner.spans ?? []
    pages.forEach((p, i) => {
      const at = joined.starts[i]
      const end = at + p.text.length
      const own = model.filter((s) => s.start >= at && s.end <= end).map((s) => ({ ...s, start: s.start - at, end: s.end - at }))
      const merged = mergeSpans(p.text, [...rulesByPage[i], ...own, ...findListed(p.text, terms)])
      for (const s of merged) {
        const value = p.text.slice(s.start, s.end)
        out.push({ key: keepKey(s, value), page: p.page, span: s, value, rects: rangeRects(p, s.start, s.end) })
      }
    })
    return out
  }, [pages, joined.starts, ner.spans, rulesByPage, terms])

  const counts = useMemo(() => {
    const m = new Map<EntityType, number>()
    for (const f of allFound) if (f.span.source !== 'list') m.set(f.span.type, (m.get(f.span.type) ?? 0) + 1)
    return m
  }, [allFound])

  const found = useMemo(() => {
    const visible = new Set(filterTypes(allFound.map((f) => f.span), types))
    return allFound.filter((f) => visible.has(f.span))
  }, [allFound, types])

  /** One row per distinct value, for the review list. */
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; value: string; label: string; pages: Set<number>; count: number }>()
    for (const f of found) {
      const g = m.get(f.key) ?? {
        key: f.key,
        value: f.value,
        label: f.span.source === 'list' ? 'Always hide' : (f.span.label ?? TYPE_BY_ID[f.span.type].name.replace(/s$/, '')),
        pages: new Set<number>(),
        count: 0,
      }
      g.pages.add(f.page)
      g.count++
      m.set(f.key, g)
    }
    return [...m.values()]
  }, [found])

  const boxMap = useMemo(() => {
    const map = new Map<number, Rect[]>()
    const add = (page: number, r: Rect) => {
      const list = map.get(page)
      if (list) list.push(r)
      else map.set(page, [r])
    }
    for (const f of found) if (!kept.has(f.key)) for (const r of f.rects) add(f.page, r)
    for (const b of drawn) add(b.page, { x: b.x, y: b.y, w: b.w, h: b.h })
    return map
  }, [found, kept, drawn])

  const totalBoxes = [...boxMap.values()].reduce((n, l) => n + l.length, 0)
  const hiddenValues = groups.filter((g) => !kept.has(g.key)).length

  /* ---------------- open ---------------- */

  const onFiles = useCallback(async (files: File[]) => {
    const next = files[0]
    if (!next) return
    void docRef.current?.loadingTask.destroy()
    docRef.current = null
    setError(null)
    setResult(null)
    setDrawn([])
    setKept(new Set())
    setPages([])
    setSearchNote(null)
    setPageNo(1)
    setOpening({ label: 'Opening the document' })
    setFile(next)
    try {
      const raw = await readPdfBytes(next)
      const lib = await loadPdfLib()
      const doc = await lib.PDFDocument.load(raw, { ignoreEncryption: true, updateMetadata: false })
      const geometry = geometryFromPdfLib(doc.getPages())
      if (geometry.length === 0) throw new Error('That PDF has no pages.')
      const pdfjs = await loadPdfJs()
      const pdoc = await pdfjs.getDocument({ data: copyBytes(raw) }).promise
      docRef.current = pdoc
      setBytes(raw)
      setGeos(geometry)
      const texts: PageText[] = []
      for (let n = 1; n <= pdoc.numPages; n++) {
        setOpening({ label: `Reading the text of page ${n} of ${pdoc.numPages}`, value: (n / pdoc.numPages) * 100 })
        const page = await pdoc.getPage(n)
        texts.push(await readPageText(page, n))
        page.cleanup()
      }
      setPages(texts)
    } catch (err) {
      setFile(null)
      setBytes(null)
      setGeos([])
      setError(humanPdfError(err, next.name))
    } finally {
      setOpening(null)
    }
  }, [])

  useEffect(
    () => () => {
      cancelRef.current.cancelled = true
      void docRef.current?.loadingTask.destroy()
    },
    [],
  )

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const measure = () => setFrameW(Math.max(180, Math.floor(el.clientWidth) - 16))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [file, geos.length])

  /* ---------------- render the page ---------------- */

  useEffect(() => {
    const doc = docRef.current
    const canvas = canvasRef.current
    if (!doc || !canvas || !geo) return
    let cancelled = false
    void (async () => {
      try {
        const page = await doc.getPage(pageNo)
        if (cancelled) return
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = page.getViewport({ scale: scale * dpr })
        canvas.width = Math.max(1, Math.round(viewport.width))
        canvas.height = Math.max(1, Math.round(viewport.height))
        const ctx = get2dContext(canvas)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvas, viewport }).promise
        page.cleanup()
      } catch (err) {
        if (!cancelled && !(err instanceof Error && err.name === 'RenderingCancelledException')) setError(humanPdfError(err, file?.name))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pageNo, scale, geo, file])

  // The same page rendered out of the finished file.
  useEffect(() => {
    const canvas = verifyRef.current
    if (!result || !canvas) return
    let cancelled = false
    void (async () => {
      try {
        const pdfjs = await loadPdfJs()
        const doc = await pdfjs.getDocument({ data: copyBytes(result.bytes) }).promise
        const page = await doc.getPage(Math.min(pageNo, doc.numPages))
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: Math.min(360 / base.width, 2) })
        if (cancelled) return
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        const ctx = get2dContext(canvas)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvas, viewport }).promise
        void doc.loadingTask.destroy()
      } catch {
        /* the download works even if this preview cannot render */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [result, pageNo])

  /* ---------------- drawing ---------------- */

  const pointFrom = (event: { clientX: number; clientY: number }) => {
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect || !geo) return { x: 0, y: 0 }
    return {
      x: Math.min(Math.max(0, (event.clientX - rect.left) / scale), geo.displayW),
      y: Math.min(Math.max(0, (event.clientY - rect.top) / scale), geo.displayH),
    }
  }

  const invalidate = () => setResult(null)

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !geo) return
    const target = event.target as HTMLElement
    if (target.dataset.boxId) {
      setSelectedId(target.dataset.boxId)
      return
    }
    if (target.dataset.keepKey) return
    const p = pointFrom(event)
    const id = boxId()
    overlayRef.current?.setPointerCapture(event.pointerId)
    draftRef.current = { id, x: p.x, y: p.y, pointerId: event.pointerId }
    setDrawn((prev) => [...prev, { id, page: pageNo, x: p.x, y: p.y, w: 0, h: 0, source: 'drawn' }])
    setSelectedId(id)
    invalidate()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = draftRef.current
    if (!d || d.pointerId !== event.pointerId) return
    const p = pointFrom(event)
    setDrawn((prev) =>
      prev.map((b) => (b.id === d.id ? { ...b, x: Math.min(d.x, p.x), y: Math.min(d.y, p.y), w: Math.abs(p.x - d.x), h: Math.abs(p.y - d.y) } : b)),
    )
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = draftRef.current
    if (!d || d.pointerId !== event.pointerId) return
    draftRef.current = null
    setDrawn((prev) => prev.filter((b) => b.id !== d.id || (b.w >= MIN_BOX && b.h >= MIN_BOX)))
  }

  const toggleKeep = (key: string) => {
    invalidate()
    setKept((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const removeBox = (id: string) => {
    setDrawn((prev) => prev.filter((b) => b.id !== id))
    if (selectedId === id) setSelectedId(null)
    invalidate()
  }

  const findText = () => {
    const needle = query.trim()
    if (!needle) return
    const added: DrawnBox[] = []
    for (const p of pages) {
      for (const m of searchPage(p, needle, caseSensitive)) {
        for (const r of rangeRects(p, m.start, m.end)) added.push({ id: boxId(), page: p.page, ...r, source: 'search', label: needle })
      }
    }
    setDrawn((prev) => [...prev, ...added])
    invalidate()
    const pagesHit = new Set(added.map((b) => b.page)).size
    setSearchNote(
      added.length === 0
        ? `"${needle}" is not in the text layer. If the document is a scan, it has no text layer: draw the boxes by hand.`
        : `Added ${plural(added.length, 'box', 'boxes')} for "${needle}" on ${plural(pagesHit, 'page')}. Check each page before you apply.`,
    )
  }

  /* ---------------- apply ---------------- */

  const apply = async () => {
    if (!bytes || !file || totalBoxes === 0) return
    setBusy(true)
    setError(null)
    setResult(null)
    cancelRef.current = { cancelled: false }
    setProgress({ value: 1, label: 'Starting' })
    try {
      const out = await burnRedactions(
        bytes,
        boxMap,
        { dpi: Number(dpi), quality: Number(quality), rasterAll },
        (p) => setProgress({ value: Math.round((p.done / Math.max(1, p.total)) * 90), label: p.label }),
        cancelRef.current,
      )
      // Check the result: none of the hidden values may still be in its text layer.
      setProgress({ value: 95, label: 'Checking the result' })
      const pdfjs = await loadPdfJs()
      const check = await pdfjs.getDocument({ data: copyBytes(out.bytes) }).promise
      let outText = ''
      for (let n = 1; n <= check.numPages; n++) {
        const page = await check.getPage(n)
        outText += `${(await readPageText(page, n)).text}\n`
      }
      void check.loadingTask.destroy()
      const flat = outText.replace(/\s+/g, ' ').toLowerCase()
      const leaks = groups
        .filter((g) => !kept.has(g.key) && g.value.trim().length >= 3 && flat.includes(g.value.replace(/\s+/g, ' ').toLowerCase()))
        .map((g) => g.value)
      setResult({ blob: pdfBlob(out.bytes), bytes: out.bytes, rasterPages: out.rasterPages, leaks })
      setProgress({ value: 100, label: 'Done' })
    } catch (err) {
      setError(err instanceof DOMException && err.name === 'AbortError' ? 'Cancelled. Nothing was written.' : humanPdfError(err, file.name))
    } finally {
      setBusy(false)
      window.setTimeout(() => setProgress(null), 600)
    }
  }

  /* ---------------- view ---------------- */

  if (!file || !geo) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={(files) => void onFiles(files)}
          maxSizeMb={500}
          title="Drop the PDF to redact"
          hint="The document is opened in this tab and never sent anywhere"
          disabled={Boolean(opening)}
        />
        {opening ? <ProgressPanel label={opening.label} value={opening.value} /> : null}
        {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}
      </div>
    )
  }

  const pageFound = found.filter((f) => f.page === pageNo)
  const pageDrawn = drawn.filter((b) => b.page === pageNo)
  const textless = pages.length > 0 && pages.every((p) => !p.text.trim())
  const rasterCount = rasterAll ? geos.length : boxMap.size

  return (
    <div className="space-y-4">
      {opening ? <ProgressPanel label={opening.label} value={opening.value} /> : null}
      {textless ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-pretty text-foreground">
          This PDF has no text layer, so nothing can be found automatically. It is probably a scan. Draw boxes by hand, or use the scanned document redactor, which reads the pages with OCR.
        </p>
      ) : (
        <ModelNote ner={ner} />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <ToolPanel
          className="min-w-0"
          title="Pages"
          description="Black boxes are burned in. Press a found item to keep it (it shows as an outline). Drag on the page to add a box."
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button type="button" size="icon" variant="outline" aria-label="Previous page" disabled={pageNo <= 1} onClick={() => setPageNo((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <span className="num px-1 text-sm text-muted-foreground">
                Page {pageNo} of {geos.length}
              </span>
              <Button type="button" size="icon" variant="outline" aria-label="Next page" disabled={pageNo >= geos.length} onClick={() => setPageNo((p) => Math.min(geos.length, p + 1))}>
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="num text-sm text-muted-foreground" role="status" aria-live="polite">
              {plural(totalBoxes, 'box', 'boxes')} on {plural(boxMap.size, 'page')}
            </p>
          </div>

          <div ref={frameRef} className="w-full overflow-auto rounded-lg bg-muted p-2">
            <div className="relative mx-auto" style={{ width: geo.displayW * scale, height: geo.displayH * scale, backgroundColor: '#ffffff' }}>
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label={`Page ${pageNo} of ${file.name}`} />
              <div
                ref={overlayRef}
                className="absolute inset-0 cursor-crosshair touch-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {pageFound.map((f, i) =>
                  f.rects.map((r, j) => {
                    const isKept = kept.has(f.key)
                    return (
                      <button
                        key={`${i}-${j}`}
                        type="button"
                        data-keep-key={f.key}
                        onClick={() => toggleKeep(f.key)}
                        aria-label={isKept ? `${f.value}, kept. Press to hide.` : `Hidden: ${f.value}. Press to keep.`}
                        aria-pressed={isKept}
                        className={cn('absolute cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1', isKept && 'outline-dashed outline-2 outline-offset-0')}
                        style={{
                          left: r.x * scale,
                          top: r.y * scale,
                          width: Math.max(r.w, 1) * scale,
                          height: Math.max(r.h, 1) * scale,
                          // Page ink, not chrome: black in both themes.
                          backgroundColor: isKept ? 'transparent' : '#000000',
                          outlineColor: '#000000',
                        }}
                      />
                    )
                  }),
                )}
                {pageDrawn.map((b) => (
                  <div
                    key={b.id}
                    data-box-id={b.id}
                    className={cn('absolute', selectedId === b.id && 'outline-2 outline-offset-2 outline-foreground outline-solid')}
                    style={{ left: b.x * scale, top: b.y * scale, width: Math.max(b.w, 1) * scale, height: Math.max(b.h, 1) * scale, backgroundColor: '#000000' }}
                  />
                ))}
              </div>
            </div>
          </div>

          {pageDrawn.length > 0 ? (
            <ul className="space-y-1">
              {pageDrawn.map((b, i) => (
                <li key={b.id} className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-1 text-sm">
                  <span className="truncate text-muted-foreground">
                    {b.source === 'search' ? `Match for "${b.label}"` : `Drawn box ${i + 1}`}
                  </span>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Remove box ${i + 1} on page ${pageNo}`} onClick={() => removeBox(b.id)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </ToolPanel>

        <div className="min-w-0 space-y-4">
          <ToolPanel title="Found" description={groups.length ? `${plural(hiddenValues, 'value')} hidden. Uncheck a value to keep it.` : 'Nothing found in the text layer yet.'}>
            {groups.length > 0 ? (
              <ul className="max-h-80 space-y-1.5 overflow-auto">
                {groups.map((g) => (
                  <li key={g.key} className="flex items-start gap-2">
                    <Checkbox
                      id={`${ids}-${g.key}`}
                      className="mt-0.5"
                      checked={!kept.has(g.key)}
                      onCheckedChange={() => toggleKeep(g.key)}
                    />
                    <Label htmlFor={`${ids}-${g.key}`} className="block min-w-0 text-sm font-normal">
                      <span className="block truncate font-[600]" title={g.value}>
                        {g.value}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {g.label}, page {[...g.pages].slice(0, 6).join(', ')}
                        {g.pages.size > 6 ? ' and more' : ''}
                        {g.count > 1 ? `, ${g.count} times` : ''}
                      </span>
                    </Label>
                  </li>
                ))}
              </ul>
            ) : null}
            <TypePicker types={types} onChange={(t) => (setTypes(t), invalidate())} counts={counts} className="lg:grid-cols-1" />
            <HideList value={hide} onChange={(v) => (setHide(v), invalidate())} />
          </ToolPanel>

          <ToolPanel title="Find a word">
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-query`}>Word or phrase</Label>
              <div className="flex gap-2">
                <Input
                  id={`${ids}-query`}
                  value={query}
                  placeholder="A surname or a number"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      findText()
                    }
                  }}
                />
                <Button type="button" size="icon" aria-label="Add boxes for every match" disabled={!query.trim()} onClick={findText}>
                  <Search className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id={`${ids}-case`} checked={caseSensitive} onCheckedChange={setCaseSensitive} />
              <Label htmlFor={`${ids}-case`} className="text-sm font-normal">
                Match case
              </Label>
            </div>
            {searchNote ? (
              <p className="text-sm text-pretty text-muted-foreground" role="status" aria-live="polite">
                {searchNote}
              </p>
            ) : null}
          </ToolPanel>
        </div>
      </div>

      <ToolPanel title="Apply" description={`${file.name}, ${formatBytes(file.size)}, ${plural(geos.length, 'page')}`}>
        <p className="text-sm text-pretty text-foreground">
          {rasterCount === 0
            ? 'Add at least one box.'
            : `${plural(rasterCount, 'page')} with boxes ${rasterCount === 1 ? 'becomes an image' : 'become images'}: the text on ${rasterCount === 1 ? 'it' : 'them'} can no longer be selected, searched or copied. Other pages stay as they are. Document properties, XMP metadata, bookmarks, comments, form data and attachments are removed from the whole file.`}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-dpi`}>Resolution of redacted pages</Label>
            <Select value={dpi} onValueChange={(v) => (setDpi(v), invalidate())}>
              <SelectTrigger id={`${ids}-dpi`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DPI_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-quality`}>Image format</Label>
            <Select value={quality} onValueChange={(v) => (setQuality(v), invalidate())}>
              <SelectTrigger id={`${ids}-quality`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.75">JPEG 75%, small</SelectItem>
                <SelectItem value="0.85">JPEG 85%</SelectItem>
                <SelectItem value="0.95">JPEG 95%, sharp</SelectItem>
                <SelectItem value="1">PNG, lossless</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch id={`${ids}-all`} checked={rasterAll} onCheckedChange={(v) => (setRasterAll(v), invalidate())} />
          <Label htmlFor={`${ids}-all`} className="text-sm font-normal">
            Turn every page into an image
          </Label>
        </div>

        {progress ? <ProgressPanel label={progress.label} value={progress.value} /> : null}
        {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void apply()} disabled={busy || totalBoxes === 0}>
            {busy ? 'Redacting…' : `Redact ${plural(totalBoxes, 'box', 'boxes')}`}
          </Button>
          {busy ? (
            <Button type="button" variant="outline" onClick={() => (cancelRef.current.cancelled = true)}>
              Cancel
            </Button>
          ) : null}
          <DownloadButton blob={result?.blob ?? null} filename={outputName(file.name, '-redacted')} label="Download redacted PDF" variant={result ? 'default' : 'outline'} />
        </div>

        {result ? (
          <div className="space-y-2 rounded-lg bg-background p-3">
            <h3 className="text-sm font-[600] text-foreground">Check of the result</h3>
            <p className="text-sm text-pretty text-foreground" role="status">
              {result.leaks.length === 0
                ? `None of the ${plural(hiddenValues, 'hidden value')} is in the text of the new file. ${plural(result.rasterPages.length, 'page')} became ${result.rasterPages.length === 1 ? 'an image' : 'images'}.`
                : `Still in the text of the new file: ${result.leaks.slice(0, 8).map((v) => `"${v}"`).join(', ')}. It is probably on a page or in a place without a box. Use Find a word to box every match, then apply again.`}
            </p>
            <p className="text-xs text-muted-foreground">Page {pageNo} of the new file:</p>
            <canvas ref={verifyRef} className="mx-auto block h-auto max-w-full" style={{ backgroundColor: '#ffffff' }} aria-label={`Page ${pageNo} of the redacted file`} />
          </div>
        ) : null}
      </ToolPanel>
    </div>
  )
}

export default RedactPdf
