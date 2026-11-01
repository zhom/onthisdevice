import type { APIRoute } from 'astro'
import { siteIndex } from '@/lib/search/build'

export const prerender = true

/**
 * The search index, fetched same-origin the first time someone searches or drops a file.
 * Kept out of the JS bundle so no page pays for it up front. Format: src/lib/search/data.ts.
 */
export const GET: APIRoute = () =>
  new Response(siteIndex().json, { headers: { 'Content-Type': 'application/json; charset=utf-8' } })
