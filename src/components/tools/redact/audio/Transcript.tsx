/**
 * The transcript as a row of word buttons. A bleeped word is drawn as an ink
 * block. Click or press Enter to switch a word; arrow keys move between words
 * (one tab stop for the whole transcript). A new paragraph starts after a long
 * pause, with its start time.
 */
import { memo, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { formatTimecode } from '@/components/tools/media/_ffmpeg'
import { cn } from '@/lib/utils'
import type { Word } from '@/lib/ml/speech/types'

const PARAGRAPH_GAP_S = 1.2

interface Props {
  words: readonly Word[]
  marked: ReadonlySet<number>
  /** Why a word was found, for its tooltip. */
  reasons: ReadonlyMap<number, string>
  /** Index of the word being played, or -1. */
  playing: number
  onToggle: (index: number) => void
}

export const Transcript = memo(function Transcript({ words, marked, reasons, playing, onToggle }: Props) {
  const [focus, setFocus] = useState(0)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const paragraphs = useMemo(() => {
    const out: number[][] = []
    words.forEach((w, i) => {
      const prev = words[i - 1]
      if (!prev || w.start - prev.end > PARAGRAPH_GAP_S) out.push([])
      out[out.length - 1].push(i)
    })
    return out
  }, [words])

  const move = (to: number) => {
    const i = Math.max(0, Math.min(words.length - 1, to))
    setFocus(i)
    refs.current[i]?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const keys: Record<string, number> = { ArrowRight: i + 1, ArrowDown: i + 8, ArrowLeft: i - 1, ArrowUp: i - 8, Home: 0, End: words.length - 1 }
    if (e.key in keys) {
      e.preventDefault()
      move(keys[e.key])
    }
  }

  return (
    <div role="group" aria-label="Transcript. Press a word to bleep it or keep it." className="space-y-4">
      {paragraphs.map((para) => (
        <p key={para[0]} className="leading-[2]">
          <span className="num mr-2 text-[0.8125rem] text-muted-foreground" aria-hidden="true">
            {formatTimecode(words[para[0]].start, 0)}
          </span>
          {para.map((i) => {
            const w = words[i]
            const on = marked.has(i)
            const why = reasons.get(i)
            const label = w.text.trim()
            const joinPrev = on && i !== para[0] && marked.has(i - 1)
            const joinNext = on && i !== para[para.length - 1] && marked.has(i + 1)
            return (
              <span key={i}>
                {i !== para[0] && <span className={joinPrev ? 'bg-foreground pt-[calc(0.15em+1px)] pb-[calc(0.15em+3px)]' : undefined}> </span>}
                <button
                  ref={(el) => {
                    refs.current[i] = el
                  }}
                  type="button"
                  tabIndex={i === focus ? 0 : -1}
                  aria-pressed={on}
                  title={`${formatTimecode(w.start)}${why ? `, ${why}` : ''}`}
                  onClick={() => {
                    setFocus(i)
                    onToggle(i)
                  }}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={cn(
                    'rounded-[4px] px-0.5 py-px text-left leading-[1.5] outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    on ? 'bg-foreground text-background' : 'hover:bg-background',
                    joinPrev && 'rounded-l-none',
                    joinNext && 'rounded-r-none',
                    i === playing && 'underline decoration-2 underline-offset-4',
                  )}
                >
                  {label}
                </button>
              </span>
            )
          })}
        </p>
      ))}
    </div>
  )
})
