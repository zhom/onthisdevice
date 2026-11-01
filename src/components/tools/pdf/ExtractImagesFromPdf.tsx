import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, nextFrame } from '@/lib/utils'
import { humanPdfError, loadPdfLib, readFileBytes } from './pdf-pages-core'
import { extractImages } from './pdf-pages-images'
import type { ExtractedImage, SkippedImage } from './pdf-pages-images'
import { NumberField, ProofPanel } from './pdf-pages-ui'

interface Gallery {
  images: (ExtractedImage & { url: string })[]
  skipped: SkippedImage[]
  totalBytes: number
  originals: number
}

export default function ExtractImagesFromPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [minSide, setMinSide] = useState(32)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [gallery, setGallery] = useState<Gallery | null>(null)
  const [zip, setZip] = useState<Blob | null>(null)
  const [zipping, setZipping] = useState(false)

  const urlsRef = useRef<string[]>([])

  const releaseUrls = useCallback(() => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url)
    urlsRef.current = []
  }, [])

  useEffect(() => releaseUrls, [releaseUrls])

  const onFiles = useCallback(
    (files: File[]) => {
      const next = files[0]
      if (!next) return
      releaseUrls()
      setFile(next)
      setGallery(null)
      setZip(null)
      setError(null)
    },
    [releaseUrls],
  )

  const scan = useCallback(async () => {
    if (!file) return
    releaseUrls()
    setBusy(true)
    setError(null)
    setGallery(null)
    setZip(null)
    setProgress(0)
    setStatus('Opening the document…')

    try {
      const bytes = await readFileBytes(file)
      const lib = await loadPdfLib()
      const doc = await lib.PDFDocument.load(bytes, {
        ignoreEncryption: true,
        updateMetadata: false,
      })

      setStatus('Looking for embedded images…')
      const result = await extractImages(lib, doc, {
        minSide,
        onProgress: (done, total) => {
          setProgress(total > 0 ? Math.round((done / total) * 100) : 0)
          setStatus(`Checking image ${done} of ${total}…`)
        },
        shouldYield: nextFrame,
      })

      const withUrls = result.images.map((image) => {
        const url = URL.createObjectURL(image.blob)
        urlsRef.current.push(url)
        return { ...image, url }
      })

      setGallery({
        images: withUrls,
        skipped: result.skipped,
        totalBytes: withUrls.reduce((sum, i) => sum + i.blob.size, 0),
        originals: withUrls.filter((i) => i.original).length,
      })
      setProgress(100)
      setStatus('')
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
    }
  }, [file, minSide, releaseUrls])

  const buildZip = useCallback(async () => {
    if (!gallery || gallery.images.length === 0) return
    setZipping(true)
    try {
      const JSZip = (await import('jszip')).default
      const archive = new JSZip()
      for (const image of gallery.images) archive.file(image.filename, image.blob)
      // Images are already compressed; STORE keeps zipping fast on large sets.
      const blob = await archive.generateAsync({ type: 'blob', compression: 'STORE' })
      setZip(blob)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The ZIP could not be built.')
    } finally {
      setZipping(false)
    }
  }, [gallery])

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={onFiles}
          title="Drop a PDF to pull out its images"
          hint="or click to browse"
        />
        <ProofPanel what="Your PDF" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Find embedded images"
        description="This reads the pictures that were placed into the PDF, at the resolution they were stored in. It does not take a screenshot of the page."
      >
        {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

        <p className="truncate text-sm text-muted-foreground" title={file.name}>
          {file.name} · {formatBytes(file.size)}
        </p>

        <NumberField
          label="Ignore images smaller than"
          suffix="px"
          min={1}
          max={1000}
          value={minSide}
          onChange={setMinSide}
          hint="Filters out the 1 × 1 spacers, gradient strips and hairline rules that documents are full of."
          className="max-w-xs"
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" className="gap-2" onClick={() => void scan()} disabled={busy}>
            <ImageDown className="size-4" aria-hidden="true" />
            {busy ? 'Scanning…' : 'Extract images'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              releaseUrls()
              setFile(null)
              setGallery(null)
              setZip(null)
              setError(null)
            }}
            disabled={busy}
          >
            Use a different file
          </Button>
        </div>
      </ToolPanel>

      {busy && <ProgressPanel label={status || 'Scanning…'} value={progress} />}

      {gallery && (
        <ToolPanel title={`${gallery.images.length} image${gallery.images.length === 1 ? '' : 's'} found`}>
          {gallery.images.length === 0 ? (
            <p className="text-sm text-muted-foreground text-pretty">
              No embedded images passed the filter. If this PDF is a scan, the whole page is one
              picture. Lower the size filter to catch it, or use a PDF-to-JPG converter to render
              pages instead. If the artwork is line drawings or charts, it is probably vector
              graphics, which are drawing instructions rather than images and cannot be exported
              this way.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <ResultStat label="Images" value={gallery.images.length} emphasis />
                <ResultStat
                  label="Untouched originals"
                  value={`${gallery.originals} of ${gallery.images.length}`}
                  hint="JPEGs written out byte-for-byte"
                />
                <ResultStat label="Total size" value={formatBytes(gallery.totalBytes)} />
              </div>

              <div className="flex flex-wrap gap-2">
                {zip ? (
                  <DownloadButton
                    blob={zip}
                    filename="extracted-images.zip"
                    label="Download all (.zip)"
                  />
                ) : (
                  <Button type="button" onClick={() => void buildZip()} disabled={zipping}>
                    {zipping ? 'Building ZIP…' : 'Prepare ZIP of all images'}
                  </Button>
                )}
              </div>

              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {gallery.images.map((image) => (
                  <li
                    key={image.key}
                    className="flex flex-col gap-2 rounded-lg bg-card p-2"
                  >
                    <div className="grid aspect-square place-items-center overflow-hidden rounded-md bg-muted">
                      <img
                        src={image.url}
                        alt={`Embedded image ${image.index}, ${image.width} by ${image.height} pixels, from page ${image.pages.join(', ')}`}
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs tabular-nums text-foreground">
                        {image.width} × {image.height}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Page {image.pages.slice(0, 3).join(', ')}
                        {image.pages.length > 3 ? ` +${image.pages.length - 3}` : ''} ·{' '}
                        {formatBytes(image.blob.size)}
                      </p>
                      <p className="text-[11px] font-medium">
                        {image.original ? `Original .${image.ext}` : `.${image.ext}`}
                      </p>
                    </div>
                    <DownloadButton
                      blob={image.blob}
                      filename={image.filename}
                      label="Save"
                      size="sm"
                      variant="outline"
                      className="w-full"
                    />
                  </li>
                ))}
              </ul>
            </>
          )}

          {gallery.skipped.length > 0 && (
            <details className="rounded-lg bg-muted px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                {gallery.skipped.length} image object
                {gallery.skipped.length === 1 ? ' was' : 's were'} skipped (see why)
              </summary>
              <ul className="mt-3 space-y-1.5 text-muted-foreground">
                {gallery.skipped.slice(0, 40).map((item) => (
                  <li key={item.key} className="text-pretty">
                    <span className="tabular-nums">
                      {item.width} × {item.height}
                    </span>{' '}
                    on page {item.pages.join(', ')}: {item.reason}
                  </li>
                ))}
                {gallery.skipped.length > 40 && (
                  <li>…and {gallery.skipped.length - 40} more.</li>
                )}
              </ul>
            </details>
          )}
        </ToolPanel>
      )}

      <ProofPanel what="Your PDF and every image in it" />
    </div>
  )
}
