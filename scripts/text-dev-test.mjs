#!/usr/bin/env node
/**
 * Tests for the text, developer, security, generator and word tools (src/lib/tools/text-dev.ts):
 * registry rules for every page, a spec for every routed tool, and known-answer cases for the
 * engines. Runs the TypeScript sources with Node's type stripping.
 *
 *   node scripts/text-dev-test.mjs        all cases
 *   node scripts/text-dev-test.mjs -v     print every case
 */
import './search-test/loader.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'esbuild'

// Node strips types but rejects some TypeScript (parameter properties, JSX). Compile src with esbuild instead.
registerHooks({
  load(url, ctx, next) {
    if (url.startsWith('file:') && /\.tsx?$/.test(url) && !url.includes('/node_modules/')) {
      const loader = url.endsWith('x') ? 'tsx' : 'ts'
      const { code } = transformSync(readFileSync(fileURLToPath(url), 'utf8'), { loader, format: 'esm', jsx: 'automatic', target: 'es2024' })
      return { format: 'module', source: code, shortCircuit: true }
    }
    if (url.startsWith('file:') && url.endsWith('.json') && url.includes('/src/data/')) {
      return { format: 'module', source: `export default ${readFileSync(fileURLToPath(url), 'utf8')}`, shortCircuit: true }
    }
    return next(url, ctx)
  },
})

const verbose = process.argv.includes('-v')
let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    passed++
    if (verbose) console.log(`  ok   ${name}`)
  } catch (e) {
    failed++
    console.log(`  FAIL ${name}\n       ${String(e?.message ?? e).split('\n').join('\n       ')}`)
  }
}

// Pages fetch /data/... from this site; in Node, read the same files from public/.
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  if (typeof url === 'string' && url.startsWith('/data/')) return new Response(readFileSync(new URL(`../public${url}`, import.meta.url)))
  return realFetch(url, init)
}

const { TOOLS } = await import('../src/lib/tools/index.ts')
const { tools, TEXT_DEV_PAGES } = await import('../src/lib/tools/text-dev.ts')
const lucide = await import('lucide-react')
const { CATEGORY_BY_ID } = await import('../src/lib/tools/types.ts')

/** Spec maps of the families whose specs are plain TypeScript. */
const FAMILY_SPECS = {
  text: {
    ...(await import('../src/components/tools/text-dev/text/specs.ts')).TEXT_SPECS,
    ...(await import('../src/components/tools/text-dev/analyze/specs.ts')).ANALYZE_SPECS,
  },
  fancy: (await import('../src/components/tools/text-dev/fancy.ts')).FANCY,
  code: {
    ...(await import('../src/components/tools/text-dev/code/specs.ts')).CODE_SPECS,
    ...(await import('../src/components/tools/text-dev/data/specs.ts')).DATA_SPECS,
  },
  encode: {
    ...(await import('../src/components/tools/text-dev/encode/specs.ts')).ENCODE_SPECS,
    ...(await import('../src/components/tools/text-dev/web/specs.ts')).WEB_SPECS,
  },
  security: (await import('../src/components/tools/text-dev/security/specs.ts')).SECURITY_SPECS,
  words: {
    ...(await import('../src/components/tools/text-dev/words/specs.ts')).WORD_SPECS,
    ...(await import('../src/components/tools/text-dev/generate/specs.ts')).GENERATE_SPECS,
  },
}

/* ── registry ── */

const allSlugs = new Set(TOOLS.map((t) => t.slug))
const COPY_BANNED = [/—/, /\p{L}!(\s|$)/u]
const SALES = /\b(amazing|powerful|seamless|effortless|blazing|ultimate|best-in-class|revolutionary|supercharge|unleash)\b/i

console.log('registry')
await test('slugs are unique across the site', () => {
  const seen = new Map()
  for (const t of TOOLS) seen.set(t.slug, (seen.get(t.slug) ?? 0) + 1)
  const dupes = [...seen].filter(([, n]) => n > 1).map(([s]) => s)
  assert.deepEqual(dupes, [])
})
for (const t of tools) {
  await test(`${t.slug}: registry entry`, () => {
    const d = TEXT_DEV_PAGES.get(t.slug)
    assert.ok(d, 'missing page def')
    assert.match(t.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/)
    assert.ok(t.description.length >= 110 && t.description.length <= 155, `description is ${t.description.length} chars`)
    assert.ok(t.faqs && t.faqs.length >= 3 && t.faqs.length <= 5, `${t.faqs?.length} FAQs`)
    assert.ok(lucide[t.icon], `icon ${t.icon} is not a lucide-react export`)
    assert.ok(CATEGORY_BY_ID[t.category], `category ${t.category}`)
    assert.equal(t.updated, '2026-11-07')
    assert.ok(d.explainer.length > 0, 'no explainer')
    const copy = [t.title, t.h1 ?? '', t.description, ...t.faqs.flatMap((f) => [f.q, f.a]), ...d.explainer.flatMap((s) => [s.h, ...(s.p ?? []), ...(s.list ?? [])])]
    for (const line of copy) {
      for (const re of COPY_BANNED) assert.ok(!re.test(line), `copy has ${re}: ${line.slice(0, 80)}`)
      assert.ok(!SALES.test(line), `sales word: ${line.slice(0, 80)}`)
    }
    for (const r of t.related ?? []) assert.ok(allSlugs.has(r), `related slug ${r} does not exist`)
    const specs = FAMILY_SPECS[d.family]
    if (specs) assert.ok(specs[t.slug], `no ${d.family} spec`)
  })
}

/* ── engines ── */

const run = async (family, slug, input, values = {}, mode) => {
  const spec = FAMILY_SPECS[family][slug]
  const defaults = Object.fromEntries((spec.fields ?? []).map((f) => [f.id, f.default]))
  const fn = mode ? spec.modes.find((m) => m.id === mode).run : (spec.run ?? spec.modes[0].run)
  const r = await fn(input, { ...defaults, ...values })
  return typeof r === 'string' ? { text: r } : r
}
const text = async (...a) => (await run('text', ...a)).text

