import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface ToolPanelProps {
  title?: ReactNode
  description?: ReactNode
  footer?: ReactNode
  className?: string
  children?: ReactNode
}

/** The standard wrapper for a tool's working area: a fill block, no border. */
export function ToolPanel({ title, description, footer, className, children }: ToolPanelProps) {
  const hasHeader = title !== undefined && title !== null && title !== false
  const hasDescription = description !== undefined && description !== null && description !== false

  return (
    <Card className={cn('w-full', className)}>
      {(hasHeader || hasDescription) && (
        <CardHeader>
          {hasHeader && <CardTitle className="text-[1.0625rem] font-[680]">{title}</CardTitle>}
          {hasDescription && <CardDescription className="text-pretty">{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className="space-y-4">{children}</CardContent>
      {footer ? <CardFooter className="flex flex-wrap items-center gap-2">{footer}</CardFooter> : null}
    </Card>
  )
}
