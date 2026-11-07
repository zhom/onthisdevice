/**
 * Before and after of an image: the result covers the original up to a handle that the
 * visitor drags (or moves with the arrow keys, through a range input).
 */
import { useId, useState } from 'react'
import type { CSSProperties } from 'react'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { cn } from '@/lib/utils'

/** A two-tone square pattern that shows transparent pixels, in theme colours. */
export const CHECKER: CSSProperties = {
  backgroundColor: 'var(--background)',
  backgroundImage: 'conic-gradient(var(--muted) 25%, transparent 0 50%, var(--muted) 0 75%, transparent 0)',
  backgroundSize: '20px 20px',
}

export function Compare({
  before,
  after,
  width,
  height,
  checker = false,
  pixelated = false,
  className,
}: {
  before: Blob | null
  after: Blob | null
  width: number
  height: number
  /** Show a checker pattern behind the result (it has transparent pixels). */
  checker?: boolean
  /** Draw pixels as squares (to see the detail of an upscale). */
  pixelated?: boolean
  className?: string
}) {
  const id = useId()
  const [at, setAt] = useState(50)
  const beforeUrl = useObjectUrl(before)
  const afterUrl = useObjectUrl(after)
  const img = cn('absolute inset-0 size-full object-contain select-none', pixelated && '[image-rendering:pixelated]')
  return (
    <div className={cn('space-y-2', className)}>
      <div
        className="relative mx-auto max-h-[70vh] w-full overflow-hidden rounded-lg"
        style={{ aspectRatio: `${width} / ${height}`, maxWidth: `min(100%, calc(70vh * ${width / height}))`, ...(checker ? CHECKER : { background: 'var(--muted)' }) }}
      >
        {beforeUrl && <img src={beforeUrl} alt="Original" className={img} draggable={false} />}
        {afterUrl && (
          <img
            src={afterUrl}
            alt="Result"
            className={img}
            draggable={false}
            style={{ clipPath: beforeUrl ? `inset(0 0 0 ${at}%)` : undefined, ...(checker ? CHECKER : {}) }}
          />
        )}
        {afterUrl && beforeUrl && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `calc(${at}% - 1px)` }}>
            <span className="absolute top-1/2 left-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
          </div>
        )}
        {afterUrl && beforeUrl && (
          <input
            id={id}
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={at}
            onChange={(e) => setAt(Number(e.target.value))}
            aria-label="Compare the original (left) and the result (right)"
            className="absolute inset-0 size-full cursor-ew-resize opacity-0"
          />
        )}
      </div>
      {afterUrl && beforeUrl && <p className="text-center text-[0.8125rem] text-muted-foreground">Drag to compare. Original on the left, result on the right.</p>}
    </div>
  )
}
