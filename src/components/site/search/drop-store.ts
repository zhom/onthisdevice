/**
 * State of the drop-anywhere screen, outside React so the tiny page loader can drive it before
 * and after the UI mounts.
 */
import type { ToolDoc } from '@/lib/search/data'
import type { FileKind } from '@/lib/search/files'
import { detectFile, kindOf, toolTakes, toolsForFile } from '@/lib/search/files'
import { loadSearcher } from '@/lib/search/load'
import { pageInfo } from '@/lib/search/runtime'
import { usageBoost } from '@/lib/search/usage'
import type { Point } from './useReveal'

export type DropState =
  | { phase: 'idle' }
  | { phase: 'drag'; at: Point }
  | { phase: 'reading'; at: Point; files: File[] }
  | { phase: 'pick'; at: Point; files: File[]; kind: FileKind; tools: ToolDoc[]; here?: ToolDoc }
  | { phase: 'error'; at: Point; message: string }
  /** Closing after the files went into this page's own tool. */
  | { phase: 'done'; at: Point }

let state: DropState = { phase: 'idle' }
const listeners = new Set<() => void>()

export const getState = (): DropState => state
export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function set(next: DropState): void {
  state = next
  for (const fn of listeners) fn()
}

export function dragOver(x: number, y: number): void {
  if (state.phase === 'reading') return
  if (state.phase !== 'drag' || Math.abs(state.at.x - x) + Math.abs(state.at.y - y) > 24) set({ phase: 'drag', at: { x, y } })
}

export function dragLeave(): void {
  if (state.phase === 'drag') set({ phase: 'idle' })
}

export function close(): void {
  set({ phase: 'idle' })
}

/** The page's own file input, when its tool is on screen. */
function pageInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>('main input[type="file"]:not([disabled])')
}

/** Puts files into a file input as if they were picked, so the tool's own handler runs. */
function deliver(input: HTMLInputElement, files: File[]): boolean {
  try {
    const dt = new DataTransfer()
    for (const f of input.multiple ? files : files.slice(0, 1)) dt.items.add(f)
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  } catch {
    return false
  }
}

export async function drop(files: File[], x: number, y: number): Promise<void> {
  const at = { x, y }
  if (files.length === 0) return close()
  set({ phase: 'reading', at, files })
  try {
    const [kinds, searcher] = await Promise.all([Promise.all(files.map(detectFile)), loadSearcher()])
    // The kind most of the files share.
    const count = new Map<string, number>()
    for (const k of kinds) count.set(k.ext, (count.get(k.ext) ?? 0) + 1)
    const main = [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    const kind = kinds.find((k) => k.ext === main) ?? kindOf('')
    const same = files.filter((_, i) => kinds[i].ext === main)

    const info = pageInfo()
    const here = info.tool ? searcher.bySlug.get(info.tool) : undefined
    if (here && here.accepts.length && toolTakes(here, kind)) {
      const input = pageInput()
      if (input && deliver(input, same)) return set({ phase: 'done', at: { x: innerWidth / 2, y: innerHeight / 2 } })
    }
    let tools = toolsForFile(searcher, kind, { count: same.length, boost: usageBoost(), limit: 7 }).map((m) => m.tool)
    // This page's tool takes the file but shows no file input now: offer it first (it reloads).
    if (here && toolTakes(here, kind)) tools = [here, ...tools.filter((t) => t !== here)].slice(0, 7)
    set({ phase: 'pick', at, files: same, kind, tools, here })
  } catch {
    set({ phase: 'error', at, message: 'This file could not be read here.' })
  }
}
