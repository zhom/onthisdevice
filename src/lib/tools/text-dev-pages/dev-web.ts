import type { Def } from './types'
import { def } from './types'

export const WEB_DEFS: Def[] = [
  def({
    slug: 'htaccess-redirect-generator',
    title: '.htaccess Redirect Generator',
    h1: '.htaccess redirect generator',
    description: 'Write .htaccess redirects: 301, 302, 307, 308 or 410 rules for old pages, plus force https, add or remove www, and drop trailing slashes.',
    keywords: ['htaccess 301 redirect', 'htaccess generator', 'redirect old url to new url', 'force https htaccess', 'rewriterule generator'],
    category: 'dev',
    icon: 'ArrowRightLeft',
    family: 'encode',
    faqs: [
      { q: '301 or 302?', a: '301 (and 308) are permanent: search engines move the ranking to the new URL. 302 (and 307) are temporary, for a page that will come back.' },
      { q: 'Redirect or RewriteRule?', a: 'Redirect is simpler and also moves every page below the old path. RewriteRule matches only the exact path, and it is needed for https and www rules.' },
      { q: 'Where does the file go?', a: 'In the folder the rules apply to, usually the web root. The server must allow overrides for that folder and have the alias and rewrite modules on.' },
    ],
    related: ['robots-txt-generator', 'csp-generator', 'http-status-codes', 'url-parser'],
    explainer: [
      { h: 'Redirect codes', table: { head: ['Code', 'Meaning', 'Use'], rows: [['301', 'Moved permanently', 'A page that moved for good'], ['302', 'Found', 'A short, temporary move'], ['307', 'Temporary, same method', 'Temporary move of a form target'], ['308', 'Permanent, same method', 'Permanent move of an API endpoint'], ['410', 'Gone', 'A page that was removed on purpose']] } },
      { h: 'Test before you upload', p: ['A wrong rule can send every page in a loop. Test on a staging copy, or with a private window so cached 301s do not hide the change. Browsers cache permanent redirects for a long time.'] },
    ],
  }),
  def({
    slug: 'robots-txt-generator',
    title: 'robots.txt Generator',
    h1: 'robots.txt generator',
    description: 'Make a robots.txt file: allow or block crawlers, list paths to block and allow, add sitemaps, set rules for single crawlers and a crawl delay.',
    keywords: ['create robots.txt', 'robots.txt maker', 'robots txt file generator', 'disallow all robots'],
    category: 'dev',
    icon: 'Bot',
    family: 'encode',
    faqs: [
      { q: 'Does robots.txt hide a page?', a: 'No. It asks crawlers not to fetch the page, but the URL can still appear in results if other pages link to it. Use a noindex tag or a password to keep a page out.' },
      { q: 'Can I use wildcards?', a: 'Yes. * matches any characters and $ marks the end of a URL: /*.pdf$ blocks every PDF. Major crawlers support both.' },
      { q: 'Where does the file go?', a: 'At the root of the host: https://example.com/robots.txt. Each subdomain needs its own.' },
    ],
    related: ['meta-tag-generator', 'htaccess-redirect-generator', 'csp-generator', 'url-parser'],
    explainer: [
      { h: 'The rules', table: { head: ['Line', 'Meaning'], rows: [['User-agent: *', 'The rules below apply to every crawler'], ['Disallow: /admin/', 'Do not fetch anything under /admin/'], ['Disallow:', 'Fetch everything'], ['Allow: /admin/help', 'An exception inside a blocked path'], ['Sitemap: https://...', 'Where the sitemap is']] } },
      { h: 'Which rule wins', p: ['When several rules match a URL, the most specific one (the longest path) wins, and Allow wins a tie, as RFC 9309 specifies. A crawler that has its own User-agent group follows only that group.'] },
    ],
  }),
  def({
    slug: 'csp-generator',
    title: 'CSP Generator',
    h1: 'Content Security Policy generator',
    description: 'Build a Content-Security-Policy directive by directive from safe defaults. Copy it as an HTTP header, a meta tag or an .htaccess line, with a check.',
    keywords: ['content security policy generator', 'csp builder', 'csp header generator', 'create csp policy'],
    category: 'security',
    icon: 'ShieldCheck',
    family: 'encode',
    faqs: [
      { q: 'Where do I start?', a: "With the defaults: everything from your own origin, no plugins, no framing. Then add the hosts your pages load scripts, styles, fonts and images from. Test with Content-Security-Policy-Report-Only first." },
      { q: 'Is the meta tag as good as the header?', a: 'Almost. A meta tag cannot set frame-ancestors, report-uri or sandbox, so use the header when you can.' },
      { q: 'How do I allow inline scripts safely?', a: "Give each inline script a nonce or list its hash in script-src instead of using 'unsafe-inline'." },
    ],
    related: ['csp-evaluator', 'htaccess-redirect-generator', 'meta-tag-generator', 'hash-generator'],
    explainer: [
      { h: 'Source values', table: { head: ['Value', 'Allows'], rows: [["'self'", 'The same origin as the page'], ["'none'", 'Nothing'], ['https://cdn.example.com', 'That host'], ['https:', 'Any host over https'], ['data:', 'data: URLs'], ["'nonce-abc'", 'Elements with that nonce'], ["'sha256-...'", 'Inline code with that hash']] } },
    ],
  }),
  def({
    slug: 'gitignore-generator',
    title: '.gitignore Generator',
    h1: '.gitignore generator',
    description: 'Build a .gitignore from templates for languages, operating systems and editors, plus your own patterns. Duplicate patterns are removed. Copy or download.',
    keywords: ['gitignore template', 'create gitignore', 'gitignore file generator', 'node gitignore', 'python gitignore'],
    category: 'dev',
    icon: 'GitBranch',
    family: 'encode',
    faqs: [
      { q: 'Does .gitignore remove files that are already committed?', a: 'No. It only stops untracked files from being added. Run git rm --cached <file> to stop tracking a committed file.' },
      { q: 'How do I keep one file inside an ignored folder?', a: 'Ignore the folder contents with folder/* and add an exception with !folder/keep.me.' },
      { q: 'Should .env files be ignored?', a: 'Yes. They hold secrets. Commit a .env.example with the names and no values instead.' },
    ],
    related: ['license-generator', 'env-to-json', 'robots-txt-generator', 'yaml-formatter'],
    explainer: [
      { h: 'Pattern syntax', table: { head: ['Pattern', 'Matches'], rows: [['*.log', 'Every .log file in any folder'], ['build/', 'Every folder named build'], ['/build', 'Only build at the repository root'], ['**/temp', 'temp at any depth'], ['!keep.log', 'An exception to an earlier pattern'], ['# note', 'A comment']] } },
    ],
  }),
  def({
    slug: 'license-generator',
    title: 'License Generator',
    h1: 'Open source license generator',
    description: 'Get the full text of MIT, Apache 2.0, GPL 3.0, BSD, MPL 2.0, ISC and other open source licenses with your name and year, plus a file header notice.',
    keywords: ['mit license generator', 'open source license', 'choose a license', 'license file', 'apache license text'],
    category: 'dev',
    icon: 'Scale',
    family: 'encode',
    faqs: [
      { q: 'Which license should I pick?', a: 'MIT or ISC for the fewest conditions. Apache 2.0 adds an explicit patent grant. GPL 3.0 requires that changed versions stay open source. MPL 2.0 sits between: changes to your files stay open.' },
      { q: 'Where does the text come from?', a: 'From the SPDX License List data, the reference texts that package managers and license scanners use.' },
      { q: 'Is this legal advice?', a: 'No. The texts are the standard ones; ask a lawyer about your situation.' },
    ],
    related: ['gitignore-generator', 'lorem-ipsum-generator', 'text-diff-checker', 'markdown-editor'],
    explainer: [
      {
        h: 'Common licenses compared',
        table: {
          head: ['License', 'Commercial use', 'Must share changes', 'Patent grant'],
          rows: [['MIT', 'Yes', 'No', 'No'], ['Apache 2.0', 'Yes', 'No', 'Yes'], ['BSD 3-Clause', 'Yes', 'No', 'No'], ['MPL 2.0', 'Yes', 'Changed files', 'Yes'], ['LGPL 3.0', 'Yes', 'The library', 'Yes'], ['GPL 3.0', 'Yes', 'The whole program', 'Yes'], ['AGPL 3.0', 'Yes', 'Also for network use', 'Yes']],
        },
      },
    ],
  }),
  def({
    slug: 'utm-builder',
    title: 'UTM Builder',
    h1: 'UTM link builder',
    description: 'Add UTM parameters to a URL: source, medium, campaign, term, content and ID. Values are lowercased and encoded. Copy the tagged link for your campaign.',
    keywords: ['utm generator', 'campaign url builder', 'utm link generator', 'utm parameters', 'utm tag builder'],
    category: 'generators',
    icon: 'Link2',
    family: 'encode',
    faqs: [
      { q: 'Which parameters are required?', a: 'utm_source, utm_medium and utm_campaign. Most analytics tools ignore a link without them.' },
      { q: 'Why lowercase?', a: 'Values are case sensitive in reports, so Email and email count as two sources. Lowercase everything to keep reports clean.' },
      { q: 'Are existing query parameters kept?', a: 'Yes. Only utm_ parameters are added or replaced.' },
    ],
    related: ['url-parser', 'qr-code-generator', 'json-to-query-string', 'url-encoder-decoder'],
    explainer: [
      { h: 'The five main parameters', table: { head: ['Parameter', 'Answers', 'Example'], rows: [['utm_source', 'Who sent the visitor', 'newsletter'], ['utm_medium', 'Through which channel', 'email'], ['utm_campaign', 'For which campaign', 'autumn-sale'], ['utm_term', 'For which paid keyword', 'running shoes'], ['utm_content', 'Which link or ad', 'header-button']] } },
    ],
  }),
]
