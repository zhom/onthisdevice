import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface FormulaProps {
  children?: ReactNode
  caption?: ReactNode
  className?: string
}

/**
 * A monospace block showing the formula (and the substituted working) behind a
 * calculator's result. Wide expressions scroll inside their own container.
 */
export function Formula({ children, caption, className }: FormulaProps) {
  return (
    <figure className={cn('w-full', className)}>
      <div className="overflow-x-auto rounded-lg bg-muted px-4 py-3">
        <pre className="w-max min-w-full whitespace-pre font-mono text-sm leading-relaxed text-foreground">
          {children}
        </pre>
      </div>
      {caption ? (
        <figcaption className="mt-2 text-[0.8125rem] text-muted-foreground text-pretty">{caption}</figcaption>
      ) : null}
    </figure>
  )
}
