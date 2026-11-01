import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

/**
 * Local-storage backed state.
 *
 * Renders the `initial` value on the first paint (so the statically generated
 * HTML and the hydrated island always agree), then swaps in the persisted value
 * on mount. Writes are best-effort: private-mode / quota errors are swallowed
 * rather than crashing the calculator.
 */
export function useLocalStorage<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial)
  const hydrated = useRef(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) setValue(JSON.parse(raw) as T)
    } catch {
      /* unreadable or corrupt entry — keep the default */
    }
    hydrated.current = true
  }, [key])

  useEffect(() => {
    if (!hydrated.current) return
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage full or blocked — the calculator still works */
    }
  }, [key, value])

  return [value, setValue]
}

/**
 * "Today", safe for a statically pre-rendered island.
 *
 * The first render (the one baked into the HTML at build time) uses a fixed
 * reference date so the server markup and the first client render match
 * exactly; the real current date arrives on mount, one tick later.
 */
export function useToday(): Date {
  const [today, setToday] = useState<Date>(() => new Date(2026, 0, 1))
  useEffect(() => {
    setToday(new Date())
  }, [])
  return today
}
