import { useMemo, useState } from 'react'
import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ToolPanel } from '@/components/shared/ToolPanel'
import eolData from '@/data/eol.json'
import type { DataMeta } from './data'
import { formatDay, loadJson } from './data'
import { Loading, useLoaded } from './controls'
import type { Cycle, CycleState, Until } from './eol'
import { cycleState, daysBetween, matchCycle } from './eol'
import { SourceNote } from './SourceNote'

interface EolManifest {
  meta: DataMeta
  products: [string, string, string][]
  files: string
}
interface Product {
  label: string
  category: string
  labels: { active: string; security: string }
  link: string
  cycles: Cycle[]
}
const D = eolData as unknown as EolManifest
const CATEGORY: Record<string, string> = { lang: 'Language', framework: 'Framework', database: 'Database', os: 'Operating system', 'server-app': 'Server software', app: 'Application', device: 'Device', standard: 'Standard', service: 'Service' }
const SHOWN = 12

const untilText = (u: Until) => (typeof u === 'string' ? formatDay(u) : u === true ? 'Ended' : u === false ? 'No date set' : 'Not tracked')

const STATE_TEXT: Record<CycleState, string> = {
  active: 'Supported',
  security: 'Security fixes only',
  eol: 'End of life',
  unknown: 'No support dates',
}

/** Release cycles on a time axis: ink while fully supported, grey while security-only, faint after. */
function Timeline({ cycles, today, pick }: { cycles: Cycle[]; today: string; pick: Cycle | null }) {
  const dates = cycles.flatMap((c) => [c[2], c[3], c[4]].filter((d): d is string => typeof d === 'string' && d.length === 10))
  const start = dates.reduce((a, d) => (d < a ? d : a), today)
  const endRaw = dates.reduce((a, d) => (d > a ? d : a), today)
  const end = daysBetween(today, endRaw) < 365 ? new Date(Date.parse(`${today}T00:00:00Z`) + 365 * 86_400_000).toISOString().slice(0, 10) : endRaw
  const span = Math.max(1, daysBetween(start, end))
  const at = (d: string) => Math.max(0, Math.min(1, daysBetween(start, d) / span))
  const todayX = at(today)
  const y0 = Number(start.slice(0, 4))
  const y1 = Number(end.slice(0, 4))
  const step = Math.max(1, Math.ceil((y1 - y0) / 6))
  const years: number[] = []
  for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) years.push(y)
  return (
    <div className="space-y-1" role="img" aria-label="Timeline of the release cycles">
      <div className="relative space-y-1.5">
        {cycles.map((c, i) => {
          const rel = c[2] || start
          const active = typeof c[3] === 'string' ? c[3] : c[3] === true ? rel : null
          const sec = typeof c[4] === 'string' ? c[4] : c[4] === true ? (active ?? rel) : null
          const a0 = at(rel)
          const a1 = active ? at(active) : sec ? at(sec) : 1
          const s1 = sec ? at(sec) : 1
          const on = pick?.[0] === c[0]
          return (
            <div key={c[0]} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 text-xs sm:grid-cols-[6rem_minmax(0,1fr)]">
              <span className={`truncate tabular-nums ${on ? 'font-[700] text-foreground' : 'text-muted-foreground'}`}>{c[1] || c[0]}</span>
              <div className="relative h-3.5 rounded-sm bg-background">
                <div
                  className="absolute inset-y-0 origin-left motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2 motion-safe:duration-500"
                  style={{ left: `${a0 * 100}%`, width: `${Math.max(0.5, (s1 - a0) * 100)}%`, animationDelay: `${i * 35}ms`, animationFillMode: 'both' }}
                >
                  <span className="absolute inset-y-0 left-0 rounded-l-sm bg-foreground" style={{ width: `${((a1 - a0) / Math.max(0.0001, s1 - a0)) * 100}%`, opacity: on || !pick ? 1 : 0.55 }} />
                  <span className="absolute inset-y-0 right-0 rounded-r-sm bg-chart-3" style={{ width: `${((s1 - a1) / Math.max(0.0001, s1 - a0)) * 100}%`, opacity: on || !pick ? 1 : 0.55 }} />
                </div>
              </div>
            </div>
          )
        })}
        <div className="pointer-events-none absolute inset-y-0 right-0 left-[calc(4.5rem+0.5rem)] sm:left-[calc(6rem+0.5rem)]">
          <span className="absolute inset-y-[-4px] w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${todayX * 100}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 text-xs text-muted-foreground tabular-nums sm:grid-cols-[6rem_minmax(0,1fr)]">
        <span />
        <div className="relative h-4">
          {years.map((y) => (
            <span key={y} className="absolute -translate-x-1/2" style={{ left: `${at(`${y}-01-01`) * 100}%` }}>
              {y}
            </span>
          ))}
        </div>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-foreground" aria-hidden="true" /> Active support
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-chart-3" aria-hidden="true" /> Security fixes only
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5 rounded-full bg-foreground" aria-hidden="true" /> Today
        </span>
      </p>
    </div>
  )
}

