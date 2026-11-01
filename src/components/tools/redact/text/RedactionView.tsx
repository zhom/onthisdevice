import { Fragment, memo } from 'react'
import type { Piece } from '@/lib/ml/text/placeholders'
import type { Span } from '@/lib/ml/text/types'
import { TYPE_BY_ID } from '@/lib/ml/text/types'
import { cn } from '@/lib/utils'

/** Key that ties "keep" to a value, so every occurrence of it stays visible. */
export function keepKey(span: Span, original: string): string {
  return `${span.type}:${original.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()}`
}

function describe(span: Span): string {
  if (span.source === 'list') return 'Always-hide match'
  return span.label ?? TYPE_BY_ID[span.type]?.name.replace(/s$/, '') ?? span.type
}

interface Props {
  pieces: Piece[]
  spans: Span[]
  kept: ReadonlySet<string>
  onToggle: (key: string) => void
  mono?: boolean
  label?: string
  className?: string
}

/**
 * The redacted text. Hidden items are inverted marks with their replacement;
 * press one to keep the original (underlined), press again to hide it.
 */
export const RedactionView = memo(function RedactionView({ pieces, spans, kept, onToggle, mono, label = 'Redacted text', className }: Props) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        'max-h-[32rem] min-h-40 overflow-auto rounded-lg bg-background p-3 text-[0.9375rem] leading-7 break-words whitespace-pre-wrap text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
        mono && 'font-mono text-[0.8125rem] leading-6',
        className,
      )}
    >
      {pieces.map((p, i) => {
        if (p.span < 0) return <Fragment key={i}>{p.text}</Fragment>
        const span = spans[p.span]
        const key = keepKey(span, p.original)
        const isKept = kept.has(key)
        return (
          <button
            key={i}
            type="button"
            onClick={() => onToggle(key)}
            title={isKept ? `${describe(span)}, kept. Press to hide.` : `${describe(span)}: ${p.original}. Press to keep.`}
            aria-label={isKept ? `${p.original}, ${describe(span)}, kept. Press to hide.` : `${describe(span)} hidden as ${p.text}. Press to keep.`}
            aria-pressed={isKept}
            className={cn(
              'cursor-pointer rounded-[3px] text-left break-words whitespace-pre-wrap outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isKept
                ? 'underline decoration-dotted decoration-1 underline-offset-4 hover:bg-muted'
                : 'bg-foreground px-0.5 font-[600] text-background',
            )}
          >
            {p.text}
          </button>
        )
      })}
    </div>
  )
})
