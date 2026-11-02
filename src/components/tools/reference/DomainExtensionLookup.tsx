import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ToolPanel } from '@/components/shared/ToolPanel'
import tldData from '@/data/tlds.json'
import type { DataMeta } from './data'
import { loadJson } from './data'
import { Facts, Loading, Segmented, useLoaded } from './controls'
import { buildRules, hostFrom, matchSuffix, toUnicode } from './psl'
import { SourceNote } from './SourceNote'

interface TldManifest {
  meta: DataMeta
  counts: { tlds: number; icann: number; private: number }
  files: string
}
/** [ascii, unicode, type, manager] */
type Tld = [string, string, string, string]
const D = tldData as unknown as TldManifest
const regions = new Intl.DisplayNames(['en'], { type: 'region' })

type Kind = 'all' | 'generic' | 'country' | 'sponsored' | 'other'
const KINDS: { id: Kind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'generic', label: 'Generic' },
  { id: 'country', label: 'Country' },
  { id: 'sponsored', label: 'Sponsored' },
  { id: 'other', label: 'Other' },
]
const kindOf = (type: string): Kind => (/^generic/i.test(type) ? 'generic' : /country/i.test(type) ? 'country' : /sponsored/i.test(type) ? 'sponsored' : 'other')
const toAscii = (h: string) => {
  try {
    return new URL(`http://${h}`).hostname
  } catch {
    return null
  }
}
function countryName(tld: Tld): string {
  if (!/^[a-z]{2}$/.test(tld[0])) return ''
  try {
    const name = regions.of(tld[0].toUpperCase())
    return name && name.toLowerCase() !== tld[0] ? name : ''
  } catch {
    return ''
  }
}

/** Every TLD as one pixel; the ones that match the filter fill with ink. */
function TldField({ tlds, match }: { tlds: Tld[]; match: Set<string> }) {
  return (
    <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(7px, 1fr))' }} aria-hidden="true">
      {tlds.map((t) => (
        <span key={t[0]} className="relative aspect-square rounded-[1px] bg-background">
          <span
            className="absolute inset-0 rounded-[1px] bg-foreground transition-transform duration-300 ease-[var(--ease-out)] motion-reduce:transition-none"
            style={{ transform: match.has(t[0]) ? 'scale(1)' : 'scale(0)' }}
          />
        </span>
      ))}
    </div>
  )
}

