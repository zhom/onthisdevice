/**
 * Tools whose page exists in src/pages. A tool can be registered before its
 * page is written; lists and menus link only to pages that exist.
 */
const files = Object.keys(import.meta.glob('/src/pages/*.astro'))
const SLUGS = new Set(files.map((f) => f.slice('/src/pages/'.length, -'.astro'.length)))

export const hasPage = (tool: { slug: string }): boolean => SLUGS.has(tool.slug)
