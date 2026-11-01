/**
 * Wire format of /search-index.json and its decoded form. Rows are arrays, not objects, so the
 * file stays small; `decodeIndex` turns them into named fields once, on load.
 */

/** [id, title, slug, tagline] */
export type CategoryRow = [string, string, string, string]

/**
 * [slug, title, category index, keyword phrases joined by "|", extra words from the description,
 * accepted extensions joined by " ", popularity rank (1 = most used, 0 = not ranked),
 * related tool indexes]
 */
export type ToolRow = [string, string, number, string, string, string, number, number[]]

export interface SearchIndex {
  v: 1
  c: CategoryRow[]
  t: ToolRow[]
}

export interface CategoryDoc {
  index: number
  id: string
  title: string
  slug: string
  tagline: string
  href: string
  count: number
}

export interface ToolDoc {
  index: number
  slug: string
  title: string
  href: string
  category: CategoryDoc
  keywords: string[]
  extra: string
  accepts: string[]
  rank: number
  related: number[]
}

export interface Catalog {
  tools: ToolDoc[]
  categories: CategoryDoc[]
  bySlug: Map<string, ToolDoc>
}

export function decodeIndex(index: SearchIndex): Catalog {
  const categories: CategoryDoc[] = index.c.map(([id, title, slug, tagline], i) => ({
    index: i,
    id,
    title,
    slug,
    tagline,
    href: `/category/${slug}`,
    count: 0,
  }))
  const tools: ToolDoc[] = index.t.map(([slug, title, cat, keywords, extra, accepts, rank, related], i) => {
    const category = categories[cat]
    category.count++
    return {
      index: i,
      slug,
      title,
      href: `/${slug}`,
      category,
      keywords: keywords ? keywords.split('|') : [],
      extra,
      accepts: accepts ? accepts.split(' ') : [],
      rank,
      related,
    }
  })
  return { tools, categories, bySlug: new Map(tools.map((t) => [t.slug, t])) }
}
