import type { APIRoute } from 'astro'
import { siteVectors } from '@/lib/search/build'

export const prerender = true

/**
 * One int8 vector per tool for search by meaning, in search-index order. Fetched with the
 * model, only when search by meaning starts. Format: src/lib/search/semantic/format.ts.
 */
export const GET: APIRoute = () =>
  new Response(siteVectors().bytes, { headers: { 'Content-Type': 'application/octet-stream' } })
