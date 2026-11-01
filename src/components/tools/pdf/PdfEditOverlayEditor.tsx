import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Image as ImageIcon,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Redo2,
  Signature,
  Square,
  Trash2,
  Type as TypeIcon,
  Undo2,
  Eraser,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { cn, formatBytes, nextFrame } from '@/lib/utils'
import {
  copyBytes,
  geometryFromPdfLib,
  get2dContext,
  humanPdfError,
  loadPdfJs,
  loadPdfLib,
  outputName,
  pdfBlob,
  plural,
  readPdfBytes,
  toEmbeddableImage,
} from './pdf-edit-core'
import type { PageGeometry } from './pdf-edit-core'
import {
  boundsOf,
  cssStyle,
  cssWeight,
  describeObject,
  exportEditedPdf,
  FONT_BY_KEY,
  FONT_CHOICES,
  moveObject,
  newId,
  simplifyStroke,
} from './pdf-edit-model'
import type {
  EditorObject,
  FontKey,
  ImageAsset,
  ObjKind,
  Point,
  TextObj,
} from './pdf-edit-model'
import { PdfEditSignaturePad } from './PdfEditSignaturePad'

/* ------------------------------------------------------------------ */
/* Modes                                                               */
/* ------------------------------------------------------------------ */

export type EditorMode = 'full' | 'annotate' | 'text' | 'sign' | 'whiteout' | 'highlight' | 'image'

type ToolId = 'select' | ObjKind

interface ModeConfig {
  tools: ToolId[]
  defaultTool: ToolId
  /** Shows the signature builder. */
  signature: boolean
  panelTitle: string
  panelDescription: string
  dropTitle: string
  dropHint: string
  suffix: string
  emptyHint: string
}

const MODES: Record<EditorMode, ModeConfig> = {
  full: {
    tools: ['select', 'text', 'image', 'ink', 'highlight', 'whiteout', 'rect', 'line'],
    defaultTool: 'text',
    signature: true,
    panelTitle: 'Edit your PDF',
    panelDescription:
      'Add text, images, drawings, highlights and white-out boxes anywhere on any page. The original text and vectors underneath stay exactly as they were.',
    dropTitle: 'Drop a PDF to start editing',
    dropHint: 'or click to browse',
    suffix: '-edited',
    emptyHint: 'Pick a tool, then click or drag on the page.',
  },
  annotate: {
    tools: ['select', 'ink', 'highlight', 'text', 'rect', 'line'],
    defaultTool: 'highlight',
    signature: false,
    panelTitle: 'Annotate your PDF',
    panelDescription:
      'Mark up a document the way you would with a pen: highlight passages, draw freehand, box a figure, add a margin note.',
    dropTitle: 'Drop the PDF you want to mark up',
    dropHint: 'or click to browse',
    suffix: '-annotated',
    emptyHint: 'Choose highlighter, pen or note, then drag across the page.',
  },
  text: {
    tools: ['select', 'text'],
    defaultTool: 'text',
    signature: false,
    panelTitle: 'Type onto the page',
    panelDescription:
      'Click anywhere on the page and start typing. Use it to fill in a scanned form that has no form fields.',
    dropTitle: 'Drop the PDF you want to type on',
    dropHint: 'or click to browse',
    suffix: '-text',
    emptyHint: 'Click the spot on the page where the text should start.',
  },
  sign: {
    tools: ['select', 'text', 'ink'],
    defaultTool: 'select',
    signature: true,
    panelTitle: 'Place your signature',
    panelDescription:
      'Build a signature by drawing, typing or uploading one, then drag it into place. Add the date and your initials as text while you are here.',
    dropTitle: 'Drop the PDF you need to sign',
    dropHint: 'or click to browse',
    suffix: '-signed',
    emptyHint: 'Create a signature, then drag it onto the signature line.',
  },
  whiteout: {
    tools: ['select', 'whiteout', 'text'],
    defaultTool: 'whiteout',
    signature: false,
    panelTitle: 'Cover and retype',
    panelDescription:
      'Drag an opaque white box over anything that should disappear visually, then type the replacement on top.',
    dropTitle: 'Drop the PDF you want to correct',
    dropHint: 'or click to browse',
    suffix: '-whiteout',
    emptyHint: 'Drag a box over the text you want to cover.',
  },
  highlight: {
    tools: ['select', 'highlight', 'text', 'ink'],
    defaultTool: 'highlight',
    signature: false,
    panelTitle: 'Highlight the page',
    panelDescription:
      'Drag across a passage to lay a translucent highlight over it. The words underneath stay readable, selectable and searchable.',
    dropTitle: 'Drop the PDF you want to highlight',
    dropHint: 'or click to browse',
    suffix: '-highlighted',
    emptyHint: 'Drag across a line of text to highlight it.',
  },
  image: {
    tools: ['select', 'image', 'text'],
    defaultTool: 'select',
    signature: false,
    panelTitle: 'Place an image',
    panelDescription:
      'Drop a logo, stamp, photo or chart onto any page, then drag and resize it. PNG transparency is preserved.',
    dropTitle: 'Drop the PDF that needs an image',
    dropHint: 'or click to browse',
    suffix: '-image',
    emptyHint: 'Use “Add image” above, then drag it where it belongs.',
  },
}

