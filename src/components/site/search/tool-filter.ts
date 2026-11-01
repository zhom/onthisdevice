/**
 * /all-tools: the full list is static HTML; this filters it with the on-device engine as you
 * type, ranks what is left (CSS `order`, so no node moves), filters by category, keeps ?q= and
 * ?c= in the URL, and animates rows to their new places.
 */
import type { Searcher } from '@/lib/search/engine'
import { loadSearcher } from '@/lib/search/load'

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

interface Section {
  el: HTMLElement
  slug: string
  items: HTMLElement[]
  count: HTMLElement | null
}

export function initToolFilter(): void {
  const input = document.getElementById('tool-filter')
  const counter = document.querySelector<HTMLElement>('[data-filter-count]')
  const empty = document.querySelector<HTMLElement>('[data-empty]')
  const list = document.getElementById('tools')
  if (!(input instanceof HTMLInputElement) || !counter || !empty || !list) return

  const sections: Section[] = [...document.querySelectorAll<HTMLElement>('[data-section]')].map((el) => ({
    el,
    slug: el.dataset.section ?? '',
    items: [...el.querySelectorAll<HTMLElement>('[data-tool]')],
    count: el.querySelector<HTMLElement>('[data-section-count]'),
  }))
  const items = sections.flatMap((s) => s.items)
  const total = items.length
  const catLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-cat]')]
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

  const params = new URLSearchParams(location.search)
  const state = { q: params.get('q') ?? '', c: params.get('c') ?? '' }
  if (!sections.some((s) => s.slug === state.c)) state.c = ''
  input.value = state.q

  let searcher: Searcher | null = null
  let loading: Promise<void> | null = null
  const load = () =>
    (loading ??= loadSearcher().then(
      (s) => {
        searcher = s
        apply(false)
      },
      () => {
        loading = null
        counter.textContent = 'Search did not load. Reload the page to try again.'
      },
    ))

  /** On-screen top of every visible row, before a change. */
  const snapshot = () => {
    const tops = new Map<HTMLElement, DOMRect>()
    if (reduced.matches) return tops
    for (const el of items) if (!el.hidden) tops.set(el, el.getBoundingClientRect())
    return tops
  }

  const play = (before: Map<HTMLElement, DOMRect>) => {
    if (reduced.matches) return
    const view = window.innerHeight
    let fresh = 0
    for (const el of items) {
      if (el.hidden) continue
      for (const a of el.getAnimations()) a.cancel()
      const now = el.getBoundingClientRect()
      if (now.top > view || now.bottom < 0) continue
      const was = before.get(el)
      if (!was) {
        el.animate(
          [
            { opacity: 0, transform: 'translateY(8px)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 240, delay: Math.min(fresh++ * 12, 160), easing: EASE, fill: 'backwards' },
        )
      } else if (Math.abs(was.top - now.top) + Math.abs(was.left - now.left) > 1) {
        el.animate(
          [{ transform: `translate(${was.left - now.left}px, ${was.top - now.top}px)` }, { transform: 'none' }],
          { duration: 300, easing: EASE },
        )
      }
    }
  }

  function apply(animate: boolean): void {
    const q = state.q.trim()
    if (q && !searcher) {
      counter!.textContent = 'Loading'
      void load()
      return
    }
    // Keep the results in view: a filter typed far down the page starts at the top of the list.
    const listTop = list!.getBoundingClientRect().top + window.scrollY - 200
    if (animate && window.scrollY > listTop) window.scrollTo({ top: listTop })
    const before = animate ? snapshot() : new Map<HTMLElement, DOMRect>()

    let rank: Map<string, number> | null = null
    if (q && searcher) {
      const result = searcher.search(q, { limit: Infinity, highlight: false, floor: 0.05 })
      rank = new Map(result.tools.map((h, i) => [h.tool.slug, i]))
    }
    let shown = 0
    for (const s of sections) {
      const inCategory = !state.c || s.slug === state.c
      let n = 0
      let best = Number.MAX_SAFE_INTEGER
      for (const el of s.items) {
        const r = rank ? rank.get(el.dataset.tool ?? '') : 0
        const on = inCategory && r !== undefined
        el.hidden = !on
        el.style.order = rank && r !== undefined ? String(r) : ''
        if (on) {
          n++
          best = Math.min(best, r ?? 0)
        }
      }
      s.el.hidden = n === 0
      s.el.style.order = rank && n ? String(best) : ''
      if (s.count) s.count.textContent = String(n)
      shown += n
    }
    empty!.hidden = shown > 0
    counter!.textContent = q || state.c ? `${shown} of ${total} tools` : `${total} tools`
    for (const a of catLinks) a.setAttribute('aria-current', String((a.dataset.cat ?? '') === state.c))

    const url = new URL(location.href)
    url.hash = ''
    if (q) url.searchParams.set('q', q)
    else url.searchParams.delete('q')
    if (state.c) url.searchParams.set('c', state.c)
    else url.searchParams.delete('c')
    history.replaceState(history.state, '', url)

    if (animate) play(before)
  }

  let frame = 0
  input.addEventListener('input', () => {
    state.q = input.value
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => apply(true))
  })
  input.form?.addEventListener('submit', (e) => {
    e.preventDefault()
    input.blur()
  })
  input.addEventListener('focus', () => void load(), { once: true })
  input.addEventListener('pointerenter', () => void load(), { once: true })

  for (const a of catLinks) {
    a.addEventListener('click', (e) => {
      e.preventDefault()
      const c = a.dataset.cat ?? ''
      state.c = state.c === c ? '' : c
      apply(true)
    })
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-filter-clear]')) {
    b.addEventListener('click', () => {
      state.q = ''
      state.c = ''
      input.value = ''
      apply(true)
      input.focus()
    })
  }

  if (state.q) void load()
  else if (state.c) apply(false)
}
