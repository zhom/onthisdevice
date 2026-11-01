import { useEffect, useState } from 'react'
import { copyBytes, humanPdfError, readFileBytes } from './pdf-shared'

export interface PagePreview {
  /** Object URL of the rendered bitmap. */
  url: string
  /** Bitmap size in CSS pixels. */
  w: number
  h: number
  /** Displayed page size in PDF points (the file's own /Rotate applied). */
  widthPt: number
  heightPt: number
  page: number
}

export interface SinglePagePreviewState {
  preview: PagePreview | null
  pageCount: number
  loading: boolean
  error: string | null
}

/** Render one page of a PDF at a readable size, for live option previews. */
export function useSinglePagePreview(
  file: File | null,
  page: number,
  targetWidth = 320,
): SinglePagePreviewState {
  const [state, setState] = useState<SinglePagePreviewState>({
    preview: null,
    pageCount: 0,
    loading: false,
    error: null,
  })

  useEffect(() => {
    if (!file) {
      setState({ preview: null, pageCount: 0, loading: false, error: null })
      return
    }

    let cancelled = false
    let created: string | null = null

    const run = async () => {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const bytes = await readFileBytes(file)
        const { pdfjs } = await import('./pdfjs-worker')
        const doc = await pdfjs.getDocument({ data: copyBytes(bytes) })
          .promise
        if (cancelled) {
          void doc.loadingTask.destroy()
          return
        }
        const total = doc.numPages
        const wanted = Math.min(Math.max(1, page), total)
        const pdfPage = await doc.getPage(wanted)
        const base = pdfPage.getViewport({ scale: 1 })
        const scale = Math.min(targetWidth / base.width, 3)
        const viewport = pdfPage.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(viewport.width))
        canvas.height = Math.max(1, Math.round(viewport.height))
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('This browser would not give us a 2D canvas to draw on.')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await pdfPage.render({ canvas, viewport }).promise
        pdfPage.cleanup()
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.85),
        )
        void doc.loadingTask.destroy()
        if (cancelled) return
        const url = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/jpeg', 0.85)
        if (blob) created = url
        setState({
          preview: {
            url,
            w: canvas.width,
            h: canvas.height,
            widthPt: base.width,
            heightPt: base.height,
            page: wanted,
          },
          pageCount: total,
          loading: false,
          error: null,
        })
      } catch (err) {
        if (cancelled) return
        setState({
          preview: null,
          pageCount: 0,
          loading: false,
          error: humanPdfError(err, file.name),
        })
      }
    }

    void run()

    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [file, page, targetWidth])

  return state
}