console.log('text engines')
await test('case', async () => {
  assert.equal(await text('uppercase-converter', 'straße é'), 'STRASSE É')
  assert.equal(await text('title-case-converter', 'the lord of the rings'), 'The Lord of the Rings')
  assert.equal(await text('camel-case-converter', 'HTTPResponseCode\nmax-retry-count'), 'httpResponseCode\nmaxRetryCount')
  assert.equal(await text('snake-case-converter', 'firstName'), 'first_name')
  assert.equal(await text('kebab-case-converter', 'User Profile'), 'user-profile')
  assert.equal(await text('constant-case-converter', 'maxRetryCount'), 'MAX_RETRY_COUNT')
  assert.equal(await text('pascal-case-converter', 'user_profile'), 'UserProfile')
  assert.equal(await text('alternating-case-converter', 'abc d'), 'aBc D')
})
await test('clean-up', async () => {
  assert.equal(await text('remove-extra-spaces', '  a   b\tc  '), 'a b c')
  assert.equal(await text('remove-empty-lines', 'a\n\n \nb'), 'a\nb')
  assert.equal(await text('remove-empty-lines', 'a\n\n\nb', { keepParagraphs: true }), 'a\n\nb')
  assert.equal(await text('remove-punctuation', "It's a well-known fact: $5!"), "It's a wellknown fact $5")
  assert.equal(await text('remove-punctuation', "It's a well-known fact: $5!", { hyphens: true, symbols: true }), "It's a well-known fact 5")
  assert.equal(await text('remove-numbers-from-text', 'Pay 1,299.50 now'), 'Pay now')
  assert.equal(await text('remove-accents', 'Crème brûlée Łódź straße'), 'Creme brulee Lodz strasse')
  assert.equal(await text('remove-html-tags', '<p>A &amp; B</p><script>x()</script><ul><li>one</li></ul>'), 'A & B\n- one')
  assert.equal(await text('remove-emojis', 'Hi 👍🏽 team 👨‍👩‍👧 🇫🇷 © 1️⃣ #1'), 'Hi team © #1')
  assert.equal(await text('remove-non-ascii-characters', 'Café “x” — ok 日本'), 'Cafe "x" - ok ')
  assert.equal(await text('smart-quotes-to-straight-quotes', '“Don’t”…', {}, 'straight'), '"Don\'t"...')
  assert.equal(await text('smart-quotes-to-straight-quotes', '"Don\'t," she said', {}, 'smart'), '“Don’t,” she said')
  assert.equal(await text('tabs-to-spaces', 'a\tb\n\tc', { width: 4 }, 'spaces'), 'a   b\n    c')
  assert.equal(await text('tabs-to-spaces', '      x', { width: 4, leading: true }, 'tabs'), '\t  x')
  assert.equal(await text('remove-duplicate-words', 'this is is a test of the The tool'), 'this is a test of the tool')
})
await test('lines', async () => {
  assert.equal(await text('add-line-numbers', 'a\n\nb', { pad: true, start: 9 }), '09. a\n\n10. b')
  assert.equal(await text('add-prefix-and-suffix-to-lines', 'a\nb'), "'a',\n'b',")
  assert.equal(await text('split-text', 'aaa bbb ccc', { by: 'characters', size: 7 }), 'aaa bbb\n\nccc')
  assert.equal(await text('split-text', 'a,b,c', { by: 'delimiter', delimiter: ',' }), 'a\nb\nc')
  assert.equal(await text('wrap-text', 'one two three four', { width: 9 }), 'one two\nthree\nfour')
  assert.equal(await text('list-to-comma-separated', "a\nb'c\n\na", { quote: "'", wrap: '()', dedupe: true }), "('a', 'b''c')")
  assert.equal(await text('comma-separated-to-list', 'a, "b, c", d'), 'a\nb, c\nd')
  assert.equal(await text('comma-separated-to-list', 'a; b; c'), 'a\nb\nc')
})
await test('extraction', async () => {
  assert.equal(await text('extract-emails', 'x SALES@ex.com, sales@ex.com <a.b+c@mail.ex.co.uk>'), 'sales@ex.com\na.b+c@mail.ex.co.uk')
  assert.equal(await text('extract-urls', 'See https://ex.com/a?b=1, (https://w.org/Foo_(bar)) and www.ex.net.'), 'https://ex.com/a?b=1\nhttps://w.org/Foo_(bar)\nwww.ex.net')
  const n = await run('text', 'extract-numbers', 'Q3 sold 1,204.50 and -3 or 12.5% mp4')
  assert.equal(n.text, '1,204.50\n-3\n12.5')
  assert.equal(n.stats[1].value, 1214)
  assert.equal(await text('extract-numbers', 'Preis 1.234,5 und 2', { decimal: ',' }), '1.234,5\n2')
  assert.equal(await text('extract-phone-numbers', 'Call +1 (415) 555-0132 or 020 7946 0958. Ref 2026-11-07, id 12345678'), '+1 (415) 555-0132\n020 7946 0958')
  assert.equal(await text('extract-hashtags', '#Sun #sun page#x &#39; #1 #été', {}, 'hashtags'), '#sun\n#été')
  assert.equal(await text('extract-hashtags', 'hi @jane_doe mail a@b.com @x.y.', {}, 'mentions'), '@jane_doe\n@x.y')
  assert.equal(await text('extract-ip-addresses', '1.2.3.4 999.1.1.1 1.2.3.4.5 10.0.0.0/8 2001:db8::1 fe80::1%eth0'), '1.2.3.4\n10.0.0.0/8\n2001:db8::1\nfe80::1%eth0')
})
await test('ciphers', async () => {
  assert.equal(await text('rot13-encoder-decoder', 'Hello, World'), 'Uryyb, Jbeyq')
  assert.equal(await text('rot47-encoder-decoder', 'Hello 9'), 'w6==@ h')
  assert.equal(await text('caesar-cipher', 'Attack at dawn', { shift: 3 }, 'encode'), 'Dwwdfn dw gdzq')
  assert.equal(await text('caesar-cipher', 'Dwwdfn dw gdzq', { shift: 3 }, 'decode'), 'Attack at dawn')
  const crack = await run('text', 'caesar-cipher', 'Wkh vhfuhw phhwlqj lv dw qrrq lq wkh sdun', {}, 'crack')
  assert.equal(crack.text, 'The secret meeting is at noon in the park')
  assert.equal(await text('vigenere-cipher', 'ATTACK AT DAWN', { key: 'LEMON' }, 'encode'), 'LXFOPV EF RNHR')
  assert.equal(await text('vigenere-cipher', 'LXFOPV EF RNHR', { key: 'LEMON' }, 'decode'), 'ATTACK AT DAWN')
  assert.equal(await text('atbash-cipher', 'Hello'), 'Svool')
  assert.equal(await text('letters-to-numbers', 'Hi you', {}, 'encode'), '8-9 / 25-15-21')
  assert.equal(await text('letters-to-numbers', '8-9 / 25-15-21', {}, 'decode'), 'HI YOU')
  assert.equal(await text('rail-fence-cipher', 'WE ARE DISCOVERED FLEE AT ONCE', { rails: 3 }, 'encode'), 'WECRLTEERDSOEEFEAOCAIVDEN')
  assert.equal(await text('rail-fence-cipher', 'WECRLTEERDSOEEFEAOCAIVDEN', { rails: 3 }, 'decode'), 'WEAREDISCOVEREDFLEEATONCE')
  assert.equal(await text('baconian-cipher', 'Hide', { alphabet: '26' }, 'encode'), 'AABBB ABAAA AAABB AABAA')
  assert.equal(await text('baconian-cipher', 'AABBB ABAAA AAABB AABAA', { alphabet: '26' }, 'decode'), 'hide')
  assert.equal(await text('pig-latin-translator', 'Pig latin string apple queen yellow rhythm'), 'Igpay atinlay ingstray appleway eenquay ellowyay ythmrhay')
  assert.equal(await text('leetspeak-translator', 'leet', {}, 'encode'), 'l337')
  assert.equal(await text('leetspeak-translator', 'h4ck3r 2026', {}, 'decode'), 'hacker 2026')
})

