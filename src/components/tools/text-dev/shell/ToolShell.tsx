import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownUp, Play, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { BusyNote, OutputBox, Segmented, TextEditor, useComputed } from '@/components/tools/text/common'
import { FieldControl } from './fields'
import { defaults } from './spec'
import type { Result, Spec, Value, Values } from './spec'
import { BarsView, RowsView, StatsView, TableView, VerdictView } from './views'

const asResult = (r: Result | string): Result => (typeof r === 'string' ? { text: r } : r)

const message = (e: unknown) => (e instanceof Error && e.message ? e.message : 'This input could not be processed.')

interface State {
  result: Result | null
  error: string | null
  busy: boolean
}

/** Renders one Spec: main input, modes, fields, and the result in every view the Result asks for. */
export function ToolShell({ spec }: { spec: Spec }) {
  const [input, setInput] = useState('')
  const [modeId, setModeId] = useState(spec.modes?.[0]?.id ?? '')
  const [values, setValues] = useState<Values>(() => defaults(spec.fields))

  const mode = spec.modes?.find((m) => m.id === modeId)
  const run = mode?.run ?? spec.run
  const fields = useMemo(() => (spec.fields ?? []).filter((f) => !f.modes || f.modes.includes(modeId)), [spec.fields, modeId])
  const setValue = useCallback((id: string, v: Value) => setValues((prev) => ({ ...prev, [id]: v })), [])
  const needsInput = spec.input !== undefined
  const empty = needsInput && input.trim() === ''

  // Live tools recompute as the input changes. Tools with an action run on click and once on load.
  const live = useComputed<Result | null>(
    null,
    async () => {
      if (spec.action || empty || !run) return null
      return asResult(await run(input, values))
    },
    [input, modeId, values, empty],
  )

  const [manual, setManual] = useState<State>({ result: null, error: null, busy: false })
  const runs = useRef(0)
  const trigger = useCallback(async () => {
    if (!run || (needsInput && input.trim() === '')) return
    const ticket = ++runs.current
    setManual((s) => ({ ...s, busy: true, error: null }))
    try {
      const result = asResult(await run(input, values))
      if (ticket === runs.current) setManual({ result, error: null, busy: false })
    } catch (e) {
      if (ticket === runs.current) setManual({ result: null, error: message(e), busy: false })
    }
  }, [run, needsInput, input, values])

  // A result from another mode would be misleading.
  useEffect(() => {
    runs.current++
    setManual({ result: null, error: null, busy: false })
  }, [modeId])

  useEffect(() => {
    if (spec.action && !needsInput) void trigger()
    // Runs once on load; later runs come from the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const state: State = spec.action ? manual : { result: live.value, error: live.error, busy: live.busy }
  const result = empty && !spec.action ? null : state.result
  const outputLabel = mode?.outputLabel ?? spec.output?.label ?? 'Result'
  const filename = mode?.filename ?? spec.output?.filename ?? 'result.txt'

  const swap = () => {
    if (!result?.text) return
    setInput(result.text)
    const modes = spec.modes ?? []
    if (modes.length === 2) setModeId(modes.find((m) => m.id !== modeId)?.id ?? modeId)
  }

  const controls = (
    <>
      {spec.modes && spec.modes.length > 1 ? (
        <Segmented label="Mode" value={modeId} options={spec.modes.map((m) => ({ value: m.id, label: m.label }))} onChange={setModeId} />
      ) : null}
      {fields.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <FieldControl key={f.id} field={f} value={values[f.id] ?? f.default} onChange={(v) => setValue(f.id, v)} />
          ))}
        </div>
      ) : null}
      {spec.action ? (
        <Button type="button" onClick={() => void trigger()} disabled={state.busy || empty} className="gap-2">
          {needsInput ? <Play className="size-4" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
          {mode?.action ?? spec.action}
        </Button>
      ) : null}
    </>
  )

  return (
    <div className="space-y-6">
      <ToolPanel>
        {spec.input ? (
          <TextEditor
            label={mode?.inputLabel ?? spec.input.label}
            value={input}
            onChange={setInput}
            sample={mode?.sample ?? spec.input.sample}
            placeholder={spec.input.placeholder}
            mono={spec.input.mono}
            rows={spec.input.rows ?? 8}
            hint={spec.input.hint}
          />
        ) : null}
        {controls}
      </ToolPanel>

      <ToolPanel>
        <BusyNote busy={state.busy} progress={0} label="Working…" />
        {state.error && !state.busy ? (
          <ErrorNote title="Check the input" message={state.error} />
        ) : result ? (
          <ResultView
            result={result}
            label={outputLabel}
            filename={filename}
            rows={spec.output?.rows}
            mono={spec.output?.mono}
            onSwap={spec.swap ? swap : undefined}
          />
        ) : (
          <div className="flex min-h-32 items-center justify-center rounded-md bg-muted px-4 py-8 text-center text-sm text-pretty text-muted-foreground">
            {spec.output?.empty ?? (needsInput ? 'Type or paste text above, or try the example. The result appears here.' : 'Set the options and the result appears here.')}
          </div>
        )}
      </ToolPanel>
    </div>
  )
}

function ResultView({
  result,
  label,
  filename,
  rows,
  mono,
  onSwap,
}: {
  result: Result
  label: string
  filename: string
  rows?: number
  mono?: boolean
  onSwap?: () => void
}) {
  return (
    <div className="space-y-4">
      {result.verdict ? <VerdictView verdict={result.verdict} /> : null}
      {result.stats && result.stats.length > 0 ? <StatsView stats={result.stats} /> : null}
      {result.rows && result.rows.length > 0 ? <RowsView rows={result.rows} /> : null}
      {result.bars && result.bars.items.length > 0 ? <BarsView items={result.bars.items} summary={result.bars.summary} /> : null}
      {result.table && result.table.rows.length > 0 ? <TableView table={result.table} /> : null}
      {result.blocks?.map((b) => (
        <OutputBox key={b.label} label={b.label} value={b.text} filename={b.filename} rows={Math.min(14, Math.max(3, b.text.split('\n').length))} />
      ))}
      {result.text !== undefined ? (
        <OutputBox
          label={label}
          value={result.text}
          filename={filename}
          rows={rows ?? 8}
          mono={mono ?? true}
          empty="Nothing to show for this input."
          actions={
            onSwap ? (
              <Button type="button" variant="secondary" size="sm" className="gap-2" disabled={result.text === ''} onClick={onSwap}>
                <ArrowDownUp className="size-4" aria-hidden="true" />
                Use as input
              </Button>
            ) : null
          }
        />
      ) : null}
      {result.note ? <p className="text-xs text-muted-foreground text-pretty">{result.note}</p> : null}
    </div>
  )
}
