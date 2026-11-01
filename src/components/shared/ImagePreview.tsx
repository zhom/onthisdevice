import { useObjectUrl } from '@/hooks/useObjectUrl'
import { cn } from '@/lib/utils'

export interface ImagePreviewProps {
  file: File | Blob | null
  alt?: string
  className?: string
}

/**
 * Renders a Blob/File as an image. The object URL is created on mount and
 * revoked whenever the source changes or the component unmounts.
 */
export function ImagePreview({ file, alt = 'Preview', className }: ImagePreviewProps) {
  const url = useObjectUrl(file)
  if (!url) return null

  return (
    <img
      src={url}
      alt={alt}
      className={cn(
        'block h-auto max-w-full rounded-lg bg-muted object-contain motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300',
        className,
      )}
    />
  )
}