await test('analysis', async () => {
  const wf = await run('text', 'word-frequency-counter', 'The cat and the cat. A dog!')
  assert.deepEqual(wf.table.rows[0], [1, 'cat', 2, '66.7%'])
  const ph = await run('text', 'word-frequency-counter', 'state of the art and state of the art', { phrase: '2', stopWords: true })
  assert.deepEqual(ph.table.rows.find((r) => r[1] === 'state of').slice(1, 3), ['state of', 2])
  const cf = await run('text', 'character-frequency-counter', 'Aab!')
  assert.deepEqual(cf.table.rows[0], ['a', 'U+0061', 2, '66.7%'])
  const sc = await run('text', 'sentence-counter', 'Dr. Smith came. Did he? Yes')
  assert.equal(sc.stats[0].value, 3)
  const lc = await run('text', 'line-counter', 'a\n\nb\na')
  assert.deepEqual(lc.stats.map((s) => s.value), [4, 3, 1, 1])
  const pc = await run('text', 'paragraph-counter', 'One. Two.\n\n  \nThree')
  assert.equal(pc.stats[0].value, 2)
  const rd = await run('text', 'readability-checker', 'The cat sat on the mat. The dog ran.')
  assert.ok(rd.stats[0].value > 90, `reading ease ${rd.stats[0].value}`)
  const rt = await run('text', 'reading-time-calculator', Array(476).fill('word').join(' '))
  assert.equal(rt.stats[0].value, '2 min')
  const pal = await run('text', 'palindrome-checker', 'A man, a plan, a canal: Panama')
  assert.equal(pal.verdict.ok, true)
  const pal2 = await run('text', 'palindrome-checker', 'hello racecar world')
  assert.equal(pal2.verdict.ok, false)
  assert.equal(pal2.rows[0].value, 'racecar')
})

