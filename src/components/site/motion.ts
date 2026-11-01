/**
 * Site-wide motion that is not tied to one component:
 * - the theme switch, revealed in a circle from the switch that was pressed;
 * - category glyphs, which run only while on screen and in a visible tab.
 */
const root = document.documentElement
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')

/* Theme switch */
const label = () => {
  const dark = root.classList.contains('dark')
  for (const b of document.querySelectorAll('[data-theme-toggle]'))
    b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme')
  for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.content = dark ? '#000000' : '#ffffff'
}
const apply = (dark: boolean) => {
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  try {
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  } catch {
    /* storage blocked: the switch still applies to this page view */
  }
  label()
}
label()
for (const button of document.querySelectorAll<HTMLElement>('[data-theme-toggle]')) {
  button.addEventListener('click', () => {
    const dark = !root.classList.contains('dark')
    if (!document.startViewTransition || reduce.matches) {
      apply(dark)
      return
    }
    const r = button.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    root.classList.add('vt-theme')
    const t = document.startViewTransition(() => apply(dark))
    t.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
          { duration: 620, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
        )
      })
      .catch(() => {})
    t.finished.finally(() => root.classList.remove('vt-theme'))
  })
}

/* Glyphs: live only on screen. */
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) e.target.classList.toggle('is-live', e.isIntersecting)
  },
  { rootMargin: '48px' },
)
for (const g of document.querySelectorAll('.glyph[data-glyph]')) io.observe(g)
const syncHidden = () => root.classList.toggle('is-hidden', document.hidden)
document.addEventListener('visibilitychange', syncHidden)
syncHidden()
