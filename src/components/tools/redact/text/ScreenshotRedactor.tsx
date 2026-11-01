import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Faker } from '@faker-js/faker'
import { ClipboardCopy } from 'lucide-react'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { decodePhoto, photoError } from '@/components/tools/image-edit/photo-image'
import { ocrDownloadBytes, ocrIsCached } from '@/lib/ml/ocr/ocr'
import { loadFaker } from '@/lib/ml/text/placeholders'
import { defaultTypes } from '@/lib/ml/text/types'
import type { EntityType } from '@/lib/ml/text/types'
import { formatBytes, stripExtension } from '@/lib/utils'
import { LookControls } from '../shared/LookControls'
import { RedactionEditor } from '../shared/RedactionEditor'
import { encodeRedacted, renderRedacted } from '../shared/boxes'
import type { EditorBox } from '../shared/boxes'
import type { RedactLook } from '../shared/paint'
import { HideList, TypePicker, hideTerms } from './Options'
import { ModelNote } from './ModelNote'
import { findPictures, findTextItems, modelSpans, readScreen, sampleColors } from './screen-detect'
import type { ScreenFinding, ScreenText } from './screen-detect'
import type { Span } from '@/lib/ml/text/types'
import { useNer } from './useNer'

const ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp'
const SCREEN_LOOK: RedactLook = { style: 'fill', shape: 'rect', strength: 100, fill: '#000' }
const CHAT_TYPES: EntityType[] = ['PERSON', 'EMAIL', 'PHONE', 'ADDRESS', 'POSTCODE', 'CARD', 'IBAN', 'ID', 'DOB', 'SECRET', 'USERNAME', 'IP', 'URL']

interface Loaded {
  name: string
  bitmap: ImageBitmap
  width: number
  height: number
}

/**
 * Consistent fake names chosen close in length to the real ones, so they fit
 * the space: the same first or last name always gets the same replacement.
 */
function fakeNamer(faker: Faker, seed: number) {
  faker.seed(seed)
  const first = new Map<string, string>()
  const last = new Map<string, string>()
  const pick = (gen: () => string, want: number) => {
    let best = gen()
    for (let i = 0; i < 12 && best.length !== want; i++) {
      const c = gen()
      if (Math.abs(c.length - want) < Math.abs(best.length - want)) best = c
    }
    return best
  }
  return (original: string): string => {
    const words = original.split(/\s+/).filter(Boolean)
    return words
      .map((w, i) => {
        const key = w.toLowerCase()
        const isLast = words.length > 1 && i === words.length - 1
        const map = isLast || last.has(key) ? last : first
        let fake = map.get(key)
        if (!fake) {
          fake = pick(() => (map === last ? faker.person.lastName() : faker.person.firstName()), w.replace(/[^\p{L}]/gu, '').length)
          map.set(key, fake)
        }
        return /[,!?.]$/.test(w) ? fake + w.slice(-1) : fake
      })
      .join(' ')
  }
}

/** Box ids of a finding: one per rectangle. */
const boxIdsOf = (f: ScreenFinding) => f.rects.map((_, i) => `${f.id}#${i}`)
const findingOf = (boxId: string) => (boxId.includes('#') ? boxId.slice(0, boxId.lastIndexOf('#')) : null)

