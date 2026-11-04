/**
 * The home page's one authored moment. A sentence about upload sites takes the site's own
 * redaction bars, word by word at reading speed. The words it keeps were the heading all along,
 * and they move into place. Any input ends it at once. Runs once per session and never under
 * reduced motion: the inline script in HeroSentence.astro decides, before the first paint.
 */

const READ_MS = 1200
const BAR_MS = 120
const HOLD_MS = 420
const MOVE_MS = 640
const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'
const SKIP = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

export function mountHeroRedact(): void {
  const root = document.documentElement
  const sentence = document.querySelector<HTMLElement>('[data-hero-sentence]')
  const title = document.querySelector<HTMLElement>('[data-hero-title]')
  if (!root.dataset.heroIntro || !sentence || !title) return

  const cuts = [...sentence.querySelectorAll<HTMLElement>('.cut')]
  const kept = [...sentence.querySelectorAll<HTMLElement>('[data-keep]')]
  const words = [...title.querySelectorAll<HTMLElement>('[data-word]')]
  const timers: number[] = []
  const at = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms))

  const finish = () => {
    timers.forEach(clearTimeout)
    for (const type of SKIP) removeEventListener(type, finish)
    delete root.dataset.heroIntro
  }

  const land = () => {
    sentence.classList.add('closing')
    const scale = parseFloat(getComputedStyle(title).fontSize) / parseFloat(getComputedStyle(sentence).fontSize)
    kept.forEach((word, i) => {
      const from = word.getBoundingClientRect()
      const to = words[i]!.getBoundingClientRect()
      const transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${scale})`
      word.animate([{ transform: 'none' }, { transform }], { duration: MOVE_MS, easing: EASE, fill: 'forwards' })
    })
    at(MOVE_MS, () => {
      // The heading is already in place: without this, .enter would replay when the guard goes.
      title.style.animation = 'none'
      finish()
    })
  }

  cuts.forEach((cut, i) => at(READ_MS + i * BAR_MS, () => cut.classList.add('on')))
  at(READ_MS + cuts.length * BAR_MS + HOLD_MS, land)
  for (const type of SKIP) addEventListener(type, finish, { passive: true })
}
