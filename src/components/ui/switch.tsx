import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-[background-color] duration-200 ease-(--ease-out) outline-none data-[state=unchecked]:bg-input data-[state=checked]:bg-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-5 translate-x-0.5 rounded-full bg-background transition-transform duration-200 ease-(--ease-out) data-[state=checked]:translate-x-[1.125rem]',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
