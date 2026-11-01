import type { APIRoute } from 'astro'

export const prerender = true

const SITEMAP = 'https://onthisdevice.com/sitemap-index.xml'

export const GET: APIRoute = ({ site }) => {
  const sitemap = site ? new URL('/sitemap-index.xml', site).href : SITEMAP

  const body = [
    '# onthisdevice.com: every tool runs in the visitor’s browser.',
    '',
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${sitemap}`,
    '',
  ].join('\n')

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
