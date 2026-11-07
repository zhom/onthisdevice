/** Developer encoders, decoders, parsers and ID tools. */
import type { Field, Result, Row, Specs, Values } from '../shell/spec'
import { bool, num, pick, str } from '../shell/spec'
import { parseJson } from '../data/convert'
import {
  ascii85Decode,
  ascii85Encode,
  base58CheckDecode,
  base58CheckEncode,
  base58Decode,
  base58Encode,
  domainToAscii,
  domainToUnicode,
  escapeString,
  fromBytes,
  qpDecode,
  qpEncode,
  toBytes,
  unescapeString,
  unicodeEscape,
  unicodeUnescape,
} from './codecs'
import type { EscapeStyle, Lang } from './codecs'
import { composeYaml } from './compose'
import { evaluateCsp, parseCsp } from './csp'
import { parseCurl, toFetch, toGo, toPhp, toPython } from './curl'
import { diffJson, short, toPatch } from './diff'
import { NANO_ALPHABETS, decodeObjectId, decodeSnowflake, decodeUlid, encodeSnowflake, idsForOnePercent, iso, nanoid, newMac, newObjectId, newUlid } from './ids'
import { toJsx } from './jsx'
import { jsonPath } from './jsonpath'
import { compressIpv6, defaultPort, expandIpv6, ipv4ToNumber, ipv6Arpa, ipv6Kind, numberToIpv4, objectToQuery, parseUrl, queryToObject } from './net'
import { parseUa } from './ua'

const AS: Field = {
  kind: 'choice',
  id: 'as',
  label: 'Bytes are',
  default: 'text',
  choices: [
    { value: 'text', label: 'Text (UTF-8)' },
    { value: 'hex', label: 'Hex' },
  ],
}

const COUNT: Field = { kind: 'number', id: 'count', label: 'How many', default: 10, min: 1, max: 1000 }

function many(count: number, make: () => string): string {
  return Array.from({ length: Math.max(1, Math.min(1000, count)) }, make).join('\n')
}

const relative = (ms: number) => {
  const d = (Date.now() - ms) / 1000
  const abs = Math.abs(d)
  const [n, u] = abs < 90 ? [abs, 'seconds'] : abs < 5400 ? [abs / 60, 'minutes'] : abs < 129600 ? [abs / 3600, 'hours'] : abs < 63072000 ? [abs / 86400, 'days'] : [abs / 31557600, 'years']
  return `${Math.round(n)} ${u} ${d >= 0 ? 'ago' : 'from now'}`
}

function stringEscapeSpec(lang: Lang, sample: string): Specs[string] {
  const fields: Field[] = [{ kind: 'toggle', id: 'ascii', label: 'Escape non-ASCII characters', default: false, modes: ['escape'] }]
  if (lang === 'js') {
    fields.unshift({
      kind: 'choice',
      id: 'quote',
      label: 'Quote',
      default: "'",
      modes: ['escape'],
      choices: [
        { value: "'", label: "'single'" },
        { value: '"', label: '"double"' },
        { value: '`', label: '`template`' },
      ],
    })
  }
  return {
    input: { label: 'Text', sample, mono: true },
    output: { label: 'Result', filename: 'string.txt' },
    swap: true,
    fields,
    modes: [
      {
        id: 'escape',
        label: 'Escape',
        outputLabel: 'Escaped string',
        run: (input, v) => {
          const quote = lang === 'js' ? pick(v, 'quote', ["'", '"', '`'] as const) : '"'
          return escapeString(input, lang, { quote, ascii: bool(v, 'ascii') })
        },
      },
      { id: 'unescape', label: 'Unescape', outputLabel: 'Plain text', sample: 'Line 1\\nTab\\there \\"quoted\\" \\u00e9', run: (input) => unescapeString(input, lang) },
    ],
  }
}

const JSX_SAMPLE = `<div class="card" style="background-color: #fff; margin-top: 8px" onclick="toggle()">
  <!-- Profile -->
  <label for="name">Name</label>
  <input id="name" type="text" maxlength="40" readonly>
  <img src="/avatar.png" alt="Avatar">
  <p>Use {braces} with care</p>
</div>`

const SVG_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <title>Check</title>
  <path d="M20 6 9 17l-5-5"/>
