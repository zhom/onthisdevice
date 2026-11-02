import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent, MouseEvent } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GhostInput, completionRest } from './GhostInput'
import { ResultList, optionId } from './ResultList'
import { pickOption } from './actions'
import { prefersReducedMotion, useFlip } from './useFlip'
import { useListbox } from './useListbox'
import type { Option } from './useSearch'
import { useSearch } from './useSearch'

const EXAMPLES = [
  'merge pdf',
  'heic to jpg',
  '15% of 80',
  'compress image to 100kb',
  'blur faces',
  'mov to mp4',
  '5 kg in lbs',
  'days until christmas',
  'pdf to word',
  '0xff',
]

const TEXT = 'h-14 pl-12 pr-4 text-[1.125rem] max-md:text-[16px] pointer-coarse:text-[16px]'

/**
 * The search field for the home page hero. Suggestions, answers and completion come from the
 * same on-device engine as the search screen. The grey example in the empty field types itself
 * out; with reduced motion it stays still. Works as a plain form to /all-tools without JS.
 */
export default function HeroSearch() {
  const [query, setQuery] = useState('')
  const [armed, setArmed] = useState(false)
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const idBase = useId()

  const reorder = useRef(() => {})
  const view = useSearch(query, { enabled: armed, engaged: focused || query !== '', limit: 6, recent: 3, popular: 5, beforeReorder: () => reorder.current() })
  const snapshot = useFlip(listRef, view.groups)
  reorder.current = snapshot
  const completion = view.result?.completion
  const empty = query.trim() !== '' && view.status === 'ready' && view.flat.length === 0
  const showMenu = open && (view.groups.length > 0 || empty)

  const acceptCompletion = useCallback(() => {
    const rest = completionRest(query, completion)
    if (!rest) return false
    snapshot()
    setQuery(query + rest)
    return true
  }, [query, completion, snapshot])

  const pick = useCallback((option: Option, e: MouseEvent | KeyboardEvent) => pickOption(option, e, setCopied), [])
  const handlers = useMemo(
    () => ({ onPick: pick, onComplete: acceptCompletion, onEscape: () => setOpen(false) }),
    [pick, acceptCompletion],
  )
  const list = useListbox(view.flat, handlers)

  // A value restored by the browser (back button) should show its suggestions on focus.
  useEffect(() => {
    if (inputRef.current?.value) {
      setQuery(inputRef.current.value)
      setArmed(true)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  useLayoutEffect(() => {
    if (!showMenu || prefersReducedMotion()) return
    menuRef.current?.animate(
      [
        { opacity: 0, transform: 'translateY(-4px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    )
  }, [showMenu])

  useEffect(() => {
    if (showMenu) document.getElementById(optionId(idBase, list.active))?.scrollIntoView({ block: 'nearest' })
  }, [list.active, showMenu, idBase])

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    snapshot()
    setQuery(e.target.value)
    setCopied(null)
    setOpen(true)
    setArmed(true)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    list.onKeyDown(e)
  }

  // Enter with nothing to pick falls through to the form: /all-tools?q=…
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!query.trim()) e.preventDefault()
  }

  return (
    <div ref={rootRef} className="relative w-full" onPointerEnter={() => setArmed(true)}>
      <form role="search" action="/all-tools" method="get" onSubmit={onSubmit}>
        <label htmlFor={`${idBase}-q`} className="sr-only">
          Search tools
        </label>
        <div className="relative rounded-lg border border-input bg-background transition-shadow focus-within:ring-2 focus-within:ring-ring">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          {query === '' && <TypedExample paused={focused} />}
          <GhostInput
            ref={inputRef}
            id={`${idBase}-q`}
            name="q"
            value={query}
            completion={completion}
            onChange={onInput}
            onKeyDown={onKeyDown}
            onFocus={() => {
              setFocused(true)
              setArmed(true)
              setOpen(true)
            }}
            onBlur={() => setFocused(false)}
            textClassName={TEXT}
            type="text"
            inputMode="search"
            enterKeyHint="go"
            role="combobox"
            aria-expanded={showMenu}
            aria-controls={`${idBase}-list`}
            aria-autocomplete="both"
            aria-activedescendant={showMenu && view.flat.length ? optionId(idBase, list.active) : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
      </form>

      {showMenu && (
        <div
          ref={menuRef}
          className="absolute inset-x-0 top-full z-40 mt-2 max-h-[min(60vh,30rem)] overflow-y-auto overscroll-contain rounded-lg bg-popover p-1.5 text-popover-foreground shadow-pop"
          onMouseDown={(e) => e.preventDefault()}
        >
          <ResultList
            groups={view.groups}
            active={list.active}
            idBase={idBase}
            listRef={listRef}
            onActive={list.setActive}
            onPick={pick}
            copied={copied}
            query={query}
            size="md"
            label="Suggestions"
          />
          {empty && (
            <p className="px-3 py-3 text-[0.9375rem] text-muted-foreground">
              No tool for “{query.trim()}”. Press Enter to search all tools.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** "Try merge pdf", typed out one letter at a time, then the next example. */
function TypedExample({ paused }: { paused: boolean }) {
  const [text, setText] = useState(EXAMPLES[0])
  const ref = useRef<HTMLSpanElement | null>(null)
  const caret = useRef<HTMLSpanElement | null>(null)

  const current = useRef(0)

  useEffect(() => {
    // While the field has focus, show the whole example, not half a word.
    if (paused) setText(EXAMPLES[current.current])
    if (paused || prefersReducedMotion()) return
    let visible = true
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
    if (ref.current) io.observe(ref.current)
    let example = current.current
    let shown = EXAMPLES[example].length
    let erasing = true
    let timer = 0
    const step = () => {
      let wait: number
      if (!visible || document.hidden) wait = 400
      else if (erasing) {
        shown -= 1
        if (shown <= 0) {
          erasing = false
          example = (example + 1) % EXAMPLES.length
          current.current = example
          wait = 320
        } else wait = 26
        setText(EXAMPLES[example].slice(0, Math.max(0, shown)))
      } else {
        const target = EXAMPLES[example]
        shown += 1
        setText(target.slice(0, shown))
        if (shown >= target.length) {
          erasing = true
          wait = 2000
        } else wait = 55 + Math.random() * 45
      }
      timer = window.setTimeout(step, wait)
    }
    timer = window.setTimeout(step, 2000)
    return () => {
      window.clearTimeout(timer)
      io.disconnect()
    }
    // Restart only when pausing or resuming; the loop owns `text` while it runs.
  }, [paused])

  useEffect(() => {
    if (paused || prefersReducedMotion()) return
    const blink = caret.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 1060,
      iterations: Infinity,
      easing: 'steps(2, jump-none)',
    })
    return () => blink?.cancel()
  }, [paused])

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-y-0 left-12 flex items-center text-[1.125rem] whitespace-pre text-muted-foreground',
        'max-md:text-[16px] pointer-coarse:text-[16px]',
      )}
    >
      Try {text}
      {!paused && <span ref={caret} className="ml-px inline-block h-[1.1em] w-px bg-muted-foreground" />}
    </span>
  )
}
