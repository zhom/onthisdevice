import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ToolPanel } from '@/components/shared/ToolPanel'
import cloudData from '@/data/cloud-ips.json'
import type { DataMeta } from './data'
import { loadJson, loadText } from './data'
import type { Ip } from './ip'
import { decodeIndex, formatBig, lookupRange, mappedV4, parseCidr } from './ip'
import { SourceNote } from './SourceNote'

interface CloudManifest {
  meta: DataMeta
  providers: { name: string; url: string; ranges: number }[]
  v4: string[]
  v6: string[]
  files: string
}
interface Sets {
  labels: [number, string, string][]
  sets: number[][]
}
const D = cloudData as unknown as CloudManifest
const INDEX = decodeIndex(D.v4, D.v6)
const EXAMPLES = ['52.94.76.10', '104.16.132.229', '20.42.65.92', '34.120.0.0/16', '2600:1f18::1']

interface Result {
  input: string
  v: 4 | 6
  start: bigint
  end: bigint
  segment: { start: bigint; end: bigint } | null
  entries: { provider: number; service: string; region: string }[]
}

async function find(text: string): Promise<Result | null> {
  const c = parseCidr(text)
  if (!c) return null
  let ip: Ip = c.ip
  let { start, end } = c
  if (ip.v === 6 && c.bits === 128) {
    const m = mappedV4(ip.n)
    if (m !== null) {
      ip = { v: 4, n: m }
      start = end = BigInt(m)
    }
  }
  const key: Ip = ip.v === 4 ? { v: 4, n: Number(start) } : { v: 6, n: start }
  const hit = await lookupRange(key, INDEX, D.files, (p) => loadText(`${D.files}/${p}`))
  if (!hit) return { input: text, v: ip.v, start, end, segment: null, entries: [] }
  const sets = await loadJson<Sets>(`${D.files}/sets.json`)
  const entries = (sets.sets[hit.value] ?? []).map((id) => {
    const [provider, service, region] = sets.labels[id]
    return { provider, service, region }
  })
  return { input: text, v: ip.v, start, end, segment: { start: hit.start, end: hit.end }, entries }
}

export default function CloudIpLookup() {
  const [text, setText] = useState('52.94.76.10')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const valid = useMemo(() => parseCidr(text) !== null, [text])

  useEffect(() => {
    if (!valid) return
    let live = true
    find(text).then(
      (r) => {
        if (live) {
          setResult(r)
          setError(null)
        }
      },
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
  }, [text, valid])

  const matched = new Set(result?.entries.map((e) => e.provider))
  const owner = result?.entries.length ? [...matched].map((p) => D.providers[p].name).join(' and ') : null
  const whole = result?.segment ? result.end <= result.segment.end : false
  const isRange = result ? result.start !== result.end : false
  const summary = result
    ? owner
      ? `${result.input}: ${owner}. ${result.entries.map((e) => [e.service, e.region].filter(Boolean).join(', ')).join('; ')}`
      : `${result.input}: not in the published ranges of the providers checked.`
    : ''

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="space-y-1.5">
          <Label htmlFor="cloud-input">IP address or CIDR range</Label>
          <Input
            id="cloud-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="52.94.76.10 or 34.120.0.0/16"
            className="font-mono text-base"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={text.trim() !== '' && !valid}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Examples:</span>
          {EXAMPLES.map((ex) => (
            <Button key={ex} type="button" variant="ghost" size="sm" className="font-mono" onClick={() => setText(ex)}>
              {ex}
            </Button>
          ))}
        </div>
        {text.trim() && !valid ? <ErrorNote message="Enter an IPv4 or IPv6 address (52.94.76.10) or a CIDR range (52.94.0.0/22)." /> : null}
        {error ? <ErrorNote message={error} /> : null}
      </ToolPanel>

      {result && valid ? (
        <ToolPanel>
          <div role="status" aria-live="polite" className="space-y-1">
            <p className="text-sm text-muted-foreground">{result.input} is</p>
            <p key={owner ?? 'none'} className="reveal text-[1.75rem] leading-tight font-[740] break-words sm:text-[2.25rem]">
              {owner ?? 'Not a listed cloud or CDN'}
            </p>
            {isRange && result.segment ? (
              <p className="text-sm text-muted-foreground">
                {whole
                  ? 'The whole range is inside these published blocks.'
                  : `Only the start of the range is inside; the blocks end at ${formatBig(result.segment.end, result.v)}.`}
              </p>
            ) : null}
          </div>
          {result.entries.length ? (
            <ul className="space-y-1.5 text-sm">
              {result.entries.map((e, i) => (
                <li key={i} className="flex flex-wrap gap-x-3">
                  <span className="font-[600]">{D.providers[e.provider].name}</span>
                  <span>{e.service}</span>
                  {e.region ? <span className="text-muted-foreground">{e.region}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">The address can still belong to a provider that publishes no list, or to a customer network of one of them.</p>
          )}
          <CopyButton value={summary} label="Copy result" />
        </ToolPanel>
      ) : null}

      <ToolPanel title="Providers checked">
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {D.providers.map((p, i) => {
            const on = matched.has(i)
            return (
              <li key={p.name} className="relative flex items-baseline justify-between gap-3 overflow-hidden rounded-md px-2 py-1">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 origin-left bg-foreground transition-transform duration-300 ease-[var(--ease-out)] motion-reduce:transition-none"
                  style={{ transform: on ? 'scaleX(1)' : 'scaleX(0)' }}
                />
                <span className={`relative transition-colors duration-300 ${on ? 'font-[600] text-background' : ''}`}>
                  {p.name}
                  {on ? <span className="sr-only"> (match)</span> : null}
                </span>
                <span className={`relative shrink-0 tabular-nums transition-colors duration-300 ${on ? 'text-background' : 'text-muted-foreground'}`}>
                  {p.ranges.toLocaleString('en-US')} ranges
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
