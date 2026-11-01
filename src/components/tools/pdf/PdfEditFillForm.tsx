import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import type { PDFDocument, PDFForm } from 'pdf-lib'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { cn, formatBytes } from '@/lib/utils'
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
  userToDisplay,
} from './pdf-edit-core'
import type { PageGeometry } from './pdf-edit-core'

type FieldType = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'optionlist' | 'button' | 'signature'

interface WidgetRect {
  page: number
  x: number
  y: number
  w: number
  h: number
}

interface FieldModel {
  name: string
  type: FieldType
  readOnly: boolean
  required: boolean
  multiline: boolean
  maxLength?: number
  options: string[]
  widgets: WidgetRect[]
}

type FieldValue = string | boolean | string[]

type PdfjsModule = Awaited<ReturnType<typeof loadPdfJs>>
type PdfJsDoc = Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>

const TYPE_LABEL: Record<FieldType, string> = {
  text: 'Text',
  checkbox: 'Checkbox',
  radio: 'Radio group',
  dropdown: 'Dropdown',
  optionlist: 'List',
  button: 'Button',
  signature: 'Signature field',
}

/** Ask the catalog whether this is an XFA form, which pdf-lib cannot fill. */
function detectXfa(doc: PDFDocument, lib: Awaited<ReturnType<typeof loadPdfLib>>): boolean {
  try {
    const acro = doc.catalog.lookup(lib.PDFName.of('AcroForm'), lib.PDFDict)
    return acro?.get(lib.PDFName.of('XFA')) !== undefined
  } catch {
    return false
  }
}