console.log('code and data engines')
const code = async (...a) => (await run('code', ...a)).text
await test('formatters', async () => {
  const y = await code('yaml-formatter', 'a:   1\nb: [x,   y]\n# note\nc: {d: 2}', { indent: '2', flow: true })
  assert.equal(y, 'a: 1\nb:\n  - x\n  - y\n# note\nc:\n  d: 2\n')
  await assert.rejects(code('yaml-formatter', 'a: 1\n\tb: 2'))
  const yv = await run('code', 'yaml-validator', 'a: 1\na: 2')
  assert.equal(yv.verdict.ok, false)
  assert.equal((await run('code', 'yaml-validator', 'a: [1, 2]')).verdict.ok, true)
  assert.equal(
    await code('css-minifier', '/* x */ a , b { color : #ffffff ; content: "a , b" }\n.c > .d + .e { width: calc(100% - 2rem); }'),
    'a,b{color:#fff;content:"a , b"}.c>.d+.e{width:calc(100% - 2rem)}',
  )
  assert.equal(
    await code('html-minifier', '<div>\n  <p>Hi  <b>there</b> <i>you</i></p>\n  <!-- c -->\n  <pre>  a  b </pre>\n</div>'),
    '<div><p>Hi <b>there</b> <i>you</i></p><pre>  a  b </pre></div>',
  )
  assert.match(await code('css-formatter', 'a{color:red;margin:0}'), /a \{\n  color: red;\n  margin: 0\n\}/)
  assert.match(await code('javascript-beautifier', 'function f(a){return a+1}'), /function f\(a\) \{\n  return a \+ 1\n\}/)
  assert.match(await code('html-formatter', '<ul><li>a</li></ul>'), /<ul>\n  <li>a<\/li>\n<\/ul>/)
})
await test('data conversions', async () => {
  assert.equal(await code('toml-to-json', 'a = 1\n[b]\nc = "x"', { indent: '0' }), '{"a":1,"b":{"c":"x"}}')
  assert.equal(await code('json-to-toml', '{"a": 1, "b": {"c": "x"}}'), 'a = 1\n\n[b]\nc = "x"\n')
  await assert.rejects(code('json-to-toml', '{"a": null}'), /null/)
  assert.equal(await code('csv-to-yaml', 'id,name\n1,Ada\n2,'), '- id: 1\n  name: Ada\n- id: 2\n  name: null\n')
  assert.equal(await code('json-to-markdown-table', '[{"a":1,"b":{"c":"x|y"}}]'), '| a   | b.c  |\n| --- | ---- |\n| 1   | x\\|y |')
  assert.equal(await code('tsv-to-csv', 'a\tb\nx, y\tq"'), 'a,b\n"x, y","q"""')
  assert.equal(await code('csv-to-tsv', 'a,b\n"x, y",z'), 'a\tb\nx, y\tz')
  assert.equal(
    await code('env-to-json', '# c\nA=1\nexport B="x\\ny" \nC=\'raw\\n\'\nD=v # note\nE="multi\nline"', { indent: '0' }),
    '{"A":"1","B":"x\\ny","C":"raw\\\\n","D":"v","E":"multi\\nline"}',
  )
  assert.equal(await code('json-to-env', '{"port": 1, "db": {"host": "a b"}, "list": [1]}', { prefix: 'app_' }), 'APP_PORT=1\nAPP_DB_HOST="a b"\nAPP_LIST=[1]')
  assert.equal(await code('jsonl-to-json', '{"a":1}\n\n{"a":2}', { indent: '0' }), '[{"a":1},{"a":2}]')
  await assert.rejects(code('jsonl-to-json', '{"a":1}\n{bad'), /Line 2/)
  assert.equal(await code('json-to-jsonl', '[{"a":1},{"b":"x\\ny"}]'), '{"a":1}\n{"b":"x\\ny"}')
  assert.equal(
    await code('csv-to-sql', "id,name\n1,O'Brien\n2,", { table: 't', create: true, batch: 1 }),
    'CREATE TABLE "t" (\n  "id" INTEGER,\n  "name" TEXT\n);\n\nINSERT INTO "t" ("id", "name") VALUES\n(1, \'O\'\'Brien\');\n\nINSERT INTO "t" ("id", "name") VALUES\n(2, NULL);',
  )
  assert.equal(
    await code('json-to-sql', '[{"id":"007","n":2.5,"ok":true}]', { table: 'x', create: false, dialect: 'mysql' }),
    "INSERT INTO `x` (`id`, `n`, `ok`) VALUES\n('007', 2.5, TRUE);",
  )
  assert.match(await code('markdown-to-text', '# T\n\nA **b** [c](http://x)', { links: true }), /^T\nA b c \(http:\/\/x\)$/)
})

