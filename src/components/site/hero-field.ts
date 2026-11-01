/**
 * The home hero: a page drawn in square pixels. A scan passes down the page
 * and the pixels change state: the document, the same document with names and
 * numbers redacted, then the page converted to an image, and back. Every pixel
 * stays on the page. The pointer is a lens that shows the next state;
 * scrolling folds the page into one pixel. Pauses offscreen and in a hidden
 * tab; reduced motion draws one still frame.
 */

const STATES = 3
const SCAN_MS = 2600
const HOLD_MS = 3200

type Grid = Uint8Array
/** A grid value: 1 is a pixel, SOLID is a pixel that grows to fill its cell (a redaction bar). */
const SOLID = 2
const DOT = 0.72

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** Three grids (document, redacted, image) for a page of cols x rows pixels. */
function compose(cols: number, rows: number): Grid[] {
  const size = cols * rows
  const doc = new Uint8Array(size)
  const red = new Uint8Array(size)
  const img = new Uint8Array(size)
  const at = (x: number, y: number) => y * cols + x
  const both = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return
    doc[at(x, y)] = 1
    red[at(x, y)] = 1
  }
  const rand = rng(cols * 131 + rows)

  // Heading: two rows, about half the width.
  let y = 0
  const head = Math.max(6, Math.round(cols * 0.52))
  for (let x = 0; x < head; x++) {
    both(x, y)
    both(x, y + 1)
  }
  y += 5

  // A picture on the left of the first paragraph lines.
  const imgW = Math.max(6, Math.round(cols * 0.32))
  const imgH = Math.min(Math.round(imgW * 0.85), rows - y - 2)
  const imgTop = y
  const cx = imgW / 2
  const cy = imgTop + imgH / 2
  const r = Math.min(imgW, imgH) * 0.36
  for (let py = imgTop; py < imgTop + imgH; py++) {
    for (let px = 0; px < imgW; px++) {
      const d = Math.hypot(px + 0.5 - cx, py + 0.5 - cy)
      const edge = px === 0 || px === imgW - 1 || py === imgTop || py === imgTop + imgH - 1
      if (edge || (d < r && (px + py) % 2 === 0)) doc[at(px, py)] = 1
      red[at(px, py)] = SOLID
    }
  }

  // Paragraphs: a line of words every second row, a blank row between paragraphs.
  let inPara = 0
  const paraLen = () => 3 + Math.floor(rand() * 3)
  let limit = paraLen()
  while (y < rows - 1) {
    const left = y < imgTop + imgH ? imgW + 2 : 0
    const last = inPara === limit - 1
    const right = cols - (last ? Math.floor((cols - left) * (0.3 + rand() * 0.3)) : Math.floor(rand() * 3))
    let x = left
    let prevHidden = false
    while (x < right) {
      const len = Math.min(2 + Math.floor(rand() * 5), right - x)
      if (len < 2) break
      const hide = rand() < 0.17
      for (let i = 0; i < len; i++) {
        both(x + i, y)
        if (hide) {
          red[at(x + i, y)] = SOLID
          if (y + 1 < rows) red[at(x + i, y + 1)] = SOLID
        }
      }
      if (hide && prevHidden && x > 0) {
        red[at(x - 1, y)] = SOLID
        if (y + 1 < rows) red[at(x - 1, y + 1)] = SOLID
      }
      prevHidden = hide
      x += len + 1
    }
    y += 2
    inPara++
    if (inPara >= limit) {
      inPara = 0
      limit = paraLen()
      y += 1
    }
  }

  // The image: an ordered dither of a soft disc, light at the edges.
  const ix = cols * 0.62
  const iy = rows * 0.42
  const reach = Math.hypot(cols, rows) * 0.62
  for (let py = 0; py < rows; py++) {
    for (let px = 0; px < cols; px++) {
      const f = Math.max(0, 1 - Math.hypot(px - ix, py - iy) / reach)
      const t = BAYER[(py % 4) * 4 + (px % 4)] / 16
      if (t < f * f * 0.95) img[at(px, py)] = 1
    }
  }
  return [doc, red, img]
}

