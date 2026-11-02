import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { DataMeta } from './data'
import { formatDay } from './data'

/** The source, licence and update date line every data tool shows. */
export function SourceNote({ meta, children, className }: { meta: DataMeta; children?: ReactNode; className?: string }) {
  const sources = meta.sources?.length ? meta.sources : [meta.source]
  return (
    <p className={cn('text-[0.8125rem] leading-relaxed text-pretty text-muted-foreground', className)}>
      Source:{' '}
      {sources.map((s, i) => (
        <span key={s.name}>
          {i ? '; ' : ''}
          {s.url ? (
            <a href={s.url} className="underline underline-offset-2 hover:text-foreground" rel="noopener noreferrer" target="_blank">
              {s.name}
            </a>
          ) : (
            s.name
          )}
        </span>
      ))}
      . Licence:{' '}
      <a href="/licenses/data.txt" className="underline underline-offset-2 hover:text-foreground">
        {meta.licence.name}
      </a>
      . Updated {formatDay(meta.fetchedAt)}.{children ? <> {children}</> : null}
    </p>
  )
}