console.log('encode engines')
const enc = async (...a) => (await run('encode', ...a)).text
await test('codecs', async () => {
  assert.equal(await enc('base58-encoder-decoder', 'Hello World!', {}, 'encode'), '2NEpo7TZRRrLZSi2U')
  assert.equal(await enc('base58-encoder-decoder', '2NEpo7TZRRrLZSi2U', {}, 'decode'), 'Hello World!')
  assert.equal(await enc('base58-encoder-decoder', '0000287fb4cd', { as: 'hex' }, 'encode'), '11233QC4')
  const chk = await enc('base58-encoder-decoder', '00f54a5851e9372b87810a8e60cdd2e7cfd80b6e31', { as: 'hex', check: true }, 'encode')
  assert.equal(chk, '1PMycacnJaSqwwJqjawXBErnLsZ7RkXUAs')
  await assert.rejects(enc('base58-encoder-decoder', '1PMycacnJaSqwwJqjawXBErnLsZ7RkXUAt', { as: 'hex', check: true }, 'decode'), /checksum/)
  assert.equal(await enc('ascii85-encoder-decoder', 'Man is distinguished', { delims: false }, 'encode'), '9jqo^BlbD-BleB1DJ+*+F(f,q')
  assert.equal(await enc('ascii85-encoder-decoder', '<~9jqo^BlbD-BleB1DJ+*+F(f,q~>', {}, 'decode'), 'Man is distinguished')
  assert.equal(await enc('ascii85-encoder-decoder', '\0\0\0\0ab', { delims: false }, 'encode'), 'z@:B')
  assert.equal(await enc('punycode-converter', 'münchen.de\n例え.テスト\nuser@bücher.example', {}, 'encode'), 'xn--mnchen-3ya.de\nxn--r8jz45g.xn--zckzah\nuser@xn--bcher-kva.example')
  assert.equal(await enc('punycode-converter', 'xn--mnchen-3ya.de\nxn--r8jz45g.xn--zckzah', {}, 'decode'), 'münchen.de\n例え.テスト')
  assert.equal(await enc('quoted-printable-encoder-decoder', 'Café = ok ', {}, 'encode'), 'Caf=C3=A9 =3D ok=20')
  assert.equal(await enc('quoted-printable-encoder-decoder', 'Caf=C3=A9 =3D o=\nk', {}, 'decode'), 'Café = ok')
  const long = await enc('quoted-printable-encoder-decoder', 'é'.repeat(40), {}, 'encode')
  assert.ok(long.split('\n').every((l) => l.length <= 76) && !/=[0-9A-F]?=\n/.test(long))
  assert.equal(await enc('unicode-escape-converter', 'é😀a', { style: 'js' }, 'escape'), '\\u00E9\\uD83D\\uDE00a')
  assert.equal(await enc('unicode-escape-converter', 'é😀', { style: 'python' }, 'escape'), '\\u00E9\\U0001F600')
  assert.equal(await enc('unicode-escape-converter', 'Caf\\u00e9 \\ud83d\\ude00 \\u{1F44D} &#x263A; U+00E9', {}, 'unescape'), 'Café 😀 👍 ☺ é')
  assert.equal(await enc('javascript-string-escape', 'a\'b"c\n\\', { quote: "'" }, 'escape'), 'a\\\'b"c\\n\\\\')
  assert.equal(await enc('javascript-string-escape', '\\x41\\u00e9\\u{1F600}\\n', {}, 'unescape'), 'Aé😀\n')
  assert.equal(await enc('java-string-escape', 'say "hi"\té', { ascii: true }, 'escape'), 'say \\"hi\\"\\t\\u00e9')
  assert.equal(await enc('c-string-escape', 'é\n', { ascii: true }, 'escape'), '\\xc3\\xa9\\n')
  assert.equal(await enc('c-string-escape', '\\xc3\\xa9 \\101', {}, 'unescape'), 'é A')
})
await test('jsx', async () => {
  assert.equal(
    await enc('html-to-jsx', '<div class="a" style="margin-top: 8px; -webkit-box-flex: 1" tabindex="0"><!-- c --><br><label for="x">{hi}</label></div>'),
    `<div className="a" style={{ marginTop: '8px', WebkitBoxFlex: 1 }} tabIndex="0">{/* c */}<br /><label htmlFor="x">{'{'}hi{'}'}</label></div>`,
  )
  const svg = await enc('svg-to-jsx', '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="24" height="24" viewBox="0 0 24 24" stroke-width="2"><path d="M1 1"/></svg>', { component: 'Icon', dropSize: true })
  assert.match(svg, /export default function Icon\(props\)/)
  assert.match(svg, /<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 24 24" strokeWidth="2" \{\.\.\.props\}>/)
})
await test('parsers', async () => {
  const url = await run('encode', 'url-parser', 'https://u:p@ex.com:8443/a/b%20c?x=1&x=2#frag')
  assert.equal(url.rows.find((r) => r.label === 'Path').value, '/a/b c')
  assert.deepEqual(JSON.parse(url.text).query, { x: ['1', '2'] })
  assert.equal(await enc('query-string-to-json', '?a=1&b[c]=2&b[d][]=3&b[d][]=4&e=x&e=y'), JSON.stringify({ a: '1', b: { c: '2', d: ['3', '4'] }, e: ['x', 'y'] }, null, 2))
  assert.equal(await enc('json-to-query-string', '{"q":"a b","t":["x","y"],"f":{"s":1}}', { arrays: 'brackets' }), 'q=a%20b&t[]=x&t[]=y&f[s]=1')
  const ua = JSON.parse(await enc('user-agent-parser', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'))
  assert.deepEqual([ua.browser, ua.engine, ua.os, ua.device, ua.cpu], ['Chrome', 'Blink', 'Windows', 'Desktop', 'x86 64-bit'])
  const curl = `curl -X POST 'https://api.ex.com/v1' -H 'Content-Type: application/json' -u user:pw -d '{"a":1}'`
  const js = await enc('curl-to-code', curl, {}, 'fetch')
  assert.match(js, /method: "POST"/)
  assert.match(js, /"Authorization": "Basic dXNlcjpwdw=="/)
  assert.match(js, /body: JSON.stringify\(\{\n {4}"a": 1\n {2}\}\)/)
  assert.match(await enc('curl-to-code', curl, {}, 'python'), /json=json_data,\n {4}auth=\('user', 'pw'\)/)
  assert.match(await enc('curl-to-code', 'curl https://ex.com -G -d q=1', {}, 'go'), /http.NewRequest\("GET", "https:\/\/ex.com\?q=1", nil\)/)
  assert.match(await enc('curl-to-code', 'curl -F file=@a.png https://ex.com/up', {}, 'php'), /new CURLFile\('a.png'\)/)
})
await test('jsonpath and diff', async () => {
  const store = FAMILY_SPECS.encode['jsonpath-tester'].input.sample
  const jp = async (expr) => JSON.parse(await enc('jsonpath-tester', store, { expr }))
  assert.deepEqual(await jp('$.store.book[?(@.price < 10)].title'), ['Sayings of the Century', 'Moby Dick'])
  assert.equal((await jp('$..author')).length, 4)
  assert.deepEqual(await jp('$.store.book[-1].author'), ['J. R. R. Tolkien'])
  assert.deepEqual((await jp('$.store.book[0:4:2]')).map((b) => b.price), [8.95, 8.99])
  assert.equal((await jp('$..book[?(@.isbn && @.price > 10)]')).length, 1)
  assert.deepEqual(await jp("$.store.book[?(@.author =~ /^J/)].title"), ['The Lord of the Rings'])
  assert.deepEqual(await jp("$.store.bicycle['color','price']"), ['red', 399])
  assert.deepEqual(await jp('$.store.book[?(length(@.title) < 10)].title'), ['Moby Dick'])
  const d = await run('encode', 'json-diff', '{"a":1,"b":[1,2],"c":{"d":1}}', { second: '{"b":[1],"c":{"d":2},"e":true,"a":1}' })
  assert.deepEqual(JSON.parse(d.text), [{ op: 'replace', path: '/c/d', value: 2 }, { op: 'remove', path: '/b/1' }, { op: 'add', path: '/e', value: true }])
  assert.equal((await run('encode', 'json-diff', '{"a":1,"b":2}', { second: '{"b":2,"a":1}' })).verdict.ok, true)
})
await test('ids and addresses', async () => {
  const oid = await run('encode', 'objectid-decoder', '507f1f77bcf86cd799439011', {}, 'decode')
  assert.equal(oid.rows[0].value, '2012-10-17T21:13:27.000Z')
  const sf = await run('encode', 'snowflake-id-decoder', '1541815603606036480')
  assert.equal(sf.rows[0].value, '2022-06-28T16:07:40.105Z')
  const ulids = (await enc('ulid-generator', '', { count: 50 })).split('\n')
  assert.equal(ulids.length, 50)
  assert.ok(ulids.every((u) => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(u)))
  assert.deepEqual([...ulids].sort(), ulids)
  const nano = (await enc('nanoid-generator', '', { count: 20, size: 12, alphabet: 'numbers' })).split('\n')
  assert.ok(nano.every((n) => /^\d{12}$/.test(n)))
  assert.equal(await enc('ipv6-expander', '2001:db8::1\n::ffff:192.0.2.128', {}, 'expand'), '2001:0db8:0000:0000:0000:0000:0000:0001\n0000:0000:0000:0000:0000:ffff:c000:0280')
  assert.equal(await enc('ipv6-expander', '2001:0db8:0000:0000:0001:0000:0000:0001\nfe80:0:0:0:0:0:0:0', {}, 'compress'), '2001:db8::1:0:0:1\nfe80::')
  assert.equal(await enc('ip-to-decimal', '192.168.1.1\n3232235777'), '192.168.1.1\t3232235777\n192.168.1.1\t3232235777')
  const macs = (await enc('mac-address-generator', '', { count: 30 })).split('\n')
  assert.ok(macs.every((m) => /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/.test(m) && (parseInt(m.slice(0, 2), 16) & 3) === 2))
})
await test('compose and csp', async () => {
  const yml = await enc('docker-run-to-compose', 'docker run -d --name web --restart always -p 8080:80 -e A=1 -v data:/data --network back -it --mount type=bind,source=/a,target=/b,readonly example/web:1 serve --port 80')
  assert.equal(
    yml,
    'services:\n  web:\n    image: example/web:1\n    container_name: web\n    restart: always\n    ports:\n      - 8080:80\n    environment:\n      - A=1\n    volumes:\n      - data:/data\n      - /a:/b:ro\n    networks:\n      - back\n    stdin_open: true\n    tty: true\n    command:\n      - serve\n      - --port\n      - "80"\nnetworks:\n  back:\n    external: true\nvolumes:\n  data:\n',
  )
  const csp = await run('encode', 'csp-evaluator', "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' *.cdn.com; scirpt-src x")
  assert.equal(csp.verdict.ok, false)
  assert.ok(csp.table.rows.some((r) => r[1] === 'scirpt-src'))
  assert.equal((await run('encode', 'csp-evaluator', "default-src 'none'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")).verdict.ok, true)
})
await test('web generators', async () => {
  const ht = await enc('htaccess-redirect-generator', '', { rules: '/old /new\n/gone', code: 'gone', https: false })
  assert.equal(ht, '# Page redirects (410 Gone)\nRedirect gone /old\nRedirect gone /gone\n')
  const ht2 = await enc('htaccess-redirect-generator', '', { rules: '/a.html https://ex.com/b', code: '301', style: 'rewrite', https: true, www: 'remove' })
  assert.match(ht2, /RewriteRule \^a\\\.html\/\?\$ https:\/\/ex.com\/b \[L,R=301\]/)
  assert.match(ht2, /RewriteCond %\{HTTPS\} off/)
  assert.equal(await enc('robots-txt-generator', '', { disallow: '/admin\nprivate', bots: 'BadBot', sitemap: 'https://ex.com/s.xml' }), 'User-agent: *\nDisallow: /admin\nDisallow: /private\n\nUser-agent: BadBot\nDisallow: /\n\nSitemap: https://ex.com/s.xml\n')
  const gi = await enc('gitignore-generator', '', { templates: 'node,secrets', extra: 'uploads/' })
  assert.equal(gi.split('\n').filter((l) => l === '.env').length, 1)
  assert.match(gi, /# Project\nuploads\/\n$/)
  const utm = await enc('utm-builder', '', { url: 'https://ex.com/p?x=1', source: 'News Letter', medium: 'Email', campaign: 'fall' })
  assert.equal(utm, 'https://ex.com/p?x=1&utm_source=news-letter&utm_medium=email&utm_campaign=fall')
  const cspg = await run('encode', 'csp-generator', '', {})
  assert.match(cspg.text, /^default-src 'self'; script-src 'self'; .*object-src 'none'.*upgrade-insecure-requests$/)
})

console.log('security engines')
const sec = async (...a) => (await run('security', ...a)).text
await test('digests', async () => {
  const fox = 'The quick brown fox jumps over the lazy dog'
  assert.equal(await sec('sha224-hash-generator', fox), '730e109bd7a8a32b1cb9d9a09aa2325d2430587ddbc0c38bad911525')
  assert.equal(await sec('sha384-hash-generator', fox), 'ca737f1014a48f4c0b6dd43cb177b0afd9e5169367544c494011e3317dbf9a509cb1e5dc1e85a941bbee3d7f2afbc9b1')
  assert.equal(await sec('sha3-hash-generator', ''), 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a')
  assert.equal(await sec('keccak-256-hash-generator', ''), 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470')
  assert.equal(await sec('blake2-hash-generator', 'abc'), 'ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923')
  assert.equal(await sec('blake3-hash-generator', ''), 'af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262')
  assert.equal(await sec('ripemd160-hash-generator', fox), '37f332f68db77bd9d7edd4969571ad671cf9dd3b')
  assert.equal(await sec('xxhash-generator', '', { algo: '64' }), 'ef46db3751d8e999')
  assert.equal(await sec('xxhash-generator', '', { algo: '32' }), '02cc5d05')
  assert.equal(await sec('whirlpool-hash-generator', ''), '19fa61d75522a4669b44e39c1d2e1726c530232130d407f89afee0964997f7a73e83be698b288febcf88e3e03c4f0757ea8964e59b63d93708b138cc42a66eb3')
  assert.equal(await sec('ntlm-hash-generator', 'password'), '8846f7eaee8fb117ad06bdd830b7586c')
  assert.equal(await sec('sha384-hash-generator', 'abc', { format: 'base64' }), 'ywB1P0WjXou1oD1pmsZQBycsMqsO3tFjGotgWkP/W+2AhgcroefMI1i67KE0yCWn')
})
await test('password hashing', async () => {
  const h = await sec('bcrypt-generator', 'hunter2', { cost: 4 }, 'hash')
  assert.match(h, /^\$2[ab]\$04\$[./A-Za-z0-9]{53}$/)
  assert.equal((await run('security', 'bcrypt-generator', 'hunter2', { hash: h }, 'verify')).verdict.ok, true)
  assert.equal((await run('security', 'bcrypt-generator', 'hunter3', { hash: h }, 'verify')).verdict.ok, false)
  const a = await sec('argon2-hash-generator', 'pw', { memory: 1, iterations: 1 }, 'hash')
  assert.match(a, /^\$argon2id\$v=19\$m=1024,t=1,p=1\$/)
  assert.equal((await run('security', 'argon2-hash-generator', 'pw', { hash: a }, 'verify')).verdict.ok, true)
  assert.equal(await sec('scrypt-hash-generator', 'password', { n: 1024, r: 8, p: 16, length: 64, salt: Buffer.from('NaCl').toString('hex') }), 'fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b3731622eaf30d92e22a3886ff109279d9830dac727afb94a83ee6d8360cbdfa2cc0640')
  assert.equal(await sec('pbkdf2-generator', 'password', { hash: 'SHA-1', iterations: 1, length: 20, salt: 'salt' }), '0c60c80f961f0e71f3a9b524af6012062fe037a6')
  assert.match(await sec('htpasswd-generator', '', { user: 'admin', password: 'pw', algo: 'bcrypt' }), /^admin:\$2y\$10\$/)
  assert.equal(await sec('htpasswd-generator', '', { user: 'a', password: 'password', algo: 'sha' }), 'a:{SHA}W6ph5Mm5Pz8GgiULbPgzG37mj9g=')
  const ids = await sec('hash-identifier', '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW\n5d41402abc4b2a76b9719d911017c592')
  assert.match(ids, /bcrypt\n.*MD5/)
})
await test('keys and certificates', async () => {
  for (const type of ['ed25519', 'ecdsa', 'rsa']) {
    const r = await run('security', 'ssh-key-generator', '', { type, bits: '2048', comment: 'me@host' })
    assert.match(r.text, new RegExp(`^(ssh-ed25519|ecdsa-sha2-nistp256|ssh-rsa) AAAA[A-Za-z0-9+/=]+ me@host$`))
    assert.match(r.blocks[0].text, /^-----BEGIN OPENSSH PRIVATE KEY-----\n/)
    const fp = await run('security', 'ssh-key-fingerprint', r.text)
    assert.equal(fp.rows[0].value, r.rows[0].value)
  }
  const fp = await run('security', 'ssh-key-fingerprint', FAMILY_SPECS.security['ssh-key-fingerprint'].input.sample)
  assert.equal(fp.rows[0].value, 'SHA256:lhZFbg61ea6tALQOmD0qLTcX3sJXeHNgk1XNB/XHBxw')
  const rsa = await run('security', 'rsa-key-generator', '', { bits: '2048', format: 'pkcs1' })
  assert.match(rsa.blocks[0].text, /^-----BEGIN RSA PRIVATE KEY-----/)
  const back = await run('security', 'jwk-to-pem', rsa.blocks[0].text, {}, 'tojwk')
  assert.equal(JSON.parse(back.text).kty, 'RSA')
  const cert = await run('security', 'x509-certificate-decoder', FAMILY_SPECS.security['x509-certificate-decoder'].input.sample)
  const row = (r, l) => r.rows.find((x) => x.label.startsWith(l))?.value
  assert.equal(row(cert, 'Subject'), 'C=US, O=Example Org, CN=www.example.com')
  assert.equal(row(cert, 'Subject Alternative Name'), 'DNS:www.example.com, DNS:example.com')
  assert.equal(row(cert, 'Public key'), 'Elliptic curve (ECDSA), P-256')
  assert.equal(row(cert, 'SHA-256 fingerprint'), 'A1:7B:73:CE:DA:D6:1D:8A:D5:37:5E:1E:00:8B:43:03:2B:14:31:23:C2:C6:D0:79:13:61:3C:A7:A9:0D:7A:DD')
  assert.equal(row(cert, 'Extended Key Usage'), 'TLS server')
  const csr = await run('security', 'csr-decoder', FAMILY_SPECS.security['csr-decoder'].input.sample)
  assert.equal(csr.verdict.ok, true)
  assert.equal(row(csr, 'Subject Alternative Name'), 'DNS:shop.example.com, DNS:example.com')
  const pem = await sec('jwk-to-pem', FAMILY_SPECS.security['jwk-to-pem'].input.sample, {}, 'topem')
  assert.equal(pem.trim(), FAMILY_SPECS.security['jwk-to-pem'].modes[1].sample)
  const jwk = await run('security', 'jwk-to-pem', pem, {}, 'tojwk')
  assert.equal(jwk.rows[1].value, 'oKIywvGUpTVTyxMQ3bwIIeQUudfr_CkLMjCE19ECD-U')
  const tok = await sec('jwt-encoder', '{"sub":"1234567890","name":"John Doe","iat":1516239022}', { alg: 'HS256', secret: 'your-256-bit-secret' })
  assert.equal(tok, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')
  const es = await sec('jwt-encoder', '{"a":1}', { alg: 'RS256', secret: rsa.blocks[0].text })
  assert.equal(es.split('.').length, 3)
})
await test('check digits', async () => {
  assert.equal((await run('security', 'luhn-checker', '79927398713')).verdict.ok, true)
  assert.equal((await run('security', 'luhn-checker', '7992739871')).table.rows[0][2], '3')
  const cards = await run('security', 'credit-card-validator', '4111 1111 1111 1111\n3782 822463 10005\n5555555555554444\n4111111111111112')
  assert.deepEqual(cards.table.rows.map((r) => [r[1], r[4]]), [['Visa', 'Valid'], ['American Express', 'Valid'], ['Mastercard', 'Valid'], ['Visa', 'Invalid']])
  assert.equal((await run('security', 'iban-validator', 'GB82 WEST 1234 5698 7654 32')).verdict.ok, true)
  const bad = await run('security', 'iban-validator', 'GB83WEST12345698765432')
  assert.equal(bad.verdict.ok, false)
  assert.match(bad.rows[2].value, /expected 82/)
  assert.equal((await run('security', 'iban-validator', 'DE8937040044053201300')).verdict.ok, false)
})

console.log('word and generator engines')
const wd = async (...a) => (await run('words', ...a)).text
await test('words', async () => {
  const d = await run('words', 'dictionary', 'dogs')
  assert.equal(d.rows[0].value, 'dog')
  assert.ok(d.table.rows.length >= 5)
  const th = await run('words', 'thesaurus', 'happy')
  assert.match(th.text, /felicitous/)
  assert.match(th.rows[0].value, /unhappy/)
  assert.match(await wd('antonym-finder', 'good'), /^evil\nbad/)
  const rh = (await wd('rhyme-finder', 'cat')).split('\n')[0]
  assert.match(rh, /^1 syllable: .*\bhat\b/)
  const sy = await run('words', 'syllable-counter', 'An old silent pond\nA frog jumps into the pond')
  assert.equal(sy.text, '5\tAn old silent pond\n7\tA frog jumps into the pond')
  assert.match(await wd('word-unscrambler', 'tpslea'), /6 letters: .*\bplates\b/)
  const an = (await wd('anagram-solver', 'listen')).split('\n')
  assert.ok(['silent', 'enlist', 'tinsel'].every((w) => an.includes(w)) && !an.includes('listen'))
  const sc = await run('words', 'scrabble-word-finder', 'qrtzaeu')
  assert.ok(sc.table.rows.some((r) => r[0] === 'quartz'))
  const wl = (await wd('wordle-solver', 'cr___', { yellow: 'a4', gray: 'nets' })).split('\n')
  assert.ok(wl.includes('crazy') && wl.every((w) => /^cr/.test(w) && w.includes('a') && w[3] !== 'a' && !/[nets]/.test(w)))
  assert.equal((await wd('crossword-solver', 'c?o?s?o?d')).split('\n')[0], 'crossword')
  const q = await run('words', 'quote-finder', 'courage')
  assert.ok(q.stats[0].value > 10)
  const rw = (await wd('random-word-generator', '', { count: 20, min: 4, max: 6 })).split('\n')
  assert.ok(rw.length === 20 && rw.every((w) => w.length >= 4 && w.length <= 6))
})
await test('generators', async () => {
  const names = await wd('random-name-generator', '', { count: 5, seed: 'x' })
  assert.equal(names, await wd('random-name-generator', '', { count: 5, seed: 'x' }))
  assert.equal(names.split('\n').length, 5)
  const cards = await run('words', 'test-credit-card-generator', '', { count: 20, network: 'amex' })
  const { luhnValid } = await import('../src/components/tools/text-dev/security/validate.ts')
  assert.ok(cards.table.rows.every((r) => /^3[47]\d\d \d{6} \d{5}$/.test(r[0]) && luhnValid(r[0].replace(/ /g, '')) && /^\d{4}$/.test(r[2])))
  const data = JSON.parse(await wd('fake-data-generator', '', { fields: 'id,email,price', count: 3, format: 'json' }))
  assert.deepEqual(Object.keys(data[0]), ['id', 'email', 'price'])
  assert.match(data[2].email, /@example\.com$/)
  assert.ok((await wd('random-email-generator', '', { count: 5 })).split('\n').every((e) => /^[a-z.+_0-9-]+@example\.com$/.test(e)))
  assert.ok((await wd('random-phone-number-generator', '', { count: 5 })).split('\n').every((p) => /^\(\d{3}\) 555-01\d\d$/.test(p)))
  assert.ok((await wd('random-ip-address-generator', '', { count: 20, kind: 'documentation' })).split('\n').every((ip) => /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+$/.test(ip)))
  const dates = (await wd('random-date-generator', '', { count: 30, from: '2024-01-01', to: '2024-01-31', weekdays: true, sort: true })).split('\n')
  assert.ok(dates.every((x) => /^2024-01-\d\d$/.test(x) && ![0, 6].includes(new Date(`${x}T00:00:00Z`).getUTCDay())))
  assert.deepEqual([...dates].sort(), dates)
  assert.equal(new Set((await wd('random-letter-generator', '', { count: 26, unique: true, join: '' })).split('')).size, 26)
  const teams = await run('words', 'random-team-generator', 'a\nb\nc\nd\ne', { by: 'teams', n: 2 })
  assert.deepEqual(teams.table.rows.map((r) => r[1].split(', ').length).sort(), [2, 3])
  assert.ok((await wd('username-generator', '', { count: 10, max: 12 })).split('\n').every((u) => u.length <= 12 && /^\w+$/.test(u)))
})

console.log(`\ntext-dev: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
