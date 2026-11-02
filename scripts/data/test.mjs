#!/usr/bin/env node
/**
 * Unit tests for the data fetchers' parsers (scripts/data/*.mjs) and the reference tools' lookups
 * (src/components/tools/reference/*.ts), plus checks of the data files in the repository.
 * Offline: no test downloads anything.
 *
 *   node scripts/data/test.mjs        all tests
 *   node scripts/data/test.mjs ip     tests whose name contains "ip"
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { ROOT, CheckError, checkJump, chunkedArray, parseCsv, sig, unzip } from './lib.mjs'
import { encodeDates, parseEcbCsv } from './ecb-fx.mjs'
import { despike, pricesFromSnapshot } from './crypto.mjs'
import { parsePmms, usDate } from './mortgage-rates.mjs'
import { parseBlsSeries } from './cpi-us.mjs'
import { parseShiller } from './stock-returns.mjs'
import { encodeV4Chunk, encodeV6Chunk, findRow, parseIpToAsn, v4ToInt, v6ToHex } from './ip-asn.mjs'
import { flatten, parseCidr as parseCidrBig } from './cloud-ips.mjs'
import { countryOf, parseRegistry } from './mac-vendors.mjs'
import { parsePorts } from './ports.mjs'
import { parsePsl, parseRootDb } from './tlds.mjs'
import { currentRelease } from './browser-versions.mjs'
import { compactProduct } from './eol.mjs'
import { outlinePath, parseAirports } from './airports.mjs'
import { parseBlocks, parseEmojiTest, parseUnicodeData } from './unicode.mjs'
import { parseLifeTable } from './life-table.mjs'
import { parseYear } from './baby-names.mjs'
import { parseLms } from './growth-charts.mjs'

const REF = path.join(ROOT, 'src/components/tools/reference')
const ref = (name) => import(path.join(REF, `${name}.ts`))
const [fx, ip, mac, ports, psl, ua, eol, geo, unicode, lms, stock] = await Promise.all(
  ['fx', 'ip', 'mac', 'ports', 'psl', 'ua', 'eol', 'geo', 'unicode', 'lms', 'stock'].map(ref),
)

const filter = process.argv[2] ?? ''
let passed = 0
const failures = []
async function test(name, fn) {
  if (filter && !name.includes(filter)) return
  try {
    await fn()
    passed++
  } catch (e) {
    failures.push([name, e])
  }
}
const readJson = (rel) => JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'))

/* ── lib ─────────────────────────────────────────────────────────────── */
await test('lib csv quotes and newlines', () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","he said ""hi"""\r\n1,\n'), [
    ['a', 'b'],
    ['x, y', 'he said "hi"'],
    ['1', ''],
  ])
})
await test('lib unzip stored and deflated', () => {
  const entry = (name, data, method) => {
    const body = method ? deflateRawSync(data) : data
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    return { name, body, method, local: Buffer.concat([local, Buffer.from(name), body]), size: data.length }
  }
  const items = [entry('a.txt', Buffer.from('hello'), 0), entry('b.csv', Buffer.from('x,y\n'.repeat(50)), 8)]
  const central = []
  let offset = 0
  for (const it of items) {
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0)
    c.writeUInt16LE(it.method, 10)
    c.writeUInt32LE(it.body.length, 20)
    c.writeUInt32LE(it.size, 24)
    c.writeUInt16LE(it.name.length, 28)
    c.writeUInt32LE(offset, 42)
    central.push(Buffer.concat([c, Buffer.from(it.name)]))
    offset += it.local.length
  }
  const cd = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(items.length, 10)
  end.writeUInt32LE(cd.length, 12)
  end.writeUInt32LE(offset, 16)
  const files = unzip(Buffer.concat([...items.map((i) => i.local), cd, end]))
  assert.equal(files.get('a.txt').toString(), 'hello')
  assert.equal(files.get('b.csv').toString(), 'x,y\n'.repeat(50))
})
await test('lib checks and formatting', () => {
  assert.throws(() => checkJump(100, 140, 0.3, 'x'), CheckError)
  assert.doesNotThrow(() => checkJump(100, 120, 0.3, 'x'))
  assert.equal(sig(1.23456789, 4), 1.235)
  assert.deepEqual(JSON.parse(chunkedArray([1, null, 3], 2)), [1, null, 3])
})

/* ── exchange rates ──────────────────────────────────────────────────── */
await test('fx ECB CSV and dates', () => {
  const csv = 'Date,USD,JPY,CYP,\n1999-01-05,1.179,130.96,0.5823,\n1999-01-04,1.1789,133.73,0.58231,\n1999-01-06,1.1743,N/A,N/A,\n'
  const { dates, series } = parseEcbCsv(csv)
  assert.deepEqual(dates, ['1999-01-04', '1999-01-05', '1999-01-06'])
  assert.deepEqual(Object.keys(series), ['USD'], 'only currencies quoted on the latest day')
  const gaps = encodeDates(['1999-01-04', '1999-01-05', '1999-01-08', '1999-01-11'])
  assert.equal(gaps, '1133')
  const days = fx.decodeDates('1999-01-04', gaps)
  assert.deepEqual(days.map((d) => new Date(d * 86_400_000).toISOString().slice(0, 10)), ['1999-01-04', '1999-01-05', '1999-01-08', '1999-01-11'])
})
await test('fx cross rates and amounts', () => {
  const rates = { USD: 1.1, GBP: 0.85 }
  assert.equal(fx.crossRate(rates, 'EUR', 'USD'), 1.1)
  assert.ok(Math.abs(fx.crossRate(rates, 'USD', 'GBP') - 0.85 / 1.1) < 1e-12)
  assert.ok(Number.isNaN(fx.crossRate(rates, 'USD', 'XXX')))
  assert.deepEqual(fx.pairSeries([2, null, 4], [1, 1, 2], 3), [0.5, null, 0.5])
  assert.equal(fx.parseAmount('1,234.50'), 1234.5)
  assert.equal(fx.parseAmount('12,5'), 12.5)
  assert.ok(Number.isNaN(fx.parseAmount('abc')))
})
await test('crypto snapshot and glitch removal', () => {
  const p = pricesFromSnapshot({ usd: { btc: 0.00001, eth: 0.0005, usdt: 1 } })
  assert.equal(p.BTC, 100000)
  assert.equal(p.ETH, 2000)
  assert.deepEqual(despike([10, 11, 10, 0.02, 11, 10, 12]), [10, 11, 10, null, 11, 10, 12])
  assert.deepEqual(despike([10, 11, 20, 21, 22, 20, 21]), [10, 11, 20, 21, 22, 20, 21], 'a lasting move stays')
})

/* ── mortgage, CPI, stocks ───────────────────────────────────────────── */
await test('mortgage PMMS parse', () => {
  assert.equal(usDate('4/2/1971'), '1971-04-02')
  const rows = parsePmms('date,pmms30,pmms30p,pmms15,pmms15p\n4/9/1971,7.31, ,,\n4/2/1971,7.33,,,\n10/29/2026,7.24,,6.6,\n')
  assert.deepEqual(rows[0], { date: '1971-04-02', r30: 7.33, r15: null })
  assert.deepEqual(rows[2], { date: '2026-10-29', r30: 7.24, r15: 6.6 })
})
await test('cpi BLS series parse', () => {
  const text = 'series_id\tyear\tperiod\tvalue\tfootnote_codes\nCUSR0000SA0      \t1947\tM01\t21.48\t\nCUUR0000SA0      \t1913\tM01\t9.8\t\nCUUR0000SA0      \t1913\tM13\t9.9\t\nCUUR0000SA0      \t1913\tS01\t9.8\t\n'
  const { monthly, annual } = parseBlsSeries(text, 'CUUR0000SA0')
  assert.deepEqual([...monthly], [['1913-01', 9.8]])
  assert.deepEqual([...annual], [[1913, 9.9]])
})
await test('stock returns parse and growth', () => {
  const rows = parseShiller('Date,SP500,Dividend,Earnings,Consumer Price Index\n1871-02-01,4.5,0.26,0.4,12.84\n1871-01-01,4.44,0.26,0.4,12.46\n1871-03-01,4.6,0.0,0.4,13\n')
  assert.equal(rows.length, 2, 'stops at the first month without a dividend')
  const d = { price: [100, 110, 121], dividend: [12, 12, 12], cpi: [100, 100, 110] }
  const g = stock.growth(d, 0, 2, 1000)
  assert.ok(Math.abs(g.total[1] - 1000 * (110 + 1) / 100) < 1e-9)
  assert.ok(Math.abs(g.price[2] - 1210) < 1e-9)
  assert.ok(Math.abs(g.real[2] - g.total[2] / 1.1) < 1e-9)
  assert.ok(Math.abs(stock.cagr(100, 200, 120) - (2 ** 0.1 - 1) * 100) < 1e-9)
  assert.equal(stock.monthIndex('1871-01', '1872-03'), 14)
})

/* ── IP ──────────────────────────────────────────────────────────────── */
await test('ip parse and format', () => {
  assert.deepEqual(ip.parseIp('192.0.2.1'), { v: 4, n: 3221225985 })
  assert.equal(ip.parseIp('256.1.1.1'), null)
  assert.equal(ip.parseIp('1.2.3'), null)
  assert.equal(ip.parseIPv6('2001:db8::1'), 0x20010db8000000000000000000000001n)
  assert.equal(ip.parseIPv6('[fe80::1%eth0]'), 0xfe800000000000000000000000000001n)
  assert.equal(ip.mappedV4(ip.parseIPv6('::ffff:8.8.8.8')), 0x08080808)
  assert.equal(ip.parseIPv6('1::2::3'), null)
  assert.equal(ip.parseIPv6('12345::'), null)
  assert.equal(ip.formatIPv6(ip.parseIPv6('2001:0db8:0000:0000:0001:0000:0000:0001')), '2001:db8::1:0:0:1')
  assert.equal(ip.formatIPv6(0n), '::')
  assert.equal(ip.formatIPv6(ip.parseIPv6('2001:db8:0:1:1:1:1:1')), '2001:db8:0:1:1:1:1:1', 'a single zero group is not shortened')
  assert.equal(ip.specialRange({ v: 4, n: v4ToInt('10.1.2.3') }), 'Private network (RFC 1918)')
  assert.equal(ip.specialRange({ v: 4, n: v4ToInt('8.8.8.8') }), null)
  assert.deepEqual(
    ip.rangeToCidrs(BigInt(v4ToInt('10.0.0.0')), BigInt(v4ToInt('10.0.2.255')), 32).map((c) => [ip.formatIPv4(Number(c.base)), c.bits]),
    [
      ['10.0.0.0', 23],
      ['10.0.2.0', 24],
    ],
  )
})
await test('ip chunk format round trip', () => {
  const v4 = [
    [100, 199, 15169],
    [200, 200, 13335],
    [500, 1000, 64512],
  ]
  const c4 = ip.decodeV4Chunk(encodeV4Chunk(v4), 100)
  assert.deepEqual(c4, { starts: [100, 200, 500], ends: [199, 200, 1000], values: [15169, 13335, 64512] })
  assert.equal(ip.findInChunk(c4.starts, c4.ends, 300), -1)
  assert.equal(ip.findInChunk(c4.starts, c4.ends, 700), 2)
  const a = v6ToHex('2001:4860::')
  const b = v6ToHex('2001:4860:ffff:ffff:ffff:ffff:ffff:ffff')
  const c6 = ip.decodeV6Chunk(encodeV6Chunk([[a, b, 15169]]))
  assert.equal(c6.starts[0], BigInt(`0x${a}`))
  assert.equal(c6.ends[0], BigInt(`0x${b}`))
  const { v4: rows } = parseIpToAsn('1.0.0.0\t1.0.0.255\t13335\tUS\tCLOUDFLARENET - Cloudflare, Inc.\n1.0.1.0\t1.0.3.255\t0\tNone\tNot routed\n')
  assert.equal(findRow(rows, v4ToInt('1.0.0.7'))[2], 13335)
  assert.equal(findRow(rows, v4ToInt('1.0.2.1')), null)
})
await test('ip cloud ranges flatten', () => {
  const c = (t, label) => ({ ...parseCidrBig(t), label })
  const segs = flatten([c('10.0.0.0/8', 0), c('10.1.0.0/16', 1), c('10.1.0.0/16', 2), c('11.0.0.0/8', 0)])
  assert.deepEqual(
    segs.map((s) => [ip.formatIPv4(Number(s.start)), ip.formatIPv4(Number(s.end)), s.labels.join()]),
    [
      ['10.0.0.0', '10.0.255.255', '0'],
      ['10.1.0.0', '10.1.255.255', '0,1,2'],
      ['10.2.0.0', '11.255.255.255', '0'],
    ],
  )
})
const loadFrom = (manifest) => (rel) => Promise.resolve(readFileSync(path.join(ROOT, 'public', manifest.files, rel), 'utf8'))
await test('ip data: real lookups', async () => {
  const m = readJson('src/data/ip-asn.json')
  const index = ip.decodeIndex(m.v4, m.v6)
  for (const [addr, asn] of [
    ['8.8.8.8', 15169],
    ['1.1.1.1', 13335],
    ['2001:4860:4860::8888', 15169],
  ]) {
    const hit = await ip.lookupRange(ip.parseIp(addr), index, `test-${m.files}`, loadFrom(m))
    assert.equal(hit?.value, asn, addr)
  }
  const shard = readJson(`public${m.files}/asn/${15169 % m.asnShards}.json`)
  assert.match(shard['15169'][1], /google/i)
})
await test('ip data: cloud ranges', async () => {
  const m = readJson('src/data/cloud-ips.json')
  const sets = readJson(`public${m.files}/sets.json`)
  const index = ip.decodeIndex(m.v4, m.v6)
  const providerOf = async (addr) => {
    const hit = await ip.lookupRange(ip.parseIp(addr), index, `test-${m.files}`, loadFrom(m))
    return hit ? [...new Set(sets.sets[hit.value].map((id) => m.providers[sets.labels[id][0]].name))] : []
  }
  assert.deepEqual(await providerOf('104.16.132.229'), ['Cloudflare'])
  assert.ok((await providerOf('52.94.76.10')).includes('Amazon Web Services'))
  assert.deepEqual(await providerOf('192.0.2.1'), [])
})

/* ── MAC ─────────────────────────────────────────────────────────────── */
await test('mac parse and registry', () => {
  for (const t of ['00:1A:2B:3C:4D:5E', '00-1a-2b-3c-4d-5e', '001A.2B3C.4D5E', '001a2b3c4d5e', '0:1a:2b:3c:4d:5e']) assert.equal(mac.parseMac(t)?.hex, '001A2B3C4D5E', t)
  assert.equal(mac.parseMac('00:1A:2'), null)
  assert.equal(mac.parseMac('xyz'), null)
  const local = mac.parseMac('02:00:00:00:00:01')
  assert.equal(local.local, true)
  assert.equal(local.multicast, false)
  assert.deepEqual(mac.candidates(mac.parseMac('70B3D5ABCDEF')).prefixes, ['70B3D5ABC', '70B3D5A', '70B3D5'])
  assert.equal(countryOf('1 Infinite Loop Cupertino CA US 95014'), 'US')
  assert.equal(countryOf('Road 156 Caguas  PR 00726'), 'PR')
  assert.deepEqual(parseRegistry('Registry,Assignment,Organization Name,Organization Address\nMA-L,F0D1A9,"Apple, Inc.",1 Infinite Loop Cupertino CA US 95014\n'), [['F0D1A9', 'Apple, Inc.', 'US']])
})
await test('mac data: Apple OUI', () => {
  const m = readJson('src/data/mac-vendors.json')
  assert.match(readJson(`public${m.files}/F0.json`).F0D1A9[0], /apple/i)
})

/* ── ports and domains ───────────────────────────────────────────────── */
await test('ports parse and search', () => {
  const csv = 'Service Name,Port Number,Transport Protocol,Description,Assignee,Contact,Registration Date,Modification Date,Reference,Service Code,Unauthorized Use Reported,Assignment Notes\nhttps,443,tcp,http protocol over TLS/SSL,,,,,[RFC9110],,,\nhttps,443,udp,http protocol over TLS/SSL,,,,,[RFC9110],,,\n,1000-1002,tcp,Unassigned,,,,,,,,\nssh,22,tcp,The Secure Shell (SSH) Protocol,,,,,[RFC4251],,,\nhttps,,tcp,HTTP over SSL/TLS,,,,,,,,\n'
  const entries = parsePorts(csv)
  assert.deepEqual(entries[0], [22, 22, 'ssh', 'tcp', 'The Secure Shell (SSH) Protocol', 'RFC 4251'])
  assert.deepEqual(entries[2], [1000, 1002, '', 'tcp', 'Unassigned', ''])
  assert.equal(entries[1][3], 'tcp udp', 'protocols merged')
  assert.equal(ports.searchPorts(entries, '1001').length, 1)
  assert.equal(ports.searchPorts(entries, 'https')[0][2], 'https')
  assert.equal(ports.searchPorts(entries, 'secure shell')[0][2], 'ssh')
  assert.equal(ports.zoneOf(50000).index, 2)
})
await test('domains root zone and PSL parse', () => {
  const html = '<tr><td><a href="/domains/root/db/xn--p1ai.html">.рф <span>Cyrillic</span> xn--p1ai</a></td><td>Active</td><td>Country-code</td><td class="col-manager">Coordination Center for TLD RU</td><td>Cyrl</td><td>Cyrillic</td></tr>'
  assert.deepEqual(parseRootDb(html).get('xn--p1ai'), { unicode: 'рф', type: 'Country-code', manager: 'Coordination Center for TLD RU' })
  const list = parsePsl('// ===BEGIN ICANN DOMAINS===\nuk\nco.uk\n*.ck\n!www.ck\n公司.cn\n// ===END ICANN DOMAINS===\n// ===BEGIN PRIVATE DOMAINS===\ngithub.io\n// ===END PRIVATE DOMAINS===\n')
  assert.deepEqual(list.icann, ['uk', 'co.uk', '*.ck', '!www.ck', 'xn--55qx5d.cn'])
  const rules = psl.buildRules(list)
  const m = (h, p) => psl.matchSuffix(h, rules, p)
  assert.equal(m('news.bbc.co.uk').domain, 'bbc.co.uk')
  assert.equal(m('news.bbc.co.uk').subdomain, 'news')
  assert.equal(m('a.b.ck').suffix, 'b.ck')
  assert.equal(m('www.ck').domain, 'www.ck', 'exception rule')
  assert.equal(m('me.github.io').domain, 'me.github.io')
  assert.equal(m('me.github.io', false).domain, 'github.io', 'without private rules')
  assert.equal(m('co.uk').domain, null)
  assert.equal(m('example.unknowntld').domain, 'example.unknowntld', 'default rule *')
  const toAscii = (h) => (/^[\x00-\x7f]*$/.test(h) ? h : null)
  assert.equal(psl.hostFrom('https://User@Shop.Example.com:8080/path?q', toAscii), 'shop.example.com')
  assert.equal(psl.hostFrom('me@mail.example.org', toAscii), 'mail.example.org')
  assert.equal(psl.hostFrom('bad host.com', toAscii), null)
  assert.equal(psl.decodePunycode('bcher-kva'), 'bücher')
  assert.equal(psl.toUnicode('xn--p1ai'), 'рф')
  assert.equal(psl.toUnicode('www.xn--fiqs8s'), 'www.中国')
})

/* ── browsers and support dates ──────────────────────────────────────── */
await test('browser detection', () => {
  const cases = [
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', 'chrome', '156.0.0.0', 'Windows'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', 'edge', '156.0.0.0', 'Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:159.0) Gecko/20100101 Firefox/159.0', 'firefox', '159.0', 'macOS'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Safari/605.1.15', 'safari', '27.1', 'macOS'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/156.0.0.0 Mobile/15E148 Safari/604.1', 'safariIos', '156.0.0.0', 'iOS'],
    ['Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/136.0.0.0 Mobile Safari/537.36', 'samsung', '29.0', 'Android'],
    ['Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36', 'chromeAndroid', '156.0.0.0', 'Android'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 OPR/139.0.0.0', 'opera', '139.0.0.0', 'Windows'],
  ]
  for (const [s, key, version, os] of cases) {
    const d = ua.detectBrowser(s)
    assert.deepEqual([d.key, d.version, d.os], [key, version, os], s)
  }
  assert.equal(ua.iosWebkitVersion('Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) CriOS/156.0'), '27.1')
  const today = new Date('2026-11-02T00:00:00Z')
  assert.equal(ua.versionStatus('156.0.1', '156.0.8078.80', '2026-10-20', today).status, 'current')
  assert.equal(ua.versionStatus('155.0', '156.0.8078.80', '2026-10-20', today).status, 'rolling')
  assert.deepEqual(ua.versionStatus('150.0', '156.0', '2026-10-20', today), { status: 'behind', behind: 6 })
  assert.equal(ua.versionStatus('157.0', '156.0', '2026-10-20', today).status, 'newer')
  assert.equal(ua.versionStatus('27.1', '27.2', '2026-10-26', today, true).status, 'behind')
  assert.equal(currentRelease({ browsers: { x: { name: 'X', releases: { 1: { status: 'retired' }, 2: { status: 'current', release_date: '2026-01-01' }, 3: { status: 'beta' } } } } }).major, '2')
})
await test('eol cycles', () => {
  const c = compactProduct({ name: 'x', label: 'X', category: 'lang', labels: {}, releases: [{ name: '3.10', releaseDate: '2021-10-04', isEoas: true, eoasFrom: '2023-04-05', isEol: false, eolFrom: '2026-10-31', latest: { name: '3.10.9' }, isLts: false }] })
  assert.deepEqual(c.cycles[0], ['3.10', '', '2021-10-04', '2023-04-05', '2026-10-31', '3.10.9', '', 0])
  const cycles = [
    ['3.1', '', '', '2020-01-01', '2021-01-01', '', '', 0],
    ['3.10', '', '', '2023-04-05', '2026-10-31', '', '', 0],
    ['22', '', '', false, false, '', '', 1],
  ]
  assert.equal(eol.matchCycle('3.10.4', cycles)[0], '3.10')
  assert.equal(eol.matchCycle('3.1.2', cycles)[0], '3.1')
  assert.equal(eol.matchCycle('v22.1.0', cycles)[0], '22')
  assert.equal(eol.matchCycle('4', cycles), null)
  assert.equal(eol.cycleState(cycles[1], '2026-11-02'), 'eol')
  assert.equal(eol.cycleState(cycles[1], '2025-01-01'), 'security')
  assert.equal(eol.cycleState(cycles[1], '2023-01-01'), 'active')
  assert.equal(eol.cycleState(cycles[2], '2026-11-02'), 'active')
  assert.equal(eol.cycleState(['x', '', '', null, null, '', '', 0], '2026-11-02'), 'unknown')
})

/* ── airports and maps ───────────────────────────────────────────────── */
await test('geo distance, heading and search', () => {
  const km = geo.distanceKm(40.6398, -73.7789, 51.4706, -0.461941)
  assert.ok(Math.abs(km - 5540) < 15, `JFK-LHR ${km}`)
  assert.equal(Math.round(geo.distanceKm(0, 0, 0, 180)), Math.round(Math.PI * geo.EARTH_KM))
  assert.equal(geo.compass(geo.bearing(0, 0, 10, 0)), 'N')
  assert.equal(geo.compass(geo.bearing(0, 0, 0, 10)), 'E')
  const arc = geo.greatCircle(40.64, -73.78, 51.47, -0.46, 10)
  assert.ok(Math.abs(arc[0][0] - 40.64) < 1e-6 && Math.abs(arc[10][1] + 0.46) < 1e-6)
  assert.ok(arc[5][0] > 51.47, 'the route bends north of both ends')
  assert.equal(geo.mapPath([[0, 179], [0, -179]], 84).split('M').length - 1, 2, 'split at the date line')
  const list = [
    ['LHR', 'EGLL', 'London Heathrow Airport', 'London', 'GB', 51.47, -0.46, 'L'],
    ['LCY', 'EGLC', 'London City Airport', 'London', 'GB', 51.5, 0.05, 'M'],
    ['ELS', 'FAEL', 'Ben Schoeman Airport', 'East London', 'ZA', -33.03, 27.83, 'M'],
  ]
  assert.deepEqual(geo.searchAirports(list, 'london').map((a) => a[0]), ['LHR', 'LCY', 'ELS'])
  assert.deepEqual(geo.searchAirports(list, 'egll').map((a) => a[0]), ['LHR'])
  const rows = parseAirports('"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft","continent","iso_country","iso_region","municipality","scheduled_service","icao_code","iata_code","gps_code"\n1,"EGLL","large_airport","London Heathrow Airport",51.4706,-0.461941,83,"EU","GB","GB-ENG","London","yes","EGLL","LHR","EGLL"\n2,"X","closed","Old",1,1,1,"EU","GB","","","no","","OLD",""\n')
  assert.deepEqual(rows, [['LHR', 'EGLL', 'London Heathrow Airport', 'London', 'GB', 51.4706, -0.4619, 'L']])
  const outline = outlinePath({ features: [{ geometry: { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] } }] })
  assert.match(outline, /^M180\.0 84\.0L190\.0 84\.0/)
})

/* ── Unicode ─────────────────────────────────────────────────────────── */
await test('unicode helpers', () => {
  assert.deepEqual(unicode.parseNotation('U+00E9 0x41 &#8364; &#x1F600; \\u{1F44D}'), [0xe9, 0x41, 0x20ac, 0x1f600, 0x1f44d])
  assert.equal(unicode.parseNotation('hello'), null)
  assert.deepEqual(unicode.codePoints('a😀'), [0x61, 0x1f600])
  assert.deepEqual(unicode.utf8Bytes(0x20ac), [0xe2, 0x82, 0xac])
  assert.deepEqual(unicode.utf8Bytes(0x1f600), [0xf0, 0x9f, 0x98, 0x80])
  assert.deepEqual(unicode.utf16Units(0x1f600), [0xd83d, 0xde00])
  assert.equal(unicode.hangulName(0xac00), 'HANGUL SYLLABLE GA')
  assert.equal(unicode.hangulName(0xd7a3), 'HANGUL SYLLABLE HIH')
  assert.equal(unicode.rangeName(0x4e2d, [[0x4e00, 0x9fff, 'CJK Ideograph', 'Lo']]).name, 'CJK UNIFIED IDEOGRAPH-4E2D')
  assert.equal(unicode.blockOf(0x41, [[0, 0x7f, 'Basic Latin'], [0x80, 0xff, 'Latin-1 Supplement']]), 'Basic Latin')
  assert.equal(unicode.invisible('Cf'), true)
  assert.equal(unicode.invisible('Lu'), false)
  const rows = [
    ['😀', 'grinning face', 'Smileys & Emotion', 'face-smiling', 'happy|smile', '1.0'],
    ['🐱', 'cat face', 'Animals & Nature', 'animal-mammal', 'pet|cat', '0.6'],
    ['😺', 'grinning cat', 'Smileys & Emotion', 'cat-face', 'cat|smile', '0.6'],
  ]
  assert.deepEqual(unicode.searchEmoji(rows, 'cat').map((r) => r[0]), ['🐱', '😺'])
  assert.deepEqual(unicode.searchEmoji(rows, 'happy').map((r) => r[0]), ['😀'])
})
await test('unicode data parse', () => {
  const { names, ranges } = parseUnicodeData('0000;<control>;Cc;0;BN;;;;;N;NULL;;;;\n0041;LATIN CAPITAL LETTER A;Lu;0;L;;;;;N;;;;0061;\n4E00;<CJK Ideograph, First>;Lo;0;L;;;;;N;;;;;\n9FFF;<CJK Ideograph, Last>;Lo;0;L;;;;;N;;;;;\n')
  assert.deepEqual(names.get(0), ['NULL (control)', 'Cc'])
  assert.deepEqual(ranges, [[0x4e00, 0x9fff, 'CJK Ideograph', 'Lo']])
  assert.deepEqual(parseBlocks('0000..007F; Basic Latin\n# x\n'), [[0, 127, 'Basic Latin']])
  const emoji = parseEmojiTest('# group: Smileys & Emotion\n# subgroup: face-smiling\n1F600 ; fully-qualified # 😀 E1.0 grinning face\n1F44B 1F3FB ; fully-qualified # 👋🏻 E1.0 waving hand: light skin tone\n263A ; unqualified # ☺ E0.6 smiling face\n')
  assert.deepEqual(emoji, [{ emoji: '😀', name: 'grinning face', group: 'Smileys & Emotion', subgroup: 'face-smiling', version: '1.0' }])
})

/* ── health and names ────────────────────────────────────────────────── */
await test('lms percentiles', () => {
  for (const z of [-2, -0.5, 0, 1.3]) assert.ok(Math.abs(lms.zScore(lms.valueAtZ(z, -0.2, 12, 0.1), -0.2, 12, 0.1) - z) < 1e-9)
  assert.ok(Math.abs(lms.zScore(lms.valueAtZ(1, 0, 12, 0.1), 0, 12, 0.1) - 1) < 1e-9, 'L = 0')
  assert.ok(Math.abs(lms.normalCdf(1.96) - 0.9750021048517795) < 1e-12)
  assert.ok(Math.abs(lms.normalCdf(-1) - 0.15865525393145707) < 1e-12)
  assert.equal(lms.ordinal(3), '3rd')
  assert.equal(lms.ordinal(21.6), '22nd')
  assert.equal(lms.ordinal(11), '11th')
  const rows = parseLms('Sex,Agemos,L,M,S\n1,24,-0.2,12.67,0.108\n1,24.5,-0.21,12.74,0.108\n2,24,-0.7,12.13,0.107\n')
  assert.equal(rows.male.length, 2)
  assert.deepEqual(lms.lmsAt(rows.male, 24.25).map((v) => Number(v.toFixed(4))), [-0.205, 12.705, 0.108])
  assert.ok(Math.abs(lms.percentileOf(rows.male, 24, 12.67).percentile - 50) < 1e-9)
})
await test('growth data: CDC medians are the 50th percentile', () => {
  const m = readJson('src/data/growth-cdc.json')
  const g = readJson(`public${m.files}/growth.json`)
  const row = g.statage.female.find((r) => r[0] === 120.5)
  assert.ok(Math.abs(lms.percentileOf(g.statage.female, 120.5, row[2]).percentile - 50) < 1e-9)
  assert.ok(row[2] > 135 && row[2] < 142)
})
await test('life table and baby names parse', () => {
  const html = 'Here we present the 2023 period life table <table><tr><td>0</td><td>0.006015</td><td>100,000</td><td>75.79</td><td>0.005125</td><td>100,000</td><td>81.06</td></tr><tr><td>1</td><td>0.000479</td><td>99,399</td><td>75.25</td><td>0.000392</td><td>99,487</td><td>80.48</td></tr></table>'
  const t = parseLifeTable(html)
  assert.equal(t.year, 2023)
  assert.deepEqual(t.female.l, [100000, 99487])
  assert.deepEqual(t.male.e, [75.79, 75.25])
  const y = parseYear('Emma,F,100\nOlivia,F,120\nLiam,M,90\nAva,F,100\n')
  assert.deepEqual(y.F.map((r) => r[0]), ['Olivia', 'Ava', 'Emma'])
})

/* ── data files in the repository ────────────────────────────────────── */
await test('data files: meta, folders, sizes', () => {
  const dir = path.join(ROOT, 'src/data')
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const j = readJson(`src/data/${f}`)
    for (const k of ['source', 'licence', 'fetchedAt', 'validFor']) assert.ok(j.meta?.[k] !== undefined, `${f}: meta.${k}`)
    assert.ok(j.meta.source.name && j.meta.licence.name, `${f}: source and licence names`)
    if (j.files) {
      const folder = path.join(ROOT, 'public', j.files)
      assert.ok(existsSync(folder), `${f}: ${j.files} is missing`)
      const walk = (d) => readdirSync(d).flatMap((n) => (statSync(path.join(d, n)).isDirectory() ? walk(path.join(d, n)) : [path.join(d, n)]))
      for (const file of walk(folder)) assert.ok(statSync(file).size < 4 * 1024 * 1024, `${file} is over 4 MB`)
      const siblings = readdirSync(path.dirname(folder))
      assert.deepEqual(siblings, [path.basename(folder)], `${f}: stale folders next to ${j.files}`)
    }
  }
})

for (const [name, e] of failures) console.error(`FAIL ${name}\n  ${e?.message ?? e}\n  ${e?.stack?.split('\n').find((l) => l.includes('test.mjs')) ?? ''}`)
console.log(`data tests: ${passed} passed, ${failures.length} failed`)
process.exit(failures.length ? 1 : 0)
