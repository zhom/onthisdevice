import { useEffect, useId, useMemo, useState } from 'react'
import type { Faker } from '@faker-js/faker'
import { KeyRound, RefreshCw } from 'lucide-react'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  ACTION_NAMES,
  KIND_NAMES,
  PERSONAL,
  classifyColumn,
  defaultAction,
  importHmacKey,
  randomKeyHex,
} from '@/lib/ml/text/columns'
import type { ColumnAction, ColumnKind } from '@/lib/ml/text/columns'
import { nerOnTexts } from '@/lib/ml/text/ner-client'
import { Replacer, loadFaker } from '@/lib/ml/text/placeholders'
import { formatBytes, formatNumber, stripExtension } from '@/lib/utils'
import { ModelNote } from '../text/ModelNote'
import { useNer } from '../text/useNer'
import { transformColumn } from './anonymize-table'
import type { ColumnPlan, Engine } from './anonymize-table'
import { readTable, writeTable } from './table-io'
import type { OutColumn, Table } from './table-io'

const KINDS = Object.keys(KIND_NAMES) as ColumnKind[]
const ACTIONS = Object.keys(ACTION_NAMES) as ColumnAction[]
const PREVIEW_ROWS = 8
const SAMPLE_ROWS = 300

function firstValue(table: Table, col: number): string {
  for (const r of table.rows) if (r[col]?.trim()) return r[col]
  return ''
}

