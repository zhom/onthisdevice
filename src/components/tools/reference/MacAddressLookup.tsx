import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ToolPanel } from '@/components/shared/ToolPanel'
import macData from '@/data/mac-vendors.json'
import type { DataMeta } from './data'
import { loadJson } from './data'
import { BitGrid } from './BitGrid'
import { blockName, candidates, formatMac, macBits, parseMac } from './mac'
import { SourceNote } from './SourceNote'

interface MacManifest {
  meta: DataMeta
  counts: Record<string, number>
  files: string
}
const D = macData as unknown as MacManifest
const regions = new Intl.DisplayNames(['en'], { type: 'region' })

interface Row {
  input: string
  hex: string | null
  vendor: string
  country: string
  prefix: string
  note: string
}

async function lookup(line: string): Promise<Row> {
  const mac = parseMac(line)
  if (!mac) return { input: line, hex: null, vendor: '', country: '', prefix: '', note: 'Not a MAC address' }
  const { shard, prefixes } = candidates(mac)
  let table: Record<string, [string, string]> = {}
  try {
    table = await loadJson<Record<string, [string, string]>>(`${D.files}/${shard}.json`)
  } catch {
    // No assignments start with this byte (or the file is missing): no vendor.
  }
  const hit = prefixes.find((p) => table[p])
  const notes = []
  if (mac.local) notes.push('Locally administered (random or set by software)')
  if (mac.multicast) notes.push('Multicast (group) address')
  if (!hit && !mac.local) notes.push('Not assigned in the IEEE registries')
  return {
    input: line,
    hex: mac.hex,
    vendor: hit ? table[hit][0] : '',
    country: hit ? table[hit][1] : '',
    prefix: hit ?? '',
    note: notes.join('. '),
  }
}

export default function MacAddressLookup() {
  const [text, setText] = useState('F0:D1:A9:12:34:56')
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 500)

  useEffect(() => {
    let live = true
    Promise.all(lines.map(lookup)).then(
      (r) => {
        if (live) {
          setRows(r)
          setError(null)
        }
      },
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
    // `lines` is derived from `text`.
  }, [text])

  const first = rows[0]
  const single = rows.length === 1 && first?.hex
  const csv = ['MAC,Vendor,Country,Prefix,Note', ...rows.map((r) => [r.hex ? formatMac(r.hex) : r.input, r.vendor, r.country, r.prefix, r.note].map((v) => `"${v.replace(/"/g, '""')}"`).join(','))].join('\n')

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="space-y-1.5">
          <Label htmlFor="mac-input">MAC addresses or prefixes, one per line</Label>
          <Textarea
            id="mac-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={single || lines.length < 2 ? 2 : 6}
            className="font-mono text-base"
            placeholder="00:1A:2B:3C:4D:5E"
            spellCheck={false}
            autoCapitalize="off"
          />
        </div>
        {error ? <ErrorNote message={error} /> : null}
      </ToolPanel>

      {single && first.hex ? (
        <ToolPanel>
          <div role="status" aria-live="polite" className="space-y-1">
            <p className="text-sm text-muted-foreground">{formatMac(first.hex)} was made by</p>
            <p key={first.prefix} className="reveal text-[1.75rem] leading-tight font-[740] break-words sm:text-[2.25rem]">
              {first.vendor || (first.note.startsWith('Locally') ? 'No vendor (local address)' : 'Unknown vendor')}
            </p>
            <p className="text-sm text-muted-foreground">
              {first.vendor ? `${first.country ? `${regions.of(first.country) ?? first.country} · ` : ''}${blockName(first.prefix.length)} ${formatMac(first.prefix)}` : first.note}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-[600]">48 bits{first.prefix ? `, vendor block of ${first.prefix.length * 4} bits in black` : ''}</p>
            <BitGrid bits={macBits(first.hex)} prefix={first.prefix ? first.prefix.length * 4 : null} />
          </div>
          {first.vendor && first.note ? <p className="text-sm text-muted-foreground">{first.note}.</p> : null}
        </ToolPanel>
      ) : null}

      {rows.length > 1 ? (
        <ToolPanel title={`${rows.length} addresses`}>
          <div className="overflow-x-auto" role="status" aria-live="polite">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-3 font-[560]">MAC</th>
                  <th className="py-1 pr-3 font-[560]">Vendor</th>
                  <th className="py-1 pr-3 font-[560]">Country</th>
                  <th className="py-1 font-[560]">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="align-top">
                    <td className="py-1 pr-3 font-mono whitespace-nowrap">{r.hex ? formatMac(r.hex) : r.input}</td>
                    <td className="py-1 pr-3 font-[600]">{r.vendor || '–'}</td>
                    <td className="py-1 pr-3">{r.country || '–'}</td>
                    <td className="py-1 text-muted-foreground">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CopyButton value={csv} label="Copy as CSV" />
        </ToolPanel>
      ) : null}

      <SourceNote meta={D.meta}>
        {Object.entries(D.counts)
          .map(([k, v]) => `${v.toLocaleString('en-US')} ${k}`)
          .join(', ')}{' '}
        assignments.
      </SourceNote>
    </div>
  )
}
