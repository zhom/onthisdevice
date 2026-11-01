import { useEffect, useMemo, useState } from 'react'
import type { CategoryDoc, ToolDoc } from '@/lib/search/data'
import type { Range, SearchResult, Searcher } from '@/lib/search/engine'
import type { Answer } from '@/lib/search/load'
import { loadAnswers, loadSearcher } from '@/lib/search/load'
import { readRecents, usageBoost } from '@/lib/search/usage'

export type Option =
  | { kind: 'answer'; key: string; answer: Answer; tool?: ToolDoc }
  | { kind: 'tool'; key: string; tool: ToolDoc; ranges: readonly Range[] }
  | { kind: 'category'; key: string; category: CategoryDoc; ranges: readonly Range[] }
  /** "All 42 results": the full list on /all-tools. */
  | { kind: 'all'; key: string; href: string; count: number }

export interface Group {
  id: string
  label: string
  options: Option[]
}

export interface SearchView {
  status: 'idle' | 'loading' | 'ready' | 'error'
  groups: Group[]
  /** Options in display order, for keyboard movement. */
  flat: Option[]
  result: SearchResult | null
  retry: () => void
}

interface Config {
  /** Start loading the index. */
  enabled: boolean
  /** Max tool rows for a query. */
  limit: number
  /** Rows for an empty query. */
  recent: number
  popular: number
}

const toolOption = (tool: ToolDoc, prefix: string, ranges: readonly Range[] = []): Option => ({
  kind: 'tool',
  key: `${prefix}:${tool.slug}`,
  tool,
  ranges,
})

/**
 * The search state for one input: loads the index and the answers on first use, then turns each
 * query into groups of options (Answer, Tools, Categories; or Recent and Popular when empty).
 */
export function useSearch(query: string, config: Config): SearchView {
  const [searcher, setSearcher] = useState<Searcher | null>(null)
  const [answer, setAnswer] = useState<((q: string) => Answer | null) | null>(null)
  const [status, setStatus] = useState<SearchView['status']>('idle')
  const [attempt, setAttempt] = useState(0)
  const [history, setHistory] = useState<{ recents: string[]; boost: Map<string, number> } | null>(null)

  useEffect(() => {
    if (!config.enabled) return
    setHistory({ recents: readRecents(), boost: usageBoost() })
  }, [config.enabled])

  useEffect(() => {
    if (!config.enabled || searcher) return
    let live = true
    setStatus('loading')
    loadSearcher().then(
      (s) => {
        if (!live) return
        setSearcher(s)
        setStatus('ready')
      },
      () => live && setStatus('error'),
    )
    return () => {
      live = false
    }
  }, [config.enabled, searcher, attempt])

  useEffect(() => {
    if (!config.enabled || answer) return
    let live = true
    loadAnswers().then(
      (fn) => live && setAnswer(() => fn),
      () => {},
    )
    return () => {
      live = false
    }
  }, [config.enabled, answer, attempt])

  const trimmed = query.trim()
  const result = useMemo(
    () => (searcher && trimmed ? searcher.search(query, { limit: config.limit, boost: history?.boost }) : null),
    [searcher, query, trimmed, config.limit, history],
  )
  const instant = useMemo(() => (answer && trimmed ? answer(trimmed) : null), [answer, trimmed])

  const groups = useMemo<Group[]>(() => {
    if (!searcher) return []
    const out: Group[] = []
    if (!trimmed) {
      const recent = (history?.recents ?? [])
        .map((slug) => searcher.bySlug.get(slug))
        .filter((t): t is ToolDoc => Boolean(t))
        .slice(0, config.recent)
      if (recent.length) out.push({ id: 'recent', label: 'Recent', options: recent.map((t) => toolOption(t, 'r')) })
      const seen = new Set(recent.map((t) => t.slug))
      const popular = searcher.popular(config.popular + seen.size).filter((t) => !seen.has(t.slug))
      out.push({ id: 'popular', label: 'Popular', options: popular.slice(0, config.popular).map((t) => toolOption(t, 'p')) })
      return out
    }
    if (instant) {
      out.push({
        id: 'answer',
        label: 'Answer',
        options: [{ kind: 'answer', key: `a:${instant.kind}`, answer: instant, tool: searcher.bySlug.get(instant.slug) }],
      })
    }
    if (result?.tools.length) {
      const options = result.tools.map((h) => toolOption(h.tool, 't', h.ranges))
      if (result.total > result.tools.length) {
        options.push({ kind: 'all', key: 'all', href: `/all-tools?q=${encodeURIComponent(trimmed)}`, count: result.total })
      }
      out.push({ id: 'tools', label: 'Tools', options })
    }
    if (result?.categories.length) {
      out.push({
        id: 'categories',
        label: 'Categories',
        options: result.categories.map((h) => ({
          kind: 'category',
          key: `c:${h.category.slug}`,
          category: h.category,
          ranges: h.ranges,
        })),
      })
    }
    return out
  }, [searcher, trimmed, instant, result, history, config.recent, config.popular])

  const flat = useMemo(() => groups.flatMap((g) => g.options), [groups])

  return {
    status,
    groups,
    flat,
    result,
    retry: () => setAttempt((n) => n + 1),
  }
}
