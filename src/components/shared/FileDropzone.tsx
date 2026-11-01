import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, DragEvent, KeyboardEvent, ReactNode } from 'react'
import { TriangleAlert, type LucideIcon } from 'lucide-react'
import { consumeHandoff } from '@/lib/handoff'
import { cn, formatBytes } from '@/lib/utils'

export interface FileDropzoneProps {
  /** Comma-separated list of extensions and/or MIME types, e.g. '.pdf,application/pdf,image/*'. */
  accept?: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  /** Reject anything larger than this many megabytes. */
  maxSizeMb?: number
  title?: string
  hint?: string
  /** Kept for API compatibility; the drop zone draws its own pixel icon. */
  icon?: LucideIcon
  className?: string
  disabled?: boolean
}

interface Rejection {
  name: string
  reason: string
}

function parseAccept(accept?: string): string[] {
  if (!accept) return []
  return accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
}

function matchesAccept(file: File, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return tokens.some((token) => {
    if (token === '*' || token === '*/*') return true
    if (token.startsWith('.')) return name.endsWith(token)
    if (token.endsWith('/*')) return type.length > 0 && type.startsWith(token.slice(0, -1))
    if (token.includes('/')) return type === token
    return name.endsWith(`.${token}`)
  })
}

/** Human-readable list of what the dropzone takes, for error copy. */
function describeAccept(tokens: string[]): string {
  const exts = tokens
    .filter((t) => t.startsWith('.'))
    .map((t) => t.slice(1).toUpperCase())
  if (exts.length > 0) return exts.join(', ')
  return tokens.join(', ')
}

/* The pixel icon: a file (idle), an arrow into the device (drag-over), a tick (taken). */
const ICON_FRAMES = {
  i: ['.####..', '.#..##.', '.#...#.', '.#...#.', '.#...#.', '.#...#.', '.#####.'],
  o: ['...#...', '...#...', '...#...', '.#.#.#.', '..###..', '#..#..#', '#######'],
  f: ['.......', '......#', '.....#.', '#...#..', '.#.#...', '..#....', '.......'],
} as const
const ICON_CELLS = (() => {
  const cells: { x: number; y: number; cls: string }[] = []
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++) {
      const cls = (Object.keys(ICON_FRAMES) as (keyof typeof ICON_FRAMES)[]).filter((k) => ICON_FRAMES[k][y][x] === '#').join(' ')
      if (cls) cells.push({ x, y, cls })
    }
  return cells
})()

function PixelIcon() {
  return (
    <svg viewBox="0 0 7 7" className="dz-icon size-10 fill-current sm:size-11" aria-hidden="true" focusable="false">
      {ICON_CELLS.map((c) => (
        <rect key={`${c.x}.${c.y}`} x={c.x + 0.08} y={c.y + 0.08} width="0.84" height="0.84" rx="0.1" className={c.cls} style={{ '--x': c.x, '--y': c.y } as CSSProperties} />
      ))}
    </svg>
  )
}