export function PdfEditFillForm() {
  const ids = useId()
  const [file, setFile] = useState<File | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [geos, setGeos] = useState<PageGeometry[]>([])
  const [fields, setFields] = useState<FieldModel[]>([])
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [xfa, setXfa] = useState(false)
  const [pageNo, setPageNo] = useState(1)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [resultLabel, setResultLabel] = useState<string>('')
  const [frameW, setFrameW] = useState(720)
  const [showOverlay, setShowOverlay] = useState(true)

  const docRef = useRef<PdfJsDoc | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const renderToken = useRef(0)

  const geo = geos[pageNo - 1] ?? null
  const scale = geo ? frameW / geo.displayW : 1
  const viewW = geo ? geo.displayW * scale : 0
  const viewH = geo ? geo.displayH * scale : 0

  const fillable = useMemo(
    () => fields.filter((f) => f.type !== 'button' && f.type !== 'signature'),
    [fields],
  )
  const filledCount = useMemo(
    () =>
      fillable.filter((f) => {
        const v = values[f.name]
        if (typeof v === 'boolean') return v
        if (Array.isArray(v)) return v.length > 0
        return typeof v === 'string' && v.trim().length > 0
      }).length,
    [fillable, values],
  )

  const onFiles = useCallback(async (files: File[]) => {
    const next = files[0]
    if (!next) return
    docRef.current?.loadingTask.destroy()
    docRef.current = null
    setError(null)
    setResultBlob(null)
    setFields([])
    setValues({})
    setPageNo(1)
    setLoading(true)
    setFile(next)
    try {
      const raw = await readPdfBytes(next)
      const lib = await loadPdfLib()
      const doc = await lib.PDFDocument.load(raw, { ignoreEncryption: true, updateMetadata: false })
      const geometry = geometryFromPdfLib(doc.getPages())
      const pageRefs = doc.getPages().map((p) => p.ref)

      let form: PDFForm | null = null
      try {
        form = doc.getForm()
      } catch {
        form = null
      }

      const models: FieldModel[] = []
      const initial: Record<string, FieldValue> = {}

      for (const field of form?.getFields() ?? []) {
        const widgets: WidgetRect[] = []
        for (const widget of field.acroField.getWidgets()) {
          const ref = widget.P()
          let pageIndex = ref ? pageRefs.findIndex((p) => p === ref) : -1
          if (pageIndex < 0) {
            // Some generators omit /P; fall back to scanning each page's /Annots.
            pageIndex = doc.getPages().findIndex((page) => {
              const annots = page.node.Annots()
              if (!annots) return false
              for (let i = 0; i < annots.size(); i++) {
                const entry = annots.get(i)
                if (entry instanceof lib.PDFRef) {
                  if (doc.context.lookup(entry) === widget.dict) return true
                } else if (entry === widget.dict) {
                  return true
                }
              }
              return false
            })
          }
          if (pageIndex < 0) continue
          const g = geometry[pageIndex]
          if (!g) continue
          const rect = widget.getRectangle()
          const a = userToDisplay(g, rect.x, rect.y)
          const b = userToDisplay(g, rect.x + rect.width, rect.y + rect.height)
          widgets.push({
            page: pageIndex + 1,
            x: Math.min(a.x, b.x),
            y: Math.min(a.y, b.y),
            w: Math.abs(b.x - a.x),
            h: Math.abs(b.y - a.y),
          })
        }

        const name = field.getName()
        if (field instanceof lib.PDFTextField) {
          models.push({
            name,
            type: 'text',
            readOnly: field.isReadOnly(),
            required: field.isRequired(),
            multiline: field.isMultiline(),
            maxLength: field.getMaxLength(),
            options: [],
            widgets,
          })
          initial[name] = field.getText() ?? ''
        } else if (field instanceof lib.PDFCheckBox) {
          models.push({
            name,
            type: 'checkbox',
            readOnly: field.isReadOnly(),
            required: field.isRequired(),
            multiline: false,
            options: [],
            widgets,
          })
          initial[name] = field.isChecked()
        } else if (field instanceof lib.PDFRadioGroup) {
          models.push({
            name,
            type: 'radio',
            readOnly: field.isReadOnly(),
            required: field.isRequired(),
            multiline: false,
            options: field.getOptions(),
            widgets,
          })
          initial[name] = field.getSelected() ?? ''
        } else if (field instanceof lib.PDFDropdown) {
          models.push({
            name,
            type: 'dropdown',
            readOnly: field.isReadOnly(),
            required: field.isRequired(),
            multiline: false,
            options: field.getOptions(),
            widgets,
          })
          initial[name] = field.getSelected()[0] ?? ''
        } else if (field instanceof lib.PDFOptionList) {
          models.push({
            name,
            type: 'optionlist',
            readOnly: field.isReadOnly(),
            required: field.isRequired(),
            multiline: false,
            options: field.getOptions(),
            widgets,
          })
          initial[name] = field.getSelected()
        } else if (field instanceof lib.PDFSignature) {
          models.push({
            name,
            type: 'signature',
            readOnly: true,
            required: field.isRequired(),
            multiline: false,
            options: [],
            widgets,
          })
        } else {
          models.push({
            name,
            type: 'button',
            readOnly: true,
            required: false,
            multiline: false,
            options: [],
            widgets,
          })
        }
      }

      const pdfjs = await loadPdfJs()
      docRef.current = await pdfjs.getDocument({ data: copyBytes(raw) })
        .promise

      setXfa(detectXfa(doc, lib))
      setBytes(raw)
      setGeos(geometry)
      setFields(models)
      setValues(initial)
    } catch (err) {
      setFile(null)
      setBytes(null)
      setGeos([])
      setError(humanPdfError(err, next.name))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      docRef.current?.loadingTask.destroy()
      docRef.current = null
    }
  }, [])

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
        if (!cancelled) setError(humanPdfError(err, file?.name))
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [pageNo, scale, viewW, geo, file])

  const setValue = (name: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setResultBlob(null)
  }

  const build = async (flatten: boolean) => {
    if (!bytes || !file) return
    setBusy(true)
    setError(null)
    setResultBlob(null)
    try {
      const lib = await loadPdfLib()
      const doc = await lib.PDFDocument.load(bytes, {
        ignoreEncryption: true,
        updateMetadata: false,
      })
      const form = doc.getForm()
      const helvetica = await doc.embedFont('Helvetica')

      for (const model of fields) {
        const value = values[model.name]
        if (model.readOnly) continue
        try {
          if (model.type === 'text' && typeof value === 'string') {
            form.getTextField(model.name).setText(value)
          } else if (model.type === 'checkbox' && typeof value === 'boolean') {
            const box = form.getCheckBox(model.name)
            if (value) box.check()
            else box.uncheck()
          } else if (model.type === 'radio' && typeof value === 'string') {
            const group = form.getRadioGroup(model.name)
            if (value) group.select(value)
            else group.clear()
          } else if (model.type === 'dropdown' && typeof value === 'string') {
            const dropdown = form.getDropdown(model.name)
            if (value) dropdown.select(value)
            else dropdown.clear()
          } else if (model.type === 'optionlist' && Array.isArray(value)) {
            const list = form.getOptionList(model.name)
            if (value.length > 0) list.select(value)
            else list.clear()
          }
        } catch (err) {
          throw new Error(
            `The field “${model.name}” would not accept that value. ${
              err instanceof Error ? err.message : String(err)
            }`,
          )
        }
      }

      try {
        form.updateFieldAppearances(helvetica)
      } catch {
        // Some producers ship fields with no usable default appearance; the
        // values are still stored, readers will draw them on open.
      }

      if (flatten) form.flatten()

      const out = await doc.save({ useObjectStreams: false })
      setResultBlob(pdfBlob(out))
      setResultLabel(flatten ? 'flattened' : 'editable')
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
    }
  }

  if (!file || !geo) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={(files) => void onFiles(files)}
          maxSizeMb={500}
          title="Drop a PDF form"
          hint="or click to browse"
          disabled={loading}
        />
        {loading ? <ProgressPanel label="Reading the form fields…" /> : null}
        {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}
        <p className="text-sm text-muted-foreground">
          Works with standard AcroForm PDFs, the kind that most form software and government
          departments produce. Your entries are held in this
          browser tab and written into the file when you save.
        </p>
      </div>
    )
  }

  // `index` is the widget's position within its own field, because that is what
  // maps a radio-group widget to its export value — filtering first would
  // renumber them on any page but the first.
  const pageWidgets = fields.flatMap((f) =>
    f.widgets
      .map((rect, index) => ({ field: f, rect, index }))
      .filter((entry) => entry.rect.page === pageNo),
  )

  return (
    <div className="space-y-4">
      {xfa ? (
        <Alert role="note">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>This is an XFA form</AlertTitle>
          <AlertDescription>
            XFA is an XML form format that most PDF readers cannot render. A browser cannot fill it
            correctly, and a file filled here could lose your answers. Open it in a desktop PDF
            reader that supports XFA, or print it and use{' '}
            <a href="/add-text-to-pdf" className="underline">
              Add Text to PDF
            </a>{' '}
            on a flattened copy.
          </AlertDescription>
        </Alert>
      ) : null}

      {fields.length === 0 ? (
        <Alert role="status">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>No form fields in this PDF</AlertTitle>
          <AlertDescription>
            This file has no AcroForm fields, so there is nothing to fill. It is almost certainly a
            scan or a flat design that only looks like a form. Use{' '}
            <a href="/add-text-to-pdf" className="underline">
              Add Text to PDF
            </a>{' '}
            to type onto it instead.
          </AlertDescription>
        </Alert>
      ) : null}

      {fields.length > 0 ? (
        <ToolPanel
          title="Fill the form"
          description={`${plural(fillable.length, 'fillable field')} found · ${filledCount} filled in so far. Click on the page, or use the list below. Both edit the same values.`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Previous page"
                disabled={pageNo <= 1}
                onClick={() => setPageNo((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <span className="px-1 text-sm tabular-nums text-muted-foreground">
                Page {pageNo} of {geos.length}
              </span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Next page"
                disabled={pageNo >= geos.length}
                onClick={() => setPageNo((p) => Math.min(geos.length, p + 1))}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={showOverlay}
              onClick={() => setShowOverlay((v) => !v)}
            >
              {showOverlay ? 'Hide the on-page inputs' : 'Show the on-page inputs'}
            </Button>
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
              {showOverlay
                ? pageWidgets.map(({ field, rect, index }) => {
                    const key = `${field.name}-${pageNo}-${index}`
                    const style = {
                      left: `${rect.x * scale}px`,
                      top: `${rect.y * scale}px`,
                      width: `${Math.max(rect.w, 8) * scale}px`,
                      height: `${Math.max(rect.h, 8) * scale}px`,
                      fontSize: `${Math.max(9, Math.min(rect.h * 0.62, 15) * scale)}px`,
                    }
                    const box =
                      'absolute rounded-[2px] border border-input bg-background/80 px-1 text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring'

                    if (field.readOnly || field.type === 'button' || field.type === 'signature') {
                      return (
                        <div
                          key={key}
                          style={style}
                          title={`${field.name}: ${field.type === 'signature' ? 'signature field' : 'read-only'}`}
                          className="absolute rounded-[2px] border border-dashed border-input"
                        />
                      )
                    }
                    if (field.type === 'checkbox') {
                      const checked = values[field.name] === true
                      return (
                        <button
                          key={key}
                          type="button"
                          style={style}
                          aria-label={field.name}
                          aria-pressed={checked}
                          onClick={() => setValue(field.name, !checked)}
                          className={cn(box, 'grid place-items-center font-bold leading-none')}
                        >
                          {checked ? '✓' : ''}
                        </button>
                      )
                    }
                    if (field.type === 'radio') {
                      const option = field.options[index] ?? ''
                      const active = values[field.name] === option
                      return (
                        <button
                          key={key}
                          type="button"
                          style={style}
                          aria-label={`${field.name}: ${option || `option ${index + 1}`}`}
                          aria-pressed={active}
                          onClick={() => setValue(field.name, active ? '' : option)}
                          className={cn(box, 'grid place-items-center rounded-full leading-none')}
                        >
                          {active ? '●' : ''}
                        </button>
                      )
                    }
                    if (field.type === 'dropdown' || field.type === 'optionlist') {
                      const current = Array.isArray(values[field.name])
                        ? (values[field.name] as string[])[0] ?? ''
                        : String(values[field.name] ?? '')
                      return (
                        <select
                          key={key}
                          style={style}
                          aria-label={field.name}
                          value={current}
                          onChange={(e) =>
                            setValue(
                              field.name,
                              field.type === 'optionlist'
                                ? e.target.value
                                  ? [e.target.value]
                                  : []
                                : e.target.value,
                            )
                          }
                          className={cn(box, 'bg-background/90')}
                        >
                          <option value="">–</option>
                          {field.options.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      )
                    }
                    return (
                      <input
                        key={key}
                        type="text"
                        style={style}
                        aria-label={field.name}
                        value={String(values[field.name] ?? '')}
                        maxLength={field.maxLength}
                        onChange={(e) => setValue(field.name, e.target.value)}
                        className={box}
                      />
                    )
                  })
                : null}
            </div>
          </div>
        </ToolPanel>
      ) : null}

      {fillable.length > 0 ? (
        <ToolPanel
          title="All fields"
          description="Every field in the document, including the ones on pages you have not scrolled to. Fully keyboard operable."
        >
          <div className="space-y-4">
            {fields.map((field) => {
              const inputId = `${ids}-${field.name.replace(/[^a-zA-Z0-9]+/g, '-')}`
              const pageList = [...new Set(field.widgets.map((w) => w.page))]
              return (
                <div key={field.name} className="space-y-1.5 border-b border-border pb-4 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor={inputId} className="text-sm font-medium">
                      {field.name}
                    </Label>
                    <span className="text-xs text-muted-foreground">{TYPE_LABEL[field.type]}</span>
                    {field.required ? <span className="text-xs font-medium">Required</span> : null}
                    {field.readOnly ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="size-3" aria-hidden="true" />
                        Read-only
                      </span>
                    ) : null}
                    {pageList.length > 0 ? (
                      <button
                        type="button"
                        className="text-xs text-primary underline"
                        onClick={() => setPageNo(pageList[0])}
                      >
                        page {pageList.join(', ')}
                      </button>
                    ) : null}
                  </div>

                  {field.type === 'text' && field.multiline ? (
                    <Textarea
                      id={inputId}
                      rows={3}
                      disabled={field.readOnly}
                      maxLength={field.maxLength}
                      value={String(values[field.name] ?? '')}
                      onChange={(e) => setValue(field.name, e.target.value)}
                    />
                  ) : null}

                  {field.type === 'text' && !field.multiline ? (
                    <Input
                      id={inputId}
                      disabled={field.readOnly}
                      maxLength={field.maxLength}
                      value={String(values[field.name] ?? '')}
                      onChange={(e) => setValue(field.name, e.target.value)}
                    />
                  ) : null}

                  {field.type === 'checkbox' ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        id={inputId}
                        type="checkbox"
                        className="size-4 accent-primary"
                        disabled={field.readOnly}
                        checked={values[field.name] === true}
                        onChange={(e) => setValue(field.name, e.target.checked)}
                      />
                      Ticked
                    </label>
                  ) : null}

                  {(field.type === 'radio' || field.type === 'dropdown') && field.options.length > 0 ? (
                    <Select
                      value={String(values[field.name] ?? '')}
                      onValueChange={(v) => setValue(field.name, v === '__none' ? '' : v)}
                    >
                      <SelectTrigger id={inputId} disabled={field.readOnly}>
                        <SelectValue placeholder="Not answered" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Not answered</SelectItem>
                        {field.options.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}

                  {field.type === 'optionlist' ? (
                    <div className="flex flex-wrap gap-2">
                      {field.options.map((o) => {
                        const current = Array.isArray(values[field.name])
                          ? (values[field.name] as string[])
                          : []
                        const on = current.includes(o)
                        return (
                          <button
                            key={o}
                            type="button"
                            aria-pressed={on}
                            disabled={field.readOnly}
                            onClick={() =>
                              setValue(
                                field.name,
                                on ? current.filter((c) => c !== o) : [...current, o],
                              )
                            }
                            className={cn(
                              'rounded-md border px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                              on
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-input bg-background text-foreground hover:bg-muted',
                            )}
                          >
                            {o}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}

                  {field.type === 'signature' ? (
                    <p className="text-sm text-muted-foreground">
                      A digital-signature placeholder. We do not issue certificates, so this stays
                      empty. Place a visual signature with{' '}
                      <a href="/sign-pdf" className="text-primary underline">
                        Sign PDF
                      </a>{' '}
                      instead.
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </ToolPanel>
      ) : null}

      <ToolPanel
        title="Save the filled form"
        description={`${file.name} · ${formatBytes(file.size)}`}
      >
        {busy ? <ProgressPanel label="Writing your answers into the PDF…" /> : null}
        {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-muted p-3">
            <h3 className="text-sm font-semibold text-foreground">Keep it editable</h3>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">
              The fields stay live, so the next person can change an answer. Best while a form is
              still going round.
            </p>
            <Button type="button" size="sm" disabled={busy} onClick={() => void build(false)}>
              Build editable PDF
            </Button>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <h3 className="text-sm font-semibold text-foreground">Flatten it</h3>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">
              The answers become part of the page. Nothing can be retyped, and every reader shows it
              the same way. Use this for the copy you send back.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void build(true)}
            >
              Build flattened PDF
            </Button>
          </div>
        </div>
        {resultBlob ? (
          <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
            <DownloadButton
              blob={resultBlob}
              filename={outputName(file.name, resultLabel === 'flattened' ? '-filled-flat' : '-filled')}
              label={`Download the ${resultLabel} PDF`}
            />
            <span className="text-sm text-muted-foreground">
              {plural(filledCount, 'field')} filled in.
            </span>
          </div>
        ) : null}
      </ToolPanel>
    </div>
  )
}

export default PdfEditFillForm
