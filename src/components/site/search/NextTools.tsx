import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ToolDoc } from '@/lib/search/data'
import { loadSearcher } from '@/lib/search/load'
import { readNext } from '@/lib/search/usage'
import { Glyph } from './Glyph'
import { prefersReducedMotion } from './useFlip'

interface Props {
  /** The tool on this page. */
  slug: string
}

const COUNT = 3

/**
 * Three tools to use next: the ones this visitor opened after this tool before (counted in this
 * browser only), then the tool's related tools, then popular tools of its category. Renders
 * nothing until the list is known.
 */
export default function NextTools({ slug }: Props) {
  const [tools, setTools] = useState<ToolDoc[] | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  useEffect(() => {
    let live = true
    loadSearcher()
      .then((s) => {
        const current = s.bySlug.get(slug)
        const out: ToolDoc[] = []
        const add = (t: ToolDoc | undefined) => {
          if (t && t.slug !== slug && !out.includes(t) && out.length < COUNT) out.push(t)
        }
        for (const [next, n] of readNext(slug)) if (n >= 1) add(s.bySlug.get(next))
        for (const i of current?.related ?? []) add(s.tools[i])
        if (current) {
          const siblings = s.tools.filter((t) => t.category === current.category)
          siblings.sort((a, b) => (a.rank || 999) - (b.rank || 999))
          for (const t of siblings) add(t)
        }
        if (live) setTools(out)
      })
      .catch(() => live && setTools([]))
    return () => {
      live = false
    }
  }, [slug])

  useLayoutEffect(() => {
    if (!tools?.length || prefersReducedMotion()) return
    listRef.current?.querySelectorAll('li').forEach((li, i) =>
      li.animate(
        [
          { opacity: 0, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 280, delay: i * 60, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
      ),
    )
  }, [tools])

  if (!tools?.length) return null
  return (
    <section aria-labelledby="next-tools">
      <h2 id="next-tools" className="t-h3">
        Next
      </h2>
      <ul ref={listRef} className="mt-3 grid gap-1 sm:grid-cols-3">
        {tools.map((t) => (
          <li key={t.slug}>
            <a
              href={t.href}
              className="group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Glyph id={t.category.id} className="size-[1.125rem]" />
              <span className="min-w-0">
                <span className="block truncate text-[0.9375rem] font-[650]">{t.title}</span>
                <span className="block truncate text-[0.8125rem] text-muted-foreground">{t.category.title}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
