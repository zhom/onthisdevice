import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { CopyButton } from '@/components/shared/CopyButton'
import { ToolPanel } from '@/components/shared/ToolPanel'
import browserData from '@/data/browser-versions.json'
import type { DataMeta } from './data'
import { formatDay } from './data'
import { Facts } from './controls'
import type { BrowserKey, Detected } from './ua'
import { detectBrowser, iosWebkitVersion, versionStatus } from './ua'
import { SourceNote } from './SourceNote'

interface Latest {
  name: string
  major: string
  version: string
  released: string
}
interface BrowserManifest {
  meta: DataMeta
  browsers: Record<BrowserKey | 'firefoxEsr', Latest>
}
const D = browserData as unknown as BrowserManifest

interface UaData {
  brands?: { brand: string; version: string }[]
  mobile?: boolean
  platform?: string
  getHighEntropyValues?: (hints: string[]) => Promise<{ fullVersionList?: { brand: string; version: string }[]; platformVersion?: string }>
}

const UPDATE_HELP: Partial<Record<BrowserKey, string>> = {
  chrome: 'Open Chrome menu > Help > About Google Chrome; Chrome downloads the update and asks you to relaunch.',
  chromeAndroid: 'Open the Play Store, search for Chrome and tap Update.',
  edge: 'Open edge://settings/help; Edge downloads the update and asks you to restart.',
  firefox: 'Open the menu > Help > About Firefox; Firefox downloads the update and asks you to restart.',
  firefoxAndroid: 'Open the Play Store, search for Firefox and tap Update.',
  safari: 'Open System Settings > General > Software Update. Safari updates with macOS.',
  safariIos: 'Open Settings > General > Software Update. Browsers on iOS and iPadOS update their engine with the system.',
  opera: 'Open the menu > Update & Recovery and click Check for update.',
  samsung: 'Open the Galaxy Store or the Play Store and update Samsung Internet.',
}

/** The latest twelve major versions as pixels; versions up to yours fill with ink. */
function VersionLadder({ mine, latest }: { mine: number; latest: number }) {
  const from = latest - 11
  return (
    <div className="space-y-1.5" aria-hidden="true">
      <div className="grid max-w-[24rem] grid-cols-12 gap-1">
        {Array.from({ length: 12 }, (_, i) => {
          const v = from + i
          return (
            <span key={v} className="relative aspect-square rounded-[2px] bg-background">
              <span
                className="absolute inset-0 rounded-[2px] motion-safe:animate-in motion-safe:zoom-in-0 motion-safe:duration-300"
                style={{ background: v <= mine ? 'var(--foreground)' : 'var(--chart-4)', animationDelay: `${i * 40}ms`, animationFillMode: 'both' } as CSSProperties}
              />
            </span>
          )
        })}
      </div>
      <div className="flex max-w-[24rem] justify-between text-xs text-muted-foreground tabular-nums">
        <span>{from}</span>
        <span>{latest} (latest)</span>
      </div>
    </div>
  )
}

