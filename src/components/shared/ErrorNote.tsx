import type { ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ErrorNoteProps {
  message: ReactNode
  onRetry?: () => void
  title?: string
  className?: string
}

/** An announced error message (icon and words, ink only) with an optional retry action. */
export function ErrorNote({ message, onRetry, title = 'Something went wrong', className }: ErrorNoteProps) {
  return (
    <Alert variant="destructive" role="alert" className={cn('reveal w-full', className)}>
      <AlertTriangle className="size-4" aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-pretty">
        <span className="block">{message}</span>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 gap-2"
            onClick={onRetry}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
