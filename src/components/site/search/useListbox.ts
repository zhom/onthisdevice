import { useCallback, useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'

interface Keyed {
  key: string
}

/**
 * Keyboard movement for an input that drives a listbox (aria-activedescendant pattern): arrows
 * move, Enter picks, Tab or Right arrow at the end of the text accepts the inline completion.
 * The first row is active whenever the list changes.
 */
export function useListbox<T extends Keyed>(
  options: readonly T[],
  handlers: {
    onPick: (option: T, event: KeyboardEvent<HTMLElement>) => void
    /** Accepts the completion; returns false when there is none. */
    onComplete?: () => boolean
    onEscape?: () => void
  },
) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    setActive(0)
  }, [options])

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const n = options.length
      if (e.key === 'ArrowDown' && n) {
        e.preventDefault()
        setActive((i) => (i + 1) % n)
      } else if (e.key === 'ArrowUp' && n) {
        e.preventDefault()
        setActive((i) => (i - 1 + n) % n)
      } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
        const option = options[Math.min(active, n - 1)]
        if (option) {
          e.preventDefault()
          handlers.onPick(option, e)
        }
      } else if (e.key === 'Tab' && !e.shiftKey && handlers.onComplete) {
        if (handlers.onComplete()) e.preventDefault()
      } else if (e.key === 'ArrowRight' && handlers.onComplete) {
        const input = e.currentTarget
        const atEnd =
          input instanceof HTMLInputElement &&
          input.selectionStart === input.value.length &&
          input.selectionEnd === input.value.length
        if (atEnd && handlers.onComplete()) e.preventDefault()
      } else if (e.key === 'Escape' && handlers.onEscape) {
        e.preventDefault()
        handlers.onEscape()
      }
    },
    [options, active, handlers],
  )

  return { active: Math.min(active, Math.max(0, options.length - 1)), setActive, onKeyDown }
}
