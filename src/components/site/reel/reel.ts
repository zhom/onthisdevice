/**
 * Plays the home reel (./scenes.ts, ./paint.ts) on a canvas, keeps the caption, the scene bars
 * and the heading phrase in step, and pauses offscreen, in a hidden tab and on request.
 * Reduced motion: each scene is a still frame, and the bars choose the scene.
 */
import { SCENES, SCENE_MS } from './scenes'
import { FILL, GREY, INK, PAINTERS, STILL, hash, type Colors, type Grid, type Painter, type Tone } from './paint'

/** The first part of a scene dissolves from the previous one. */
const DISSOLVE = 0.1
const FRAME_MS = 1000 / 30
const DOT = 0.8

export function mountReel(root: HTMLElement, phrase: HTMLElement | null) {
  const host = root.querySelector<HTMLElement>('[data-reel-canvas]')
  const canvas = host?.querySelector('canvas')
  const ctx = canvas?.getContext('2d')
  const link = root.querySelector<HTMLAnchorElement>('[data-reel-link]')
  const title = root.querySelector<HTMLElement>('[data-reel-title]')
  const note = root.querySelector<HTMLElement>('[data-reel-note]')
  const caption = root.querySelector<HTMLElement>('[data-reel-caption]')
  const pause = root.querySelector<HTMLButtonElement>('[data-reel-pause]')
  const steps = [...root.querySelectorAll<HTMLButtonElement>('[data-reel-go]')]
  const bars = steps.map((b) => b.querySelector<HTMLElement>('[data-reel-bar]'))
  if (!host || !canvas || !ctx || steps.length !== SCENES.length) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')

  let w = 0
  let h = 0
  let dpr = 1
  let cell = 6
  let grid: Grid = { cols: 1, rows: 1, aspect: 1 }
  let ox = 0
  let oy = 0
  let colors: Colors = { ink: '#000', grey: '#6b6b6b', fill: '#f3f3f3', paper: '#fff' }

  /** Play time since the reel started, without pauses. */
  let elapsed = DISSOLVE * SCENE_MS
  let shown = 0
  let previous = 0
  let paused = false
  let visible = false
  let raf = 0
  let last = 0
  let drawn = 0

  const readColors = () => {
    const css = getComputedStyle(host)
    const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
    colors = { ink: css.color || '#000', grey: v('--muted-foreground', '#6b6b6b'), fill: v('--muted', '#f3f3f3'), paper: v('--background', '#fff') }
  }

  const size = () => {
    const rect = host.getBoundingClientRect()
    const nw = Math.max(1, Math.round(rect.width))
    const nh = Math.max(1, Math.round(rect.height))
    const ndpr = Math.min(2, window.devicePixelRatio || 1)
    if (nw === w && nh === h && ndpr === dpr) return
    w = nw
    h = nh
    dpr = ndpr
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    cell = w < 420 ? 5 : 6
    const cols = Math.floor(w / cell)
    const rows = Math.floor(h / cell)
    grid = { cols, rows, aspect: cols / rows }
    ox = Math.floor((w - cols * cell) / 2)
    oy = Math.floor((h - rows * cell) / 2)
    for (const p of Object.values(PAINTERS)) p.prepare?.(grid)
    readColors()
  }

  const painterOf = (i: number): Painter => PAINTERS[SCENES[i].id]

  const draw = (index: number, t: number) => {
    const now = painterOf(index)
    const before = painterOf(previous)
    const mix = t < DISSOLVE && !reduce.matches ? smooth(t / DISSOLVE) : 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const paths: Record<Exclude<Tone, 0>, Path2D> = { [INK]: new Path2D(), [FILL]: new Path2D(), [GREY]: new Path2D() }
    const step = cell * dpr
    const dot = Math.max(1, Math.round(step * DOT))
    for (let y = 0; y < grid.rows; y++) {
      const py = Math.round((oy + y * cell) * dpr)
      for (let x = 0; x < grid.cols; x++) {
        const fresh = mix >= 1 || hash(x + 101, y + 37) < mix
        const tone = fresh ? now.cell(x, y, t, grid) : before.cell(x, y, STILL, grid)
        if (tone) paths[tone].rect(Math.round((ox + x * cell) * dpr), py, dot, dot)
      }
    }
    ctx.fillStyle = colors.fill
    ctx.fill(paths[FILL])
    ctx.fillStyle = colors.grey
    ctx.fill(paths[GREY])
    ctx.fillStyle = colors.ink
    ctx.fill(paths[INK])

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.textBaseline = 'alphabetic'
    if (mix < 1 && before.type) {
      ctx.save()
      ctx.globalAlpha = 1 - mix
      before.type(ctx, STILL, { w, h }, colors)
      ctx.restore()
    }
    now.type?.(ctx, t, { w, h }, colors)
  }

  const show = (index: number) => {
    if (index === shown) return
    previous = shown
    shown = index
    const scene = SCENES[index]
    const step = steps[index]
    if (link) link.href = `/${scene.slug}`
    if (title) title.textContent = step.dataset.title ?? scene.phrase
    if (note) note.textContent = scene.note
    steps.forEach((b, i) => b.setAttribute('aria-current', String(i === index)))
    if (!reduce.matches) caption?.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
    if (phrase) swapPhrase(phrase, scene.phrase, reduce.matches)
  }

  const position = () => {
    const total = SCENE_MS * SCENES.length
    const at = ((elapsed % total) + total) % total
    return { index: Math.floor(at / SCENE_MS), t: (at % SCENE_MS) / SCENE_MS }
  }

  const render = () => {
    const still = reduce.matches
    const { index, t } = position()
    show(index)
    draw(index, still ? STILL : t)
    bars.forEach((bar, i) => {
      if (!bar) return
      const fill = still ? (i === index ? 1 : 0) : i < index ? 1 : i === index ? t : 0
      bar.style.transform = `scaleX(${fill})`
    })
  }

  const playing = () => visible && !paused && !reduce.matches

  const frame = (now: number) => {
    raf = 0
    if (!playing()) return
    elapsed += Math.min(100, now - last)
    last = now
    if (now - drawn >= FRAME_MS - 2) {
      drawn = now
      render()
    }
    raf = requestAnimationFrame(frame)
  }

  const wake = () => {
    if (raf || !playing()) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  const jump = (index: number) => {
    elapsed = index * SCENE_MS + (paused || reduce.matches ? STILL * SCENE_MS : 0)
    render()
  }

  steps.forEach((b, i) => b.addEventListener('click', () => jump(i)))
  pause?.addEventListener('click', () => {
    paused = !paused
    pause.setAttribute('aria-pressed', String(paused))
    pause.setAttribute('aria-label', paused ? 'Play the animation' : 'Pause the animation')
    pause.dataset.paused = String(paused)
    if (paused) render()
    else wake()
  })

  size()
  render()
  // Canvas type needs the web font; draw again once it is ready.
  document.fonts?.ready.then(() => render())

  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting) && !document.hidden
    wake()
  }).observe(host)
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden && host.getBoundingClientRect().bottom > 0
    wake()
  })
  let resizeTimer = 0
  new ResizeObserver(() => {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      size()
      render()
    }, 80)
  }).observe(host)
  new MutationObserver(() => {
    readColors()
    render()
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  reduce.addEventListener('change', () => {
    render()
    wake()
  })
}

const smooth = (p: number) => p * p * (3 - 2 * p)

/** The heading phrase wipes out to the right, then the new one wipes in from the left. */
function swapPhrase(el: HTMLElement, text: string, still: boolean) {
  if (el.textContent === text) return
  if (still) {
    el.textContent = text
    return
  }
  const shown = 'inset(-0.25em 0 -0.25em 0)'
  el.getAnimations().forEach((a) => a.cancel())
  el.animate([{ clipPath: shown }, { clipPath: 'inset(-0.25em 0 -0.25em 100%)' }], {
    duration: 180,
    easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
    fill: 'forwards',
  }).onfinish = () => {
    el.textContent = text
    el.animate([{ clipPath: 'inset(-0.25em 100% -0.25em 0)' }, { clipPath: shown }], {
      duration: 300,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards',
    })
  }
}
