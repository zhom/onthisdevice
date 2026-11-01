import { useEffect, useState } from 'react'
import type { DragEvent } from 'react'
import { flushSync } from 'react-dom'
import { ChevronDown, ChevronUp, File as FileIcon, GripVertical, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatBytes } from '@/lib/utils'

export interface FileChipsProps {
  files: File[]
  onRemove?: (index: number) => void
  /** When supplied, the list becomes reorderable by drag and by arrow buttons. */
  onReorder?: (from: number, to: number) => void
  className?: string
}

/** A stable name per file, so a reorder can animate each row to its new place. */
const ids = new WeakMap<File, number>()
let nextId = 0
const idOf = (file: File) => {
  let id = ids.get(file)
  if (id === undefined) {
    id = ++nextId
    ids.set(file, id)
  }
  return id
}

/** Runs a reorder inside a view transition where the browser has one: rows slide to their places. */
function animated(update: () => void) {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (typeof document === 'undefined' || !document.startViewTransition || reduce) {
    update()
    return
  }
  document.startViewTransition(() => flushSync(update))
}

/** The selected-files list: name, size, removal and (optionally) reordering. */
export function FileChips({ files, onRemove, onReorder, className }: FileChipsProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  // Row names for the reorder animation are client-only, so server HTML matches the first render.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (files.length === 0) return null

  const reorderable = typeof onReorder === 'function'

  const endDrag = () => {
    setDragIndex(null)
    setOverIndex(null)
  }

  const handleDragStart = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    if (!reorderable) return
    setDragIndex(index)
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      // Firefox refuses to start a drag without payload.
      event.dataTransfer.setData('text/plain', String(index))
    }
  }

  const handleDragOver = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    if (!reorderable || dragIndex === null) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    setOverIndex(index)
  }

  const handleDrop = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    if (!reorderable || dragIndex === null) return
    event.preventDefault()
    const from = dragIndex
    endDrag()
    if (from !== index) animated(() => onReorder?.(from, index))
  }

  const move = (from: number, to: number) => {
    if (!reorderable) return
    if (to < 0 || to >= files.length || to === from) return
    animated(() => onReorder?.(from, to))
  }

  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {files.map((file, index) => (
        <li
          key={`${index}-${file.name}-${file.size}-${file.lastModified}`}
          draggable={reorderable}
          onDragStart={handleDragStart(index)}
          onDragOver={handleDragOver(index)}
          onDrop={handleDrop(index)}
          onDragEnd={endDrag}
          style={reorderable && mounted ? { viewTransitionName: `file-row-${idOf(file)}` } : undefined}
          className={cn(
            'flex items-center gap-2 rounded-lg bg-card px-3 py-2 transition-[opacity,box-shadow] duration-150 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-300',
            reorderable && 'cursor-grab active:cursor-grabbing',
            dragIndex === index && 'opacity-50',
            overIndex === index && dragIndex !== null && dragIndex !== index && 'ring-2 ring-foreground',
          )}
        >
          {reorderable ? (
            <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-[600] text-foreground" title={file.name}>
              {file.name}
            </span>
            <span className="block text-xs tabular-nums text-muted-foreground">
              {formatBytes(file.size)}
            </span>
          </span>

          {reorderable && (
            <span className="flex shrink-0 items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={index === 0}
                aria-label={`Move ${file.name} up`}
                onClick={() => move(index, index - 1)}
              >
                <ChevronUp className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={index === files.length - 1}
                aria-label={`Move ${file.name} down`}
                onClick={() => move(index, index + 1)}
              >
                <ChevronDown className="size-4" aria-hidden="true" />
              </Button>
            </span>
          )}

          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${file.name}`}
              onClick={() => onRemove(index)}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