</svg>`

const STORE = `{
  "store": {
    "book": [
      { "category": "reference", "author": "Nigel Rees", "title": "Sayings of the Century", "price": 8.95 },
      { "category": "fiction", "author": "Evelyn Waugh", "title": "Sword of Honour", "price": 12.99 },
      { "category": "fiction", "author": "Herman Melville", "title": "Moby Dick", "isbn": "0-553-21311-3", "price": 8.99 },
      { "category": "fiction", "author": "J. R. R. Tolkien", "title": "The Lord of the Rings", "isbn": "0-395-19395-8", "price": 22.99 }
    ],
    "bicycle": { "color": "red", "price": 399 }
  }
}`

const SNOWFLAKE_EPOCHS = [
  { value: '1288834974657', label: '2010-11-04 01:42:54.657 UTC' },
  { value: '1420070400000', label: '2015-01-01 00:00:00 UTC' },
  { value: '0', label: '1970-01-01 (Unix epoch)' },
]

function timeRows(ms: number): Row[] {
  return [
    { label: 'Date and time (UTC)', value: iso(ms) },
    { label: 'Local time', value: new Date(ms).toLocaleString() },
    { label: 'Unix time (ms)', value: String(ms) },
    { label: 'Relative', value: relative(ms) },
  ]
}

function xpathRun(input: string, v: Values): Result {
  const html = str(v, 'type') === 'html'
  const doc = new DOMParser().parseFromString(input, html ? 'text/html' : 'application/xml')
  if (!html && doc.querySelector('parsererror')) throw new Error('This is not well-formed XML. Switch the document type to HTML for web pages.')
  const expr = str(v, 'expr').trim()
  if (!expr) throw new Error('Type an XPath expression, such as //book/title.')
  let r: XPathResult
  try {
    r = doc.evaluate(expr, doc, doc.createNSResolver?.(doc.documentElement) ?? null, XPathResult.ANY_TYPE, null)
  } catch (e) {
    throw new Error(`The expression is not valid XPath: ${e instanceof Error ? e.message.split('\n')[0] : ''}`)
  }
  if (r.resultType === XPathResult.NUMBER_TYPE) return { text: String(r.numberValue), stats: [{ label: 'Number', value: r.numberValue }] }
  if (r.resultType === XPathResult.STRING_TYPE) return { text: r.stringValue, stats: [{ label: 'String length', value: r.stringValue.length }] }
  if (r.resultType === XPathResult.BOOLEAN_TYPE) return { text: String(r.booleanValue), verdict: { ok: r.booleanValue, title: r.booleanValue ? 'true' : 'false' } }
  const nodes: Node[] = []
  for (let n = r.iterateNext(); n; n = r.iterateNext()) nodes.push(n)
  const ser = new XMLSerializer()
  const show = (n: Node) => (n.nodeType === Node.ELEMENT_NODE ? ser.serializeToString(n) : (n.nodeValue ?? n.textContent ?? ''))
  return {
    stats: [{ label: 'Matches', value: nodes.length }],
    table: { head: ['#', 'Node', 'Text'], rows: nodes.slice(0, 500).map((n, i) => [i + 1, n.nodeType === Node.ATTRIBUTE_NODE ? `@${n.nodeName}` : n.nodeName, (n.textContent ?? '').trim().slice(0, 120)]) },
    text: nodes.map(show).join('\n'),
    note: nodes.length === 0 ? 'No nodes match this expression.' : undefined,
  }
}

export const ENCODE_SPECS: Specs = {
  'base58-encoder-decoder': {
    input: { label: 'Input', sample: 'Hello world', mono: true },
    output: { label: 'Result', filename: 'base58.txt' },
    swap: true,
    fields: [AS, { kind: 'toggle', id: 'check', label: 'Base58Check (4-byte checksum)', default: false }],
    modes: [
      { id: 'encode', label: 'Encode', outputLabel: 'Base58', run: async (input, v) => (bool(v, 'check') ? base58CheckEncode(toBytes(input, str(v, 'as'))) : base58Encode(toBytes(input, str(v, 'as')))) },
      { id: 'decode', label: 'Decode', outputLabel: 'Decoded', sample: 'JxF12TrwUP45BMd', run: async (input, v) => fromBytes(bool(v, 'check') ? await base58CheckDecode(input) : base58Decode(input), str(v, 'as')) },
    ],
  },
  'ascii85-encoder-decoder': {
    input: { label: 'Input', sample: 'Man is distinguished', mono: true },
    output: { label: 'Result', filename: 'ascii85.txt' },
    swap: true,
    fields: [AS, { kind: 'toggle', id: 'delims', label: 'Add <~ and ~>', default: true, modes: ['encode'] }],
    modes: [
      { id: 'encode', label: 'Encode', outputLabel: 'Ascii85', run: (input, v) => ascii85Encode(toBytes(input, str(v, 'as')), bool(v, 'delims')) },
      { id: 'decode', label: 'Decode', outputLabel: 'Decoded', sample: '<~9jqo^BlbD-BleB1DJ+*+F(f,q~>', run: (input, v) => fromBytes(ascii85Decode(input), str(v, 'as')) },
    ],
  },
  'punycode-converter': {
    input: { label: 'Domain names or email addresses, one per line', sample: 'münchen.de\nbücher.example\n例え.テスト\nuser@ñandú.com', mono: true },
    output: { label: 'Result', filename: 'domains.txt' },
    swap: true,
    modes: [
      { id: 'encode', label: 'Unicode to Punycode', outputLabel: 'ASCII (xn--) form', run: (input) => input.split(/\r?\n/).map((l) => (l.trim() ? domainToAscii(l.trim()) : '')).join('\n') },
      { id: 'decode', label: 'Punycode to Unicode', outputLabel: 'Unicode form', sample: 'xn--mnchen-3ya.de\nxn--r8jz45g.xn--zckzah', run: (input) => input.split(/\r?\n/).map((l) => (l.trim() ? domainToUnicode(l.trim()) : '')).join('\n') },
    ],
  },
  'quoted-printable-encoder-decoder': {
    input: { label: 'Input', sample: 'Café crème = 3 € — a long line of text that is longer than seventy-six characters so it gets a soft break.' },
    output: { label: 'Result', filename: 'quoted-printable.txt' },
    swap: true,
    modes: [
      { id: 'encode', label: 'Encode', outputLabel: 'Quoted-printable', run: (input) => qpEncode(input) },
      { id: 'decode', label: 'Decode', outputLabel: 'Decoded text', sample: 'Caf=C3=A9 cr=C3=A8me =3D 3 =E2=82=AC', run: (input) => qpDecode(input) },
    ],
  },
  'unicode-escape-converter': {
    input: { label: 'Text', sample: 'Café ☕ 😀 naïve', mono: true },
    output: { label: 'Result', filename: 'escaped.txt' },
    swap: true,
    fields: [
      {
        kind: 'choice',
        id: 'style',
        label: 'Escape format',
        default: 'js',
        modes: ['escape'],
        choices: [
          { value: 'js', label: 'JavaScript, JSON, Java: \\u00E9' },
          { value: 'es6', label: 'JavaScript ES6: \\u{1F600}' },
          { value: 'python', label: 'Python: \\u00E9 \\U0001F600' },
          { value: 'css', label: 'CSS: \\E9' },
          { value: 'html', label: 'HTML: &#xE9;' },
          { value: 'uplus', label: 'Code points: U+00E9' },
        ],
      },
      { kind: 'toggle', id: 'all', label: 'Escape ASCII characters too', default: false, modes: ['escape'] },
    ],
    modes: [
      { id: 'escape', label: 'Escape', outputLabel: 'Escaped', run: (input, v) => unicodeEscape(input, pick<EscapeStyle>(v, 'style', ['js', 'es6', 'python', 'css', 'html', 'uplus']), bool(v, 'all')) },
      { id: 'unescape', label: 'Unescape', outputLabel: 'Text', sample: 'Caf\\u00e9 \\u2615 \\ud83d\\ude00 \\u{1F44D} &#x263A;', run: (input) => unicodeUnescape(input) },
    ],
  },
  'javascript-string-escape': stringEscapeSpec('js', 'He said "it\'s fine"\nC:\\path\ttab é'),
  'java-string-escape': stringEscapeSpec('java', 'He said "it\'s fine"\nC:\\path\ttab é'),
  'c-string-escape': stringEscapeSpec('c', 'He said "it\'s fine"\nC:\\path\ttab é'),
  'html-to-jsx': {
    input: { label: 'HTML', sample: JSX_SAMPLE, mono: true, rows: 10 },
    output: { label: 'JSX', filename: 'Component.jsx', rows: 14 },
    fields: [{ kind: 'text', id: 'component', label: 'Component name (empty for JSX only)', default: '', mono: true, placeholder: 'ProfileCard' }],
    run: (input, v) => toJsx(input, { component: str(v, 'component'), svg: false, dropSize: false }),
  },
  'svg-to-jsx': {
    input: { label: 'SVG', sample: SVG_SAMPLE, mono: true, rows: 10 },
    output: { label: 'JSX component', filename: 'Icon.jsx', rows: 14 },
    fields: [
      { kind: 'text', id: 'component', label: 'Component name (empty for JSX only)', default: 'CheckIcon', mono: true },
      { kind: 'toggle', id: 'dropSize', label: 'Remove width and height', default: true, hint: 'The icon then takes its size from CSS or props.' },
    ],
    run: (input, v) => {
      if (!/<svg[\s>]/i.test(input)) throw new Error('No <svg> element found.')
      return toJsx(input, { component: str(v, 'component'), svg: true, dropSize: bool(v, 'dropSize') })
    },
  },
  'unicode-normalizer': {
    input: { label: 'Text', sample: 'ﬁle ① Å Å ｗｉｄｅ é é' },
    output: { label: 'Normalized text', filename: 'normalized.txt' },
    fields: [
      {
        kind: 'choice',
        id: 'form',
        label: 'Form',
        default: 'NFC',
        choices: [
          { value: 'NFC', label: 'NFC' },
          { value: 'NFD', label: 'NFD' },
          { value: 'NFKC', label: 'NFKC' },
          { value: 'NFKD', label: 'NFKD' },
        ],
        hint: 'NFC composes (é is one character). NFD decomposes (e plus an accent). The K forms also replace compatibility characters: ﬁ to fi, ① to 1.',
      },
    ],
    run: (input, v) => {
      const form = pick(v, 'form', ['NFC', 'NFD', 'NFKC', 'NFKD'] as const)
      const out = input.normalize(form)
      const cps = (s: string) => [...s].length
      const forms = (['NFC', 'NFD', 'NFKC', 'NFKD'] as const).map((f) => ({ label: `${f} already`, value: input === input.normalize(f) ? 'Yes' : 'No' }))
      return { text: out, stats: [{ label: 'Code points before', value: cps(input) }, { label: 'Code points after', value: cps(out) }, { label: 'Changed', value: out === input ? 'No' : 'Yes' }], rows: forms }
    },
  },
  'url-parser': {
    input: { label: 'URL', sample: 'https://user:pass@shop.example.com:8443/products/shoes?color=red&size=42&size=43&q=running%20shoes#reviews', mono: true, rows: 3 },
    output: { label: 'Parts as JSON', filename: 'url.json' },
    run: (input) => {
      const u = parseUrl(input.split(/\r?\n/)[0])
      const params = [...u.searchParams]
      const parts = {
        protocol: u.protocol.replace(/:$/, ''),
        username: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        hostname: u.hostname,
        port: defaultPort(u),
        pathname: decodeURIComponent(u.pathname),
        search: u.search,
        hash: decodeURIComponent(u.hash.slice(1)),
        origin: u.origin,
      }
      return {
        rows: [
          { label: 'Protocol', value: parts.protocol },
          ...(parts.username ? [{ label: 'Username', value: parts.username }, { label: 'Password', value: parts.password }] : []),
          { label: 'Host', value: parts.hostname },
          { label: 'Port', value: u.port ? u.port : `${parts.port} (default)` },
          { label: 'Path', value: parts.pathname },
          { label: 'Path segments', value: u.pathname.split('/').filter(Boolean).map(decodeURIComponent).join(' / ') },
          { label: 'Query string', value: u.search },
          { label: 'Fragment', value: parts.hash },
          { label: 'Origin', value: u.origin },
        ],
        table: params.length ? { head: ['Parameter', 'Value'], rows: params.map(([k, x]) => [k, x]) } : undefined,
        text: JSON.stringify({ ...parts, query: queryToObject(u.search, false) }, null, 2),
      }
    },
  },
  'query-string-to-json': {
    input: { label: 'Query string or URL', sample: 'https://example.com/search?q=shoes&tags=red&tags=sale&filter[size]=42&filter[brand][]=a&filter[brand][]=b&page=2', mono: true, rows: 4 },
    output: { label: 'JSON', filename: 'query.json', rows: 12 },
    fields: [{ kind: 'toggle', id: 'nested', label: 'Nest bracket keys (a[b]=1)', default: true }],
    run: (input, v) => {
      const obj = queryToObject(input, bool(v, 'nested'))
      return { text: JSON.stringify(obj, null, 2), stats: [{ label: 'Keys', value: Object.keys(obj).length }] }
    },
  },
  'json-to-query-string': {
    input: { label: 'JSON object', sample: '{\n  "q": "running shoes",\n  "tags": ["red", "sale"],\n  "filter": { "size": 42, "brand": "acme" },\n  "page": 2\n}', mono: true, rows: 8 },
    output: { label: 'Query string', filename: 'query.txt' },
    fields: [
      {
        kind: 'choice',
        id: 'arrays',
        label: 'Arrays',
        default: 'repeat',
        choices: [
          { value: 'repeat', label: 'tags=a&tags=b' },
          { value: 'brackets', label: 'tags[]=a&tags[]=b' },
          { value: 'index', label: 'tags[0]=a&tags[1]=b' },
          { value: 'comma', label: 'tags=a,b' },
        ],
      },
      { kind: 'toggle', id: 'plus', label: 'Spaces as +', default: false, hint: 'Off writes %20, which every server reads.' },
    ],
    run: (input, v) => {
      return objectToQuery(parseJson(input), { arrays: pick(v, 'arrays', ['repeat', 'brackets', 'index', 'comma'] as const), plus: bool(v, 'plus') })
    },
  },
  'user-agent-parser': {
    input: { label: 'User agent string', sample: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', mono: true, rows: 3 },
    output: { label: 'Parsed as JSON', filename: 'user-agent.json' },
    run: (input) => {
      const ua = parseUa(input.split(/\r?\n/)[0])
      return {
        rows: [
          { label: 'Browser', value: ua.bot ? `${ua.bot} (bot)` : `${ua.browser} ${ua.version}`.trim() },
          { label: 'Engine', value: ua.engine },
          { label: 'Operating system', value: `${ua.os} ${ua.osVersion}`.trim() },
          { label: 'Device type', value: ua.device },
          { label: 'CPU', value: ua.cpu },
        ],
        text: JSON.stringify(ua, null, 2),
      }
    },
  },
  'curl-to-code': {
    input: {
      label: 'curl command',
      mono: true,
      rows: 6,
      sample: `curl -X POST https://api.example.com/v1/orders \\
  -H "Authorization: Bearer TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{"item": "book", "qty": 2}'`,
    },
    output: { label: 'Code', filename: 'request.txt', rows: 16 },
    modes: [
      { id: 'fetch', label: 'JavaScript', outputLabel: 'JavaScript (fetch)', filename: 'request.js', run: (input) => toFetch(parseCurl(input)) },
      { id: 'python', label: 'Python', outputLabel: 'Python', filename: 'request.py', run: (input) => toPython(parseCurl(input)) },
      { id: 'go', label: 'Go', outputLabel: 'Go (net/http)', filename: 'main.go', run: (input) => toGo(parseCurl(input)) },
      { id: 'php', label: 'PHP', outputLabel: 'PHP (curl)', filename: 'request.php', run: (input) => toPhp(parseCurl(input)) },
    ],
  },
  'jsonpath-tester': {
    input: { label: 'JSON', sample: STORE, mono: true, rows: 12 },
    output: { label: 'Matched values (JSON)', filename: 'matches.json', rows: 12 },
    fields: [{ kind: 'text', id: 'expr', label: 'JSONPath expression', default: '$.store.book[?(@.price < 10)].title', mono: true, hint: 'Examples: $..author, $.store.book[-1], $.store.book[0:2], $..book[?(@.isbn)]' }],
    run: (input, v) => {
      const matches = jsonPath(parseJson(input), str(v, 'expr'))
      return {
        stats: [{ label: 'Matches', value: matches.length }],
        table: { head: ['Path', 'Value'], rows: matches.slice(0, 500).map((m) => [m.path, short(m.value)]) },
        text: JSON.stringify(matches.map((m) => m.value), null, 2),
        note: matches.length === 0 ? 'Nothing matches this expression.' : undefined,
      }
    },
  },
  'xpath-tester': {
    input: {
      label: 'XML or HTML',
      mono: true,
      rows: 10,
      sample: '<?xml version="1.0"?>\n<library>\n  <book year="2005"><title lang="en">Everyday Italian</title><price>30.00</price></book>\n  <book year="1999"><title lang="en">Learning XML</title><price>39.95</price></book>\n  <book year="2012"><title lang="fr">Le Petit Prince</title><price>9.50</price></book>\n</library>',
    },
    output: { label: 'Matches', filename: 'matches.xml' },
    fields: [
      { kind: 'text', id: 'expr', label: 'XPath expression', default: '//book[price > 10]/title', mono: true, hint: 'Examples: //title/@lang, count(//book), //book[@year > 2000]/title/text()' },
      {
        kind: 'choice',
        id: 'type',
        label: 'Document type',
        default: 'xml',
        choices: [
          { value: 'xml', label: 'XML' },
          { value: 'html', label: 'HTML' },
        ],
      },
    ],
    run: xpathRun,
  },
  'json-diff': {
    input: { label: 'First JSON (before)', sample: '{\n  "name": "app",\n  "version": "1.2.0",\n  "dependencies": { "a": "^1.0.0", "b": "^2.1.0" },\n  "tags": ["web", "tools"]\n}', mono: true, rows: 10 },
    output: { label: 'JSON Patch (RFC 6902)', filename: 'patch.json', rows: 10 },
    fields: [
      {
        kind: 'area',
        id: 'second',
        label: 'Second JSON (after)',
        rows: 10,
        mono: true,
        default: '{\n  "name": "app",\n  "version": "1.3.0",\n  "dependencies": { "a": "^1.0.0", "c": "^0.4.0" },\n  "tags": ["web", "tools", "cli"]\n}',
      },
    ],
    run: (input, v) => {
      const a = parseJson(input)
      const b = parseJson(str(v, 'second'))
      const changes = diffJson(a, b)
      const n = (k: string) => changes.filter((c) => c.kind === k).length
      return {
        verdict: changes.length === 0 ? { ok: true, title: 'The two documents are equal.', detail: 'Key order and whitespace are ignored.' } : undefined,
        stats: [
          { label: 'Changed', value: n('changed') },
          { label: 'Added', value: n('added') },
          { label: 'Removed', value: n('removed') },
        ],
        table: {
          head: ['Change', 'Path', 'Before', 'After'],
          rows: changes.map((c) => [c.kind, c.path, c.kind === 'added' ? '' : short(c.before), c.kind === 'removed' ? '' : short(c.after)]),
        },
        text: JSON.stringify(toPatch(changes), null, 2),
      }
    },
  },
  'objectid-decoder': {
    input: { label: 'ObjectIds, one per line', sample: '6560f4b9c3a5e2d1f0a1b2c3\n507f1f77bcf86cd799439011', mono: true, rows: 4 },
    output: { label: 'Result', filename: 'objectids.txt' },
    modes: [
      {
        id: 'decode',
        label: 'Decode',
        outputLabel: 'Timestamps',
        run: (input) => {
          const ids = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
          const parts = ids.map(decodeObjectId)
          const first = parts[0]
          return {
            rows: [...timeRows(first.seconds * 1000), { label: 'Random value', value: first.random }, { label: 'Counter', value: String(first.counter) }],
            table: ids.length > 1 ? { head: ['ObjectId', 'Created (UTC)'], rows: ids.map((id, i) => [id, iso(parts[i].seconds * 1000)]) } : undefined,
            text: ids.map((id, i) => `${id}\t${iso(parts[i].seconds * 1000)}`).join('\n'),
          }
        },
      },
      {
        id: 'generate',
        label: 'From a date',
        outputLabel: 'ObjectId',
        sample: '2026-11-07T12:00:00Z',
        run: (input) => {
          const ms = Date.parse(input.trim())
          if (Number.isNaN(ms)) throw new Error('Type a date such as 2026-11-07 or 2026-11-07T12:00:00Z.')
          const id = newObjectId(ms)
          const floor = `${Math.floor(ms / 1000).toString(16).padStart(8, '0')}0000000000000000`
          return { text: id, rows: [{ label: 'ObjectId', value: id }, { label: 'Lowest ObjectId for this second (for range queries)', value: floor }] }
        },
      },
    ],
  },
  'snowflake-id-decoder': {
    input: { label: 'Snowflake IDs, one per line', sample: '1541815603606036480\n1288834974657', mono: true, rows: 4 },
    output: { label: 'Timestamps', filename: 'snowflakes.txt' },
    fields: [
      { kind: 'choice', id: 'epoch', label: 'Epoch', default: SNOWFLAKE_EPOCHS[0].value, choices: SNOWFLAKE_EPOCHS, hint: 'Each service counts from its own start time. Pick the one that gives a sensible date.' },
      { kind: 'text', id: 'custom', label: 'Custom epoch (ms, overrides the list)', default: '', mono: true, placeholder: '1288834974657' },
    ],
    run: (input, v) => {
      const epoch = str(v, 'custom').trim() ? Number(str(v, 'custom')) : Number(str(v, 'epoch'))
      if (!Number.isFinite(epoch)) throw new Error('The custom epoch must be a number of milliseconds.')
      const ids = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      const parts = ids.map((id) => decodeSnowflake(id, epoch))
      const f = parts[0]
      return {
        rows: [...timeRows(f.ms), { label: 'Datacenter (5 bits)', value: String(f.datacenter) }, { label: 'Worker (5 bits)', value: String(f.worker) }, { label: 'Sequence (12 bits)', value: String(f.sequence) }, { label: 'Lowest ID for this millisecond', value: encodeSnowflake(f.ms, epoch) }],
        table: ids.length > 1 ? { head: ['ID', 'Created (UTC)', 'Worker', 'Sequence'], rows: ids.map((id, i) => [id, iso(parts[i].ms), parts[i].worker, parts[i].sequence]) } : undefined,
        text: ids.map((id, i) => `${id}\t${iso(parts[i].ms)}`).join('\n'),
      }
    },
  },
  'ulid-generator': {
    output: { label: 'ULIDs', filename: 'ulids.txt' },
    action: 'Generate',
    fields: [COUNT, { kind: 'toggle', id: 'monotonic', label: 'Monotonic (sorted within the same millisecond)', default: true }, { kind: 'toggle', id: 'lower', label: 'Lowercase', default: false }],
    run: (_input, v) => {
      const now = Date.now()
      const ids = many(num(v, 'count'), () => newUlid(now, bool(v, 'monotonic')))
      return { text: bool(v, 'lower') ? ids.toLowerCase() : ids, rows: timeRows(now).slice(0, 2).concat([{ label: 'First ID decodes to', value: iso(decodeUlid(ids.split('\n')[0]).ms) }]) }
    },
  },
  'nanoid-generator': {
    output: { label: 'IDs', filename: 'ids.txt' },
    action: 'Generate',
    fields: [
      COUNT,
      { kind: 'number', id: 'size', label: 'Length', default: 21, min: 2, max: 256 },
      {
        kind: 'choice',
        id: 'alphabet',
        label: 'Alphabet',
        default: 'url',
        choices: [
          { value: 'url', label: 'URL-safe (A-Z a-z 0-9 _ -)' },
          { value: 'alnum', label: 'Letters and digits' },
          { value: 'lower', label: 'Lowercase and digits' },
          { value: 'nolookalikes', label: 'No look-alikes (no 1 l I 0 O)' },
          { value: 'hex', label: 'Hex' },
          { value: 'numbers', label: 'Digits only' },
          { value: 'custom', label: 'Custom' },
        ],
      },
      { kind: 'text', id: 'custom', label: 'Custom alphabet', default: 'abcdef123456', mono: true },
    ],
    run: (_input, v) => {
      const a = str(v, 'alphabet') === 'custom' ? str(v, 'custom') : (NANO_ALPHABETS[str(v, 'alphabet')] ?? NANO_ALPHABETS.url)
      const size = num(v, 'size')
      const n = idsForOnePercent(new Set(a).size, size)
      return {
        text: many(num(v, 'count'), () => nanoid(a, size)),
        stats: [
          { label: 'Bits per ID', value: Math.round(size * Math.log2(new Set(a).size)) },
          { label: 'IDs for a 1% collision chance', value: n > 1e15 ? n.toExponential(1) : Math.round(n).toLocaleString() },
        ],
      }
    },
  },
  'ipv6-expander': {
    input: { label: 'IPv6 addresses, one per line', sample: '2001:db8::1\nfe80::1ff:fe23:4567:890a\n::ffff:192.0.2.128\n2001:0db8:0000:0000:0000:ff00:0042:8329', mono: true, rows: 5 },
    output: { label: 'Result', filename: 'ipv6.txt' },
    swap: true,
    modes: [
      { id: 'expand', label: 'Expand', outputLabel: 'Full form', run: (input) => ipv6Result(input, 'expand') },
      { id: 'compress', label: 'Compress', outputLabel: 'Short form (RFC 5952)', run: (input) => ipv6Result(input, 'compress') },
    ],
  },
  'ip-to-decimal': {
    input: { label: 'IP addresses or numbers, one per line', sample: '192.168.1.1\n8.8.8.8\n3232235777\n2001:db8::1', mono: true, rows: 5 },
    output: { label: 'Result', filename: 'ip-numbers.txt' },
    run: (input) => {
      const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      const rows = lines.map((l) => {
        if (l.includes(':')) {
          const g = expandIpv6(l)
          const n = BigInt(`0x${g.join('')}`)
          return [l, compressIpv6(g), n.toString(), `0x${g.join('')}`]
        }
        if (/^\d+$/.test(l)) {
          const n = Number(l)
          return [l, numberToIpv4(n), String(n), `0x${n.toString(16).padStart(8, '0')}`]
        }
        const n = ipv4ToNumber(l)
        return [l, l, String(n), `0x${n.toString(16).padStart(8, '0')}`]
      })
      const first = rows[0]
      const v4 = first && !first[1].includes(':') ? ipv4ToNumber(first[1]) : null
      return {
        rows: first
          ? [
              { label: 'Address', value: first[1] },
              { label: 'Decimal', value: first[2] },
              { label: 'Hex', value: first[3] },
              ...(v4 !== null ? [{ label: 'Binary', value: v4.toString(2).padStart(32, '0').replace(/(.{8})(?=.)/g, '$1.') }, { label: 'Octal', value: `0${v4.toString(8)}` }] : []),
            ]
          : [],
        table: rows.length > 1 ? { head: ['Input', 'Address', 'Decimal', 'Hex'], rows } : undefined,
        text: rows.map((r) => `${r[1]}\t${r[2]}`).join('\n'),
      }
    },
  },
  'mac-address-generator': {
    output: { label: 'MAC addresses', filename: 'mac-addresses.txt' },
    action: 'Generate',
    fields: [
      COUNT,
      {
        kind: 'choice',
        id: 'separator',
        label: 'Format',
        default: ':',
        choices: [
          { value: ':', label: '00:1a:2b:3c:4d:5e' },
          { value: '-', label: '00-1a-2b-3c-4d-5e' },
          { value: '.', label: '001a.2b3c.4d5e' },
          { value: '', label: '001a2b3c4d5e' },
        ],
      },
      { kind: 'text', id: 'prefix', label: 'Vendor prefix (optional)', default: '', mono: true, placeholder: '00:1A:2B' },
      { kind: 'toggle', id: 'local', label: 'Locally administered', default: true, hint: 'Sets the bit that marks the address as not assigned by a vendor, so it cannot clash with real hardware.' },
      { kind: 'toggle', id: 'upper', label: 'Uppercase', default: false },
    ],
    run: (_input, v) => many(num(v, 'count'), () => newMac({ local: bool(v, 'local'), multicast: false, prefix: str(v, 'prefix'), separator: str(v, 'separator'), upper: bool(v, 'upper') })),
  },
  'docker-run-to-compose': {
    input: {
      label: 'docker run commands',
      mono: true,
      rows: 8,
      sample: `docker run -d --name db --restart unless-stopped \\
  -e DB_PASSWORD=secret -v dbdata:/var/lib/db \\
  -p 5432:5432 --network backend registry.example.com/db:17
docker run -d --name web -p 8080:80 --network backend \\
  -v ./site:/srv/www:ro registry.example.com/web:1.4`,
    },
    output: { label: 'compose.yaml', filename: 'compose.yaml', rows: 18 },
    run: async (input) => {
      const r = await composeYaml(input)
      return { text: r.yaml, stats: [{ label: 'Services', value: r.services }], note: r.notes.join(' ') || undefined }
    },
  },
  'csp-evaluator': {
    input: {
      label: 'Content-Security-Policy header',
      mono: true,
      rows: 5,
      sample: "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.example.com *.example.net; img-src * data:; report-uri /csp",
    },
    output: { label: 'Report', filename: 'csp-report.txt' },
    run: (input) => {
      const csp = parseCsp(input)
      if (csp.size === 0) throw new Error('No directives found. Paste the policy, such as default-src \'self\'; script-src \'self\'.')
      const findings = evaluateCsp(csp)
      const high = findings.filter((x) => x.severity === 'High').length
      const medium = findings.filter((x) => x.severity === 'Medium').length
      return {
        verdict: { ok: high === 0, title: high ? `${high} high-risk problem${high === 1 ? '' : 's'} found.` : medium ? `No high-risk problems; ${medium} to review.` : 'No serious problems found.', detail: 'A policy protects only as much as its weakest script source.' },
        table: { head: ['Severity', 'Directive', 'Finding'], rows: findings.map((x) => [x.severity, x.directive, x.text]) },
        rows: [...csp].map(([k, vals]) => ({ label: k, value: vals.join(' ') })),
        text: findings.map((x) => `[${x.severity}] ${x.directive}: ${x.text}`).join('\n'),
      }
    },
  },
}

function ipv6Result(input: string, mode: 'expand' | 'compress'): Result {
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const parsed = lines.map((l) => expandIpv6(l))
  const out = parsed.map((g) => (mode === 'expand' ? g.join(':') : compressIpv6(g)))
  const g = parsed[0]
  return {
    rows: g
      ? [
          { label: 'Full form', value: g.join(':') },
          { label: 'Short form', value: compressIpv6(g) },
          { label: 'Type', value: ipv6Kind(g) },
          { label: 'Reverse DNS name', value: ipv6Arpa(g) },
          { label: 'Binary', value: g.map((x) => parseInt(x, 16).toString(2).padStart(16, '0')).join(':') },
        ]
      : [],
    text: out.join('\n'),
  }
}
