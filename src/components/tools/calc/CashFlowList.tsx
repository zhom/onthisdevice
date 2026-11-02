/**
 * Editable list of yearly cash flows for the NPV and IRR calculators.
 * Row 0 is now (year 0); each later row is the end of that year.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { numUpTo, toNum } from './mb-ui'

export interface FlowRow {
  id: number
  value: string
}

const MAX_ROWS = 41

/** "a + b − c" with the sign of each term outside the number. */
function sumText(terms: { v: number; text: (abs: number) => string }[], lead: boolean): string {
  return terms.map(({ v, text }, k) => (k === 0 && lead ? text(v) : `${v < 0 ? '−' : '+'} ${text(Math.abs(v))}`)).join(' ')
}

/** Terms three to a line, the first line starting "NPV = ". */
function npvLines(terms: { v: number; text: (abs: number) => string }[]): string[] {
  const lines: string[] = []
  for (let k = 0; k < terms.length; k += 3) {
    lines.push(k === 0 ? `NPV = ${sumText(terms.slice(0, 3), true)}` : `      ${sumText(terms.slice(k, k + 3), false)}`)
  }
  return lines
}

/** Working lines for NPV = Σ CFₜ ÷ (1 + r)^t: the terms, then the present value of each flow. */
export function npvSteps(flows: number[], presentValues: number[], ratePct: number, fmt: (n: number) => string): string[] {
  const g = numUpTo(1 + ratePct / 100, 6)
  return [
    ...npvLines(flows.map((v, t) => ({ v, text: (a: number) => (t === 0 ? fmt(a) : `${fmt(a)} ÷ ${g}^${t}`) }))),
    ...npvLines(presentValues.map((v) => ({ v, text: fmt }))),
  ]
}

/** Rows with stable ids, and the parsed numbers. */
export function useCashFlows(initial: number[]) {
  const [rows, setRows] = useState<FlowRow[]>(() => initial.map((v, i) => ({ id: i, value: String(v) })))
  const flows = useMemo(() => rows.map((r) => toNum(r.value)), [rows])
  return { rows, setRows, flows }
}

export function CashFlowList({
  id,
  rows,
  onChange,
  symbol,
}: {
  id: string
  rows: FlowRow[]
  onChange: (rows: FlowRow[]) => void
  symbol: string
}) {
  const [focusId, setFocusId] = useState<number | null>(null)
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    if (focusId === null) return
    listRef.current?.querySelector<HTMLInputElement>(`#${id}-${focusId}`)?.focus()
    setFocusId(null)
  }, [focusId, id])

  const set = (rowId: number, value: string) => onChange(rows.map((r) => (r.id === rowId ? { ...r, value } : r)))
  const remove = (rowId: number) => onChange(rows.filter((r) => r.id !== rowId))
  const add = () => {
    const next = Math.max(-1, ...rows.map((r) => r.id)) + 1
    const last = rows[rows.length - 1]?.value ?? '0'
    onChange([...rows, { id: next, value: toNum(last) > 0 ? last : '0' }])
    setFocusId(next)
  }
  const pad = symbol.length > 2 ? 'pl-12' : symbol.length > 1 ? 'pl-10' : 'pl-7'

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Cash flows</legend>
      <p className="text-xs text-muted-foreground">Year 0 is today. Enter money you pay out as a negative number.</p>
      <ol ref={listRef} className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.id} className="grid grid-cols-[3.75rem_minmax(0,1fr)_2.5rem] items-center gap-2">
            <Label htmlFor={`${id}-${r.id}`} className="text-sm tabular-nums text-muted-foreground">
              Year {i}
            </Label>
            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {symbol}
              </span>
              <Input
                id={`${id}-${r.id}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                value={r.value}
                onChange={(e) => set(r.id, e.target.value)}
                className={`tabular-nums ${pad}`}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hover:bg-background"
              aria-label={`Remove year ${i}`}
              disabled={rows.length <= 2}
              onClick={() => remove(r.id)}
            >
              <X aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" size="sm" onClick={add} disabled={rows.length >= MAX_ROWS}>
        <Plus aria-hidden="true" />
        Add year {rows.length}
      </Button>
    </fieldset>
  )
}