export function AnonymizeCsv() {
  const id = useId()
  const [file, setFile] = useState<File | null>(null)
  const [table, setTable] = useState<Table | null>(null)
  const [plans, setPlans] = useState<ColumnPlan[]>([])
  const [keyHex, setKeyHex] = useState(() => randomKeyHex())
  const [keyError, setKeyError] = useState<string | null>(null)
  const [textStyle, setTextStyle] = useState<'label' | 'fake'>('label')
  const [useModel, setUseModel] = useState(false)
  const [faker, setFaker] = useState<Faker | null>(null)
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31))
  const [preview, setPreview] = useState<{ header: string[]; rows: string[][] } | null>(null)
  const [examples, setExamples] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ label: string; value: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const ner = useNer('', true)
  const modelReady = ner.phase === 'ready' || ner.phase === 'running'

  useEffect(() => {
    void loadFaker().then(setFaker)
  }, [])

  // One replacer per file, so the preview and the export give the same fake values.
  const replacer = useMemo(() => new Replacer(faker, seed), [faker, seed, table])
  const keyJob = useMemo(() => {
    const job = importHmacKey(keyHex)
    job.then(() => setKeyError(null)).catch((e: unknown) => setKeyError(e instanceof Error ? e.message : 'Invalid key.'))
    return job
  }, [keyHex])

  const hasText = plans.some((p) => p.action === 'redact')
  const engineFor = async (): Promise<Engine> => ({
    replacer,
    key: await keyJob,
    textStyle,
    ner: useModel && modelReady && hasText ? (texts, onP) => nerOnTexts(texts, (d, t) => onP(d / Math.max(1, t))) : undefined,
  })

  const open = async (f: File, sheet?: string) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setPreview(null)
    try {
      const t = await readTable(f, sheet)
      setFile(f)
      setTable(t)
      setPlans(
        t.header.map((h, i) => {
          const kind = classifyColumn(h, t.rows.slice(0, SAMPLE_ROWS).map((r) => r[i] ?? ''))
          return { kind, action: defaultAction(kind) }
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : `${f.name} could not be read.`)
    } finally {
      setLoading(false)
    }
  }

  // Preview of the first rows and one example per column, recomputed on every change.
  useEffect(() => {
    if (!table) return
    let live = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const engine = await engineFor()
          const head = table.rows.slice(0, PREVIEW_ROWS)
          const cols = await Promise.all(plans.map((p, i) => transformColumn(head.map((r) => r[i] ?? ''), p, engine)))
          const ex = await Promise.all(plans.map((p, i) => transformColumn([firstValue(table, i)], p, engine)))
          if (!live) return
          const keep = plans.map((p, i) => (p.action === 'drop' ? -1 : i)).filter((i) => i >= 0)
          setPreview({ header: keep.map((i) => table.header[i]), rows: head.map((_, r) => keep.map((i) => cols[i][r])) })
          setExamples(ex.map((c) => c[0]))
        } catch {
          /* an invalid key shows its own message */
        }
      })()
    }, 150)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
    // engineFor reads the values listed here.
  }, [table, plans, replacer, keyJob, textStyle, useModel, modelReady])

  const setPlan = (i: number, next: Partial<ColumnPlan>) => {
    setResult(null)
    setPlans((prev) => prev.map((p, j) => (j === i ? { ...p, ...next } : p)))
  }

  const run = async () => {
    if (!table) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const engine = await engineFor()
      const cols: string[][] = []
      for (let i = 0; i < plans.length; i++) {
        const label = `Column ${i + 1} of ${plans.length}: ${table.header[i]}`
        setProgress({ label, value: (i / plans.length) * 100 })
        const values = table.rows.map((r) => r[i] ?? '')
        cols.push(await transformColumn(values, plans[i], engine, (p) => setProgress({ label, value: ((i + p) / plans.length) * 100 })))
      }
      setProgress({ label: 'Writing the file', value: 99 })
      const out: OutColumn[] = []
      plans.forEach((p, i) => {
        if (p.action !== 'drop') out.push({ source: i, header: table.header[i], kept: p.action === 'keep' })
      })
      const rows = table.rows.map((_, r) => out.map((c) => cols[c.source][r]))
      setResult(await writeTable(table, out, rows))
      setProgress({ label: 'Done', value: 100 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The table could not be anonymized.')
    } finally {
      setBusy(false)
      window.setTimeout(() => setProgress(null), 800)
    }
  }

  const ext = table ? (table.format === 'xlsx' ? 'xlsx' : table.format) : 'csv'
  const outName = file ? `${stripExtension(file.name)}-anonymized.${ext}` : `anonymized.${ext}`
  const personalCols = plans.filter((p) => PERSONAL.has(p.kind)).length

  if (!table || !file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".csv,.tsv,.tab,.txt,.xlsx,.xls,.ods,.json"
          onFiles={(files) => files[0] && void open(files[0])}
          maxSizeMb={300}
          title="Drop a CSV, TSV, XLSX or JSON file"
          hint="The file is read in this tab and never sent anywhere"
          disabled={loading}
        />
        {loading ? <ProgressPanel label="Reading the table" /> : null}
        {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ToolPanel
        title={file.name}
        description={`${formatNumber(table.rows.length)} rows, ${table.header.length} columns, ${formatBytes(file.size)}. ${personalCols} ${personalCols === 1 ? 'column looks' : 'columns look'} personal.`}
        footer={
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFile(null)
              setTable(null)
              setResult(null)
            }}
          >
            Open another file
          </Button>
        }
      >
        {table.sheets && table.sheets.length > 1 ? (
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor={`${id}-sheet`}>Sheet</Label>
            <Select value={table.sheet} onValueChange={(v) => void open(file, v)}>
              <SelectTrigger id={`${id}-sheet`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {table.sheets.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">The download holds this sheet only.</p>
          </div>
        ) : null}

        <h3 className="text-sm font-[600] text-foreground">Columns</h3>
        <div className="hidden px-3 text-xs text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_11rem_10rem] sm:gap-2" aria-hidden="true">
          <span>Name and example</span>
          <span>Holds</span>
          <span>Action</span>
        </div>
        <ul className="space-y-2">
          {table.header.map((h, i) => {
            const p = plans[i]
            if (!p) return null
            const sample = firstValue(table, i)
            return (
              <li key={`${h}-${i}`} className="grid gap-2 rounded-lg bg-background p-3 sm:grid-cols-[minmax(0,1fr)_11rem_10rem] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-[600] text-foreground" title={h}>
                    {h}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground" title={sample}>
                    {sample ? (
                      <>
                        {sample.slice(0, 40)}
                        {p.action !== 'keep' ? <> → {p.action === 'drop' ? 'removed' : (examples[i] ?? '').slice(0, 40)}</> : null}
                      </>
                    ) : (
                      'empty'
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${id}-kind-${i}`} className="text-xs text-muted-foreground sm:sr-only">
                    Holds
                  </Label>
                  <Select value={p.kind} onValueChange={(v) => setPlan(i, { kind: v as ColumnKind, action: defaultAction(v as ColumnKind) })}>
                    <SelectTrigger id={`${id}-kind-${i}`} className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {KIND_NAMES[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${id}-action-${i}`} className="text-xs text-muted-foreground sm:sr-only">
                    Action
                  </Label>
                  <Select value={p.action} onValueChange={(v) => setPlan(i, { action: v as ColumnAction })}>
                    <SelectTrigger id={`${id}-action-${i}`} className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {ACTION_NAMES[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </li>
            )
          })}
        </ul>
      </ToolPanel>

      <ToolPanel title="Settings">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-key`} className="flex items-center gap-1.5">
            <KeyRound className="size-4" aria-hidden="true" />
            Hash key
          </Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={`${id}-key`}
              value={keyHex}
              onChange={(e) => {
                setResult(null)
                setKeyHex(e.target.value.trim())
              }}
              className="min-w-0 flex-1 font-mono text-[0.8125rem]"
              spellCheck={false}
              aria-invalid={keyError ? true : undefined}
            />
            <CopyButton value={keyHex} label="Copy key" />
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setKeyHex(randomKeyHex())}>
              <RefreshCw className="size-4" aria-hidden="true" />
              New key
            </Button>
          </div>
          <p className="text-xs text-pretty text-muted-foreground">
            {keyError ??
              'Hashed columns use HMAC-SHA-256 with this random key. It exists only in this page. Paste the same key for another file and equal values get equal hashes, so you can still join the files.'}
          </p>
        </div>

        {hasText ? (
          <div className="space-y-3">
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor={`${id}-style`}>Free text: replace with</Label>
              <Select value={textStyle} onValueChange={(v) => setTextStyle(v as 'label' | 'fake')}>
                <SelectTrigger id={`${id}-style`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="label">Labels such as [NAME]</SelectItem>
                  <SelectItem value="fake">Fake values</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch id={`${id}-model`} checked={useModel} onCheckedChange={(v) => {
                setUseModel(v)
                setResult(null)
                if (v && ner.phase === 'idle') ner.start()
              }} />
              <Label htmlFor={`${id}-model`} className="text-sm font-normal">
                Find names in free text with the language model
              </Label>
            </div>
            {useModel ? <ModelNote ner={ner} what="Names in free text" /> : null}
          </div>
        ) : null}
      </ToolPanel>

      {preview ? (
        <ToolPanel title="Preview" description={`The first ${Math.min(PREVIEW_ROWS, table.rows.length)} rows of the result.`}>
          <div className="overflow-x-auto rounded-lg bg-background">
            <table className="w-max min-w-full border-collapse text-left text-[0.8125rem]">
              <thead>
                <tr>
                  {preview.header.map((h, i) => (
                    <th key={i} scope="col" className="px-3 py-2 font-[600] whitespace-nowrap text-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j} className="max-w-64 truncate px-3 py-1.5 font-mono whitespace-nowrap text-foreground" title={c}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ToolPanel>
      ) : null}

      <ToolPanel
        title="Export"
        footer={
          <>
            <Button type="button" onClick={() => void run()} disabled={busy || Boolean(keyError)}>
              {busy ? 'Working…' : `Anonymize ${formatNumber(table.rows.length)} rows`}
            </Button>
            <DownloadButton blob={result} filename={outName} label={`Download .${ext}`} variant={result ? 'default' : 'outline'} />
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          The download has the same format as your file: {ext.toUpperCase()}
          {table.format === 'csv' ? `, separated by "${table.delimiter === '\t' ? 'tab' : table.delimiter}"` : ''}. Dropped columns are left out.
        </p>
        {progress ? <ProgressPanel label={progress.label} value={progress.value} /> : null}
        {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}
      </ToolPanel>
    </div>
  )
}

export default AnonymizeCsv
