import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

export interface CopyButtonProps {
  value: string
  label?: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

/** Copies text to the clipboard, with a legacy fallback for non-secure contexts. */
function legacyCopy(value: string): boolean {
  if (typeof document === 'undefined') return false
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)

  const selection = document.getSelection()
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }

  textarea.remove()
  if (previous && selection) {
    selection.removeAllRanges()
    selection.addRange(previous)
  }
  return ok
}

export function CopyButton({
  value,
  label = 'Copy',
  variant = 'outline',
  size = 'sm',
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const flash = useCallback(() => {
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }, [])

  const copy = useCallback(async () => {
    if (typeof window === 'undefined') return
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
        flash()
        return
      }
    } catch {
      /* fall through to the legacy path */
    }
    if (legacyCopy(value)) flash()
  }, [flash, value])

  const iconOnly = size === 'icon'

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn('swap-icon gap-2', className)}
      data-done={copied || undefined}
      onClick={() => {
        void copy()
      }}
      aria-label={iconOnly ? (copied ? 'Copied' : label) : undefined}
      aria-live="polite"
    >
      <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">
        <Copy className="col-start-1 row-start-1 size-4" />
        <Check className="col-start-1 row-start-1 size-4" />
      </span>
      {!iconOnly && <span>{copied ? 'Copied' : label}</span>}
    </Button>
  )
}