const TOOL_META: Record<ToolId, { label: string; icon: LucideIcon; hint: string }> = {
  select: { label: 'Select', icon: MousePointer2, hint: 'Move, resize and delete what you added' },
  text: { label: 'Text', icon: TypeIcon, hint: 'Click the page, then type' },
  image: { label: 'Image', icon: ImageIcon, hint: 'Place a PNG or JPEG' },
  ink: { label: 'Draw', icon: PenLine, hint: 'Freehand pen' },
  highlight: { label: 'Highlight', icon: Highlighter, hint: 'Translucent marker' },
  whiteout: { label: 'White-out', icon: Eraser, hint: 'Opaque cover box' },
  rect: { label: 'Box', icon: Square, hint: 'Rectangle outline or fill' },
  line: { label: 'Line', icon: Minus, hint: 'Straight line' },
}

const SWATCHES = ['#111827', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ffffff']

/* ------------------------------------------------------------------ */
/* Types local to the editor                                           */
/* ------------------------------------------------------------------ */

type PdfjsModule = Awaited<ReturnType<typeof loadPdfJs>>
type PdfJsDoc = Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>

interface Interaction {
  mode: 'draw' | 'move' | 'resize'
  pointerId: number
  start: Point
  id: string
  snapshot: EditorObject[]
  origin?: EditorObject
  moved: boolean
}

interface Props {
  mode?: EditorMode
}

const MIN_SIZE = 6

export function PdfEditOverlayEditor({ mode = 'full' }: Props) {
  const config = MODES[mode]
  const ids = useId()

  const [file, setFile] = useState<File | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [geos, setGeos] = useState<PageGeometry[]>([])
  const [pageNo, setPageNo] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [objects, setObjects] = useState<EditorObject[]>([])
  const [past, setPast] = useState<EditorObject[][]>([])
  const [future, setFuture] = useState<EditorObject[][]>([])
  const [assets, setAssets] = useState<Map<string, ImageAsset>>(new Map())

  const [tool, setTool] = useState<ToolId>(config.defaultTool)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [color, setColor] = useState('#111827')
  const [fontSize, setFontSize] = useState(12)
  const [fontKey, setFontKey] = useState<FontKey>('helvetica')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [zoom, setZoom] = useState(1)
  const [signatureOpen, setSignatureOpen] = useState(false)

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [thumbs, setThumbs] = useState<string[]>([])

  const docRef = useRef<PdfJsDoc | null>(null)
  /** Mirror of `objects`, kept in step synchronously so pointer handlers and
   *  the history stack never read a stale render's value. */
  const objectsRef = useRef<EditorObject[]>([])
  const assetsRef = useRef<Map<string, ImageAsset>>(new Map())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const interactionRef = useRef<Interaction | null>(null)
  const renderToken = useRef(0)

  const [frameW, setFrameW] = useState(720)

  const geo = geos[pageNo - 1] ?? null
  const pageCount = geos.length
  const scale = geo ? (frameW / geo.displayW) * zoom : 1
  const viewW = geo ? geo.displayW * scale : 0
  const viewH = geo ? geo.displayH * scale : 0
  const pageObjects = useMemo(
    () => objects.filter((o) => o.page === pageNo),
    [objects, pageNo],
  )
  const selected = useMemo(
    () => objects.find((o) => o.id === selectedId) ?? null,
    [objects, selectedId],
  )

  /* -------------------------------------------------------------- */
  /* File loading                                                    */
  /* -------------------------------------------------------------- */

  const reset = useCallback(() => {
    docRef.current?.loadingTask.destroy()
    docRef.current = null
    for (const asset of assetsRef.current.values()) URL.revokeObjectURL(asset.url)
    assetsRef.current = new Map()
    setAssets(new Map())
    objectsRef.current = []
    setObjects([])
    setPast([])
    setFuture([])
    setSelectedId(null)
    setResultBlob(null)
    setThumbs([])
    setPageNo(1)
    setZoom(1)
  }, [])

  const onFiles = useCallback(
    async (files: File[]) => {
      const next = files[0]
      if (!next) return
      reset()
      setError(null)
      setLoading(true)
      setFile(next)
      try {
        const raw = await readPdfBytes(next)
        const { PDFDocument } = await loadPdfLib()
        const libDoc = await PDFDocument.load(raw, {
          ignoreEncryption: true,
          updateMetadata: false,
        })
        const geometry = geometryFromPdfLib(libDoc.getPages())
        if (geometry.length === 0) throw new Error('That PDF has no pages.')

        const pdfjs = await loadPdfJs()
        const jsDoc = await pdfjs.getDocument({ data: copyBytes(raw) })
          .promise
        docRef.current = jsDoc
        setBytes(raw)
        setGeos(geometry)
        setTool(config.defaultTool)
      } catch (err) {
        setBytes(null)
        setGeos([])
        setFile(null)
        setError(humanPdfError(err, next.name))
      } finally {
        setLoading(false)
      }
    },
    [config.defaultTool, reset],
  )

  useEffect(() => {
    const assetStore = assetsRef
    return () => {
      docRef.current?.loadingTask.destroy()
      docRef.current = null
      for (const asset of assetStore.current.values()) URL.revokeObjectURL(asset.url)
    }
  }, [])

  /* -------------------------------------------------------------- */
  /* Measuring and rendering                                         */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    // `p-2` on the frame: subtract the padding or the page is one scrollbar too wide.
    const measure = () => setFrameW(Math.max(180, Math.floor(el.clientWidth) - 16))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [file])

  useEffect(() => {
    const doc = docRef.current
    const canvas = canvasRef.current
    if (!doc || !canvas || !geo || viewW <= 0) return
    const token = ++renderToken.current
    let cancelled = false

    const run = async () => {
      try {
        const page = await doc.getPage(pageNo)
        if (cancelled || token !== renderToken.current) return
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
        if (!cancelled && token === renderToken.current) {
          setError(humanPdfError(err, file?.name))
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [pageNo, scale, viewW, geo, file])

  // Page thumbnails, rendered one at a time so a 300-page file does not lock up.
  useEffect(() => {
    const doc = docRef.current
    if (!doc || pageCount === 0 || pageCount > 200) return
    let cancelled = false
    const run = async () => {
      const out: string[] = []
      const canvas = document.createElement('canvas')
      const ctx = get2dContext(canvas)
      for (let i = 1; i <= doc.numPages; i++) {
        if (cancelled) return
        try {
          const page = await doc.getPage(i)
          const base = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: 64 / base.width })
          canvas.width = Math.max(1, Math.round(viewport.width))
          canvas.height = Math.max(1, Math.round(viewport.height))
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          await page.render({ canvas, viewport }).promise
          page.cleanup()
          out.push(canvas.toDataURL('image/jpeg', 0.6))
        } catch {
          out.push('')
        }
        if (!cancelled) setThumbs([...out])
        await nextFrame()
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [pageCount, bytes])

  /* -------------------------------------------------------------- */
  /* History                                                         */
  /* -------------------------------------------------------------- */

  /** Replace the objects without touching the history stack. */
  const applyLive = useCallback((fn: (prev: EditorObject[]) => EditorObject[]) => {
    const value = fn(objectsRef.current)
    if (value === objectsRef.current) return
    objectsRef.current = value
    setObjects(value)
  }, [])

  /** Replace the objects and make the previous state undoable. */
  const commit = useCallback(
    (next: EditorObject[] | ((prev: EditorObject[]) => EditorObject[])) => {
      const prev = objectsRef.current
      const value = typeof next === 'function' ? next(prev) : next
      if (value === prev) return
      objectsRef.current = value
      setPast((p) => [...p.slice(-49), prev])
      setFuture([])
      setResultBlob(null)
      setObjects(value)
    },
    [],
  )

  /** Record the current state as undoable without changing it — used before a
   *  burst of live edits such as typing or dragging a slider. */
  const markUndoPoint = useCallback(() => {
    const snapshot = objectsRef.current
    setPast((p) => (p[p.length - 1] === snapshot ? p : [...p.slice(-49), snapshot]))
    setFuture([])
  }, [])

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p
      const previous = p[p.length - 1]
      const current = objectsRef.current
      objectsRef.current = previous
      setObjects(previous)
      setFuture((f) => [current, ...f.slice(0, 49)])
      setSelectedId(null)
      setResultBlob(null)
      return p.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f
      const nextState = f[0]
      const current = objectsRef.current
      objectsRef.current = nextState
      setObjects(nextState)
      setPast((p) => [...p.slice(-49), current])
      setSelectedId(null)
      setResultBlob(null)
      return f.slice(1)
    })
  }, [])

  /* -------------------------------------------------------------- */
  /* Object creation                                                 */
  /* -------------------------------------------------------------- */

  const clampToPage = useCallback(
    (p: Point): Point =>
      geo
        ? {
            x: Math.min(Math.max(0, p.x), geo.displayW),
            y: Math.min(Math.max(0, p.y), geo.displayH),
          }
        : p,
    [geo],
  )

  const pointFrom = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const rect = overlayRef.current?.getBoundingClientRect()
      if (!rect || scale <= 0) return { x: 0, y: 0 }
      return clampToPage({
        x: (event.clientX - rect.left) / scale,
        y: (event.clientY - rect.top) / scale,
      })
    },
    [clampToPage, scale],
  )

  const addObject = useCallback(
    (obj: EditorObject) => {
      commit((prev) => [...prev, obj])
      setSelectedId(obj.id)
    },
    [commit],
  )

  const updateSelected = useCallback(
    (patch: Partial<EditorObject>, historic = true) => {
      const apply = (prev: EditorObject[]) =>
        prev.map((o) => (o.id === selectedId ? ({ ...o, ...patch } as EditorObject) : o))
      if (historic) commit(apply)
      else applyLive(apply)
    },
    [applyLive, commit, selectedId],
  )

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    commit((prev) => prev.filter((o) => o.id !== selectedId))
    setSelectedId(null)
  }, [commit, selectedId])

  /* -------------------------------------------------------------- */
  /* Pointer interaction                                             */
  /* -------------------------------------------------------------- */

  const onOverlayPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!geo || event.button !== 0) return
    if (interactionRef.current) return
    const point = pointFrom(event)
    overlayRef.current?.setPointerCapture(event.pointerId)

    if (tool === 'select') {
      setSelectedId(null)
      return
    }

    if (tool === 'text') {
      const obj: TextObj = {
        id: newId('text'),
        kind: 'text',
        page: pageNo,
        x: point.x,
        y: point.y,
        text: '',
        size: fontSize,
        color,
        font: fontKey,
      }
      addObject(obj)
      window.setTimeout(() => textareaRef.current?.focus(), 30)
      return
    }

    if (tool === 'image') {
      imageInputRef.current?.click()
      return
    }

    const snapshot = objectsRef.current
    const id = newId(tool)
    let created: EditorObject
    if (tool === 'ink') {
      created = { id, kind: 'ink', page: pageNo, points: [point], color, width: strokeWidth }
    } else if (tool === 'line') {
      created = {
        id,
        kind: 'line',
        page: pageNo,
        x1: point.x,
        y1: point.y,
        x2: point.x,
        y2: point.y,
        color,
        width: strokeWidth,
      }
    } else {
      created = {
        id,
        kind: tool,
        page: pageNo,
        x: point.x,
        y: point.y,
        w: 0,
        h: 0,
        color: tool === 'highlight' ? '#fde047' : tool === 'whiteout' ? '#ffffff' : color,
        filled: tool !== 'rect',
        strokeWidth: tool === 'rect' ? strokeWidth : 0,
        opacity: tool === 'highlight' ? 0.45 : 1,
      }
    }
    interactionRef.current = {
      mode: 'draw',
      pointerId: event.pointerId,
      start: point,
      id,
      snapshot,
      moved: false,
    }
    applyLive((prev) => [...prev, created])
    setSelectedId(id)
    setResultBlob(null)
  }

  const onObjectPointerDown = (event: ReactPointerEvent<HTMLElement>, obj: EditorObject) => {
    if (event.button !== 0) return
    event.stopPropagation()
    overlayRef.current?.setPointerCapture(event.pointerId)
    setSelectedId(obj.id)
    interactionRef.current = {
      mode: 'move',
      pointerId: event.pointerId,
      start: pointFrom(event),
      id: obj.id,
      snapshot: objectsRef.current,
      origin: obj,
      moved: false,
    }
  }

  const onResizePointerDown = (event: ReactPointerEvent<HTMLElement>, obj: EditorObject) => {
    if (event.button !== 0) return
    event.stopPropagation()
    overlayRef.current?.setPointerCapture(event.pointerId)
    setSelectedId(obj.id)
    interactionRef.current = {
      mode: 'resize',
      pointerId: event.pointerId,
      start: pointFrom(event),
      id: obj.id,
      snapshot: objectsRef.current,
      origin: obj,
      moved: false,
    }
  }

  const onOverlayPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const it = interactionRef.current
    if (!it || it.pointerId !== event.pointerId) return
    const point = pointFrom(event)
    it.moved = true

    applyLive((prev) =>
      prev.map((o) => {
        if (o.id !== it.id) return o
        if (it.mode === 'draw') {
          if (o.kind === 'ink') return { ...o, points: [...o.points, point] }
          if (o.kind === 'line') return { ...o, x2: point.x, y2: point.y }
          if (o.kind === 'rect' || o.kind === 'highlight' || o.kind === 'whiteout') {
            return {
              ...o,
              x: Math.min(it.start.x, point.x),
              y: Math.min(it.start.y, point.y),
              w: Math.abs(point.x - it.start.x),
              h: Math.abs(point.y - it.start.y),
            }
          }
          return o
        }
        if (it.mode === 'move' && it.origin) {
          return moveObject(it.origin, point.x - it.start.x, point.y - it.start.y)
        }
        if (it.mode === 'resize' && it.origin) {
          const origin = it.origin
          if (origin.kind === 'line') {
            return { ...origin, x2: point.x, y2: point.y }
          }
          if (origin.kind === 'text') {
            const grow = Math.max(4, origin.size + (point.y - it.start.y))
            return { ...origin, size: Math.round(Math.min(grow, 200)) }
          }
          if (origin.kind === 'ink') return origin
          return {
            ...origin,
            w: Math.max(MIN_SIZE, point.x - origin.x),
            h: Math.max(MIN_SIZE, point.y - origin.y),
          }
        }
        return o
      }),
    )
  }

  const finishInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const it = interactionRef.current
    if (!it || it.pointerId !== event.pointerId) return
    interactionRef.current = null
    overlayRef.current?.releasePointerCapture?.(event.pointerId)

    const prev = objectsRef.current
    let next = prev
    if (it.mode === 'draw') {
      next = prev
        .map((o) =>
          o.id === it.id && o.kind === 'ink' ? { ...o, points: simplifyStroke(o.points) } : o,
        )
        .filter((o) => {
          // A stray click that produced nothing is discarded rather than
          // leaving an invisible zero-size object behind.
          if (o.id !== it.id) return true
          if (o.kind === 'rect' || o.kind === 'highlight' || o.kind === 'whiteout') {
            return o.w >= MIN_SIZE && o.h >= MIN_SIZE
          }
          if (o.kind === 'line') return Math.hypot(o.x2 - o.x1, o.y2 - o.y1) >= MIN_SIZE
          if (o.kind === 'ink') return o.points.length > 1
          return true
        })
    }
    if (next !== prev) {
      objectsRef.current = next
      setObjects(next)
      if (next.length < prev.length) setSelectedId(null)
    }
    // Nothing actually changed if a stray click was discarded again.
    const changed = next.length !== it.snapshot.length || it.moved
    if (changed) {
      setPast((p) => [...p.slice(-49), it.snapshot])
      setFuture([])
      setResultBlob(null)
    }
  }

  /* -------------------------------------------------------------- */
  /* Images and signatures                                           */
  /* -------------------------------------------------------------- */

  const placeAsset = useCallback(
    (asset: ImageAsset) => {
      if (!geo) return
      assetsRef.current = new Map(assetsRef.current).set(asset.id, asset)
      setAssets(assetsRef.current)
      // Pixels are assumed to be 96 DPI, the CSS reference, so 0.75 pt each.
      const maxW = geo.displayW * 0.35
      const w = Math.max(24, Math.min(maxW, asset.width * 0.75))
      const h = Math.max(12, (asset.height / Math.max(1, asset.width)) * w)
      addObject({
        id: newId('image'),
        kind: 'image',
        page: pageNo,
        x: Math.max(0, (geo.displayW - w) / 2),
        y: Math.max(20, Math.min(geo.displayH - h - 20, geo.displayH * 0.6)),
        w,
        h,
        assetId: asset.id,
        opacity: 1,
      })
      setTool('select')
    },
    [addObject, geo, pageNo],
  )

  const onImageChosen = async (fileList: FileList | null) => {
    const picked = fileList?.[0]
    if (!picked) return
    try {
      const image = await toEmbeddableImage(picked)
      const blob = pdfImageBlob(image.bytes, image.type)
      placeAsset({
        id: newId('asset'),
        bytes: image.bytes,
        type: image.type,
        width: image.width,
        height: image.height,
        url: URL.createObjectURL(blob),
        label: picked.name,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  /* -------------------------------------------------------------- */
  /* Export                                                          */
  /* -------------------------------------------------------------- */

  const runExport = async () => {
    if (!bytes || !file) return
    setBusy(true)
    setError(null)
    setResultBlob(null)
    setProgress({ value: 2, label: 'Opening the document' })
    try {
      const out = await exportEditedPdf(bytes, objects, assets, (p) => {
        setProgress({
          value: p.total === 0 ? 90 : Math.round((p.done / p.total) * 90) + 5,
          label: p.label,
        })
      })
      setProgress({ value: 100, label: 'Done' })
      setResultBlob(pdfBlob(out))
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
      window.setTimeout(() => setProgress(null), 600)
    }
  }

  /* -------------------------------------------------------------- */
  /* Keyboard                                                        */
  /* -------------------------------------------------------------- */

  const onObjectKeyDown = (event: ReactKeyboardEvent<HTMLElement>, obj: EditorObject) => {
    const step = event.shiftKey ? 10 : 1
    let dx = 0
    let dy = 0
    if (event.key === 'ArrowLeft') dx = -step
    else if (event.key === 'ArrowRight') dx = step
    else if (event.key === 'ArrowUp') dy = -step
    else if (event.key === 'ArrowDown') dy = step
    else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      commit((prev) => prev.filter((o) => o.id !== obj.id))
      setSelectedId(null)
      return
    } else return
    event.preventDefault()
    commit((prev) => prev.map((o) => (o.id === obj.id ? moveObject(o, dx, dy) : o)))
  }

  /* -------------------------------------------------------------- */
  /* Rendering                                                       */
  /* -------------------------------------------------------------- */

  if (!file || !geo) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={(files) => void onFiles(files)}
          maxSizeMb={800}
          title={config.dropTitle}
          hint={config.dropHint}
          disabled={loading}
        />
        {loading ? <ProgressPanel label="Opening the document…" /> : null}
        {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}
        <p className="text-sm text-muted-foreground">
          {config.panelDescription} Everything happens in this browser tab, and it works with the
          network turned off.
        </p>
      </div>
    )
  }

  const objectStyle = (obj: EditorObject): CSSProperties => {
    const b = boundsOf(obj)
    return {
      left: `${b.x * scale}px`,
      top: `${b.y * scale}px`,
      width: `${Math.max(b.w, 2) * scale}px`,
      height: `${Math.max(b.h, 2) * scale}px`,
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => void onImageChosen(e.target.files)}
      />

      <ToolPanel title={config.panelTitle} description={config.panelDescription}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted p-1.5">
          <div role="group" aria-label="Editing tools" className="flex flex-wrap gap-1">
            {config.tools.map((id) => {
              const meta = TOOL_META[id]
              const Glyph = meta.icon
              return (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={tool === id ? 'default' : 'ghost'}
                  aria-pressed={tool === id}
                  // The text label is hidden on phones, so name the button here.
                  aria-label={meta.label}
                  title={meta.hint}
                  className="gap-1.5"
                  onClick={() => {
                    setTool(id)
                    if (id === 'image') imageInputRef.current?.click()
                  }}
                >
                  <Glyph className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{meta.label}</span>
                </Button>
              )
            })}
            {config.signature ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5"
                aria-label="Signature"
                onClick={() => setSignatureOpen(true)}
              >
                <Signature className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Signature</span>
              </Button>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Undo"
              disabled={past.length === 0}
              onClick={undo}
            >
              <Undo2 className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Redo"
              disabled={future.length === 0}
              onClick={redo}
            >
              <Redo2 className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Zoom out"
              disabled={zoom <= 0.5}
              onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
            >
              <Minus className="size-4" aria-hidden="true" />
            </Button>
            <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Zoom in"
              disabled={zoom >= 3}
              onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Style bar */}
        <div className="flex flex-wrap items-end gap-4 rounded-lg bg-muted p-3">
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-muted-foreground">Colour</legend>
            <div className="flex items-center gap-1.5">
              {SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Use ${hex}`}
                  aria-pressed={color.toLowerCase() === hex}
                  onClick={() => {
                    setColor(hex)
                    if (selected && selected.kind !== 'image') updateSelected({ color: hex })
                  }}
                  className={cn(
                    'size-6 rounded-full border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    color.toLowerCase() === hex ? 'border-primary' : 'border-border',
                  )}
                  style={{ backgroundColor: hex }}
                />
              ))}
              <Input
                type="color"
                aria-label="Custom colour"
                value={color}
                className="h-8 w-10 cursor-pointer p-1"
                onChange={(e) => {
                  setColor(e.target.value)
                  if (selected && selected.kind !== 'image') updateSelected({ color: e.target.value })
                }}
              />
            </div>
          </fieldset>

          {(tool === 'text' || selected?.kind === 'text') && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-size`} className="text-xs text-muted-foreground">
                  Text size (pt)
                </Label>
                <Input
                  id={`${ids}-size`}
                  type="number"
                  min={4}
                  max={200}
                  className="h-8 w-24"
                  value={selected?.kind === 'text' ? selected.size : fontSize}
                  onChange={(e) => {
                    const v = Math.min(200, Math.max(4, Number(e.target.value) || 12))
                    setFontSize(v)
                    if (selected?.kind === 'text') updateSelected({ size: v })
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-font`} className="text-xs text-muted-foreground">
                  Font
                </Label>
                <Select
                  value={selected?.kind === 'text' ? selected.font : fontKey}
                  onValueChange={(v) => {
                    setFontKey(v as FontKey)
                    if (selected?.kind === 'text') updateSelected({ font: v as FontKey })
                  }}
                >
                  <SelectTrigger id={`${ids}-font`} className="h-8 w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_CHOICES.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {(tool === 'ink' || tool === 'line' || tool === 'rect' || selected?.kind === 'ink') && (
            <div className="min-w-40 flex-1 space-y-1.5">
              <Label htmlFor={`${ids}-stroke`} className="text-xs text-muted-foreground">
                Stroke · {strokeWidth} pt
              </Label>
              <Slider
                id={`${ids}-stroke`}
                min={1}
                max={12}
                step={1}
                value={[strokeWidth]}
                onValueChange={(v) => {
                  const w = v[0] ?? 2
                  setStrokeWidth(w)
                  if (selected && (selected.kind === 'ink' || selected.kind === 'line')) {
                    updateSelected({ width: w }, false)
                  }
                  if (selected?.kind === 'rect') updateSelected({ strokeWidth: w }, false)
                }}
              />
            </div>
          )}
        </div>

        {/* Page canvas */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Previous page"
                disabled={pageNo <= 1}
                onClick={() => {
                  setPageNo((p) => Math.max(1, p - 1))
                  setSelectedId(null)
                }}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <span className="px-1 text-sm tabular-nums text-muted-foreground">
                Page {pageNo} of {pageCount}
              </span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Next page"
                disabled={pageNo >= pageCount}
                onClick={() => {
                  setPageNo((p) => Math.min(pageCount, p + 1))
                  setSelectedId(null)
                }}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
              {objects.length === 0
                ? config.emptyHint
                : `${plural(objects.length, 'object')} added, ${pageObjects.length} on this page`}
            </p>
          </div>

          <div ref={frameRef} className="w-full overflow-auto rounded-lg bg-muted p-2">
            <div
              className="relative mx-auto"
              // Paper, not chrome: a PDF page is white in light and dark mode alike.
              style={{ width: `${viewW}px`, height: `${viewH}px`, backgroundColor: '#ffffff' }}
            >
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full"
                aria-label={`Page ${pageNo} of ${file.name}`}
              />
              <div
                ref={overlayRef}
                className={cn(
                  'absolute inset-0 touch-none',
                  tool === 'select' ? 'cursor-default' : 'cursor-crosshair',
                )}
                onPointerDown={onOverlayPointerDown}
                onPointerMove={onOverlayPointerMove}
                onPointerUp={finishInteraction}
                onPointerCancel={finishInteraction}
              >
                {pageObjects.map((obj) => {
                  const isSelected = obj.id === selectedId
                  const common = {
                    tabIndex: 0,
                    role: 'button' as const,
                    'aria-label': `${describeObject(obj)}. Drag to move, arrow keys to nudge, Delete to remove`,
                    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => onObjectPointerDown(e, obj),
                    onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => onObjectKeyDown(e, obj),
                    onFocus: () => setSelectedId(obj.id),
                  }
                  const ring = isSelected
                    ? 'outline outline-2 outline-black outline-offset-1'
                    : 'outline-none hover:outline hover:outline-1 hover:outline-muted-foreground'

                  if (obj.kind === 'text') {
                    const font = FONT_BY_KEY[obj.font]
                    return (
                      <div
                        key={obj.id}
                        {...common}
                        className={cn('absolute cursor-move whitespace-pre', ring)}
                        style={{
                          left: `${obj.x * scale}px`,
                          top: `${obj.y * scale}px`,
                          fontFamily: font.css,
                          fontWeight: cssWeight(obj.font),
                          fontStyle: cssStyle(obj.font),
                          fontSize: `${obj.size * scale}px`,
                          lineHeight: 1.15,
                          color: obj.color,
                        }}
                      >
                        {obj.text || ' '}
                      </div>
                    )
                  }

                  if (obj.kind === 'image') {
                    const asset = assets.get(obj.assetId)
                    return (
                      <div
                        key={obj.id}
                        {...common}
                        className={cn('absolute cursor-move', ring)}
                        style={{ ...objectStyle(obj), opacity: obj.opacity }}
                      >
                        {asset ? (
                          <img
                            src={asset.url}
                            alt={asset.label}
                            className="h-full w-full object-fill"
                            draggable={false}
                          />
                        ) : null}
                        {isSelected ? <ResizeHandle onPointerDown={(e) => onResizePointerDown(e, obj)} /> : null}
                      </div>
                    )
                  }

                  if (obj.kind === 'ink' || obj.kind === 'line') {
                    const b = boundsOf(obj)
                    const pad = obj.width + 4
                    const pts =
                      obj.kind === 'ink'
                        ? obj.points
                        : [
                            { x: obj.x1, y: obj.y1 },
                            { x: obj.x2, y: obj.y2 },
                          ]
                    const path = pts
                      .map((p) => `${(p.x - b.x + pad) * scale},${(p.y - b.y + pad) * scale}`)
                      .join(' ')
                    return (
                      <div
                        key={obj.id}
                        {...common}
                        className={cn('absolute cursor-move', ring)}
                        style={{
                          left: `${(b.x - pad) * scale}px`,
                          top: `${(b.y - pad) * scale}px`,
                          width: `${(b.w + pad * 2) * scale}px`,
                          height: `${(b.h + pad * 2) * scale}px`,
                          // A diagonal stroke's bounding box is mostly empty
                          // space; only the ink itself should catch a pointer,
                          // or it would block drawing anywhere near it.
                          pointerEvents: 'none',
                        }}
                      >
                        <svg
                          className="h-full w-full"
                          width={(b.w + pad * 2) * scale}
                          height={(b.h + pad * 2) * scale}
                          aria-hidden="true"
                        >
                          <polyline
                            points={path}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={Math.max(14, obj.width * scale + 10)}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ pointerEvents: 'stroke', cursor: 'move' }}
                          />
                          <polyline
                            points={path}
                            fill="none"
                            stroke={obj.color}
                            strokeWidth={Math.max(1, obj.width * scale)}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ pointerEvents: 'none' }}
                          />
                        </svg>
                      </div>
                    )
                  }

                  const isHighlight = obj.kind === 'highlight'
                  return (
                    <div
                      key={obj.id}
                      {...common}
                      className={cn('absolute cursor-move', ring)}
                      style={{
                        ...objectStyle(obj),
                        backgroundColor:
                          obj.kind === 'rect' && !obj.filled ? 'transparent' : obj.color,
                        opacity: obj.opacity,
                        mixBlendMode: isHighlight ? 'multiply' : undefined,
                        border:
                          obj.kind === 'rect' && obj.strokeWidth > 0
                            ? `${Math.max(1, obj.strokeWidth * scale)}px solid ${obj.color}`
                            : undefined,
                      }}
                    >
                      {isSelected ? <ResizeHandle onPointerDown={(e) => onResizePointerDown(e, obj)} /> : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {thumbs.length > 1 ? (
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              aria-label="Page thumbnails"
            >
              {thumbs.map((src, index) => {
                const n = index + 1
                const count = objects.filter((o) => o.page === n).length
                return (
                  <button
                    key={n}
                    type="button"
                    aria-current={n === pageNo ? 'page' : undefined}
                    aria-label={`Go to page ${n}${count > 0 ? `, ${plural(count, 'edit')}` : ''}`}
                    onClick={() => {
                      setPageNo(n)
                      setSelectedId(null)
                    }}
                    className={cn(
                      'relative shrink-0 rounded border-2 bg-card p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      n === pageNo ? 'border-primary' : 'border-border hover:border-muted-foreground',
                    )}
                  >
                    {src ? (
                      <img src={src} alt="" width={48} className="block h-auto w-12" />
                    ) : (
                      <span className="grid h-16 w-12 place-items-center text-xs">{n}</span>
                    )}
                    <span className="block pt-0.5 text-center text-[10px] tabular-nums text-muted-foreground">
                      {n}
                    </span>
                    {count > 0 ? (
                      <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                        {count}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        {/* Selected object panel */}
        {selected ? (
          <div className="space-y-3 rounded-lg bg-muted p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">{describeObject(selected)}</h3>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    commit((prev) => {
                      const target = prev.find((o) => o.id === selected.id)
                      if (!target) return prev
                      return [...prev.filter((o) => o.id !== selected.id), target]
                    })
                  }
                >
                  Bring to front
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  onClick={deleteSelected}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Delete
                </Button>
              </div>
            </div>

            {selected.kind === 'text' ? (
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-text`}>Text (Enter starts a new line)</Label>
                <Textarea
                  id={`${ids}-text`}
                  ref={textareaRef}
                  rows={3}
                  value={selected.text}
                  placeholder="Type here…"
                  onFocus={markUndoPoint}
                  onChange={(e) => updateSelected({ text: e.target.value }, false)}
                />
              </div>
            ) : null}

            {(selected.kind === 'highlight' || selected.kind === 'rect' || selected.kind === 'image') && (
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-opacity`} className="text-xs text-muted-foreground">
                  Opacity · {Math.round(selected.opacity * 100)}%
                </Label>
                <Slider
                  id={`${ids}-opacity`}
                  min={5}
                  max={100}
                  step={5}
                  value={[Math.round(selected.opacity * 100)]}
                  onValueChange={(v) => updateSelected({ opacity: (v[0] ?? 100) / 100 }, false)}
                />
              </div>
            )}

            {selected.kind === 'rect' ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={selected.filled}
                  onChange={(e) => updateSelected({ filled: e.target.checked })}
                />
                Fill the box instead of outlining it
              </label>
            ) : null}

            {selected.kind === 'image' ||
            selected.kind === 'rect' ||
            selected.kind === 'highlight' ||
            selected.kind === 'whiteout' ? (
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`${ids}-w`} className="text-xs text-muted-foreground">
                    Width (pt)
                  </Label>
                  <Input
                    id={`${ids}-w`}
                    type="number"
                    min={1}
                    className="h-8 w-24"
                    value={Math.round(selected.w)}
                    onChange={(e) =>
                      updateSelected({ w: Math.max(1, Number(e.target.value) || 1) }, false)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${ids}-h`} className="text-xs text-muted-foreground">
                    Height (pt)
                  </Label>
                  <Input
                    id={`${ids}-h`}
                    type="number"
                    min={1}
                    className="h-8 w-24"
                    value={Math.round(selected.h)}
                    onChange={(e) =>
                      updateSelected({ h: Math.max(1, Number(e.target.value) || 1) }, false)
                    }
                  />
                </div>
                {selected.kind === 'image' ? (
                  <div className="space-y-1.5">
                    <span className="block text-xs text-muted-foreground">Proportions</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => {
                        const asset = assets.get(selected.assetId)
                        if (!asset) return
                        updateSelected({ h: (asset.height / asset.width) * selected.w })
                      }}
                    >
                      Restore aspect ratio
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Position {Math.round(boundsOf(selected).x)} × {Math.round(boundsOf(selected).y)} pt from
              the top-left of page {selected.page}. Nudge with the arrow keys while it is focused,
              10 pt at a time with Shift.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageObjects.length === 0}
            onClick={() => commit((prev) => prev.filter((o) => o.page !== pageNo))}
          >
            Clear this page
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={objects.length === 0}
            onClick={() => {
              commit([])
              setSelectedId(null)
            }}
          >
            Clear everything
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              reset()
              setFile(null)
              setBytes(null)
              setGeos([])
            }}
          >
            Use a different PDF
          </Button>
        </div>
      </ToolPanel>

      <ToolPanel
        title="Save your PDF"
        description={`${file.name} · ${formatBytes(file.size)} · ${plural(pageCount, 'page')}`}
      >
        {progress ? <ProgressPanel label={progress.label} value={progress.value} /> : null}
        {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void runExport()} disabled={busy || objects.length === 0}>
            {busy ? 'Working…' : `Apply ${plural(objects.length, 'change')}`}
          </Button>
          <DownloadButton
            blob={resultBlob}
            filename={outputName(file.name, config.suffix)}
            label="Download PDF"
            variant={resultBlob ? 'default' : 'outline'}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Everything you added is written into the original file's own content stream, so the text
          and vector graphics that were already there stay selectable and sharp. It does not reflow text:
          existing paragraphs cannot be rewritten, only covered and retyped.
        </p>
      </ToolPanel>

      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create a signature</DialogTitle>
            <DialogDescription>
              Draw it, type it or upload a photo of one. It becomes a transparent PNG held in this
              tab's memory and is not stored.
            </DialogDescription>
          </DialogHeader>
          <PdfEditSignaturePad
            onCreate={({ bytes: png, width, height, label }) => {
              placeAsset({
                id: newId('sig'),
                bytes: png,
                type: 'png',
                width,
                height,
                url: URL.createObjectURL(pdfImageBlob(png, 'png')),
                label,
              })
              setSignatureOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ResizeHandle({ onPointerDown }: { onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void }) {
  return (
    <span
      role="presentation"
      onPointerDown={onPointerDown}
      className="absolute -right-1.5 -bottom-1.5 size-3 cursor-se-resize rounded-full border-2 border-background bg-primary"
    />
  )
}

/** Wrap raw image bytes in a Blob with a real ArrayBuffer behind them. */
function pdfImageBlob(bytes: Uint8Array, type: 'png' | 'jpg'): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type: type === 'png' ? 'image/png' : 'image/jpeg' })
}

export default PdfEditOverlayEditor
