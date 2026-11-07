/** Form-based generators for web projects: .htaccess redirects, robots.txt, CSP, .gitignore, licences and UTM links. */
import licenses from '@/data/licenses.json'
import { loadText } from '@/components/tools/reference/data'
import type { Specs, Values } from '../shell/spec'
import { bool, list, num, pick, str } from '../shell/spec'
import { evaluateCsp, parseCsp } from '../encode/csp'
import { GITIGNORE, buildGitignore } from './gitignore'

const lines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

function htaccess(o: { rules: string; code: string; style: string; https: boolean; www: string; slash: boolean }): { text: string; count: number } {
  const out: string[] = []
  const rewrite = o.style === 'rewrite' || o.https || o.www !== 'keep' || o.slash
  if (rewrite) out.push('RewriteEngine On', '')
  if (o.https) out.push('# Send every request to https', 'RewriteCond %{HTTPS} off', 'RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]', '')
  if (o.www === 'add') out.push('# Add www', 'RewriteCond %{HTTP_HOST} !^www\\. [NC]', 'RewriteRule ^ https://www.%{HTTP_HOST}%{REQUEST_URI} [L,R=301]', '')
  if (o.www === 'remove') out.push('# Remove www', 'RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]', 'RewriteRule ^ https://%1%{REQUEST_URI} [L,R=301]', '')
  if (o.slash) out.push('# Remove the trailing slash from paths that are not folders', 'RewriteCond %{REQUEST_FILENAME} !-d', 'RewriteRule ^(.+)/$ /$1 [L,R=301]', '')
  let count = 0
  const rules = lines(o.rules).map((l, i) => {
    const [from, to = ''] = l.split(/\s+|\s*(?:->|=>)\s*/).filter(Boolean)
    const gone = o.code === 'gone'
    if (!from || (!to && !gone)) throw new Error(`Line ${i + 1} needs two parts: the old path and the new URL.`)
    const path = from.replace(/^https?:\/\/[^/]+/, '')
    if (!path.startsWith('/')) throw new Error(`Line ${i + 1}: the old path must start with /, such as /old-page.`)
    count++
    if (o.style === 'rewrite') {
      const pattern = path.slice(1).replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      return gone ? `RewriteRule ^${pattern}/?$ - [G]` : `RewriteRule ^${pattern}/?$ ${to} [L,R=${o.code}]`
    }
    return gone ? `Redirect gone ${path}` : `Redirect ${o.code} ${path} ${to}`
  })
  if (rules.length) out.push(`# Page redirects (${o.code === 'gone' ? '410 Gone' : o.code})`, ...rules)
  return { text: `${out.join('\n').trim()}\n`, count }
}

