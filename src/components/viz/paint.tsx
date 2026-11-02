import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/**
 * Series are told apart by ink, one grey and patterns, never by colour.
 * `ink` solid foreground, `grey` solid muted-foreground, `hatch` diagonal ink
 * lines, `dots` ink dots, `paper` the page colour (a hole in a fill).
 */
export type Paint = 'ink' | 'grey' | 'hatch' | 'dots' | 'paper'

/** Line styles for line charts. */
export type Stroke = 'solid' | 'dash' | 'grey' | 'dot'

export const PAINT_ORDER: Paint[] = ['ink', 'hatch', 'grey', 'dots']
export const STROKE_ORDER: Stroke[] = ['solid', 'dash', 'grey', 'dot']

/** SVG <pattern> defs for one chart. Pass the chart's unique id prefix. */
export function PaintDefs({ uid }: { uid: string }) {
  return (
    <defs>
      <pattern id={`${uid}-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="1.6" height="5" style={{ fill: 'var(--foreground)' }} />
      </pattern>
      <pattern id={`${uid}-dots`} width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="2.5" cy="2.5" r="1.1" style={{ fill: 'var(--foreground)' }} />
      </pattern>
    </defs>
  )
}

/** CSS fill value for a paint inside a chart that rendered <PaintDefs uid>. */
export function fillOf(paint: Paint, uid: string): string {
  switch (paint) {
    case 'ink':
      return 'var(--foreground)'
    case 'grey':
      return 'var(--muted-foreground)'
    case 'paper':
      return 'var(--background)'
    case 'hatch':
      return `url(#${uid}-hatch)`
    case 'dots':
      return `url(#${uid}-dots)`
  }
}

/** SVG stroke props for a line style. */
export function strokeOf(stroke: Stroke): CSSProperties {
  switch (stroke) {
    case 'solid':
      return { stroke: 'var(--foreground)', strokeWidth: 2 }
    case 'dash':
      return { stroke: 'var(--foreground)', strokeWidth: 2, strokeDasharray: '6 4' }
    case 'grey':
      return { stroke: 'var(--muted-foreground)', strokeWidth: 2 }
    case 'dot':
      return { stroke: 'var(--foreground)', strokeWidth: 2, strokeDasharray: '1 4', strokeLinecap: 'round' }
  }
}

/** CSS background for HTML drawn in a paint (swatches, bar lists). */
export function paintBackground(paint: Paint): CSSProperties {
  switch (paint) {
    case 'ink':
      return { background: 'var(--foreground)' }
    case 'grey':
      return { background: 'var(--muted-foreground)' }
    case 'paper':
      return { background: 'var(--background)', boxShadow: 'inset 0 0 0 1px var(--muted-foreground)' }
    case 'hatch':
      return {
        background:
          'repeating-linear-gradient(45deg, var(--foreground) 0 1.6px, transparent 1.6px 3.6px)',
        boxShadow: 'inset 0 0 0 1px var(--foreground)',
      }
    case 'dots':
      return {
        background: 'radial-gradient(circle, var(--foreground) 0 1.1px, transparent 1.3px) 0 0 / 4px 4px',
        boxShadow: 'inset 0 0 0 1px var(--foreground)',
      }
  }
}

/** A 12 px legend swatch for a fill paint or a line stroke. */
export function Swatch({ paint, stroke, className }: { paint?: Paint; stroke?: Stroke; className?: string }) {
  if (stroke) {
    const s = strokeOf(stroke)
    return (
      <svg aria-hidden="true" width="18" height="12" viewBox="0 0 18 12" className={cn('shrink-0', className)}>
        <line x1="1" y1="6" x2="17" y2="6" style={{ ...s, strokeLinecap: 'round' }} />
      </svg>
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-3 shrink-0 rounded-[3px]', className)}
      style={paintBackground(paint ?? 'ink')}
    />
  )
}