export default function BrowserVersionChecker() {
  const [found, setFound] = useState<(Detected & { ua: string; full: string; hints: string; platform: string }) | null>(null)

  useEffect(() => {
    const ua = navigator.userAgent
    const d = detectBrowser(ua)
    const uaData = (navigator as Navigator & { userAgentData?: UaData }).userAgentData
    const base = { ...d, ua, full: d.version, hints: '', platform: uaData?.platform ?? d.os }
    if (d.ios) base.version = iosWebkitVersion(ua) ?? d.version
    setFound(base)
    uaData?.getHighEntropyValues?.(['fullVersionList', 'platformVersion']).then(
      (h) => {
        const list = h.fullVersionList ?? []
        const brand = list.find((b) => (d.name === 'Chrome' ? b.brand === 'Google Chrome' : b.brand.includes(d.name)))
        setFound({ ...base, full: brand?.version ?? base.full, hints: list.map((b) => `${b.brand} ${b.version}`).join(', ') })
      },
      () => {},
    )
  }, [])

  if (!found) {
    return (
      <ToolPanel>
        <p className="text-sm text-muted-foreground">Reading your browser version. This needs JavaScript.</p>
      </ToolPanel>
    )
  }

  const latest = found.key ? D.browsers[found.key] : null
  const safari = found.key === 'safari' || found.key === 'safariIos'
  const esr = found.key === 'firefox' && found.version.split('.')[0] === D.browsers.firefoxEsr.major
  const verdict = latest ? versionStatus(found.full || found.version, latest.version || latest.major, latest.released, new Date(), safari) : { status: 'unknown' as const, behind: 0 }
  const status = esr ? 'current' : verdict.status
  const shownName = found.ios && found.name !== 'Safari' ? `${found.name} on iOS (Safari engine)` : found.name
  const headline =
    status === 'current'
      ? esr
        ? 'is the supported Firefox ESR version'
        : 'is up to date'
      : status === 'rolling'
        ? 'is one version behind; the update is rolling out'
        : status === 'behind'
          ? safari
            ? 'is out of date'
            : `is ${verdict.behind} version${verdict.behind === 1 ? '' : 's'} behind`
          : status === 'newer'
            ? 'is newer than the latest stable release (beta or developer build)'
            : 'could not be compared'
  const Icon = status === 'current' || status === 'newer' ? CircleCheck : status === 'unknown' ? Info : TriangleAlert
  const rows: [string, string][] = [
    ['Browser', shownName],
    ['Version', found.full || found.version || 'Unknown'],
    ['Operating system', found.platform || found.os],
    ...(latest ? ([['Latest stable', `${latest.version || latest.major}${latest.released ? ` (${formatDay(latest.released)})` : ''}`]] as [string, string][]) : []),
    ['User agent', found.ua],
    ...(found.hints ? ([['Client Hints', found.hints]] as [string, string][]) : []),
  ]
  const majorMine = Number.parseInt(found.version, 10)
  const majorLatest = latest ? Number.parseInt(latest.major, 10) : NaN

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div role="status" aria-live="polite" className="space-y-1">
          <p className="text-sm text-muted-foreground">Your browser</p>
          <p className="reveal text-[2rem] leading-tight font-[740] break-words sm:text-[2.5rem]">
            {shownName} {found.version.split('.').slice(0, safari ? 2 : 1).join('.')}
          </p>
          <p className="flex items-start gap-2 text-base font-[600]">
            <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <span>
              {headline}
              {latest && status !== 'current' && status !== 'unknown' ? `. Latest stable: ${latest.version || latest.major}.` : '.'}
            </span>
          </p>
        </div>
        {!safari && Number.isFinite(majorMine) && Number.isFinite(majorLatest) && majorLatest - majorMine < 12 ? <VersionLadder mine={majorMine} latest={majorLatest} /> : null}
        {status === 'behind' || status === 'rolling' ? <p className="text-sm text-muted-foreground">{UPDATE_HELP[found.key as BrowserKey]}</p> : null}
        {safari && status === 'behind' ? <p className="text-sm text-muted-foreground">An older Mac or iPhone can be on the last Safari its system supports; it still gets security fixes for a time.</p> : null}
        <Facts rows={rows} />
        <CopyButton value={rows.map(([k, v]) => `${k}: ${v}`).join('\n')} label="Copy details" />
      </ToolPanel>

      <ToolPanel title="Latest stable versions">
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {(Object.entries(D.browsers) as [BrowserKey | 'firefoxEsr', Latest][]).map(([k, b]) => {
            const on = k === found.key
            return (
              <li key={k} className="relative flex items-baseline justify-between gap-3 overflow-hidden rounded-md px-2 py-1">
                <span aria-hidden="true" className="absolute inset-0 origin-left bg-foreground transition-transform duration-500 ease-[var(--ease-out)] motion-reduce:transition-none" style={{ transform: on ? 'scaleX(1)' : 'scaleX(0)' }} />
                <span className={`relative ${on ? 'font-[600] text-background' : ''}`}>
                  {b.name}
                  {on ? <span className="sr-only"> (your browser)</span> : null}
                </span>
                <span className={`relative shrink-0 tabular-nums ${on ? 'text-background' : 'text-muted-foreground'}`}>
                  {b.version || b.major}
                  {b.released ? ` · ${formatDay(b.released)}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      </ToolPanel>

      <SourceNote meta={D.meta} />
    </div>
  )
}