export default function EndOfLifeChecker() {
  const [productId, setProductId] = useState('python')
  const [search, setSearch] = useState('')
  const [version, setVersion] = useState('')
  const data = useLoaded('eol', () => loadJson<Record<string, Product>>(`${D.files}/eol.json`))
  const today = new Date().toISOString().slice(0, 10)

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return D.products.filter(([id, label]) => id.includes(q) || label.toLowerCase().includes(q)).slice(0, 10)
  }, [search])

  const product = data.state === 'ready' ? data.data[productId] : undefined
  const pick = product && version.trim() ? matchCycle(version, product.cycles) : null
  const shown = product ? product.cycles.slice(0, SHOWN) : []
  const state = pick ? cycleState(pick, today) : null
  const supported = product ? product.cycles.filter((c) => cycleState(c, today) !== 'eol' && cycleState(c, today) !== 'unknown') : []

  const verdict =
    pick && state && product
      ? state === 'eol'
        ? `${product.label} ${pick[1] || pick[0]} reached end of life${typeof pick[4] === 'string' ? ` on ${formatDay(pick[4])}` : ''}. It gets no more fixes.`
        : state === 'security'
          ? `${product.label} ${pick[1] || pick[0]} gets security fixes only${typeof pick[4] === 'string' ? `, until ${formatDay(pick[4])} (${daysBetween(today, pick[4])} days)` : ''}.`
          : state === 'active'
            ? `${product.label} ${pick[1] || pick[0]} is supported${typeof pick[3] === 'string' ? `, with full support until ${formatDay(pick[3])}` : ''}${typeof pick[4] === 'string' ? ` and security fixes until ${formatDay(pick[4])}` : ''}.`
            : `endoflife.date has no support dates for ${product.label} ${pick[0]}.`
      : ''
  const Icon = state === 'eol' ? TriangleAlert : state === 'security' ? Info : CircleCheck

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="relative space-y-1.5">
            <Label htmlFor="eol-search">Software</Label>
            <Input
              id="eol-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={product?.label ?? 'Python, Ubuntu, PostgreSQL…'}
              autoComplete="off"
              aria-controls="eol-suggestions"
            />
            {suggestions.length ? (
              <ul id="eol-suggestions" className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg bg-popover p-1 shadow-pop">
                {suggestions.map(([id, label, cat]) => (
                  <li key={id}>
                    <button
                      type="button"
                      className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                      onClick={() => {
                        setProductId(id)
                        setSearch('')
                        setVersion('')
                      }}
                    >
                      <span className="font-[600]">{label}</span>
                      <span className="text-xs text-muted-foreground">{CATEGORY[cat] ?? cat}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eol-version">Your version (optional)</Label>
            <Input id="eol-version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder={product?.cycles[1]?.[0] ?? '3.11'} autoComplete="off" className="tabular-nums" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <span className="mr-1 text-muted-foreground">Popular:</span>
          {['python', 'nodejs', 'ubuntu', 'postgresql', 'php', 'windows', 'eclipse-temurin', 'kubernetes'].map((id) => {
            const p = D.products.find((x) => x[0] === id)
            return p ? (
              <Button key={id} type="button" variant="ghost" size="sm" onClick={() => { setProductId(id); setVersion('') }}>
                {p[1]}
              </Button>
            ) : null
          })}
        </div>
      </ToolPanel>

      {data.state === 'loading' ? <Loading label="Loading support dates" /> : null}
      {data.state === 'error' ? <ErrorNote message={data.message} /> : null}

      {product ? (
        <ToolPanel title={product.label} description={`${CATEGORY[product.category] ?? product.category}. ${supported.length ? `Supported now: ${supported.map((c) => c[1] || c[0]).slice(0, 6).join(', ')}.` : 'No version is supported now.'}`}>
          <div role="status" aria-live="polite">
            {version.trim() && !pick ? <ErrorNote message={`No ${product.label} release cycle matches “${version.trim()}”. Use a version such as ${product.cycles[0][0]}.`} /> : null}
            {verdict ? (
              <p key={`${productId}-${pick?.[0]}`} className="reveal flex items-start gap-2 text-lg leading-snug font-[680]">
                <Icon className="mt-1 size-5 shrink-0" aria-hidden="true" />
                <span>{verdict}</span>
              </p>
            ) : null}
          </div>
          <Timeline key={productId} cycles={shown} today={today} pick={pick} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm tabular-nums">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-3 font-[560]">Version</th>
                  <th className="py-1 pr-3 font-[560]">Released</th>
                  <th className="py-1 pr-3 font-[560]">{product.labels.active}</th>
                  <th className="py-1 pr-3 font-[560]">{product.labels.security}</th>
                  <th className="py-1 font-[560]">Latest</th>
                </tr>
              </thead>
              <tbody>
                {product.cycles.map((c) => {
                  const st = cycleState(c, today)
                  return (
                    <tr key={c[0]} className={pick?.[0] === c[0] ? 'font-[700]' : st === 'eol' ? 'text-muted-foreground' : ''}>
                      <td className="py-1 pr-3">
                        {c[1] || c[0]}
                        {c[7] && !/lts/i.test(c[1]) ? ' LTS' : ''}
                        <span className="sr-only"> ({STATE_TEXT[st]})</span>
                      </td>
                      <td className="py-1 pr-3">{c[2] ? formatDay(c[2]) : '–'}</td>
                      <td className="py-1 pr-3">{untilText(c[3])}</td>
                      <td className="py-1 pr-3">{untilText(c[4])}</td>
                      <td className="py-1">{c[5] || '–'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CopyButton
              value={['Version,Released,Active support until,Security support until,Latest', ...product.cycles.map((c) => [c[0], c[2], c[3], c[4], c[5]].map((v) => String(v ?? '')).join(','))].join('\n')}
              label="Copy as CSV"
            />
            <a href={product.link} className="text-sm underline underline-offset-2" target="_blank" rel="noopener noreferrer">
              {product.label} on endoflife.date
            </a>
          </div>
        </ToolPanel>
      ) : null}

      <SourceNote meta={D.meta}>{D.products.length} products.</SourceNote>
    </div>
  )
}
