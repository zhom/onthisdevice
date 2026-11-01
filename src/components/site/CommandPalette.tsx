import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react'
import { Search, X } from 'lucide-react'
import { GhostInput, completionRest } from './search/GhostInput'
import { ResultList, optionId } from './search/ResultList'
import { pickOption } from './search/actions'
import { prefersReducedMotion, useFlip } from './search/useFlip'
import { useListbox } from './search/useListbox'
import { useReveal } from './search/useReveal'
import type { Option } from './search/useSearch'
import { useSearch } from './search/useSearch'

type Phase = 'closed' | 'open' | 'closing'

const TEXT = 'h-14 text-[1.75rem] font-[560] max-md:text-[16px] pointer-coarse:text-[16px] placeholder:text-muted-foreground'

/** Where the last pointer press was, so the search opens from the control that was pressed. */
let lastPress = { x: 0, y: 0, at: 0 }
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => (lastPress = { x: e.clientX, y: e.clientY, at: e.timeStamp }), {
    capture: true,
    passive: true,
  })
}

function openingPoint(): { x: number; y: number } {
  if (performance.now() - lastPress.at < 800) return lastPress
  for (const el of document.querySelectorAll<HTMLElement>('[data-search-open]')) {
    const r = el.getBoundingClientRect()
    if (r.width && r.height && r.bottom > 0 && r.top < window.innerHeight) {
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
  }
  return { x: window.innerWidth / 2, y: 0 }
}

/**
 * The search screen. It opens with ⌘K, "/" or any [data-search-open] control (BaseLayout sends
 * `otd:search-open`) and grows from that control as a circle of paper over the page; it closes
 * back into it. Every search, answer and suggestion is computed in this tab.
 */
export default function CommandPalette() {
  const [phase, setPhase] = useState<Phase>('closed')
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)
  const origin = useRef({ x: 0, y: 0 })
  const idBase = useId()

  const view = useSearch(query, { enabled: phase !== 'closed', limit: 8, recent: 5, popular: 8 })
  const snapshot = useFlip(listRef, view.groups)
  const completion = view.result?.completion
  const empty = query.trim() !== '' && view.status === 'ready' && view.flat.length === 0

  const reveal = useReveal(overlayRef, () => setPhase('closed'))
  const play = useCallback(
    (dir: 'in' | 'out') => {
      reveal.play(dir, origin.current)
      if (dir === 'in' && overlayRef.current && !prefersReducedMotion()) {
        panelRef.current?.animate(
          [
            { opacity: 0, transform: 'translateY(10px)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 280, delay: 70, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
        )
      }
    },
    [reveal],
  )

  const phaseNow = useRef<Phase>('closed')
  phaseNow.current = phase

  const open = useCallback(() => {
    delete document.documentElement.dataset.searchPending
    document.documentElement.dataset.search = 'open'
    if (phaseNow.current === 'closed') {
      restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      origin.current = openingPoint()
      setQuery('')
      setCopied(null)
    }
    setPhase('open')
    play('in')
  }, [play])

  const close = useCallback(() => {
    document.documentElement.removeAttribute('data-search')
    if (phaseNow.current === 'closed') return
    setPhase('closing')
    play('out')
  }, [play])

  // BaseLayout fires this for ⌘K, "/" and [data-search-open] clicks.
  useEffect(() => {
    const onOpen = () => open()
    window.addEventListener('otd:search-open', onOpen)
    if (document.documentElement.dataset.searchPending === '1') open()
    // Back/forward cache: never come back to a page with search still open.
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      reveal.reset()
      document.documentElement.removeAttribute('data-search')
      setPhase('closed')
    }
    window.addEventListener('pageshow', onShow)
    return () => {
      window.removeEventListener('otd:search-open', onOpen)
      window.removeEventListener('pageshow', onShow)
    }
  }, [open, reveal])

  // The first frame of the reveal has to run once the screen is in the DOM.
  useLayoutEffect(() => {
    if (phase !== 'open') return
    if (!reveal.isRunning()) play('in')
    inputRef.current?.focus({ preventScroll: true })
  }, [phase, play, reveal])

  useEffect(() => {
    if (phase === 'closed') {
      const el = restoreFocus.current
      restoreFocus.current = null
      if (el && document.contains(el)) el.focus({ preventScroll: true })
      return
    }
    const html = document.documentElement
    const previous = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = previous
    }
  }, [phase])

  const acceptCompletion = useCallback(() => {
    const rest = completionRest(query, completion)
    if (!rest) return false
    snapshot()
    setQuery(query + rest)
    return true
  }, [query, completion, snapshot])

  const pick = useCallback(
    (option: Option, event: MouseEvent | KeyboardEvent) => pickOption(option, event, setCopied),
    [],
  )
  const handlers = useMemo(() => ({ onPick: pick, onComplete: acceptCompletion, onEscape: close }), [pick, acceptCompletion, close])
  const list = useListbox(view.flat, handlers)

  // Keep the active row in view.
  useEffect(() => {
    if (phase !== 'open') return
    document.getElementById(optionId(idBase, list.active))?.scrollIntoView({ block: 'nearest' })
  }, [list.active, phase, idBase])

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    snapshot()
    setQuery(e.target.value)
    setCopied(null)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      close()
      return
    }
    list.onKeyDown(e)
  }

  // Keep Tab inside the screen.
  const onDialogKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault()
      close()
      return
    }
    if (e.key !== 'Tab' || e.defaultPrevented) return
    const focusable = [...(overlayRef.current?.querySelectorAll<HTMLElement>('input, button, [href]:not([tabindex="-1"])') ?? [])]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  if (phase === 'closed') return null

  const didYouMean = view.result?.didYouMean
  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Search tools"
      className="fixed inset-0 z-200 overflow-hidden bg-background text-foreground"
      onKeyDown={onDialogKeyDown}
    >
      <div
        ref={panelRef}
        className="mx-auto flex h-full w-full max-w-2xl flex-col px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-[9vh]"
      >
        <div className="flex items-center gap-3 pl-3">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <GhostInput
            ref={inputRef}
            value={query}
            completion={completion}
            onChange={onInput}
            onKeyDown={onKeyDown}
            textClassName={TEXT}
            className="flex-1"
            type="text"
            inputMode="search"
            enterKeyHint="go"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${idBase}-list`}
            aria-autocomplete="both"
            aria-activedescendant={view.flat.length ? optionId(idBase, list.active) : undefined}
            aria-label="Search tools"
            aria-busy={view.status === 'loading'}
            placeholder="Search tools"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="grid h-9 shrink-0 place-items-center rounded-md px-2 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X className="size-5 sm:hidden" aria-hidden="true" />
            <span className="hidden sm:inline">Esc</span>
          </button>
        </div>

        <div className="min-h-6 pl-11 text-[0.875rem] text-muted-foreground" aria-live="polite">
          {didYouMean && (
            <>
              Did you mean{' '}
              <button
                type="button"
                onClick={() => {
                  snapshot()
                  setQuery(didYouMean)
                  inputRef.current?.focus()
                }}
                className="font-[650] text-foreground underline decoration-1 underline-offset-[0.22em]"
              >
                {didYouMean}
              </button>
              ?
            </>
          )}
        </div>

        <div className="-mx-1 mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <ResultList
            groups={view.groups}
            active={list.active}
            idBase={idBase}
            listRef={listRef}
            onActive={list.setActive}
            onPick={pick}
            copied={copied}
            query={query}
            label="Search results"
          />
          {view.status === 'loading' && view.groups.length === 0 && (
            <p className="px-3 pt-4 text-[0.9375rem] text-muted-foreground" role="status">
              Loading the tool list
            </p>
          )}
          {view.status === 'error' && (
            <div className="px-3 pt-4 text-[0.9375rem]" role="alert">
              <p>Search did not load.</p>
              <button type="button" onClick={view.retry} className="mt-2 font-[650] underline decoration-1 underline-offset-[0.22em]">
                Try again
              </button>
            </div>
          )}
          {empty && (
            <div className="px-3 pt-4">
              <p className="text-[1.0625rem] font-[600]">No tool for “{query.trim()}”</p>
              <p className="mt-1 text-[0.9375rem] text-muted-foreground">Try fewer words, or what the tool does: merge, compress, convert.</p>
              <a href="/all-tools" className="mt-4 inline-block text-[0.9375rem] font-[650] underline decoration-1 underline-offset-[0.22em]">
                All tools
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
