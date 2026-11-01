/**
 * SearchRuntime.astro renders one hidden element with this id on every page. Its data says
 * where the index is (with a content version, so a deploy never reads a stale cached index) and
 * which tool the page is, if any.
 */
export const RUNTIME_ID = 'otd-search'

export interface PageInfo {
  /** URL of the search index. */
  index: string
  /** Slug of the tool on this page, or "" on other pages. */
  tool: string
  /** Title of that tool. */
  title: string
  /** Extensions the page's tool takes. */
  accepts: string[]
}

export function pageInfo(): PageInfo {
  const data = document.getElementById(RUNTIME_ID)?.dataset ?? {}
  return {
    index: data.index ?? '/search-index.json',
    tool: data.tool ?? '',
    title: data.title ?? '',
    accepts: (data.accepts ?? '').split(' ').filter(Boolean),
  }
}
