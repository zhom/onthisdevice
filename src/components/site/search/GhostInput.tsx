import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> {
  value: string
  /** A lowercase phrase that starts with the value; its rest shows as grey text after the caret. */
  completion?: string
  /** Shared by the input and the grey layer: padding, font size, weight. */
  textClassName: string
}

/** The rest of a completion, or "" when it does not continue what was typed. */
export function completionRest(value: string, completion: string | undefined): string {
  if (!completion || !value.trim() || value.length > 48) return ''
  return completion.startsWith(value.toLowerCase()) ? completion.slice(value.length) : ''
}

/**
 * A text input with inline completion: the rest of the best match shows in grey after what was
 * typed. The grey layer sits behind a transparent input and repeats the typed text invisibly, so
 * the two line up exactly.
 */
export const GhostInput = forwardRef<HTMLInputElement, Props>(function GhostInput(
  { value, completion, textClassName, className, ...rest },
  ref,
) {
  const tail = completionRest(value, completion)
  return (
    <span className={cn('relative block min-w-0', className)}>
      {tail && (
        <span
          aria-hidden="true"
          className={cn('pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre', textClassName)}
        >
          <span className="invisible">{value}</span>
          <span className="text-muted-foreground">{tail}</span>
        </span>
      )}
      <input
        ref={ref}
        value={value}
        className={cn('relative block w-full bg-transparent outline-none', textClassName)}
        {...rest}
      />
    </span>
  )
})
