import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// One ink block for the main action. Status is in words, so destructive is ink too.
// Outline and secondary use an inset hairline, so the 2px focus ring stays outside.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-[600] cursor-pointer select-none transition-[background-color,color,box-shadow,text-decoration-color,scale] duration-150 ease-(--ease-out) active:scale-[0.97] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        destructive: 'bg-primary text-primary-foreground',
        outline: 'bg-background text-foreground inset-ring-1 inset-ring-input hover:bg-muted',
        secondary:
          'bg-secondary text-secondary-foreground hover:inset-ring-1 hover:inset-ring-input',
        ghost: 'text-foreground hover:bg-muted',
        link: 'text-foreground underline underline-offset-4 decoration-muted-foreground hover:decoration-foreground',
      },
      size: {
        default: 'h-10 px-4 has-[>svg]:px-3.5',
        sm: 'h-9 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-11 px-6 has-[>svg]:px-5 text-[0.9375rem]',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
