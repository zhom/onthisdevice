import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground md:text-sm placeholder:text-muted-foreground selection:bg-foreground selection:text-background transition-[border-color,box-shadow] duration-150 outline-none',
        'focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground',
        'aria-invalid:border-foreground aria-invalid:ring-1 aria-invalid:ring-foreground',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
