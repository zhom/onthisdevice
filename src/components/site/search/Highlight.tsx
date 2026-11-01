import type { ReactNode } from 'react'
import type { Range } from '@/lib/search/engine'

/** Text with the matched characters in a heavier weight. Weight, not colour, marks a match. */
export function Highlight({ text, ranges }: { text: string; ranges: readonly Range[] }) {
  if (ranges.length === 0) return <>{text}</>
  const parts: ReactNode[] = []
  let at = 0
  for (const [start, end] of ranges) {
    if (start > at) parts.push(text.slice(at, start))
    parts.push(
      <b key={start} className="font-[700]">
        {text.slice(start, end)}
      </b>,
    )
    at = end
  }
  if (at < text.length) parts.push(text.slice(at))
  return <>{parts}</>
}
