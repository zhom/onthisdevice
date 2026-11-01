import { useCallback, useDeferredValue, useId, useMemo, useState } from 'react'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { mergeSpans } from '@/lib/ml/text/merge'
import { applySpans } from '@/lib/ml/text/placeholders'
import { secretRule } from '@/lib/ml/text/secret-rules'
import type { Span } from '@/lib/ml/text/types'
import { fileExtension, stripExtension } from '@/lib/utils'
import { RedactionView, keepKey } from './RedactionView'
import { TextInput } from './TextInput'
import { useRuleSpans } from './useRuleSpans'

// Fake values. Key prefixes are split with ${} so secret scanners do not flag this file.
const SAMPLE = `# .env for staging
DATABASE_URL=postgres://app:9fQ2-wLm7ZpX@db01.staging.corp:5432/app
REDIS_URL=redis://cache.staging.corp:6379
STRIPE_SECRET_KEY=sk_${'live'}_4eC39HqLyjWDarjtT1zdp7dc
GITHUB_TOKEN=gh${'p'}_R8dVf2kLq9mN3xPz7tYb1cWe5hJa0sGu4oKi
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
ADMIN_EMAIL=ops@example.com
LOG_LEVEL=debug
MAX_TOKENS=4096

2025-03-12T09:15:12Z DEBUG api request from 203.0.113.77 Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk
2025-03-12T09:15:13Z INFO  build 4.12.0 commit 9fceb02d0ae598e95dc970b74767f19372d61af8 ok`

const ACCEPT =
  '.log,.txt,.json,.yaml,.yml,.env,.ini,.toml,.conf,.cfg,.properties,.xml,.sh,.ps1,.py,.js,.ts,.tf,.tfvars,.har,.csv,.md,text/*'

type Style = 'type' | 'generic' | 'partial'

const STYLES: { id: Style; name: string; example: string }[] = [
  { id: 'type', name: 'Type name', example: '[GITHUB_TOKEN]' },
  { id: 'generic', name: 'One word', example: '[REDACTED]' },
  { id: 'partial', name: 'Keep the start', example: 'ghp_****' },
]

const PII_TAG: Record<string, string> = { email: 'EMAIL', ipv4: 'IP', ipv6: 'IP', mac: 'MAC', 'internal-host': 'HOST' }

function tagFor(span: Span): string {
  const rule = secretRule(span.rule)
  if (rule) return rule.tag
  if (span.rule && PII_TAG[span.rule]) return PII_TAG[span.rule]
  if (span.rule === 'config-password') return 'PASSWORD'
  return 'SECRET'
}

function labelFor(span: Span): string {
  if (span.label) return span.label
  if (span.rule === 'email') return 'Email'
  if (span.rule === 'ipv4' || span.rule === 'ipv6') return 'IP address'
  if (span.rule === 'mac') return 'MAC address'
  return 'Secret'
}

/** Rules whose values have no fixed, public prefix. */
const NO_PREFIX = new Set([
  'url-password', 'auth-header', 'cookie', 'api-key-header', 'npmrc-auth', 'jwt', 'aws-secret-key', 'aws-session-token',
  'azure-storage-key', 'azure-client-secret', 'azure-sas', 'discord-bot', 'telegram-bot', 'asana', 'mailchimp',
  'sentry-dsn', 'putty-key', 'postmark', 'twitter-bearer', 'terraform', 'deepseek-like', 'openai-legacy',
])

function replaceWith(style: Style, span: Span, original: string): string {
  if (style === 'generic') return '[REDACTED]'
  if (style === 'partial') {
    // Provider keys start with a fixed prefix (ghp_, sk_l, AKIA) that tells which key it was.
    // Passwords and random strings show nothing.
    const provider = secretRule(span.rule)
    const fixedPrefix = provider && !NO_PREFIX.has(provider.id)
    const head = fixedPrefix && original.length >= 16 ? original.slice(0, 4) : ''
    return `${head}****`
  }
  return `[${tagFor(span)}]`
}

/** 1-based line number for each offset, by binary search over line starts. */
function lineIndex(text: string) {
  const starts = [0]
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1)
  return (offset: number) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= offset) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
}

const MAX_LISTED = 500

