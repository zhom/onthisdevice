import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { Faker } from '@faker-js/faker'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { parseChat, CHAT_FORMAT_NAMES } from '@/lib/ml/text/chat'
import { filterTypes, findListed, mergeSpans } from '@/lib/ml/text/merge'
import { Replacer, loadFaker, maskSpans } from '@/lib/ml/text/placeholders'
import type { MaskMode } from '@/lib/ml/text/placeholders'
import { TYPE_BY_ID, defaultTypes } from '@/lib/ml/text/types'
import type { EntityType, Span } from '@/lib/ml/text/types'
import { stripExtension } from '@/lib/utils'
import { ModelNote } from './ModelNote'
import { HideList, MaskPicker, TypePicker, hideTerms } from './Options'
import { RedactionView, keepKey } from './RedactionView'
import { TextInput } from './TextInput'
import { useNer } from './useNer'
import { useRuleSpans } from './useRuleSpans'

const SAMPLE_TEXT = `Hi Daniel,

Thanks for the call. As agreed, here are the details for the new account:

Name: Margaret Ellison
Date of birth: 04/09/1971
Address: 14 Wellington Road, Bristol BS8 2LT
Phone: 07700 900461
Email: m.ellison@postbox.example
IBAN: GB29 NWBK 6016 1331 9268 19

She worked at Northwind Insurance in Leeds until March. Her manager there, Priya Natarajan, can give a reference.

Best,
Tom Reilly`

const SAMPLE_CHAT = `[12/03/2025, 09:14:02] Anna Berg: Morning! Did you send the contract to Marco?
[12/03/2025, 09:15:40] Marco Rossi: Yes, to anna.berg@example.com and to Julia
[12/03/2025, 09:16:05] Julia Weber: Got it. Anna, can you call me on +44 7700 900123?
[12/03/2025, 09:17:31] Anna Berg: Sure. Marco, the office is at 221B Baker Street, London NW1 6XE
[12/03/2025, 09:18:12] Marco Rossi: Thanks Anna. I'll be there at 10.`

const ACCEPT_TEXT = '.txt,.md,.csv,.tsv,.json,.log,.eml,.xml,.html,.yml,.yaml,text/*'
const ACCEPT_CHAT = '.txt,.json,.csv,.html,text/*'

/** Extracts readable text from a chat HTML export; other files are read as text. */
async function readChatFile(file: File): Promise<string> {
  const raw = await file.text()
  if (!/\.html?$/i.test(file.name)) return raw
  const doc = new DOMParser().parseFromString(raw, 'text/html')
  // Telegram HTML: each message has a .from_name and a .text block.
  const rows = [...doc.querySelectorAll('.message')]
  if (rows.length > 0) {
    let last = ''
    const lines: string[] = []
    for (const r of rows) {
      const from = r.querySelector('.from_name')?.textContent?.trim()
      if (from) last = from
      const body = r.querySelector('.text')?.textContent?.trim()
      if (body) lines.push(`${last}: ${body}`)
    }
    if (lines.length) return lines.join('\n')
  }
  return doc.body.innerText || doc.body.textContent || ''
}

