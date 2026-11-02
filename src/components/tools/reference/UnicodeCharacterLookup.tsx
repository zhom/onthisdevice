import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ToolPanel } from '@/components/shared/ToolPanel'
import unicodeData from '@/data/unicode.json'
import type { DataMeta } from './data'
import { loadJson } from './data'
import { Facts, Loading, Segmented } from './controls'
import type { UcdBlock, UcdRange } from './unicode'
import { CATEGORY, blockOf, codePoints, hex, invisible, parseNotation, rangeName, uPlus, utf16Units, utf8Bytes } from './unicode'
import { SourceNote } from './SourceNote'

interface UnicodeManifest {
  meta: DataMeta
  version: string
  counts: { names: number; emoji: number }
  shift: number
  shards: number[]
  ranges: UcdRange[]
  blocks: UcdBlock[]
  files: string
}
type Shard = Record<string, [string, string]>
const D = unicodeData as unknown as UnicodeManifest
const SHARDS = new Set(D.shards)
const MAX = 200

const loadShard = (k: number): Promise<Shard> => (SHARDS.has(k) ? loadJson<Shard>(`${D.files}/names/${k}.json`) : Promise.resolve({}))

interface Info {
  cp: number
  name: string
  gc: string
}

async function describe(cps: number[]): Promise<Info[]> {
  const shards = new Map<number, Shard>()
  await Promise.all([...new Set(cps.map((c) => c >> D.shift))].map(async (k) => shards.set(k, await loadShard(k))))
  return cps.map((cp) => {
    const hit = shards.get(cp >> D.shift)?.[cp.toString(16).toUpperCase()]
    if (hit) return { cp, name: hit[0], gc: hit[1] }
    const r = rangeName(cp, D.ranges)
    return r ? { cp, ...r } : { cp, name: 'Unassigned', gc: 'Cn' }
  })
}

const hexBytes = (list: number[], width: number) => list.map((b) => b.toString(16).toUpperCase().padStart(width, '0')).join(' ')

