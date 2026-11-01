import { useEffect, useState } from 'react'
import { copyBytes, humanPdfError, readFileBytes } from './pdf-shared'

export interface PdfThumbnail {
  /** 1-based page number in the source document. */
  page: number
  /** Object URL of the rendered preview. */
  url: string
  /** Preview bitmap size in CSS pixels. */
  w: number
  h: number
  /** Page size in PDF points, with the file's own /Rotate already applied. */
  widthPt: number
  heightPt: number
}

export interface ThumbnailsState {
  pages: PdfThumbnail[]
  pageCount: number
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** 0-100 while rendering. */
  progress: number
  error: string | null
}

const IDLE: ThumbnailsState = {
  pages: [],
  pageCount: 0,
  status: 'idle',
  progress: 0,
  error: null,
}

/**
 * Render every page of `file` to a small preview bitmap with pdf.js, one page
 * at a time so the UI keeps painting, and clean the object URLs up afterwards.
 */
export function usePdfThumbnails(file: File | null, targetWidth = 150): ThumbnailsState {
  const [state, setState] = useState<ThumbnailsState>(IDLE)

  useEffect(() => {
    if (!file) {
      setState(IDLE)
      return
    }

    let cancelled = false
    const created: string[] = []

    const run = async () => {
      setState({ ...IDLE, status: 'loading' })
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
        setState((s) => ({ ...s, pageCount: total }))
        const pages: PdfThumbnail[] = []

        for (let n = 1; n <= total; n++) {
          if (cancelled) break
          const page = await doc.getPage(n)
          const base = page.getViewport({ scale: 1 })
          const scale = Math.min(targetWidth / base.width, 2)
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(viewport.width))
          canvas.height = Math.max(1, Math.round(viewport.height))
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('This browser would not give us a 2D canvas to draw on.')
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          await page.render({ canvas, viewport }).promise
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', 0.72),
          )
          page.cleanup()
          if (cancelled) break
          const url = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/jpeg', 0.72)
          if (blob) created.push(url)
          pages.push({
            page: n,
            url,
            w: canvas.width,
            h: canvas.height,
            widthPt: base.width,
            heightPt: base.height,
          })
          setState({
            pages: [...pages],
            pageCount: total,
            status: n === total ? 'ready' : 'loading',
            progress: Math.round((n / total) * 100),
            error: null,
          })
        }

        void doc.loadingTask.destroy()
      } catch (err) {
        if (cancelled) return
        setState({
          pages: [],
          pageCount: 0,
          status: 'error',
          progress: 0,
          error: humanPdfError(err, file.name),
        })
      }
    }

    void run()

    return () => {
      cancelled = true
      for (const url of created) URL.revokeObjectURL(url)
    }
  }, [file, targetWidth])

  return state
}
