import type { MouseEvent, RefObject } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Glyph } from './Glyph'
import { Highlight } from './Highlight'
import type { Group, Option } from './useSearch'

interface Props {
  groups: Group[]
  active: number
  idBase: string
  listRef?: RefObject<HTMLDivElement | null>
  onActive: (index: number) => void
  onPick: (option: Option, event: MouseEvent) => void
  /** Key of the answer that was just copied. */
  copied?: string | null
  /** "paper" on the page; "ink" on the inverted drop screen. */
  tone?: 'paper' | 'ink'
  size?: 'lg' | 'md'
  label: string
  /** The typed query; an answer's label is hidden when it only repeats it. */
  query?: string
}

export const optionId = (idBase: string, index: number) => `${idBase}-o${index}`

/**
 * Grouped search results as a listbox. The input that drives it owns focus and points at the
 * active row with aria-activedescendant; rows are links so they also work with a pointer.
 */
export function ResultList({
  groups,
  active,
  idBase,
  listRef,
  onActive,
  onPick,
  copied,
  tone = 'paper',
  size = 'lg',
  label,
  query,
}: Props) {
  let index = -1
  const ink = tone === 'ink'
  return (
    <div ref={listRef} role="listbox" id={`${idBase}-list`} aria-label={label}>
      {groups.map((group) => (
        <div key={group.id} role="group" aria-labelledby={`${idBase}-g-${group.id}`} className="pb-2">
          <div
            id={`${idBase}-g-${group.id}`}
            data-flip={`g:${group.id}`}
            className={cn('px-3 pt-3 pb-1.5 text-[0.8125rem]', ink ? 'text-background' : 'text-muted-foreground')}
          >
            {group.label}
          </div>
          {group.options.map((option) => {
            index += 1
            const i = index
            const isActive = i === active
            const common = {
              id: optionId(idBase, i),
              role: 'option' as const,
              'aria-selected': isActive,
              'data-flip': option.key,
              tabIndex: -1,
              onMouseMove: () => !isActive && onActive(i),
              onClick: (e: MouseEvent) => onPick(option, e),
            }
            const row = cn(
              'flex items-center rounded-md transition-colors duration-150',
              size === 'lg' ? 'gap-3.5 px-3 py-2.5 sm:py-3' : 'gap-3 px-3 py-2.5',
              isActive && (ink ? 'bg-background text-foreground' : 'bg-muted'),
            )
            if (option.kind === 'answer') {
              return (
                <AnswerRow
                  key={option.key}
                  option={option}
                  query={query ?? ''}
                  rowClass={row}
                  common={common}
                  copied={copied === option.key}
                  active={isActive}
                  ink={ink}
                />
              )
            }
            if (option.kind === 'all') {
              return (
                <a key={option.key} href={option.href} className={cn(row, 'text-[0.9375rem]')} {...common}>
                  <ArrowRight className={size === 'lg' ? 'size-[1.125rem]' : 'size-4'} aria-hidden="true" />
                  <span className="flex-1">All {option.count} results</span>
                </a>
              )
            }
            const { title, glyph, side, href, ranges } =
              option.kind === 'tool'
                ? { title: option.tool.title, glyph: option.tool.category.id, side: option.tool.category.title, href: option.tool.href, ranges: option.ranges }
                : { title: option.category.title, glyph: option.category.id, side: `${option.category.count} tools`, href: option.category.href, ranges: option.ranges }
            return (
              <a key={option.key} href={href} className={row} {...common}>
                <Glyph id={glyph} live={isActive} className={size === 'lg' ? 'size-[1.125rem]' : 'size-4'} />
                <span className={cn('min-w-0 flex-1 truncate font-[450]', size === 'lg' ? 'text-[1.0625rem]' : 'text-[0.9375rem]')}>
                  <Highlight text={title} ranges={ranges} />
                </span>
                <span
                  className={cn(
                    'hidden shrink-0 text-[0.8125rem] sm:block',
                    ink ? (isActive ? 'text-muted-foreground' : 'text-background') : 'text-muted-foreground',
                  )}
                >
                  {side}
                </span>
              </a>
            )
          })}
        </div>
      ))}
    </div>
  )
}

const sameText = (a: string, b: string) => a.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase()

function AnswerRow({
  option,
  query,
  rowClass,
  common,
  copied,
  active,
  ink,
}: {
  option: Extract<Option, { kind: 'answer' }>
  query: string
  rowClass: string
  common: Record<string, unknown>
  copied: boolean
  active: boolean
  ink: boolean
}) {
  const { answer, tool } = option
  const grey = ink && !active ? 'text-background' : 'text-muted-foreground'
  return (
    <div className={cn(rowClass, 'cursor-pointer flex-col items-stretch py-3 sm:flex-row sm:items-start sm:py-3.5')} {...common}>
      <span className="min-w-0 flex-1">
        {!sameText(answer.label, query) && <span className={cn('block text-[0.8125rem]', grey)}>{answer.label}</span>}
        <span className="mt-0.5 flex min-w-0 items-center gap-2.5">
          {answer.swatch && (
            <span className="size-6 shrink-0 rounded-sm" style={{ backgroundColor: answer.swatch }} aria-hidden="true" />
          )}
          <span className="num min-w-0 text-[1.75rem] leading-tight font-[650] [overflow-wrap:anywhere] sm:text-[2rem]">{answer.value}</span>
        </span>
        {answer.more && answer.more.length > 0 && (
          <span className={cn('num mt-1 flex flex-wrap gap-x-4 text-[0.875rem]', grey)}>
            {answer.more.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-row-reverse items-center justify-end gap-4 pt-0.5 text-[0.8125rem] sm:flex-col sm:items-end sm:gap-1">
        <span className={grey} aria-live="polite">
          {copied ? 'Copied' : active ? <span className="hidden pointer-fine:inline">Enter to copy</span> : ''}
        </span>
        {tool && (
          <a
            href={tool.href}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="font-[560] underline decoration-1 underline-offset-[0.22em]"
          >
            {tool.title}
          </a>
        )}
      </span>
    </div>
  )
}
