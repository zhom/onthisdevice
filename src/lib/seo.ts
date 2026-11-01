/**
 * Small SEO helpers shared by layouts and the share-card generator.
 */

/** Path of a page's generated 1200×630 share card. */
export function ogImagePath(pagePath: string): string {
  const clean = pagePath.replace(/^\/+|\/+$/g, '')
  return `/og/${clean ? clean.replace(/\//g, '--') : 'index'}.png`
}

/** Fit a <title> near 60 characters by trying candidates in order. */
export function fitTitle(candidates: string[], max = 60): string {
  return candidates.find((c) => c.length <= max) ?? candidates[candidates.length - 1]
}
