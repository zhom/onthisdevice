import { useEffect, useRef, useState } from 'react'
import { Check, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, downloadBlob, formatBytes } from '@/lib/utils'

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

export interface DownloadButtonProps {
  blob: Blob | null
  filename: string
  label?: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  disabled?: boolean
}

/** Saves a Blob to disk and advertises its size. Disabled until the blob exists. */
export function DownloadButton({
  blob,
  filename,
  label = 'Download',
  variant = 'default',
  size = 'default',
  className,
  disabled = false,
}: DownloadButtonProps) {
  const isDisabled = disabled || blob === null
  const iconOnly = size === 'icon'
  const [saved, setSaved] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <Button
      // Re-mounts when a result arrives, so the arrival plays once per result.
      key={blob ? `ready-${blob.size}` : 'empty'}
      type="button"
      variant={variant}
      size={size}
      className={cn(
        'swap-icon gap-2',
        blob && 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300',
        className,
      )}
      data-done={saved || undefined}
      disabled={isDisabled}
      aria-label={iconOnly ? `${label} ${filename}` : undefined}
      onClick={() => {
        if (!blob) return
        downloadBlob(blob, filename)
        setSaved(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setSaved(false), 1800)
      }}
    >
      <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">
        <Download className="col-start-1 row-start-1 size-4" />
        <Check className="col-start-1 row-start-1 size-4" />
      </span>
      {!iconOnly && (
        <>
          <span className="truncate" aria-live="polite">
            {saved ? 'Saved' : label}
          </span>
          {blob ? (
            <span className="text-xs font-normal tabular-nums">
              {formatBytes(blob.size)}
            </span>
          ) : null}
        </>
      )}
    </Button>
  )
}
