import type { MouseEvent, KeyboardEvent } from 'react'
import type { Option } from './useSearch'

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** What picking a row does: open a tool or category, or copy an answer. */
export function pickOption(
  option: Option,
  event: MouseEvent | KeyboardEvent,
  onCopied: (key: string) => void,
): void {
  if (option.kind === 'answer') {
    event.preventDefault()
    void copyText(option.answer.copy).then((ok) => ok && onCopied(option.key))
    return
  }
  const href = option.kind === 'tool' ? option.tool.href : option.kind === 'category' ? option.category.href : option.href
  // Let the browser handle a click that opens a new tab or window.
  if ('button' in event && (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)) return
  event.preventDefault()
  if (event.metaKey || event.ctrlKey) window.open(href, '_blank', 'noopener')
  else window.location.assign(href)
}