function Tiles({ items, active, onPick }: { items: Info[]; active: number; onPick: (i: number) => void }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Characters">
      {items.map((c, i) => {
        const hidden = invisible(c.gc)
        return (
          <li key={`${i}-${c.cp}`} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-90 motion-safe:duration-300" style={{ animationDelay: `${Math.min(i, 40) * 18}ms`, animationFillMode: 'both' } as CSSProperties}>
            <button
              type="button"
              onClick={() => onPick(i)}
              aria-pressed={i === active}
              aria-label={`${uPlus(c.cp)} ${c.name}`}
              className={`flex h-12 min-w-12 flex-col items-center justify-center rounded-lg px-1.5 transition-colors ${i === active ? 'bg-foreground text-background' : hidden ? 'bg-chart-4 text-foreground' : 'bg-background'}`}
            >
              <span className="text-xl leading-none">{hidden ? '·' : String.fromCodePoint(c.cp)}</span>
              <span className="mt-0.5 text-[0.625rem] leading-none tabular-nums opacity-80">{hex(c.cp)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

type Mode = 'text' | 'name'

export default function UnicodeCharacterLookup() {
  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState('caf\u00E9\u200B\u20AC \u2713')
  const [nameQuery, setNameQuery] = useState('arrow right')
  const [items, setItems] = useState<Info[]>([])
  const [active, setActive] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [found, setFound] = useState<Info[] | null>(null)

  const cps = useMemo(() => (parseNotation(text) ?? codePoints(text)).slice(0, MAX), [text])

  useEffect(() => {
    let live = true
    describe(cps).then(
      (r) => {
        if (!live) return
        setItems(r)
        setActive((a) => Math.min(a, Math.max(0, r.length - 1)))
        setError(null)
      },
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
  }, [cps])

  useEffect(() => {
    if (mode !== 'name') return
    const words = nameQuery.trim().toUpperCase().split(/\s+/).filter(Boolean)
    if (!words.length) {
      setFound([])
      return
    }
    let live = true
    setSearching(true)
    Promise.all(D.shards.map((k) => loadShard(k))).then(
      (shards) => {
        if (!live) return
        const out: Info[] = []
        for (const shard of shards) {
          for (const [h, [name, gc]] of Object.entries(shard)) {
            if (words.every((w) => name.includes(w))) out.push({ cp: parseInt(h, 16), name, gc })
            if (out.length >= 300) break
          }
          if (out.length >= 300) break
        }
        const exact = words.join(' ')
        out.sort((a, b) => Number(b.name === exact) - Number(a.name === exact) || a.name.length - b.name.length)
        setFound(out)
        setSearching(false)
      },
      (e: unknown) => {
        if (live) {
          setError(e instanceof Error ? e.message : String(e))
          setSearching(false)
        }
      },
    )
    return () => {
      live = false
    }
  }, [mode, nameQuery])

  const list = mode === 'text' ? items : (found ?? [])
  const cur = list[active] ?? list[0]
  const rows: [string, string][] = cur
    ? [
        ['Code point', `${uPlus(cur.cp)} (decimal ${cur.cp})`],
        ['Name', cur.name],
        ['Category', `${CATEGORY[cur.gc] ?? cur.gc} (${cur.gc})`],
        ['Block', blockOf(cur.cp, D.blocks)],
        ['UTF-8', hexBytes(utf8Bytes(cur.cp), 2)],
        ['UTF-16', hexBytes(utf16Units(cur.cp), 4)],
        ['HTML', `&#x${cur.cp.toString(16).toUpperCase()}; or &#${cur.cp};`],
        ['JavaScript', cur.cp > 0xffff ? `\\u{${cur.cp.toString(16).toUpperCase()}}` : `\\u${hex(cur.cp)}`],
        ['CSS', `\\${cur.cp.toString(16).toUpperCase()}`],
      ]
    : []
  const hiddenCount = items.filter((c) => invisible(c.gc)).length

  return (
    <div className="space-y-6">
      <ToolPanel>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m)
            setActive(0)
          }}
          options={[
            { id: 'text', label: 'Text or code point' },
            { id: 'name', label: 'Search by name' },
          ]}
          label="Lookup mode"
        />
        {mode === 'text' ? (
          <div className="space-y-1.5">
            <Label htmlFor="uc-text">Text, or code points such as U+00E9 0x41 &amp;#8364;</Label>
            <Textarea id="uc-text" value={text} onChange={(e) => setText(e.target.value)} rows={2} className="text-lg" spellCheck={false} />
            <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
              {cps.length} character{cps.length === 1 ? '' : 's'}
              {hiddenCount ? `, ${hiddenCount} invisible or combining (grey)` : ''}
              {codePoints(text).length > MAX ? `. Showing the first ${MAX}.` : '.'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="uc-name">Words in the character name</Label>
            <Input id="uc-name" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} placeholder="arrow right, greek small, check mark" autoComplete="off" />
          </div>
        )}
        {error ? <ErrorNote message={error} /> : null}
        {mode === 'name' && searching && !found ? <Loading label={`Loading ${D.counts.names.toLocaleString('en-US')} character names`} /> : null}
        {list.length ? <Tiles items={list.slice(0, MAX)} active={Math.min(active, list.length - 1)} onPick={setActive} /> : null}
        {mode === 'name' && found && !found.length && nameQuery.trim() ? <p className="text-sm text-muted-foreground">No character name has all these words.</p> : null}
      </ToolPanel>

      {cur ? (
        <ToolPanel>
          <div className="flex items-center gap-5">
            <span key={cur.cp} className="reveal flex size-20 shrink-0 items-center justify-center rounded-xl bg-background text-[3rem] leading-none">
              {invisible(cur.gc) ? <span className="text-sm text-muted-foreground">{hex(cur.cp)}</span> : String.fromCodePoint(cur.cp)}
            </span>
            <div className="min-w-0 space-y-1" role="status" aria-live="polite">
              <p className="text-lg leading-tight font-[700] break-words">{cur.name}</p>
              <p className="text-sm text-muted-foreground tabular-nums">{uPlus(cur.cp)}</p>
            </div>
          </div>
          <Facts rows={rows} />
          <div className="flex flex-wrap gap-2">
            <CopyButton value={String.fromCodePoint(cur.cp)} label="Copy character" />
            <CopyButton value={rows.map(([k, v]) => `${k}: ${v}`).join('\n')} label="Copy details" variant="ghost" />
          </div>
        </ToolPanel>
      ) : null}

      <SourceNote meta={D.meta}>
        Unicode {D.version}, {D.counts.names.toLocaleString('en-US')} named characters plus the ideograph and syllable ranges.
      </SourceNote>
    </div>
  )
}