export function FileDropzone({
  accept,
  multiple = false,
  onFiles,
  maxSizeMb,
  title,
  hint,
  className,
  disabled = false,
}: FileDropzoneProps) {
  const inputId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const regionRef = useRef<HTMLDivElement>(null)
  const dragDepth = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragCount, setDragCount] = useState(0)
  const [fed, setFed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const feedTimer = useRef(0)
  const [origin, setOrigin] = useState({ x: '50%', y: '50%' })
  const setOriginFrom = (event: DragEvent<HTMLDivElement>) => {
    const r = regionRef.current?.getBoundingClientRect()
    if (!r) return
    setOrigin({ x: `${Math.round(event.clientX - r.left)}px`, y: `${Math.round(event.clientY - r.top)}px` })
  }

  const heading = isDragging
    ? dragCount > 1
      ? `Release to add ${dragCount} files`
      : multiple
        ? 'Release to add the files'
        : 'Release to add the file'
    : (title ?? (multiple ? 'Drop files here' : 'Drop a file here'))
  // Hints written for the old box often start "or click to browse, …"; the
  // button says that now, so keep only the part after the dash.
  const tidy = (h: string) => {
    const rest = h.replace(/^or (click|tap) to (browse|choose)[^a-z0-9]*/i, '').trim()
    if (!rest) return null
    const sentence = rest.charAt(0).toUpperCase() + rest.slice(1)
    return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`
  }
  const subtitle = isDragging
    ? 'It stays in this tab. Nothing is uploaded.'
    : ((hint && tidy(hint)) ?? 'Your file is read here, in this tab. It is never uploaded.')

  useEffect(() => () => window.clearTimeout(feedTimer.current), [])

  const accepted = useCallback(
    (incoming: File[]) => {
      const tokens = parseAccept(accept)
      const maxBytes = typeof maxSizeMb === 'number' ? maxSizeMb * 1024 * 1024 : null
      const kept: File[] = []
      const rejected: Rejection[] = []

      for (const file of incoming) {
        if (!matchesAccept(file, tokens)) {
          rejected.push({ name: file.name, reason: `not ${describeAccept(tokens)}` })
          continue
        }
        if (maxBytes !== null && file.size > maxBytes) {
          rejected.push({
            name: file.name,
            reason: `${formatBytes(file.size)} exceeds the ${maxSizeMb} MB limit`,
          })
          continue
        }
        if (file.size === 0) {
          rejected.push({ name: file.name, reason: 'the file is empty' })
          continue
        }
        kept.push(file)
      }

      return { kept, rejected }
    },
    [accept, maxSizeMb],
  )

  const handleFiles = useCallback(
    (incoming: File[]) => {
      if (disabled || incoming.length === 0) return
      const list = multiple ? incoming : incoming.slice(0, 1)
      const { kept, rejected } = accepted(list)

      if (rejected.length > 0) {
        const first = rejected[0]
        const message =
          rejected.length === 1
            ? `${first.name} was skipped: ${first.reason}.`
            : `${rejected.length} files were skipped, for example ${first.name}: ${first.reason}.`
        setError(message)
      } else {
        setError(null)
      }

      if (kept.length > 0) {
        setFed(true)
        window.clearTimeout(feedTimer.current)
        feedTimer.current = window.setTimeout(() => setFed(false), 1400)
        onFiles(kept)
      }
    },
    [accepted, disabled, multiple, onFiles],
  )

  const openPicker = useCallback(() => {
    if (disabled) return
    inputRef.current?.click()
  }, [disabled])

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    dragDepth.current += 1
    if (event.dataTransfer?.types?.includes('Files')) {
      if (!isDragging) setOriginFrom(event)
      setIsDragging(true)
      const n = Array.from(event.dataTransfer.items ?? []).filter((i) => i.kind === 'file').length
      setDragCount(multiple ? n : Math.min(n, 1))
    }
  }

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    setIsDragging(true)
  }

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragging(false)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    dragDepth.current = 0
    setOriginFrom(event)
    setIsDragging(false)
    const dropped = Array.from(event.dataTransfer?.files ?? [])
    handleFiles(dropped)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return
    event.preventDefault()
    openPicker()
  }

  // Files dropped elsewhere on the site and handed to this tool arrive here once, on load.
  const handoffDone = useRef(false)
  const latestHandle = useRef(handleFiles)
  useEffect(() => {
    latestHandle.current = handleFiles
  })
  useEffect(() => {
    if (handoffDone.current || disabled) return
    handoffDone.current = true
    consumeHandoff()
      .then((files) => {
        if (files.length > 0) latestHandle.current(files)
      })
      .catch(() => {})
  }, [disabled])

  // Paste-from-clipboard: works when the dropzone (or the page around it) has focus.
  useEffect(() => {
    if (disabled || typeof window === 'undefined') return

    const onPaste = (event: ClipboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      const pasted = Array.from(event.clipboardData?.files ?? [])
      if (pasted.length === 0) return
      event.preventDefault()
      handleFiles(pasted)
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [disabled, handleFiles])

  const accepts = accept ? describeAccept(parseAccept(accept)) : 'Any file'
  const state = isDragging && !disabled ? 'over' : fed ? 'fed' : 'idle'

  // The content is drawn twice: ink on the fill, and paper on the ink flood that
  // grows from the pointer on drag-over. The flood copy is hidden from readers.
  const face = (inverse: boolean): ReactNode => (
    <div className={cn('flex flex-col items-center gap-4 px-5 py-9 text-center sm:py-11', inverse ? 'text-background' : 'text-foreground')}>
      <PixelIcon />
      <div className="min-w-0">
        <span className="block text-[1.125rem] font-[680]" aria-live={inverse ? undefined : 'polite'}>
          {heading}
        </span>
        <span id={inverse ? undefined : `${inputId}-hint`} className={cn('mx-auto mt-1 block max-w-md text-[0.9375rem] text-pretty', inverse ? 'text-background' : 'text-muted-foreground')}>
          {subtitle}
        </span>
      </div>
      <span className="flex flex-col items-center gap-2.5">
        <span
          className={cn(
            'dz-key inline-flex h-10 items-center rounded-md px-4 text-[0.875rem] font-[620]',
            inverse ? 'bg-background text-foreground' : 'bg-primary text-primary-foreground',
          )}
          aria-hidden="true"
        >
          {multiple ? 'Choose files' : 'Choose a file'}
        </span>
        <span className={cn('text-[0.8125rem]', inverse ? 'text-background' : 'text-muted-foreground')}>
          {accepts}
          {typeof maxSizeMb === 'number' ? `, up to ${maxSizeMb} MB each` : ''}
          <span className="hidden sm:inline">. You can also paste.</span>
        </span>
      </span>
    </div>
  )

  return (
    <div className={cn('w-full', className)}>
      <div
        ref={regionRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={multiple ? `Choose files: ${accepts}` : `Choose a file: ${accepts}`}
        aria-describedby={error ? `${errorId} ${inputId}-hint` : `${inputId}-hint`}
        aria-disabled={disabled || undefined}
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        data-state={state}
        data-dropzone
        style={{ '--ox': origin.x, '--oy': origin.y } as CSSProperties}
        className={cn(
          'dropzone group/drop relative isolate w-full overflow-hidden rounded-xl bg-muted select-none',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        )}
      >
        {face(false)}
        <div className="dz-flood absolute inset-0 bg-foreground" aria-hidden="true">
          {face(true)}
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          // The input lives inside the clickable region: without this, the
          // synthetic click from openPicker() would bubble back and recurse.
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? [])
            handleFiles(picked)
            // Allow re-picking the very same file.
            event.target.value = ''
          }}
        />
      </div>

      {error && (
        <p id={errorId} role="alert" className="reveal mt-3 flex items-start gap-2 text-[0.875rem] text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
