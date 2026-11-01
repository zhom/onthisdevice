import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import type { PdfThumbnail } from './usePdfThumbnails'

export const THUMB_BOX_W = 120
export const THUMB_BOX_H = 158

interface PageThumbProps {
  thumb?: PdfThumbnail
  /** Extra rotation applied on top of the rendered preview, in degrees. */
  rotation?: number
  className?: string
  /** Dim the preview, e.g. for pages queued for deletion. */
  muted?: boolean
}

/**
 * A fixed-size preview box that scales and rotates the rendered page so it
 * always fits, whatever the page aspect ratio is.
 */
export function PageThumb({ thumb, rotation = 0, className, muted }: PageThumbProps) {
  const rot = ((rotation % 360) + 360) % 360
  const swapped = rot === 90 || rot === 270

  let style: CSSProperties = {}
  if (thumb) {
    const boxedW = swapped ? thumb.h : thumb.w
    const boxedH = swapped ? thumb.w : thumb.h
    const scale = Math.min(THUMB_BOX_W / boxedW, THUMB_BOX_H / boxedH)
    style = {
      width: Math.max(1, Math.round(thumb.w * scale)),
      height: Math.max(1, Math.round(thumb.h * scale)),
      transform: `rotate(${rot}deg)`,
    }
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-md bg-muted',
        className,
      )}
      style={{ width: THUMB_BOX_W, height: THUMB_BOX_H }}
    >
      {thumb ? (
        <img
          src={thumb.url}
          alt={`Page ${thumb.page} preview`}
          style={style}
          className={cn(
            'origin-center transition-[transform,opacity] duration-200',
            muted && 'opacity-25',
          )}
          draggable={false}
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-muted" aria-hidden="true" />
      )}
    </div>
  )
}
