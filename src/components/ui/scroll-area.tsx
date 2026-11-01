/**
 * `@radix-ui/react-scroll-area` is not installed in this project, so this is a
 * dependency-free implementation that exposes the same public API as the
 * shadcn/ui component: `<ScrollArea>` wraps its children in a scrollable
 * viewport, and `<ScrollBar orientation>` is accepted (and ignored) so existing
 * shadcn markup keeps working. Native scrollbars are styled to match the theme
 * and the viewport is focusable so it stays keyboard-scrollable.
 */
import * as React from 'react'

import { cn } from '@/lib/utils'

function ScrollArea({
  className,
  children,
  type,
  scrollHideDelay,
  ...props
}: React.ComponentProps<'div'> & {
  /** Accepted for shadcn/Radix API parity; native scrollbars are always used. */
  type?: 'auto' | 'always' | 'scroll' | 'hover'
  /** Accepted for shadcn/Radix API parity; unused. */
  scrollHideDelay?: number
}) {
  void type
  void scrollHideDelay

  return (
    <div
      data-slot="scroll-area"
      className={cn('relative overflow-hidden', className)}
      {...props}
    >
      <div
        data-slot="scroll-area-viewport"
        tabIndex={0}
        className={cn(
          'size-full overflow-auto rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring',
          '[scrollbar-color:var(--input)_transparent] [scrollbar-width:thin]',
          '[&::-webkit-scrollbar]:size-2.5',
          '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[3px] [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-input [&::-webkit-scrollbar-thumb]:bg-clip-content',
          '[&::-webkit-scrollbar-track]:bg-transparent',
          '[&::-webkit-scrollbar-corner]:bg-transparent',
        )}
      >
        {children}
      </div>
    </div>
  )
}

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<'div'> & {
  orientation?: 'vertical' | 'horizontal'
}) {
  void className
  void orientation
  void props
  // Native scrollbars are rendered by the viewport above; nothing to draw here.
  return null
}

export { ScrollArea, ScrollBar }
