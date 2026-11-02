/**
 * Latest stable versions of the main browsers. Tier: weekly.
 *
 * Full version numbers come from each vendor's public release feed where one exists (Chrome,
 * Firefox, Edge); the current major release of every browser comes from MDN browser-compat-data
 * (CC0), which also covers Safari, Opera and Samsung Internet.
 *
 *   src/data/browser-versions.json   { browsers: { chrome: { name, major, version, released } ... } }
 */
import { check, checkRange, commit, get, meta, readJson, run } from './lib.mjs'

const BCD = (id) => `https://raw.githubusercontent.com/mdn/browser-compat-data/main/browsers/${id}.json`

/** BCD browser file -> { name, major, released } of the release with status "current". */
export function currentRelease(json) {
  const b = Object.values(json.browsers)[0]
  const current = Object.entries(b.releases).filter(([, r]) => r.status === 'current')
  check(current.length >= 1, `browsers: no current release for ${b.name}`)
  const [major, r] = current.sort((x, y) => parseFloat(y[0]) - parseFloat(x[0]))[0]
  return { name: b.name, major, released: r.release_date ?? '' }
}

const cmp = (a, b) => {
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0)
  return 0
}

async function main() {
  const ids = ['chrome', 'chrome_android', 'edge', 'firefox', 'firefox_android', 'safari', 'safari_ios', 'opera', 'samsunginternet_android']
  const bcd = {}
  for (const id of ids) bcd[id] = currentRelease(await get(BCD(id), { as: 'json' }))

  // The stable feed lists the early-stable rollout of the next major a week before its release;
  // the latest version of the major that MDN calls current is what most users get.
  const chromeFeed = await get('https://versionhistory.googleapis.com/v1/chrome/platforms/win/channels/stable/versions?pageSize=40', { as: 'json' })
  const chromeAll = chromeFeed.versions.map((v) => v.version).sort(cmp)
  const chromeVersion = chromeAll.filter((v) => v.split('.')[0] === bcd.chrome.major).pop() ?? chromeAll.pop()
  const ff = await get('https://product-details.mozilla.org/1.0/firefox_versions.json', { as: 'json' })
  const edgeFeed = await get('https://edgeupdates.microsoft.com/api/products', { as: 'json' })
  const edgeStable = edgeFeed.find((p) => p.Product === 'Stable')
  const edgeWin = edgeStable.Releases.filter((r) => r.Platform === 'Windows').sort((a, b) => cmp(a.ProductVersion, b.ProductVersion)).pop()

  const browsers = {
    chrome: { name: 'Chrome', major: chromeVersion.split('.')[0], version: chromeVersion, released: bcd.chrome.released },
    chromeAndroid: { name: 'Chrome for Android', major: bcd.chrome_android.major, version: '', released: bcd.chrome_android.released },
    edge: { name: 'Edge', major: edgeWin.ProductVersion.split('.')[0], version: edgeWin.ProductVersion, released: edgeWin.PublishedTime.slice(0, 10) },
    firefox: { name: 'Firefox', major: ff.LATEST_FIREFOX_VERSION.split('.')[0], version: ff.LATEST_FIREFOX_VERSION, released: ff.LAST_RELEASE_DATE },
    firefoxEsr: { name: 'Firefox ESR', major: ff.FIREFOX_ESR.split('.')[0], version: ff.FIREFOX_ESR.replace(/esr$/, ''), released: '' },
    firefoxAndroid: { name: 'Firefox for Android', major: bcd.firefox_android.major, version: '', released: bcd.firefox_android.released },
    safari: { name: 'Safari', major: bcd.safari.major, version: bcd.safari.major, released: bcd.safari.released },
    safariIos: { name: 'Safari on iOS', major: bcd.safari_ios.major, version: bcd.safari_ios.major, released: bcd.safari_ios.released },
    opera: { name: 'Opera', major: bcd.opera.major, version: '', released: bcd.opera.released },
    samsung: { name: 'Samsung Internet', major: bcd.samsunginternet_android.major, version: '', released: bcd.samsunginternet_android.released },
  }
  checkRange(Number(browsers.chrome.major), 120, 400, 'browsers chrome')
  checkRange(Number(browsers.edge.major), 120, 400, 'browsers edge')
  checkRange(Number(browsers.firefox.major), 120, 400, 'browsers firefox')
  checkRange(parseFloat(browsers.safari.major), 17, 60, 'browsers safari')
  checkRange(parseFloat(browsers.opera.major), 100, 400, 'browsers opera')
  checkRange(parseFloat(browsers.samsung.major), 20, 100, 'browsers samsung')
  check(Math.abs(Number(browsers.chrome.major) - Number(bcd.chrome.major)) <= 2, `browsers: Chrome feed ${browsers.chrome.major} vs MDN ${bcd.chrome.major}`)
  const prev = readJson('src/data/browser-versions.json')
  for (const [k, b] of Object.entries(browsers)) {
    const before = prev?.browsers?.[k]?.major
    if (before) check(parseFloat(b.major) >= parseFloat(before), `browsers: ${k} went back from ${before} to ${b.major}`)
  }

  commit('browser-versions', {
    meta: meta({
      source: { name: 'Vendor release feeds and MDN browser-compat-data', url: 'https://github.com/mdn/browser-compat-data' },
      sources: [
        { name: 'Chrome version history API', url: 'https://versionhistory.googleapis.com/v1/chrome/platforms/win/channels/stable/versions' },
        { name: 'Mozilla product details', url: 'https://product-details.mozilla.org/1.0/firefox_versions.json' },
        { name: 'Microsoft Edge update feed', url: 'https://edgeupdates.microsoft.com/api/products' },
        { name: 'MDN browser-compat-data (CC0)', url: 'https://github.com/mdn/browser-compat-data' },
      ],
      licence: { name: 'CC0 1.0 (browser-compat-data); version numbers from vendor feeds', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
      validFor: Object.values(browsers).map((b) => b.released).filter(Boolean).sort().pop(),
    }),
    browsers,
  })
}

if (import.meta.url === `file://${process.argv[1]}`) run('browser-versions', main)
