/**
 * Runs on every page (SearchRuntime.astro). Small on purpose: it records tool visits for the
 * visitor's own history and waits for a file to be dragged or pasted; only then does it load
 * the drop screen.
 */
import { pageInfo } from '@/lib/search/runtime'
import { recordVisit } from '@/lib/search/usage'

type DropModule = typeof import('./drop-mount')

const info = pageInfo()
if (info.tool) recordVisit(info.tool)

let loading: Promise<DropModule> | null = null
const load = () => (loading ??= import('./drop-mount'))

const carriesFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

/** A tool's own drop zone: marked with data-dropzone, or a box that holds a file input. */
function overDropzone(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null
  for (let depth = 0; el && depth < 8; depth++, el = el.parentElement) {
    if (el.hasAttribute('data-dropzone') || el.querySelector(':scope > input[type="file"]')) return true
  }
  return false
}

const editable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

let dragging = false
let watchdog = 0
function endDrag(): void {
  window.clearTimeout(watchdog)
  if (!dragging) return
  dragging = false
  void load().then((m) => m.dragLeave())
}

window.addEventListener('dragover', (e) => {
  if (!carriesFiles(e)) return
  if (overDropzone(e.target)) return endDrag()
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  dragging = true
  // dragover repeats while a drag is over the page (at least every ~550 ms); long silence
  // means the drag ended somewhere we were not told about.
  window.clearTimeout(watchdog)
  watchdog = window.setTimeout(endDrag, 1200)
  const { clientX, clientY } = e
  void load().then((m) => m.dragOver(clientX, clientY))
})

// Leaving the window: no element to enter, and the pointer at or past an edge.
window.addEventListener('dragleave', (e) => {
  if (!dragging || e.relatedTarget) return
  const { clientX: x, clientY: y } = e
  if (x <= 0 || y <= 0 || x >= window.innerWidth || y >= window.innerHeight) endDrag()
})

window.addEventListener('drop', (e) => {
  if (!carriesFiles(e) || e.defaultPrevented || overDropzone(e.target)) return
  e.preventDefault()
  window.clearTimeout(watchdog)
  dragging = false
  const files = Array.from(e.dataTransfer?.files ?? [])
  const { clientX, clientY } = e
  void load().then((m) => m.drop(files, clientX, clientY))
})

// Paste a file on a page without its own file input (home, hubs, calculators).
window.addEventListener('paste', (e) => {
  if (e.defaultPrevented || editable(e.target) || document.querySelector('main input[type="file"]')) return
  const files = Array.from(e.clipboardData?.files ?? [])
  if (files.length === 0) return
  e.preventDefault()
  void load().then((m) => m.drop(files, window.innerWidth / 2, window.innerHeight / 2))
})
