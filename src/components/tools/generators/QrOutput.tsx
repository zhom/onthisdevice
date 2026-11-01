import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { downloadBlob } from '@/lib/utils'
import { CheckerSurface } from './GenUi'
import type { EccLevel, LoadedImage } from './qrlib'
import { canvasToPngBlob, createMatrix, drawQr, payloadByteLength, qrToSvg } from './qrlib'

export interface QrOutputProps {
  /** The exact string encoded into the symbol. Empty renders the idle state. */
  payload: string
  ecc: EccLevel
  size: number
  margin: number
  dark: string
  /** `null` renders a transparent background. */
  light: string | null
  logo?: LoadedImage | null
  logoScale?: number
  logoPadded?: boolean
  /** Filename stem for the downloads, without an extension. */
  filename: string
  /** Shown above the payload readout, e.g. "Wi-Fi payload". */
  payloadLabel?: string
  /** Copy shown in the empty state before anything has been typed. */
  emptyHint?: string
}

/**
 * Renders a QR symbol to a canvas at full export resolution, and offers the
 * PNG and SVG downloads. Everything is recomputed synchronously — a version-40
 * symbol is roughly 30k modules, which is well under one frame of work.
 */
export function QrOutput({
  payload,
  ecc,
  size,
  margin,
  dark,
  light,
  logo,
  logoScale = 0.2,
  logoPadded = true,
  filename,
  payloadLabel = 'Encoded text',
  emptyHint = 'Type something above and the QR code appears here.',
}: QrOutputProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const style = useMemo(() => ({ size, margin, dark, light }), [size, margin, dark, light])

  const built = useMemo(() => {
    if (payload.length === 0) return { matrix: null, failure: null }
    try {
      return { matrix: createMatrix(payload, ecc), failure: null }
    } catch (err) {
      return {
        matrix: null,
        failure: err instanceof Error ? err.message : 'The QR code could not be generated.',
      }
    }
  }, [payload, ecc])

  const matrix = built.matrix

  useEffect(() => {
    setError(built.failure)
    const canvas = canvasRef.current
    if (!canvas || !matrix) return
    try {
      drawQr(
        canvas,
        matrix,
        style,
        logo ? { image: logo.image, scale: logoScale, padded: logoPadded, aspect: logo.aspect } : null,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The QR code could not be drawn.')
    }
  }, [built.failure, matrix, style, logo, logoScale, logoPadded])

  const svg = useMemo(() => {
    if (!matrix) return ''
    try {
      return qrToSvg(
        matrix,
        style,
        logo ? { href: logo.dataUri, scale: logoScale, padded: logoPadded, aspect: logo.aspect } : null,
      )
    } catch {
      return ''
    }
  }, [matrix, style, logo, logoScale, logoPadded])

  const downloadPng = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setBusy(true)
    try {
      const blob = await canvasToPngBlob(canvas)
      downloadBlob(blob, `${filename}.png`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The PNG could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const downloadSvg = () => {
    if (!svg) return
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`)
  }

  if (payload.length === 0) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-lg bg-muted p-6 text-center">
        <p className="text-sm text-pretty text-muted-foreground">{emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <CheckerSurface className="w-full">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Generated QR code preview"
          className="block h-auto w-full max-w-[320px] rounded-sm"
        />
      </CheckerSurface>

      <div
        role="status"
        aria-live="polite"
        className="flex flex-wrap items-center justify-center gap-2 text-xs"
      >
        {matrix ? (
          <>
            <Badge variant="secondary">Version {matrix.version}</Badge>
            <Badge variant="secondary">
              {matrix.size} × {matrix.size} modules
            </Badge>
            <Badge variant="secondary">Level {ecc}</Badge>
            <Badge variant="secondary">{payloadByteLength(payload)} bytes</Badge>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={() => void downloadPng()} disabled={busy || !matrix}>
          Download PNG
        </Button>
        <Button type="button" variant="outline" onClick={downloadSvg} disabled={!svg}>
          Download SVG
        </Button>
        <CopyButton value={payload} label="Copy payload" />
      </div>

      <details className="rounded-lg bg-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground hover:bg-muted">
          {payloadLabel}: see what is encoded
        </summary>
        <div className="border-t border-border px-4 py-3">
          <pre className="overflow-x-auto font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {payload}
          </pre>
        </div>
      </details>
    </div>
  )
}