export function SecretsScrubber() {
  const id = useId()
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [style, setStyle] = useState<Style>('type')
  const [emails, setEmails] = useState(true)
  const [ips, setIps] = useState(true)
  const [hosts, setHosts] = useState(true)
  const [entropy, setEntropy] = useState(true)
  const [kept, setKept] = useState<Set<string>>(() => new Set())

  const deferred = useDeferredValue(text)
  const raw = useRuleSpans(deferred, { pii: emails || ips, secrets: true, entropy, hosts })

  const spans = useMemo(() => {
    const wanted = (raw ?? []).filter((s) => {
      if (s.type === 'SECRET') return true
      if (s.type === 'EMAIL') return emails
      if (s.type === 'IP' || s.type === 'MAC') return ips
      if (s.rule === 'internal-host') return hosts
      return false
    })
    return mergeSpans(deferred, wanted)
  }, [raw, deferred, emails, ips, hosts])

  const result = useMemo(() => {
    const keptIdx = new Set<number>()
    spans.forEach((s, i) => {
      if (kept.has(keepKey(s, deferred.slice(s.start, s.end)))) keptIdx.add(i)
    })
    return { ...applySpans(deferred, spans, (s, o) => replaceWith(style, s, o), keptIdx), keptIdx }
  }, [deferred, spans, style, kept])

  const findings = useMemo(() => {
    const lineOf = lineIndex(deferred)
    return spans.map((s, i) => ({ i, line: lineOf(s.start), label: labelFor(s), tag: tagFor(s), kept: result.keptIdx.has(i) }))
  }, [spans, deferred, result.keptIdx])

  const toggle = useCallback((key: string) => {
    setKept((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const hidden = findings.filter((f) => !f.kept).length
  const ext = fileName ? fileExtension(fileName) : 'txt'
  const outName = `${fileName ? stripExtension(fileName) : 'scrubbed'}${fileName ? '-scrubbed' : ''}.${ext || 'txt'}`
  const blob = useMemo(() => (result.output ? new Blob([result.output], { type: 'text/plain;charset=utf-8' }) : null), [result.output])
  const stale = text !== deferred || raw === null

  const toggles = [
    { id: 'emails', label: 'Email addresses', value: emails, set: setEmails },
    { id: 'ips', label: 'IP and MAC addresses', value: ips, set: setIps },
    { id: 'hosts', label: 'Internal host names', value: hosts, set: setHosts },
    { id: 'entropy', label: 'Long random strings', value: entropy, set: setEntropy },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div className="min-w-0 space-y-4">
        <ToolPanel>
          <TextInput
            value={text}
            onChange={(t, name) => {
              setText(t)
              setFileName(name ?? null)
            }}
            accept={ACCEPT}
            label="Logs, code or config"
            placeholder="Paste a log, a config file or code, or drop a file"
            sample={SAMPLE}
            mono
          />
        </ToolPanel>

        <ToolPanel
          title="Result"
          description={text ? 'Only the secret values change. Press a mark to keep that value.' : undefined}
          footer={
            text ? (
              <>
                <CopyButton value={result.output} label="Copy result" variant="default" size="default" />
                <DownloadButton blob={blob} filename={outName} label={`Download .${ext || 'txt'}`} variant="secondary" />
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
                {stale ? 'Scanning…' : hidden === 0 ? 'No secrets found.' : `${hidden} ${hidden === 1 ? 'value' : 'values'} replaced.`}
              </p>
              <RedactionView pieces={result.pieces} spans={spans} kept={kept} onToggle={toggle} mono label="Scrubbed text" />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">The scrubbed text shows here as you paste.</p>
          )}
        </ToolPanel>

        {findings.length > 0 ? (
          <ToolPanel title="Findings" description="Line number and type of each value. The values are not shown here.">
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[22rem] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-card text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-1.5 pr-3 font-[560]">Line</th>
                    <th scope="col" className="py-1.5 pr-3 font-[560]">Type</th>
                    <th scope="col" className="py-1.5 font-[560]">Tag</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.slice(0, MAX_LISTED).map((f) => (
                    <tr key={f.i}>
                      <td className="num py-1 pr-3 align-top">{f.line}</td>
                      <td className="py-1 pr-3 align-top">
                        {f.label}
                        {f.kept ? <span className="text-muted-foreground">, kept</span> : null}
                      </td>
                      <td className="py-1 align-top font-mono text-[0.8125rem]">[{f.tag}]</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {findings.length > MAX_LISTED ? (
              <p className="text-sm text-muted-foreground">
                The first {MAX_LISTED} of {findings.length} are listed. The result has all of them replaced.
              </p>
            ) : null}
          </ToolPanel>
        ) : null}
      </div>

      <ToolPanel title="Options">
        <fieldset>
          <legend className="mb-2 text-sm font-[600] text-foreground">Replace with</legend>
          <RadioGroup value={style} onValueChange={(v) => setStyle(v as Style)} className="grid gap-2.5">
            {STYLES.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <RadioGroupItem id={`${id}-${s.id}`} value={s.id} />
                <Label htmlFor={`${id}-${s.id}`} className="text-sm font-normal">
                  {s.name}
                  <span className="ml-1.5 font-mono text-[0.8125rem] text-muted-foreground">{s.example}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-[600] text-foreground">Also hide</legend>
          <div className="grid gap-2.5">
            {toggles.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <Checkbox id={`${id}-${t.id}`} checked={t.value} onCheckedChange={(v) => t.set(v === true)} />
                <Label htmlFor={`${id}-${t.id}`} className="text-sm font-normal">
                  {t.label}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>
        <p className="text-sm text-pretty text-muted-foreground">
          Keys, tokens, private keys and passwords are always hidden. Keep the start shows the fixed prefix of provider keys, such as ghp_ or AKIA, so you can tell which key it was.
        </p>
      </ToolPanel>
    </div>
  )
}

export default SecretsScrubber
