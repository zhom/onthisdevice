import { memo } from 'react'
import type { CSSProperties } from 'react'
import { GLYPH_SIZE, glyphCells } from '@/lib/glyphs'
import { cn } from '@/lib/utils'

/**
 * A category's pixel glyph for React lists; the same markup as Glyph.astro, so motion.css
 * animates it. `live` plays the frames (input to output); otherwise it shows frame 0.
 */
export const Glyph = memo(function Glyph({ id, live = false, className }: { id: string; live?: boolean; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${GLYPH_SIZE} ${GLYPH_SIZE}`}
      className={cn('glyph shrink-0 fill-current', live && 'is-live', className)}
      aria-hidden="true"
      focusable="false"
    >
      {glyphCells(id).map((c) => {
        const moving = c.mask !== 15
        return (
          <rect
            key={`${c.x}.${c.y}`}
            x={c.x + 0.09}
            y={c.y + 0.09}
            width="0.82"
            height="0.82"
            rx="0.1"
            className={moving ? cn('g', `gm${c.mask}`, !(c.mask & 1) && 'o') : undefined}
            style={moving ? ({ '--x': c.x } as CSSProperties) : undefined}
          />
        )
      })}
    </svg>
  )
})