export function ScreenshotRedactor({ chat = false }: { chat?: boolean }) {
  const id = useId()
  const [image, setImage] = useState<Loaded | null>(null)
  const [screen, setScreen] = useState<ScreenText | null>(null)
  const [pictures, setPictures] = useState<ScreenFinding[]>([])
  const [model, setModel] = useState<Span[]>([])
  /** Finding ids the user keeps visible. */
  const [kept, setKept] = useState<Set<string>>(() => new Set())
  /** Boxes drawn by hand (and found boxes the user moved, which become drawn ones). */
  const [manual, setManual] = useState<EditorBox[]>([])
  const [look, setLook] = useState<RedactLook>(SCREEN_LOOK)
  const [types, setTypes] = useState<Set<EntityType>>(() => (chat ? new Set(CHAT_TYPES) : defaultTypes()))
  const [hide, setHide] = useState('')
  const [faces, setFaces] = useState(true)
  const [avatars, setAvatars] = useState(true)
  const [fakeNames, setFakeNames] = useState(false)
  const [faker, setFaker] = useState<Faker | null>(null)
  const [progress, setProgress] = useState<{ label: string; value: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Blob | null>(null)
  const [ocrCached, setOcrCached] = useState(true)
  const [copied, setCopied] = useState(false)
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31))
  const ner = useNer('', true)
  const modelReady = ner.phase === 'ready' || ner.phase === 'running'
  const runToken = useRef(0)

  useEffect(() => {
    void ocrIsCached().then(setOcrCached)
  }, [])
  useEffect(() => {
    if (fakeNames && !faker) void loadFaker().then(setFaker)
  }, [fakeNames, faker])
  useEffect(() => () => image?.bitmap.close(), [image])

  const open = useCallback(async (file: File | Blob, name: string) => {
    setError(null)
    setResult(null)
    setScreen(null)
    setPictures([])
    setModel([])
    setKept(new Set())
    setManual([])
    try {
      const { bitmap, width, height } = await decodePhoto(file, name)
      setImage({ name, bitmap, width, height })
    } catch (err) {
      setError(photoError(err, `${name} could not be read.`))
    }
  }, [])

  // Paste a screenshot from the clipboard anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (!file) return
      e.preventDefault()
      void open(file, 'pasted-screenshot.png')
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [open])

  // OCR, faces and pictures run once per image.
  useEffect(() => {
    if (!image) return
    const token = ++runToken.current
    void (async () => {
      try {
        setProgress({ label: ocrCached ? 'Reading the text' : `Downloading the text reader (${formatBytes(ocrDownloadBytes())}, once)`, value: 0 })
        const st = await readScreen(image.bitmap, (p) => token === runToken.current && setProgress({ label: 'Reading the text', value: p * 85 }))
        if (token !== runToken.current) return
        setOcrCached(true)
        setScreen(st)
        setProgress({ label: 'Looking for faces and profile pictures', value: 90 })
        const pics = await findPictures(image.bitmap, st)
        if (token === runToken.current) setPictures(pics)
      } catch (err) {
        if (token === runToken.current) setError(err instanceof Error ? err.message : 'The screenshot could not be read.')
      } finally {
        if (token === runToken.current) setProgress(null)
      }
    })()
  }, [image, ocrCached])

  // The language model reads the text once it is loaded.
  useEffect(() => {
    if (!screen || !modelReady) return
    let live = true
    void modelSpans(screen).then((spans) => live && setModel(spans))
    return () => {
      live = false
    }
  }, [screen, modelReady])

  const terms = useMemo(() => hideTerms(hide), [hide])
  const findings = useMemo(() => {
    if (!screen || !image) return []
    const text = findTextItems(screen, { types, hide: terms, model, chat, height: image.height })
    const pics = pictures.filter((p) => (p.kind === 'face' ? faces : avatars))
    return [...text, ...pics]
  }, [screen, image, types, terms, model, chat, pictures, faces, avatars])

  /** Editor boxes: one per rectangle of each finding, then the drawn ones. */
  const boxes = useMemo<EditorBox[]>(() => {
    if (!image) return []
    const found = findings.flatMap((f) =>
      f.rects.map((r, i) => ({
        id: `${f.id}#${i}`,
        x: r.x / image.width,
        y: r.y / image.height,
        w: r.w / image.width,
        h: r.h / image.height,
        kind: f.kind === 'face' ? ('face' as const) : f.kind === 'avatar' ? ('manual' as const) : ('text' as const),
        keep: kept.has(f.id),
        label: f.label,
      })),
    )
    return [...found, ...manual]
  }, [findings, kept, manual, image])

  /* ---------------- fake names drawn on the image ---------------- */

  const nameFindings = useMemo(() => (chat && fakeNames ? findings.filter((f) => f.name) : []), [chat, fakeNames, findings])
  const nameIds = useMemo(() => new Set(nameFindings.flatMap(boxIdsOf)), [nameFindings])

  /** The image with fake names drawn over the real ones, used as the editor's source. */
  const source = useMemo(() => {
    if (!image) return null
    if (nameFindings.length === 0 || !faker) return image.bitmap
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(image.bitmap, 0, 0)
    const names = fakeNamer(faker, seed)
    for (const f of nameFindings) {
      if (kept.has(f.id)) continue
      const original = f.value ?? ''
      const fake = names(original)
      const parts = f.ink ?? f.rects
      for (const r of parts) {
        const pad = Math.max(1, r.h * 0.12)
        const { bg, fg } = sampleColors(ctx, { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 })
        ctx.fillStyle = bg
        ctx.fillRect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2)
        // OCR boxes run from the top of the tallest letter to the bottom of the lowest one.
        const descends = /[gjpqyQ,;]/.test(original)
        const size = Math.max(8, descends ? r.h / 0.92 : r.h / 0.74)
        ctx.font = `${f.label === 'Name' ? 400 : 600} ${size}px system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`
        ctx.fillStyle = fg
        ctx.textBaseline = 'alphabetic'
        const text = parts.length > 1 ? fake.split(' ')[parts.indexOf(r)] ?? fake : fake
        // The fake name is chosen close in length; squeeze it to the original width when longer.
        ctx.fillText(text, r.x, descends ? r.y + r.h * 0.76 : r.y + r.h, r.w + pad)
      }
    }
    return canvas
  }, [image, nameFindings, faker, seed, kept])

  // With fake names on, the name boxes are drawn into the image instead of covered.
  const editorBoxes = useMemo(() => boxes.filter((b) => !nameIds.has(b.id)), [boxes, nameIds])
  const setEditorBoxes = (next: EditorBox[]) => {
    setResult(null)
    const before = new Map(editorBoxes.map((b) => [b.id, b]))
    const nextKept = new Set(kept)
    const drawn: EditorBox[] = []
    const seen = new Set<string>()
    for (const b of next) {
      const fid = findingOf(b.id)
      const old = before.get(b.id)
      if (!fid) {
        drawn.push(b)
        continue
      }
      seen.add(b.id)
      const moved = old && (Math.abs(old.x - b.x) > 1e-6 || Math.abs(old.y - b.y) > 1e-6 || Math.abs(old.w - b.w) > 1e-6 || Math.abs(old.h - b.h) > 1e-6)
      if (moved) {
        // A moved or resized found box becomes a drawn box; the found one stays visible.
        drawn.push({ ...b, id: `m-${b.id}-${Date.now()}`, kind: 'manual' })
        nextKept.add(fid)
      } else if (b.keep) nextKept.add(fid)
      else nextKept.delete(fid)
    }
    // A removed found box means: keep that item visible.
    for (const b of editorBoxes) {
      const fid = findingOf(b.id)
      if (fid && !seen.has(b.id)) nextKept.add(fid)
    }
    setKept(nextKept)
    setManual(drawn)
  }

  const toggleFinding = (f: ScreenFinding) => {
    setResult(null)
    setKept((prev) => {
      const next = new Set(prev)
      if (next.has(f.id)) next.delete(f.id)
      else next.add(f.id)
      return next
    })
  }

  const exportImage = async () => {
    if (!image || !source) return
    const canvas = renderRedacted(source, image.width, image.height, editorBoxes, look)
    const blob = await encodeRedacted(canvas, 'png', 1)
    canvas.width = 0
    setResult(blob)
    return blob
  }

  const copyImage = async () => {
    const blob = result ?? (await exportImage())
    if (!blob || !('ClipboardItem' in window)) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('The browser did not allow copying the image. Use Download instead.')
    }
  }

  if (!image) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept={ACCEPT}
          onFiles={(files) => files[0] && void open(files[0], files[0].name)}
          maxSizeMb={60}
          title={chat ? 'Drop a chat screenshot' : 'Drop a screenshot'}
          hint="Or paste one with Ctrl+V or Cmd+V. It stays on your device."
        />
        <p className="text-sm text-pretty text-muted-foreground">
          {ocrCached
            ? 'The text reader is ready on this device.'
            : `The first screenshot downloads the text reader once: ${formatBytes(ocrDownloadBytes())}. After that it works offline.`}
        </p>
        {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}
      </div>
    )
  }

  const textFound = findings.filter((f) => f.kind === 'text')
  const otherFound = findings.filter((f) => f.kind !== 'text')
  const listed = [...textFound, ...otherFound]
  const keptOf = (f: ScreenFinding) => kept.has(f.id)

  return (
    <div className="space-y-4">
      <ModelNote ner={ner} what="Names, addresses and usernames" />
      {progress ? <ProgressPanel label={progress.label} value={progress.value} /> : null}
      {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <ToolPanel
          className="min-w-0"
          title={image.name}
          description={`${image.width} × ${image.height}. Press a box to keep that area. Drag on the image to add a box.`}
          footer={
            <>
              <Button type="button" onClick={() => void exportImage()} disabled={Boolean(progress)}>
                Make PNG
              </Button>
              <DownloadButton blob={result} filename={`${stripExtension(image.name)}-redacted.png`} label="Download PNG" variant={result ? 'default' : 'outline'} />
              <Button type="button" variant="secondary" className="gap-2" onClick={() => void copyImage()} disabled={Boolean(progress)}>
                <ClipboardCopy className="size-4" aria-hidden="true" />
                {copied ? 'Copied' : 'Copy image'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setImage(null)
                  setScreen(null)
                  setPictures([])
                  setManual([])
                  setResult(null)
                }}
              >
                Other image
              </Button>
            </>
          }
        >
          {source ? <RedactionEditor image={source} boxes={editorBoxes} onChange={setEditorBoxes} look={look} names={{ text: 'Text', face: 'Face', manual: 'Area' }} /> : null}
        </ToolPanel>

        <div className="min-w-0 space-y-4">
          <ToolPanel title="Found" description={listed.length ? 'Uncheck an item to keep it visible.' : progress || !screen ? 'Reading…' : 'Nothing found. Drag on the image to add a box.'}>
            {listed.length ? (
              <ul className="max-h-96 space-y-1.5 overflow-auto">
                {listed.map((f) => (
                  <li key={f.id} className="flex items-start gap-2">
                    <Checkbox id={`${id}-${f.id}`} className="mt-0.5" checked={!keptOf(f)} onCheckedChange={() => toggleFinding(f)} />
                    <Label htmlFor={`${id}-${f.id}`} className="block min-w-0 text-sm font-normal">
                      <span className="block font-[600]">{f.label}</span>
                      {f.value ? (
                        <span className="block truncate text-xs text-muted-foreground" title={f.value}>
                          {f.value}
                        </span>
                      ) : null}
                    </Label>
                  </li>
                ))}
              </ul>
            ) : null}
          </ToolPanel>

          <ToolPanel title="Options">
            {chat ? (
              <div className="flex items-center gap-2">
                <Switch id={`${id}-fake`} checked={fakeNames} onCheckedChange={setFakeNames} />
                <Label htmlFor={`${id}-fake`} className="text-sm font-normal">
                  Write fake names over the names
                </Label>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Switch id={`${id}-faces`} checked={faces} onCheckedChange={setFaces} />
              <Label htmlFor={`${id}-faces`} className="text-sm font-normal">
                Faces
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id={`${id}-avatars`} checked={avatars} onCheckedChange={setAvatars} />
              <Label htmlFor={`${id}-avatars`} className="text-sm font-normal">
                Round profile pictures
              </Label>
            </div>
            <LookControls look={look} onChange={(l) => (setLook(l), setResult(null))} idPrefix={`${id}-look`} />
            <TypePicker types={types} onChange={setTypes} counts={new Map()} className="lg:grid-cols-1" only={chat ? CHAT_TYPES : undefined} />
            <HideList value={hide} onChange={setHide} />
          </ToolPanel>
        </div>
      </div>
    </div>
  )
}
