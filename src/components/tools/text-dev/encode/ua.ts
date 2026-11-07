/** User agent strings: browser and OS from the reference parser, plus OS version, engine, device type, CPU and bots. */
import { detectBrowser } from '@/components/tools/reference/ua'

export interface UaInfo {
  browser: string
  version: string
  engine: string
  os: string
  osVersion: string
  device: 'Desktop' | 'Phone' | 'Tablet' | 'TV' | 'Console' | 'Bot' | 'Unknown'
  cpu: string
  bot: string | null
}

const BOT = /(bot|crawl|spider|slurp|fetch|scan|preview|monitor|curl|wget|python-requests|httpclient|okhttp|headless|lighthouse)/i

function osVersion(ua: string, os: string): string {
  const pick = (re: RegExp) => re.exec(ua)?.[1]?.replace(/_/g, '.') ?? ''
  if (os === 'Windows') {
    const nt = pick(/Windows NT ([\d.]+)/)
    const names: Record<string, string> = { '10.0': '10 or 11', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista', '5.1': 'XP' }
    return names[nt] ?? nt
  }
  if (os === 'macOS') return pick(/Mac OS X ([\d_.]+)/)
  if (os === 'iOS') return pick(/OS ([\d_]+) like Mac OS X/)
  if (os === 'Android') return pick(/Android ([\d.]+)/)
  if (os === 'ChromeOS') return pick(/CrOS \S+ ([\d.]+)/)
  return ''
}

function engineOf(ua: string, browser: string, os: string): string {
  if (os === 'iOS') return 'WebKit'
  if (/Gecko\/\d/.test(ua) && /Firefox|FxiOS/.test(ua)) return 'Gecko'
  if (/Chrome|Chromium|CriOS|Edg|OPR|SamsungBrowser/.test(ua)) return 'Blink'
  if (/AppleWebKit/.test(ua)) return 'WebKit'
  if (/Trident/.test(ua)) return 'Trident'
  return browser === 'Unknown browser' ? 'Unknown' : ''
}

function deviceOf(ua: string, os: string): UaInfo['device'] {
  if (BOT.test(ua)) return 'Bot'
  if (/SmartTV|SMART-TV|HbbTV|AppleTV|GoogleTV|CrKey|Roku|BRAVIA|Web0S|Tizen.*TV/i.test(ua)) return 'TV'
  if (/PlayStation|Xbox|Nintendo/i.test(ua)) return 'Console'
  if (/iPad|Tablet/i.test(ua) || (os === 'Android' && !/Mobile/i.test(ua))) return 'Tablet'
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return 'Phone'
  if (/Windows|Macintosh|X11|CrOS|Linux/.test(ua)) return 'Desktop'
  return 'Unknown'
}

function cpuOf(ua: string): string {
  if (/arm64|aarch64/i.test(ua)) return 'ARM 64-bit'
  if (/\barm/i.test(ua)) return 'ARM'
  if (/Win64|x64|x86_64|amd64|WOW64/i.test(ua)) return 'x86 64-bit'
  if (/i[3-6]86|x86/i.test(ua)) return 'x86 32-bit'
  return ''
}

export function parseUa(ua: string): UaInfo {
  const s = ua.trim()
  const d = detectBrowser(s)
  const bot = BOT.test(s) ? (/([A-Za-z][\w.-]*(?:bot|crawler|spider|Slurp|fetcher))/i.exec(s)?.[1] ?? /^([\w.-]+)\//.exec(s)?.[1] ?? 'Bot') : null
  return {
    browser: d.name,
    version: d.version,
    engine: engineOf(s, d.name, d.os),
    os: d.os,
    osVersion: osVersion(s, d.os),
    device: deviceOf(s, d.os),
    cpu: cpuOf(s),
    bot,
  }
}
