import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-base text-foreground md:text-sm placeholder:text-muted-foreground selection:bg-foreground selection:text-background transition-[border-color,box-shadow] duration-150 outline-none',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        'focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground',
        'aria-invalid:border-foreground aria-invalid:ring-1 aria-invalid:ring-foreground',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