export function TextRedactor({ chat = false }: { chat?: boolean }) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [types, setTypes] = useState<Set<EntityType>>(() => defaultTypes())
  const [mode, setMode] = useState<MaskMode>(chat ? 'fake' : 'numbered')
  const [hide, setHide] = useState('')
  const [kept, setKept] = useState<Set<string>>(() => new Set())
  const [faker, setFaker] = useState<Faker | null>(null)
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31))

  const deferred = useDeferredValue(text)
  const rules = useRuleSpans(deferred, { pii: true, secrets: true, entropy: true })
  const ner = useNer(deferred)
  const chatInfo = useMemo(() => (chat ? parseChat(deferred) : null), [chat, deferred])
  const terms = useMemo(() => hideTerms(hide), [hide])

  useEffect(() => {
    if (mode === 'fake' && !faker) void loadFaker().then(setFaker)
  }, [mode, faker])

  const all = useMemo(() => {
    const list: Span[] = [...(rules ?? []), ...(ner.spans ?? []), ...findListed(deferred, terms), ...(chatInfo?.spans ?? [])]
    return mergeSpans(deferred, list)
  }, [deferred, rules, ner.spans, terms, chatInfo])

  const counts = useMemo(() => {
    const m = new Map<EntityType, number>()
    for (const s of all) if (s.source !== 'list' && s.source !== 'chat') m.set(s.type, (m.get(s.type) ?? 0) + 1)
    return m
  }, [all])

  const spans = useMemo(() => filterTypes(all, types), [all, types])

  const result = useMemo(() => {
    const keptIdx = new Set<number>()
    spans.forEach((s, i) => {
      if (kept.has(keepKey(s, deferred.slice(s.start, s.end)))) keptIdx.add(i)
    })
    return maskSpans(deferred, spans, mode, new Replacer(faker, seed), keptIdx)
  }, [deferred, spans, mode, faker, seed, kept])

  const hiddenCount = result.pieces.filter((p) => p.span >= 0 && p.text !== p.original).length

  const toggle = useCallback((key: string) => {
    setKept((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const blob = useMemo(() => (result.output ? new Blob([result.output], { type: 'text/plain;charset=utf-8' }) : null), [result.output])
  const outName = `${fileName ? stripExtension(fileName) : chat ? 'chat' : 'text'}-redacted.txt`

  const summary = useMemo(() => {
    const byType = new Map<string, [number, string, string]>()
    for (const p of result.pieces) {
      if (p.span < 0 || p.text === p.original) continue
      const s = spans[p.span]
      const info = s.source === 'list' ? { one: 'always-hide match', name: 'always-hide matches' } : TYPE_BY_ID[s.type]
      const entry = byType.get(info.one) ?? [0, info.one, info.name.toLowerCase().replace(/^id |^ip |^mac /, (m) => m.toUpperCase())]
      entry[0]++
      byType.set(info.one, entry)
    }
    return [...byType.values()].map(([n, one, many]) => `${n} ${n === 1 ? one : many}`).join(', ')
  }, [result.pieces, spans])

  const stale = text !== deferred || rules === null
  const senders = chatInfo ? [...chatInfo.senders.entries()].sort((a, b) => b[1] - a[1]) : []

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="min-w-0 space-y-4">
        <ToolPanel>
          <TextInput
            value={text}
            onChange={(t, name) => {
              setText(t)
              setFileName(name ?? null)
            }}
            accept={chat ? ACCEPT_CHAT : ACCEPT_TEXT}
            label={chat ? 'Chat' : 'Text'}
            placeholder={chat ? 'Paste a chat, or drop an exported chat file (.txt or .json)' : 'Paste text here, or drop a file'}
            sample={chat ? SAMPLE_CHAT : SAMPLE_TEXT}
            readFile={chat ? readChatFile : undefined}
          />
          {chat && text ? (
            <div className="text-sm text-pretty text-foreground" role="status" aria-live="polite">
              {chatInfo && chatInfo.format !== 'none' ? (
                <>
                  <p>
                    {CHAT_FORMAT_NAMES[chatInfo.format]}: {chatInfo.messages} messages from {senders.length}{' '}
                    {senders.length === 1 ? 'person' : 'people'}.
                  </p>
                  <p className="mt-1 text-muted-foreground">{senders.slice(0, 12).map(([name]) => name).join(', ')}{senders.length > 12 ? ', and more' : ''}</p>
                </>
              ) : (
                <p className="text-muted-foreground">No sender lines found. Names are still found in the text.</p>
              )}
            </div>
          ) : null}
        </ToolPanel>

        <ModelNote ner={ner} />

        <ToolPanel
          title="Result"
          description={text ? 'Press a hidden item to show it again. Every occurrence of that value is kept.' : undefined}
          footer={
            text ? (
              <>
                <CopyButton value={result.output} label="Copy result" variant="default" size="default" />
                <DownloadButton blob={blob} filename={outName} label="Download .txt" variant="secondary" />
                {kept.size > 0 ? (
                  <Button type="button" variant="ghost" onClick={() => setKept(new Set())}>
                    Hide all again
                  </Button>
                ) : null}
              </>
            ) : null
          }
        >
          {text ? (
            <>
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                {stale ? 'Reading…' : hiddenCount === 0 ? 'Nothing to hide was found.' : `Hidden: ${summary}.`}
              </p>
              <RedactionView pieces={result.pieces} spans={spans} kept={kept} onToggle={toggle} label="Result with hidden items" />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">The result shows here as you type or paste.</p>
          )}
        </ToolPanel>
      </div>

      <ToolPanel title="Options">
        <MaskPicker mode={mode} onChange={setMode} className="lg:grid-cols-1" />
        <TypePicker types={types} onChange={setTypes} counts={counts} className="lg:grid-cols-1" />
        <HideList value={hide} onChange={setHide} />
      </ToolPanel>
    </div>
  )
}