export function mountHeroField(host: HTMLElement) {
  const canvas = host.querySelector('canvas')
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')

  let cell = 10
  let cols = 0
  let rows = 0
  let w = 0
  let h = 0
  let dpr = 1
  let grids: Grid[] = []
  let scale = new Float32Array(0)
  let vel = new Float32Array(0)
  let ink = '#000'

  // Start on the document; the first scan redacts it.
  let state = 1
  let sized = false
  let cycleStart = performance.now()
  let pointer: { x: number; y: number } | null = null
  let lens = 0
  let fold = 0
  /** Canvas top relative to the viewport, from the last scroll. */
  let top = 0
  let raf = 0
  let visible = false
  let last = performance.now()

  const readInk = () => {
    ink = getComputedStyle(host).color || '#000'
  }

  const size = () => {
    const rect = host.getBoundingClientRect()
    const nw = Math.max(1, Math.round(rect.width))
    const nh = Math.max(1, Math.round(rect.height))
    if (sized && nw === w && nh === h && dpr === Math.min(2, window.devicePixelRatio || 1)) return
    w = nw
    h = nh
    dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    cell = w < 480 ? 9 : w < 760 ? 10 : 12
    cols = Math.floor(w / cell)
    rows = Math.floor(h / cell)
    grids = compose(cols, rows)
    scale = new Float32Array(cols * rows)
    vel = new Float32Array(cols * rows)
    const still = reduce.matches ? 1 : sized ? state : 0
    sized = true
    for (let i = 0; i < scale.length; i++) {
      const g = grids[still][i]
      scale[i] = g === SOLID ? 1 / DOT : g
    }
    lens = w < 480 ? 56 : 92
    readInk()
  }

  const scanRow = (now: number) => {
    const t = now - cycleStart
    if (t > SCAN_MS + HOLD_MS) {
      state = (state + 1) % STATES
      cycleStart = now
      return -3
    }
    return t < SCAN_MS ? (t / SCAN_MS) * (rows + 6) - 3 : rows + 3
  }

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = ink
    const ox = 0
    const oy = 0
    const e = fold * fold * (3 - 2 * fold)
    // Fold toward the middle of the part of the page that is still in view.
    const cxp = w / 2
    const cyp = (Math.min(h, Math.max(0, 64 - top)) + h) / 2
    const core = cell * 2.6
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const s = scale[y * cols + x]
        if (s < 0.02) continue
        let size = cell * DOT * Math.min(1.6, s)
        // Solid cells overlap a little so a bar has no seams.
        if (s > 1.2) size += 0.75
        let px = ox + x * cell + (cell * DOT) / 2
        let py = oy + y * cell + cell / 2
        if (e > 0) {
          px += (cxp - px) * e
          py += (cyp - py) * e
          size += (core - size) * e * e * e * e
        }
        ctx.fillRect(px - size / 2, py - size / 2, size, size)
      }
    }
  }

  const step = (now: number) => {
    raf = 0
    const dt = Math.min(0.033, (now - last) / 1000)
    last = now
    const scan = scanRow(now)
    const prev = (state + STATES - 1) % STATES
    const next = (state + 1) % STATES
    const ox = 0
    const oy = 0
    // The scan runs from row -3 to rows + 3; the loop stays on until it ends and the pixels settle.
    let moving = scan < rows + 3
    for (let y = 0; y < rows; y++) {
      const passed = y <= scan
      const wave = Math.abs(y - scan) < 2.5 ? 0.22 * (1 - Math.abs(y - scan) / 2.5) : 0
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x
        let k = passed ? state : prev
        if (pointer && fold < 0.05) {
          const dx = ox + x * cell + cell / 2 - pointer.x
          const dy = oy + y * cell + cell / 2 - pointer.y
          if (dx * dx + dy * dy < lens * lens) k = passed ? next : state
        }
        const g = grids[k][i]
        const target = g ? (g === SOLID ? 1 / DOT : 1) + wave : 0
        const a = 190 * (target - scale[i]) - 20 * vel[i]
        vel[i] += a * dt
        scale[i] += vel[i] * dt
        if (!moving && (Math.abs(vel[i]) > 0.01 || Math.abs(target - scale[i]) > 0.01)) moving = true
      }
    }
    draw()
    if (visible && (moving || pointer)) raf = requestAnimationFrame(step)
    else if (visible) window.setTimeout(wake, Math.max(16, cycleStart + SCAN_MS + HOLD_MS - performance.now()))
  }

  const wake = () => {
    if (!visible || raf || reduce.matches) return
    last = performance.now()
    raf = requestAnimationFrame(step)
  }

  const onScroll = () => {
    const rect = host.getBoundingClientRect()
    top = rect.top
    const p = Math.min(1, Math.max(0, (64 - rect.top) / (rect.height * 0.55)))
    if (Math.abs(p - fold) < 0.001) return
    fold = p
    if (reduce.matches) {
      draw()
      return
    }
    if (!raf) draw()
  }

  size()
  draw()

  if (!reduce.matches) {
    host.addEventListener('pointermove', (e) => {
      const r = host.getBoundingClientRect()
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top }
      wake()
    })
    host.addEventListener('pointerleave', () => {
      pointer = null
      wake()
    })
    window.addEventListener('scroll', onScroll, { passive: true })
  }

  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting) && !document.hidden
    if (visible) wake()
  }).observe(host)
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden && host.getBoundingClientRect().bottom > 0
    if (visible) {
      cycleStart = performance.now()
      wake()
    }
  })

  let resizeTimer = 0
  new ResizeObserver(() => {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      size()
      draw()
    }, 80)
  }).observe(host)
  new MutationObserver(() => {
    readInk()
    draw()
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  reduce.addEventListener('change', () => {
    size()
    draw()
  })
}
