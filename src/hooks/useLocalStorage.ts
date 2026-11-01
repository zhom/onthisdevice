import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Persist a JSON-serialisable value in `localStorage`.
 *
 * SSR-safe by design: the first render always returns `initial` (so the
 * hydrated island matches the server-rendered markup), and the stored value is
 * adopted in an effect immediately after mount. Writes are wrapped in
 * try/catch so a full or blocked storage quota never breaks the tool.
 */
export function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial)
  /** Set once the user (or the tool) has written a value, so the async read can't clobber it. */
  const dirty = useRef(false)

  useEffect(() => {
    dirty.current = false
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) return
      const parsed = JSON.parse(raw) as T
      if (!dirty.current) setValue(parsed)
    } catch {
      /* unreadable / malformed / storage disabled — keep the initial value */
    }
  }, [key])

  const set = useCallback(
    (next: T) => {
      dirty.current = true
      setValue(next)
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        /* quota exceeded or storage disabled — the in-memory value still applies */
      }
    },
    [key],
  )

  return [value, set]
}
