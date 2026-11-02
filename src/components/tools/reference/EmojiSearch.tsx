import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ToolPanel } from '@/components/shared/ToolPanel'
import unicodeData from '@/data/unicode.json'
import type { DataMeta } from './data'
import { loadJson } from './data'
import { Facts, Loading, useLoaded } from './controls'
import type { EmojiRow } from './unicode'
import { codePoints, searchEmoji, uPlus, utf8Bytes } from './unicode'
import { SourceNote } from './SourceNote'

interface UnicodeManifest {
  meta: DataMeta
  version: string
  counts: { names: number; emoji: number }
  files: string
}
const D = unicodeData as unknown as UnicodeManifest
const LIMIT = 400

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`Copied ${label}`)
  } catch {
    toast.error('The browser blocked the clipboard. Select the character and copy it.')
  }
}

export default function EmojiSearch() {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')
  const [selected, setSelected] = useState<EmojiRow | null>(null)
  const data = useLoaded('emoji', () => loadJson<EmojiRow[]>(`${D.files}/emoji.json`))
  const groups = useMemo(() => (data.state === 'ready' ? [...new Set(data.data.map((r) => r[2]))] : []), [data])
  const results = useMemo(() => {
    if (data.state !== 'ready') return []
    const rows = group === 'all' ? data.data : data.data.filter((r) => r[2] === group)
    return searchEmoji(rows, query)
  }, [data, query, group])
  const current = selected ?? results[0] ?? null
  const cps = current ? codePoints(current[0]) : []
  const rows: [string, string][] = current
    ? [
        ['Name', current[1]],
        ['Code points', cps.map(uPlus).join(' ')],
        ['Group', `${current[2]} · ${current[3].replace(/-/g, ' ')}`],
        ['Added in', `Emoji ${current[5]}`],
        ['UTF-8 bytes', cps.flatMap(utf8Bytes).map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')],
        ['HTML', cps.map((c) => `&#x${c.toString(16).toUpperCase()};`).join('')],
        ...(current[4] ? ([['Keywords', current[4].split('|').join(', ')]] as [string, string][]) : []),
      ]
    : []

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="emoji-q">Search emoji</Label>
            <Input
              id="emoji-q"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelected(null)
              }}
              placeholder="heart, party, cat, thumbs up"
              className="text-base"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5 sm:w-56">
            <Label htmlFor="emoji-group">Group</Label>
            <Select
              value={group}
              onValueChange={(g) => {
                setGroup(g)
                setSelected(null)
              }}
            >
              <SelectTrigger id="emoji-group" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {data.state === 'loading' ? <Loading label="Loading the emoji list" /> : null}
        {data.state === 'error' ? <ErrorNote message={data.message} /> : null}
      </ToolPanel>

      {current ? (
        <ToolPanel>
          <div className="flex items-center gap-5">
            <button
              key={current[0]}
              type="button"
              onClick={() => copy(current[0], current[1])}
              className="reveal shrink-0 rounded-xl bg-background p-3 text-[4rem] leading-none transition-transform active:scale-95"
              aria-label={`Copy ${current[1]}`}
            >
              {current[0]}
            </button>
            <div className="min-w-0 space-y-1" role="status" aria-live="polite">
              <p className="text-xl leading-tight font-[700] break-words first-letter:uppercase">{current[1]}</p>
              <p className="text-sm text-muted-foreground tabular-nums">{cps.map(uPlus).join(' ')}</p>
            </div>
          </div>
          <Facts rows={rows} />
          <div className="flex flex-wrap gap-2">
            <CopyButton value={current[0]} label="Copy emoji" />
            <CopyButton value={cps.map(uPlus).join(' ')} label="Copy code points" variant="ghost" />
          </div>
        </ToolPanel>
      ) : null}

      {data.state === 'ready' ? (
        <ToolPanel title={`${results.length.toLocaleString('en-US')} emoji`}>
          <p className="sr-only" role="status" aria-live="polite">
            {results.length} emoji found
          </p>
          {results.length ? (
            <ul key={`${group}-${query}`} className="grid gap-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(2.75rem, 1fr))' }}>
              {results.slice(0, LIMIT).map((r) => (
                <li key={r[0]}>
                  <button
                    type="button"
                    title={r[1]}
                    aria-label={r[1]}
                    onClick={() => setSelected(r)}
                    onDoubleClick={() => copy(r[0], r[1])}
                    className={`flex aspect-square w-full items-center justify-center rounded-lg text-[1.75rem] leading-none transition-transform hover:bg-background active:scale-90 ${current?.[0] === r[0] ? 'bg-background' : ''}`}
                  >
                    {r[0]}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No emoji matches. Try another word, such as smile or food.</p>
          )}
          {results.length > LIMIT ? <p className="text-xs text-muted-foreground">Showing the first {LIMIT}. Search to narrow the list.</p> : null}
          <p className="text-xs text-muted-foreground">Select an emoji to see its details; double-click or tap the large one to copy it.</p>
        </ToolPanel>
      ) : null}

      <SourceNote meta={D.meta}>
        {D.counts.emoji.toLocaleString('en-US')} emoji, Unicode {D.version}.
      </SourceNote>
    </div>
  )
}
