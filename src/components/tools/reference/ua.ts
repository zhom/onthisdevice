/** Browser detection from the user agent string and Client Hints (pure, unit-tested). */

export type BrowserKey = 'chrome' | 'chromeAndroid' | 'edge' | 'firefox' | 'firefoxAndroid' | 'safari' | 'safariIos' | 'opera' | 'samsung'

export interface Detected {
  key: BrowserKey | null
  name: string
  version: string
  os: string
  /** iOS: every browser uses the system WebKit, so Safari's version is what matters. */
  ios: boolean
}

export function detectOs(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
  if (/Android/.test(ua)) return 'Android'
  if (/CrOS/.test(ua)) return 'ChromeOS'
  if (/Windows NT/.test(ua)) return 'Windows'
  if (/Macintosh|Mac OS X/.test(ua)) return 'macOS'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown'
}

/** Parses a user agent string. The order matters: Edge, Opera and Samsung also say Chrome and Safari. */
export function detectBrowser(ua: string): Detected {
  const os = detectOs(ua)
  const ios = os === 'iOS'
  const android = os === 'Android'
  const pick = (re: RegExp) => re.exec(ua)?.[1] ?? null
  let v: string | null
  if ((v = pick(/Edg(?:e|A|iOS)?\/(\d[\d.]*)/))) return { key: ios ? 'safariIos' : 'edge', name: 'Edge', version: v, os, ios }
  if ((v = pick(/(?:OPR|OPT)\/(\d[\d.]*)/))) return { key: ios ? 'safariIos' : 'opera', name: 'Opera', version: v, os, ios }
  if ((v = pick(/SamsungBrowser\/(\d[\d.]*)/))) return { key: 'samsung', name: 'Samsung Internet', version: v, os, ios }
  if ((v = pick(/(?:Firefox|FxiOS)\/(\d[\d.]*)/))) return { key: ios ? 'safariIos' : android ? 'firefoxAndroid' : 'firefox', name: 'Firefox', version: v, os, ios }
  if ((v = pick(/(?:Chrome|CriOS)\/(\d[\d.]*)/))) return { key: ios ? 'safariIos' : android ? 'chromeAndroid' : 'chrome', name: 'Chrome', version: v, os, ios }
  if ((v = pick(/Version\/(\d[\d.]*).*Safari/))) return { key: ios ? 'safariIos' : 'safari', name: 'Safari', version: v, os, ios }
  return { key: null, name: 'Unknown browser', version: '', os, ios }
}

/** The Safari (WebKit) version on iOS, which all iOS browsers share: from "Version/x" or "OS 18_4". */
export function iosWebkitVersion(ua: string): string | null {
  const v = /Version\/(\d+(?:\.\d+)?)/.exec(ua)?.[1]
  if (v) return v
  const os = /OS (\d+)_(\d+)/.exec(ua)
  return os ? `${os[1]}.${os[2]}` : null
}

export function compareVersions(a: string, b: string): number {
  const x = a.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const y = b.split('.').map((n) => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0)
  return 0
}

export type Status = 'current' | 'rolling' | 'behind' | 'newer' | 'unknown'

/**
 * Compares a version with the latest stable one. Majors only for Chromium-based browsers and
 * Firefox (their user agents hide the minor version); major.minor for Safari.
 */
export function versionStatus(version: string, latest: string, latestReleased: string, today: Date, safari = false): { status: Status; behind: number } {
  if (!version || !latest) return { status: 'unknown', behind: 0 }
  const mine = safari ? version.split('.').slice(0, 2).join('.') : version.split('.')[0]
  const top = safari ? latest.split('.').slice(0, 2).join('.') : latest.split('.')[0]
  const c = compareVersions(mine, top)
  if (c > 0) return { status: 'newer', behind: 0 }
  if (c === 0) return { status: 'current', behind: 0 }
  const behind = safari ? Math.max(1, Math.round((parseFloat(top) - parseFloat(mine)) * 10) / 10) : Number(top) - Number(mine)
  const days = latestReleased ? (today.getTime() - Date.parse(`${latestReleased}T00:00:00Z`)) / 86_400_000 : Infinity
  // A new major reaches everyone over about two weeks.
  if (!safari && behind === 1 && days < 21) return { status: 'rolling', behind }
  return { status: 'behind', behind }
}