export default function DomainExtensionLookup() {
  const [host, setHost] = useState('news.bbc.co.uk')
  const [withPrivate, setWithPrivate] = useState(true)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Kind>('all')
  const data = useLoaded('tlds', async () => {
    const [tlds, psl] = await Promise.all([loadJson<Tld[]>(`${D.files}/tlds.json`), loadJson<{ icann: string[]; private: string[] }>(`${D.files}/psl.json`)])
    const order: Kind[] = ['generic', 'country', 'sponsored', 'other']
    const sorted = [...tlds].sort((a, b) => order.indexOf(kindOf(a[2])) - order.indexOf(kindOf(b[2])) || (a[0] < b[0] ? -1 : 1))
    return { tlds: sorted, byName: new Map(tlds.map((t) => [t[0], t])), rules: buildRules(psl) }
  })

  const ascii = useMemo(() => hostFrom(host, toAscii), [host])
  const match = useMemo(() => (data.state === 'ready' && ascii ? matchSuffix(ascii, data.data.rules, withPrivate) : null), [data, ascii, withPrivate])
  const tld = data.state === 'ready' && ascii ? data.data.byName.get(ascii.split('.').pop() ?? '') : undefined

  const filtered = useMemo(() => {
    if (data.state !== 'ready') return []
    const q = query.trim().toLowerCase().replace(/^\./, '')
    return data.data.tlds.filter((t) => (kind === 'all' || kindOf(t[2]) === kind) && (!q || t[0].includes(q) || t[1].includes(q) || t[3].toLowerCase().includes(q) || countryName(t).toLowerCase().includes(q)))
  }, [data, query, kind])
  const matchSet = useMemo(() => new Set(filtered.map((t) => t[0])), [filtered])

  const labels = ascii ? ascii.split('.') : []
  const suffixLen = match ? match.suffix.split('.').length : 0
  const rows: [string, string][] = match && ascii
    ? [
        ['Hostname', toUnicode(ascii) === ascii ? ascii : `${toUnicode(ascii)} (${ascii})`],
        ['Registrable domain', match.domain ? toUnicode(match.domain) : 'None: the hostname is a public suffix'],
        ['Public suffix', `${toUnicode(match.suffix)} (${match.section === 'private' ? 'private part of the list' : match.section === 'icann' ? 'ICANN part of the list' : 'no rule, the TLD itself'})`],
        ['Subdomain', match.subdomain ? toUnicode(match.subdomain) : 'None'],
        ...(tld ? ([['Top-level domain', `.${tld[1]}${tld[1] !== tld[0] ? ` (${tld[0]})` : ''}`], ['TLD type', tld[2]], ['TLD manager', tld[3]]] as [string, string][]) : []),
        ...(tld && countryName(tld) ? ([['Country or territory', countryName(tld)]] as [string, string][]) : []),
      ]
    : []

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="space-y-1.5">
          <Label htmlFor="dom-host">Hostname, URL or email address</Label>
          <Input id="dom-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="shop.example.co.uk" className="text-base" autoComplete="off" autoCapitalize="off" spellCheck={false} />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="dom-private" checked={withPrivate} onCheckedChange={setWithPrivate} />
          <Label htmlFor="dom-private" className="text-sm">
            Use private suffixes (hosting services)
          </Label>
        </div>
        {host.trim() && !ascii ? <ErrorNote message="This is not a valid hostname. Use letters, digits and hyphens, with dots between the labels." /> : null}
        {data.state === 'loading' ? <Loading label="Loading the root zone and the Public Suffix List" /> : null}
        {data.state === 'error' ? <ErrorNote message={data.message} /> : null}
        {match && ascii ? (
          <div role="status" aria-live="polite" className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-x-0.5 gap-y-1 font-mono text-[1.375rem] leading-tight font-[600] break-all sm:text-[1.75rem]">
              {labels.map((l, i) => {
                const part = i >= labels.length - suffixLen ? 'suffix' : i === labels.length - suffixLen - 1 ? 'domain' : 'sub'
                return (
                  <span key={`${i}-${l}`} className="reveal">
                    <span className={part === 'domain' ? 'rounded bg-foreground px-1 text-background' : part === 'suffix' ? 'rounded bg-background px-1' : 'text-muted-foreground'}>{toUnicode(l)}</span>
                    {i < labels.length - 1 ? <span className="text-muted-foreground">.</span> : null}
                  </span>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">Grey: subdomain. Black: the label that is registered. Light: the public suffix.</p>
            <Facts rows={rows} />
            <CopyButton value={rows.map(([k, v]) => `${k}: ${v}`).join('\n')} label="Copy details" />
          </div>
        ) : null}
      </ToolPanel>

      {data.state === 'ready' ? (
        <ToolPanel title={`${D.counts.tlds.toLocaleString('en-US')} top-level domains`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="dom-q">Search by extension, country or manager</Label>
              <Input id="dom-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder=".io, Germany, Google" autoComplete="off" />
            </div>
            <Segmented value={kind} onChange={setKind} options={KINDS} label="TLD type" />
          </div>
          <TldField tlds={data.data.tlds} match={matchSet} />
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {filtered.length.toLocaleString('en-US')} match{filtered.length === 1 ? '' : 'es'}
          </p>
          <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1 text-sm">
            {filtered.slice(0, 300).map((t) => (
              <li key={t[0]} className="grid grid-cols-[minmax(5rem,auto)_minmax(0,1fr)] gap-x-3">
                <span className="font-[680]">.{t[1]}</span>
                <span className="min-w-0 text-muted-foreground">
                  {t[2]}
                  {countryName(t) ? ` · ${countryName(t)}` : ''} · {t[3]}
                </span>
              </li>
            ))}
          </ul>
          {filtered.length > 300 ? <p className="text-xs text-muted-foreground">Showing the first 300. Search to narrow the list.</p> : null}
        </ToolPanel>
      ) : null}

      <SourceNote meta={D.meta}>
        {D.counts.icann.toLocaleString('en-US')} ICANN and {D.counts.private.toLocaleString('en-US')} private suffix rules.
      </SourceNote>
    </div>
  )
}