function robots(v: Values): string {
  const allowAll = str(v, 'policy') === 'allow'
  const out = ['User-agent: *']
  const disallow = lines(str(v, 'disallow'))
  const allow = lines(str(v, 'allow'))
  if (!allowAll) out.push('Disallow: /')
  else if (disallow.length === 0 && allow.length === 0) out.push('Disallow:')
  for (const p of disallow) out.push(`Disallow: ${p.startsWith('/') || p.startsWith('*') ? p : `/${p}`}`)
  for (const p of allow) out.push(`Allow: ${p.startsWith('/') || p.startsWith('*') ? p : `/${p}`}`)
  if (num(v, 'delay') > 0) out.push(`Crawl-delay: ${num(v, 'delay')}`)
  // Extra groups: "BotName: /path" lines; an empty path blocks the bot from the whole site.
  const groups = new Map<string, string[]>()
  for (const l of lines(str(v, 'bots'))) {
    const i = l.indexOf(':')
    const name = (i < 0 ? l : l.slice(0, i)).trim()
    const path = i < 0 ? '/' : l.slice(i + 1).trim() || '/'
    groups.set(name, [...(groups.get(name) ?? []), path])
  }
  for (const [name, paths] of groups) out.push('', `User-agent: ${name}`, ...paths.map((p) => `Disallow: ${p}`))
  const sitemaps = lines(str(v, 'sitemap'))
  for (const s of sitemaps) {
    if (!/^https?:\/\//.test(s)) throw new Error('A sitemap must be a full URL, such as https://example.com/sitemap.xml.')
  }
  if (sitemaps.length) out.push('', ...sitemaps.map((s) => `Sitemap: ${s}`))
  return `${out.join('\n')}\n`
}

const CSP_DIRECTIVES: [string, string, string][] = [
  ['default-src', "'self'", 'Fallback for every fetch directive below that is empty.'],
  ['script-src', "'self'", "Where scripts may load from. Avoid 'unsafe-inline'."],
  ['style-src', "'self'", ''],
  ['img-src', "'self' data:", ''],
  ['font-src', "'self'", ''],
  ['connect-src', "'self'", 'fetch, XHR and WebSocket targets.'],
  ['media-src', '', ''],
  ['frame-src', '', 'Pages this page may embed.'],
  ['worker-src', '', ''],
  ['object-src', "'none'", "'none' blocks plugins."],
  ['base-uri', "'self'", ''],
  ['form-action', "'self'", ''],
  ['frame-ancestors', "'none'", "Who may frame this page. 'none' stops clickjacking."],
]

function cspPolicy(v: Values): string {
  const parts = CSP_DIRECTIVES.map(([d]) => [d, str(v, d).trim()] as const)
    .filter(([, val]) => val !== '')
    .map(([d, val]) => `${d} ${val}`)
  if (bool(v, 'upgrade')) parts.push('upgrade-insecure-requests')
  const report = str(v, 'report').trim()
  if (report) parts.push(`report-uri ${report}`)
  return parts.join('; ')
}

interface LicenseInfo {
  id: string
  name: string
  kind: string
}

const LICENSES = licenses.licenses as LicenseInfo[]
const PERMISSIVE_FILL = new Set(['MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD'])

export const WEB_SPECS: Specs = {
  'htaccess-redirect-generator': {
    output: { label: '.htaccess', filename: '.htaccess', rows: 14 },
    fields: [
      { kind: 'area', id: 'rules', label: 'Redirects: old path, then new URL, one per line', default: '/old-page /new-page\n/blog/2019/launch https://example.com/news/launch\n/shop/ https://shop.example.com/', mono: true, rows: 5 },
      {
        kind: 'choice',
        id: 'code',
        label: 'Redirect type',
        default: '301',
        choices: [
          { value: '301', label: '301 Permanent' },
          { value: '302', label: '302 Temporary' },
          { value: '307', label: '307 Temporary, same method' },
          { value: '308', label: '308 Permanent, same method' },
          { value: 'gone', label: '410 Gone' },
        ],
      },
      {
        kind: 'choice',
        id: 'style',
        label: 'Rule style',
        default: 'redirect',
        choices: [
          { value: 'redirect', label: 'Redirect' },
          { value: 'rewrite', label: 'RewriteRule' },
        ],
        hint: 'Redirect matches the path and everything below it. RewriteRule matches the exact path.',
      },
      { kind: 'toggle', id: 'https', label: 'Force https', default: true },
      {
        kind: 'choice',
        id: 'www',
        label: 'www',
        default: 'keep',
        choices: [
          { value: 'keep', label: 'Leave as is' },
          { value: 'remove', label: 'Remove www' },
          { value: 'add', label: 'Add www' },
        ],
      },
      { kind: 'toggle', id: 'slash', label: 'Remove trailing slashes', default: false },
    ],
    run: (_i, v) => {
      const r = htaccess({ rules: str(v, 'rules'), code: str(v, 'code'), style: pick(v, 'style', ['redirect', 'rewrite'] as const), https: bool(v, 'https'), www: str(v, 'www'), slash: bool(v, 'slash') })
      return { text: r.text, stats: [{ label: 'Page redirects', value: r.count }] }
    },
  },
  'robots-txt-generator': {
    output: { label: 'robots.txt', filename: 'robots.txt', rows: 12 },
    fields: [
      {
        kind: 'choice',
        id: 'policy',
        label: 'All crawlers',
        default: 'allow',
        choices: [
          { value: 'allow', label: 'Allow the site' },
          { value: 'block', label: 'Block the site' },
        ],
      },
      { kind: 'area', id: 'disallow', label: 'Paths to block, one per line', default: '/admin/\n/cart\n/search?\n/*.pdf$', mono: true, rows: 4 },
      { kind: 'area', id: 'allow', label: 'Paths to allow inside blocked ones', default: '', mono: true, rows: 2, placeholder: '/admin/help' },
      { kind: 'area', id: 'sitemap', label: 'Sitemap URLs', default: 'https://example.com/sitemap.xml', mono: true, rows: 2 },
      { kind: 'area', id: 'bots', label: 'Rules for single crawlers (name: path)', default: '', mono: true, rows: 3, placeholder: 'ExampleBot: /\nOtherBot: /private/', hint: 'Use the user agent token the crawler publishes. A name without a path blocks that crawler everywhere.' },
      { kind: 'number', id: 'delay', label: 'Crawl-delay (seconds, 0 for none)', default: 0, min: 0, max: 120, hint: 'Some crawlers ignore it.' },
    ],
    run: (_i, v) => robots(v),
  },
  'csp-generator': {
    output: { label: 'Policy', filename: 'csp.txt', rows: 4 },
    fields: [
      ...CSP_DIRECTIVES.map(([id, def, hint]) => ({ kind: 'text' as const, id, label: id, default: def, mono: true, hint: hint || undefined })),
      { kind: 'toggle', id: 'upgrade', label: 'upgrade-insecure-requests', default: true },
      { kind: 'text', id: 'report', label: 'report-uri (optional)', default: '', mono: true, placeholder: '/csp-report' },
    ],
    run: (_i, v) => {
      const policy = cspPolicy(v)
      const findings = evaluateCsp(parseCsp(policy))
      return {
        text: policy,
        blocks: [
          { label: 'HTTP header', text: `Content-Security-Policy: ${policy}`, filename: 'csp-header.txt' },
          { label: 'HTML meta tag', text: `<meta http-equiv="Content-Security-Policy" content="${policy.replace(/"/g, '&quot;')}">`, filename: 'csp-meta.html' },
          { label: '.htaccess line', text: `Header always set Content-Security-Policy "${policy.replace(/"/g, '\\"')}"`, filename: 'csp.htaccess' },
        ],
        table: findings.length ? { head: ['Severity', 'Directive', 'Check'], rows: findings.map((f) => [f.severity, f.directive, f.text]) } : undefined,
      }
    },
  },
  'gitignore-generator': {
    output: { label: '.gitignore', filename: '.gitignore', rows: 16 },
    fields: [
      { kind: 'checks', id: 'templates', label: 'Languages, tools and systems', default: 'node,macos,windows,editors,secrets', choices: GITIGNORE.map((g) => ({ value: g.id, label: g.label })) },
      { kind: 'area', id: 'extra', label: 'Your own patterns', default: '', mono: true, rows: 3, placeholder: 'uploads/\n*.local.json' },
    ],
    run: (_i, v) => {
      const text = buildGitignore(list(v, 'templates'), str(v, 'extra'))
      if (!text) throw new Error('Pick at least one template or add your own patterns.')
      return { text, stats: [{ label: 'Patterns', value: text.split('\n').filter((l) => l && !l.startsWith('#')).length }] }
    },
  },
  'license-generator': {
    output: { label: 'LICENSE', filename: 'LICENSE', rows: 16 },
    fields: [
      { kind: 'choice', id: 'id', label: 'Licence', default: 'MIT', choices: LICENSES.map((l) => ({ value: l.id, label: `${l.name} (${l.kind})` })) },
      { kind: 'text', id: 'name', label: 'Copyright holder', default: 'Your Name' },
      { kind: 'number', id: 'year', label: 'Year', default: 2026, min: 1970, max: 2100 },
      { kind: 'text', id: 'project', label: 'Project name (for the file notice)', default: 'my-project' },
    ],
    run: async (_i, v) => {
      const id = pick(v, 'id', LICENSES.map((l) => l.id))
      const info = LICENSES.find((l) => l.id === id) ?? LICENSES[0]
      const year = String(num(v, 'year'))
      const name = str(v, 'name').trim() || 'Your Name'
      let text = await loadText(`${licenses.files}/${id}.txt`)
      if (PERMISSIVE_FILL.has(id)) {
        text = text.replace(/<year>|\bYEAR\b/g, year).replace(/<copyright holders>|<owner>|AUTHOR EMAIL|\bAUTHOR\b/g, name)
      }
      const spdx = `SPDX-License-Identifier: ${id}`
      const notice = /GPL|Apache|MPL/.test(id)
        ? `${str(v, 'project')}\nCopyright ${year} ${name}\n\n${spdx}\n\nThis file is part of ${str(v, 'project')}, licensed under the ${info.name}.\nSee the LICENSE file for the full text.`
        : `Copyright ${year} ${name}\n${spdx}`
      return { text, blocks: [{ label: 'File header notice', text: notice, filename: 'NOTICE.txt' }], rows: [{ label: 'SPDX identifier', value: id }, { label: 'Type', value: info.kind }] }
    },
  },
  'utm-builder': {
    output: { label: 'Tagged URL', filename: 'utm-link.txt', rows: 3 },
    fields: [
      { kind: 'text', id: 'url', label: 'Page URL', default: 'https://example.com/pricing', mono: true },
      { kind: 'text', id: 'source', label: 'Source (utm_source)', default: 'newsletter', hint: 'Who sends the traffic: newsletter, partner-site.' },
      { kind: 'text', id: 'medium', label: 'Medium (utm_medium)', default: 'email', hint: 'The channel: email, cpc, social, referral.' },
      { kind: 'text', id: 'campaign', label: 'Campaign (utm_campaign)', default: 'autumn-sale' },
      { kind: 'text', id: 'term', label: 'Term (utm_term, optional)', default: '' },
      { kind: 'text', id: 'content', label: 'Content (utm_content, optional)', default: '', hint: 'Tells apart links in the same message: header-link, footer-button.' },
      { kind: 'text', id: 'id', label: 'Campaign ID (utm_id, optional)', default: '' },
      { kind: 'toggle', id: 'lower', label: 'Lowercase values', default: true, hint: 'Analytics tools treat Email and email as two sources.' },
    ],
    run: (_i, v) => {
      let u: URL
      try {
        u = new URL(str(v, 'url').trim())
      } catch {
        throw new Error('Type the full page URL, starting with https://.')
      }
      const keys = ['source', 'medium', 'campaign', 'term', 'content', 'id'] as const
      for (const k of keys) {
        let val = str(v, k).trim()
        if (bool(v, 'lower')) val = val.toLowerCase()
        if (val) u.searchParams.set(`utm_${k}`, val.replace(/\s+/g, '-'))
        else u.searchParams.delete(`utm_${k}`)
      }
      const missing = ['source', 'medium', 'campaign'].filter((k) => !str(v, k).trim())
      return {
        text: u.toString(),
        rows: [...u.searchParams].filter(([k]) => k.startsWith('utm_')).map(([k, x]) => ({ label: k, value: x })),
        note: missing.length ? `Add ${missing.join(', ')}: most analytics tools need source, medium and campaign.` : undefined,
      }
    },
  },
}
