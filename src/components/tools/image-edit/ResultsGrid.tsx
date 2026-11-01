import { useState, type CSSProperties } from 'react'
import { Archive, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { downloadBlob, formatBytes } from '@/lib/utils'
import { savingsPercent, zipItems, type ProcessedItem } from './image-utils'

/** Transparent-area checkerboard that works in both themes (token based). */
export const CHECKER_STYLE: CSSProperties = {
  backgroundImage:
    'repeating-conic-gradient(color-mix(in oklch, var(--foreground) 9%, transparent) 0% 25%, transparent 0% 50%)',
  backgroundSize: '16px 16px',
}

export interface ResultsGridProps {
  items: ProcessedItem[]
  /** Base name used for the ZIP download, without the extension. */
  zipName: string
  onReset?: () => void
  /** Show the "saved x%" figure against the original file size. */
  showSavings?: boolean
  /** Checkerboard behind previews (for transparent output). */
  transparent?: boolean
}

export function ResultsGrid({
  items,
  zipName,
  onReset,
  showSavings = false,
  transparent = false,
}: ResultsGridProps) {
  const [zipping, setZipping] = useState(false)
  if (items.length === 0) return null

  const totalIn = items.reduce((sum, i) => sum + i.originalSize, 0)
  const totalOut = items.reduce((sum, i) => sum + i.blob.size, 0)
  const saved = savingsPercent(totalIn, totalOut)

  async function downloadZip() {
    setZipping(true)
    try {
      const blob = await zipItems(items)
      downloadBlob(blob, `${zipName}.zip`)
    } finally {
      setZipping(false)
    }
  }

  return (
    <section aria-label="Results" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">
            {items.length} {items.length === 1 ? 'image' : 'images'} ready
          </h3>
          {showSavings && (
            <p className="text-sm text-muted-foreground">
              {formatBytes(totalIn)} → {formatBytes(totalOut)}{' '}
              <span className={saved > 0 ? 'text-success' : 'text-muted-foreground'}>
                ({saved > 0 ? `${saved}% smaller` : saved < 0 ? `${-saved}% larger` : 'no change'})
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {items.length > 1 && (
            <Button onClick={downloadZip} disabled={zipping}>
              <Archive className="size-4" aria-hidden="true" />
              {zipping ? 'Building ZIP…' : `Download all (${items.length}) as ZIP`}
            </Button>
          )}
          {onReset && (
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Start over
            </Button>
          )}
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const delta = savingsPercent(item.originalSize, item.blob.size)
          return (
            <li
              key={item.id}
              className="flex flex-col overflow-hidden rounded-lg bg-card"
            >
              <div
                className="flex h-40 items-center justify-center overflow-hidden border-b border-border p-2"
                style={transparent ? CHECKER_STYLE : undefined}
              >
                <img
                  src={item.url}
                  alt={`Preview of ${item.name}`}
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="truncate text-sm font-medium" title={item.name}>
                  {item.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.width} × {item.height} px · {formatBytes(item.blob.size)}
                  {showSavings && item.originalSize > 0 && (
                    <>
                      {' '}
                      · {delta > 0 ? `−${delta}%` : delta < 0 ? `+${-delta}%` : '±0%'} vs{' '}
                      {formatBytes(item.originalSize)}
                    </>
                  )}
                </p>
                <div className="mt-auto pt-1">
                  <DownloadButton blob={item.blob} filename={item.name} label="Download" />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
