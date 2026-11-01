import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { stashHandoff } from '@/lib/handoff'
import type { ToolDoc } from '@/lib/search/data'
import { toolTakes } from '@/lib/search/files'
import { pageInfo } from '@/lib/search/runtime'
import { formatBytes } from '@/lib/utils'
import { ResultList, optionId } from './ResultList'
import type { DropState } from './drop-store'
import { close, getState, subscribe } from './drop-store'
import { prefersReducedMotion } from './useFlip'
import { useListbox } from './useListbox'
import type { Point } from './useReveal'
import { useReveal } from './useReveal'
import type { Group, Option } from './useSearch'

const center = (): Point => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 })

/**
 * Drop a file anywhere: ink floods the window from the pointer while a file is dragged over it.
 * On drop the file goes into this page's tool when it takes it; otherwise the screen lists the
 * tools that do, and the chosen one opens with the file already loaded (src/lib/handoff.ts).
 */
export function DropOverlay() {
  const s = useSyncExternalStore(subscribe, getState, getState)
  const [shown, setShown] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const from = useRef<Point>({ x: 0, y: 0 })
  const lastPhase = useRef<DropState['phase']>('idle')
  const restore = useRef<HTMLElement | null>(null)
  const dir = useRef<'in' | 'out' | null>(null)
  const reveal = useReveal(ref, () => {
    dir.current = null
    setShown(false)
    const el = restore.current
    restore.current = null
    if (el && document.contains(el)) el.focus({ preventScroll: true })
  })
  const active = s.phase !== 'idle' && s.phase !== 'done'

  useLayoutEffect(() => {
    const before = lastPhase.current
    lastPhase.current = s.phase
    if (active && !shown) {
      from.current = s.at
      restore.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setShown(true)
      return
    }
    if (active && shown && dir.current !== 'in') {
      dir.current = 'in'
      reveal.play('in', from.current)
    } else if (!active && shown && dir.current !== 'out') {
      dir.current = 'out'
      reveal.play('out', before === 'drag' ? from.current : s.phase === 'done' ? s.at : center())
    }
  }, [active, shown, s, reveal])

  useEffect(() => {
    if (!active) return
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  if (!shown) return null
  const dragging = s.phase === 'drag'
  return (
    <div
      ref={ref}
      className="fixed inset-0 z-210 overflow-y-auto bg-foreground text-background"
      style={{ pointerEvents: dragging ? 'none' : 'auto' }}
      onClick={(e) => e.target === e.currentTarget && close()}
      role={dragging ? undefined : 'dialog'}
      aria-modal={dragging ? undefined : true}
      aria-label={dragging ? undefined : 'Open the file with a tool'}
    >
      {s.phase === 'drag' && <DragPrompt />}
      {s.phase === 'reading' && (
        <p className="grid h-full place-items-center px-6 text-[1.0625rem]" role="status">
          Reading {s.files.length > 1 ? `${s.files.length} files` : s.files[0].name}
        </p>
      )}
      {s.phase === 'pick' && <Picker state={s} />}
      {s.phase === 'error' && (
        <div className="grid h-full place-items-center px-6 text-center" role="alert">
          <div>
            <p className="text-[1.25rem] font-[650]">{s.message}</p>
            <button type="button" onClick={close} className="mt-4 font-[650] underline decoration-1 underline-offset-[0.22em]">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DragPrompt() {
  const { title } = pageInfo()
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div>
        <p className="text-[clamp(2rem,1.3rem+3vw,3.5rem)] leading-[1.05] font-[720] text-balance">
          {title ? `Drop to open in ${title}` : 'Drop to find a tool'}
        </p>
        <p className="mt-4 text-[1rem]">Your file stays on this device.</p>
      </div>
    </div>
  )
}

function Picker({ state }: { state: Extract<DropState, { phase: 'pick' }> }) {
  const { files, kind, tools, here } = state
  const idBase = useId()
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const total = files.reduce((n, f) => n + f.size, 0)
  const notHere = here && here.accepts.length > 0 && !toolTakes(here, kind) ? here : null

  const groups = useMemo<Group[]>(
    () => [
      {
        id: 'open',
        label: 'Open with',
        options: tools.map((tool): Option => ({ kind: 'tool', key: `d:${tool.slug}`, tool, ranges: [] })),
      },
    ],
    [tools],
  )
  const flat = groups[0].options

  const openTool = useCallback(
    async (tool: ToolDoc) => {
      if (opening) return
      setOpening(tool.slug)
      try {
        await stashHandoff(files, tool.slug)
      } catch {
        /* no IndexedDB: the tool opens empty and the file can be dropped again */
      }
      window.location.assign(tool.href)
    },
    [files, opening],
  )

  const pick = useCallback(
    (option: Option, e: MouseEvent | KeyboardEvent) => {
      if (option.kind !== 'tool') return
      if ('button' in e && (e.metaKey || e.ctrlKey || e.button !== 0)) return
      e.preventDefault()
      void openTool(option.tool)
    },
    [openTool],
  )
  const handlers = useMemo(() => ({ onPick: pick, onEscape: close }), [pick])
  const list = useListbox(flat, handlers)

  const rootRef = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    boxRef.current?.focus({ preventScroll: true })
    if (prefersReducedMotion()) return
    rootRef.current?.animate(
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    )
  }, [])

  return (
    <div ref={rootRef} className="mx-auto flex min-h-full w-full max-w-xl flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10 sm:pt-[14vh]">
      <p className="px-3 text-[0.875rem]">
        {kind.ext ? kind.label : 'Unknown type'}
        {files.length > 1 ? `, ${files.length} files` : ''}, {formatBytes(total)}
      </p>
      <h2 className="mt-1 truncate px-3 text-[1.75rem] leading-tight font-[720] sm:text-[2.25rem]">{files[0].name}</h2>
      {notHere && (
        <p className="mt-2 px-3 text-[0.9375rem]">
          {notHere.title} does not take {kind.label} files.
        </p>
      )}

      {flat.length > 0 ? (
        <div
          ref={boxRef}
          tabIndex={0}
          onKeyDown={list.onKeyDown}
          aria-activedescendant={optionId(idBase, list.active)}
          className="mt-6 outline-none"
        >
          <ResultList
            groups={groups}
            active={list.active}
            idBase={idBase}
            onActive={list.setActive}
            onPick={pick}
            tone="ink"
            label={`Tools for ${kind.label}`}
          />
        </div>
      ) : (
        <p ref={boxRef} tabIndex={-1} className="mt-6 px-3 text-[1.0625rem] outline-none">
          No tool here takes {kind.ext ? `${kind.label} files` : 'this file'} yet.
        </p>
      )}

      <p className="mt-2 min-h-6 px-3 text-[0.9375rem]" aria-live="polite">
        {opening ? `Opening ${tools.find((t) => t.slug === opening)?.title ?? ''}` : ''}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 px-3 pt-8 text-[0.9375rem] whitespace-nowrap">
        <a href={kind.ext ? `/all-tools?q=${encodeURIComponent(kind.ext)}` : '/all-tools'} className="font-[650] underline decoration-1 underline-offset-[0.22em]">
          All tools
        </a>
        <button type="button" onClick={close} className="font-[650] underline decoration-1 underline-offset-[0.22em]">
          Cancel
        </button>
        <span className="basis-full sm:ml-auto sm:basis-auto">The file stays on this device.</span>
      </div>
    </div>
  )
}
