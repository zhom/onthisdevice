import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CopyButton } from '@/components/shared/CopyButton'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { cn } from '@/lib/utils'
import { DIMENSIONS } from './_dimensions'
import type { Dimension, DimensionId, Notation, Precision, UnitDef } from './_engine'
import {
  baseUnit,
  convert,
  describeFormula,
  displayValue,
  findUnit,
  formatValue,
  groupedUnits,
  isPartialNumber,
  parseNumber,
  unitNote,
} from './_engine'

type Side = 'from' | 'to'

export interface UnitConverterProps {
  dimension: DimensionId
  /** Default unit in the left field. */
  from: string
  /** Default unit in the right field. */
  to: string
  /** Default mode id (ingredient / decimal-vs-binary). */
  mode?: string
  /** Default starting value. */
  value?: string
}

const PRECISION_OPTIONS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: '0', label: '0 decimals' },
  { value: '1', label: '1 decimal' },
  { value: '2', label: '2 decimals' },
  { value: '3', label: '3 decimals' },
  { value: '4', label: '4 decimals' },
  { value: '5', label: '5 decimals' },
  { value: '6', label: '6 decimals' },
  { value: '8', label: '8 decimals' },
  { value: '10', label: '10 decimals' },
  { value: '12', label: '12 decimals' },
]

const NOTATION_OPTIONS: { value: Notation; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'decimal', label: 'Plain decimal' },
  { value: 'scientific', label: 'Scientific' },
]

function unitLabel(u: UnitDef): string {
  return u.name.includes(u.symbol) || u.symbol === u.name ? u.name : `${u.name} (${u.symbol})`
}

/** Every unit option, flattened but kept in group order with a heading row. */
function UnitSelect({
  id,
  label,
  dim,
  value,
  onChange,
}: {
  id: string
  label: string
  dim: Dimension
  value: string
  onChange: (id: string) => void
}) {
  const groups = useMemo(() => groupedUnits(dim), [dim])
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={label} className="w-full">
        <SelectValue placeholder="Choose a unit" />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {groups.map((g) => (
          <SelectGroup key={g.group}>
            <SelectLabel className="text-muted-foreground text-xs font-semibold">
              {g.group}
            </SelectLabel>
            {g.units.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {unitLabel(u)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

export default function UnitConverter({
  dimension,
  from,
  to,
  mode: modeProp,
  value: valueProp = '1',
}: UnitConverterProps) {
  const dim = DIMENSIONS[dimension]
  const defaultMode = modeProp ?? dim.modes?.options[0]?.id

  const [fromId, setFromId] = useState(from)
  const [toId, setToId] = useState(to)
  const [mode, setMode] = useState<string | undefined>(defaultMode)
  const [source, setSource] = useState<{ side: Side; text: string }>({
    side: 'from',
    text: valueProp,
  })
  const [precisionRaw, setPrecisionRaw] = useState('auto')
  const [notation, setNotation] = useState<Notation>('auto')
  const skipUrlSync = useRef(true)

  const uid = useId()
  const fromValueId = `${uid}-from-value`
  const toValueId = `${uid}-to-value`
  const fromUnitId = `${uid}-from-unit`
  const toUnitId = `${uid}-to-unit`
  const modeId = `${uid}-mode`

  /* ── deep links: /length-converter?from=cm&to=in&value=5 ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const f = findUnit(dim, params.get('from'))
    const t = findUnit(dim, params.get('to'))
    const m = params.get('mode')
    const v = params.get('value')
    if (f) setFromId(f.id)
    if (t) setToId(t.id)
    if (m && dim.modes?.options.some((o) => o.id === m)) setMode(m)
    // `side=to` marks a value typed in the To field, so the link restores it there.
    const side: Side = params.get('side') === 'to' ? 'to' : 'from'
    if (v && parseNumber(v) !== null) setSource({ side, text: v })
  }, [dim])

  const precision: Precision = precisionRaw === 'auto' ? 'auto' : Number(precisionRaw)

  const fromUnit = findUnit(dim, fromId) ?? dim.units[0]!
  const toUnit = findUnit(dim, toId) ?? dim.units[1] ?? dim.units[0]!

  /* ── the whole conversion is derived from one source field ── */
  const srcUnit = source.side === 'from' ? fromUnit : toUnit
  const dstUnit = source.side === 'from' ? toUnit : fromUnit
  const parsed = parseNumber(source.text)
  const result = parsed === null ? null : convert(parsed, srcUnit, dstUnit, dim, mode)

  const computedText = result && result.ok ? formatValue(result.value, precision, notation) : ''
  const fromText = source.side === 'from' ? source.text : computedText
  const toText = source.side === 'to' ? source.text : computedText

  const parseError =
    parsed === null && !isPartialNumber(source.text)
      ? 'That is not a number I can read. Try something like 12.5, 1,200 or 1 1/2.'
      : null
  const convertError = result && !result.ok ? result.error : null
  const error = parseError ?? convertError

  /* ── keep the address bar shareable ── */
  useEffect(() => {
    if (skipUrlSync.current) {
      skipUrlSync.current = false
      return
    }
    const params = new URLSearchParams()
    params.set('from', fromUnit.id)
    params.set('to', toUnit.id)
    if (mode) params.set('mode', mode)
    const v = source.text.trim()
    if (v && !(v === '1' && source.side === 'from')) params.set('value', v)
    if (v && source.side === 'to') params.set('side', 'to')
    const next = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState(null, '', next)
  }, [fromUnit.id, toUnit.id, mode, source])

  const swap = useCallback(() => {
    setFromId(toUnit.id)
    setToId(fromUnit.id)
    setSource((s) => ({ side: s.side === 'from' ? 'to' : 'from', text: s.text }))
  }, [fromUnit.id, toUnit.id])

  const reset = useCallback(() => {
    setFromId(from)
    setToId(to)
    setMode(defaultMode)
    setSource({ side: 'from', text: valueProp })
    setPrecisionRaw('auto')
    setNotation('auto')
  }, [from, to, defaultMode, valueProp])

  const applyPair = useCallback(
    (pairFrom: string, pairTo: string) => {
      setFromId(pairFrom)
      setToId(pairTo)
      setSource((s) => ({ side: 'from', text: s.side === 'from' ? s.text : '1' }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [],
  )

  const formula = describeFormula(srcUnit, dstUnit, mode)
  /** "5 × 0.3937007874 = 1.968503937 in" — the formula with your number in it. */
  const worked = (() => {
    if (parsed === null || !result || !result.ok) return null
    const eq = formula.text.indexOf('=')
    if (eq < 0) return null
    const rhs = formula.text.slice(eq + 1).trim()
    const substituted = rhs.split(srcUnit.symbol).join(displayValue(parsed, 'auto', notation))
    return `${substituted} = ${displayValue(result.value, precision, notation)} ${dstUnit.symbol}`
  })()
  const base = baseUnit(dim)
  const hasOffset = dim.units.some((u) => typeof u.offset === 'number' && u.offset !== 0)
  const activeMode = dim.modes?.options.find((o) => o.id === mode)

  const headline =
    result && result.ok && parsed !== null
      ? `${displayValue(parsed, 'auto', notation)} ${srcUnit.symbol} = ${displayValue(result.value, precision, notation)} ${dstUnit.symbol}`
      : null
  const copyValue = result && result.ok ? formatValue(result.value, precision, notation) : ''

  const chartValues = dim.chartValues ?? [1, 2, 5, 10, 25, 50, 100]

  return (
    <div className="space-y-6">
      <ToolPanel
        title={`${dim.name} converter`}
        description="Type in either box. The other one updates as you type."
      >
        <div className="space-y-5">
          {dim.modes ? (
            <div className="space-y-2">
              {dim.modes.options.length <= 3 ? (
                <span id={modeId} className="block text-sm leading-none font-medium">
                  {dim.modes.label}
                </span>
              ) : (
                <Label htmlFor={modeId}>{dim.modes.label}</Label>
              )}
              {dim.modes.options.length <= 3 ? (
                <Tabs value={mode ?? ''} onValueChange={setMode}>
                  <TabsList
                    aria-labelledby={modeId}
                    className="grid h-auto w-full"
                    style={{ gridTemplateColumns: `repeat(${dim.modes.options.length}, minmax(0, 1fr))` }}
                  >
                    {dim.modes.options.map((o) => (
                      <TabsTrigger
                        key={o.id}
                        value={o.id}
                        className="h-auto min-h-8 py-1.5 text-xs whitespace-normal sm:text-sm"
                      >
                        {o.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              ) : (
                <Select value={mode ?? ''} onValueChange={setMode}>
                  <SelectTrigger id={modeId} className="w-full">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {dim.modes.options.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {activeMode ? (
                <p className="text-muted-foreground text-xs leading-relaxed">{activeMode.note}</p>
              ) : null}
            </div>
          ) : null}

          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <div className="space-y-2">
              <Label htmlFor={fromValueId}>From</Label>
              <Input
                id={fromValueId}
                value={fromText}
                onChange={(e) => setSource({ side: 'from', text: e.target.value })}
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                placeholder="0"
                className="font-mono text-lg"
                aria-describedby={`${uid}-status`}
              />
              <UnitSelect
                id={fromUnitId}
                label="Convert from unit"
                dim={dim}
                value={fromUnit.id}
                onChange={(id) => setFromId(id)}
              />
            </div>

            <div className="flex justify-center pb-1 sm:pb-[2.75rem]">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={swap}
                aria-label={`Swap: convert ${toUnit.name} to ${fromUnit.name} instead`}
                title="Swap units"
              >
                <ArrowLeftRight className="size-4 rotate-90 sm:rotate-0" aria-hidden="true" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor={toValueId}>To</Label>
              <Input
                id={toValueId}
                value={toText}
                onChange={(e) => setSource({ side: 'to', text: e.target.value })}
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                placeholder="0"
                className="font-mono text-lg"
                aria-describedby={`${uid}-status`}
              />
              <UnitSelect
                id={toUnitId}
                label="Convert to unit"
                dim={dim}
                value={toUnit.id}
                onChange={(id) => setToId(id)}
              />
            </div>
          </div>

          <div id={`${uid}-status`} role="status" aria-live="polite" className="min-h-14">
            {error ? (
              <div className="bg-muted text-foreground flex items-start gap-2 rounded-lg p-3 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>{error}</p>
              </div>
            ) : headline ? (
              <div className="bg-muted flex flex-wrap items-center justify-between gap-3 rounded-lg p-3">
                <p className="text-base font-semibold break-all sm:text-lg">{headline}</p>
                <CopyButton value={copyValue} label="Copy result" />
              </div>
            ) : (
              <p className="text-muted-foreground p-3 text-sm">
                Enter a value in either field to see the conversion.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor={`${uid}-precision`}>Decimal places</Label>
              <Select value={precisionRaw} onValueChange={setPrecisionRaw}>
                <SelectTrigger id={`${uid}-precision`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRECISION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${uid}-notation`}>Number format</Label>
              <Select value={notation} onValueChange={(v) => setNotation(v as Notation)}>
                <SelectTrigger id={`${uid}-notation`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="ghost" onClick={reset} className="justify-self-start">
              <RotateCcw className="size-4" aria-hidden="true" />
              Reset
            </Button>
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed">
            Automatic formatting keeps up to 12 significant digits and switches to scientific
            notation only for numbers past 10¹⁸ or below 10⁻⁹. You can paste values with thousands
            separators, and fractions such as <code className="font-mono">3/4</code> or{' '}
            <code className="font-mono">1 1/2</code> are understood too.
          </p>
        </div>
      </ToolPanel>

      {/* ── formula ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Formula: {srcUnit.name} to {dstUnit.name}
          </CardTitle>
          <CardDescription>Exactly what the converter does with your number.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <p className="bg-muted w-max min-w-full rounded-lg p-3 font-mono text-sm">
              {formula.text}
            </p>
          </div>
          {formula.alt ? (
            <p className="text-muted-foreground font-mono text-xs">
              Same thing written another way: {formula.alt}
            </p>
          ) : null}
          {worked ? (
            <div className="overflow-x-auto">
              <p className="w-max min-w-full font-mono text-sm">
                <span className="text-muted-foreground">Your value: </span>
                {worked}
              </p>
            </div>
          ) : null}
          <div className="text-muted-foreground grid gap-1 text-xs sm:grid-cols-2">
            {unitNote(srcUnit, mode) ? (
              <p>
                <span className="text-foreground font-medium">{srcUnit.name}:</span>{' '}
                {unitNote(srcUnit, mode)}
              </p>
            ) : null}
            {unitNote(dstUnit, mode) ? (
              <p>
                <span className="text-foreground font-medium">{dstUnit.name}:</span>{' '}
                {unitNote(dstUnit, mode)}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ── common conversions ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Common {dim.name.toLowerCase()} conversions</CardTitle>
          <CardDescription>
            Tap a pair to load it into the converter. Each pair has its own share link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dim.common.map((pair) => {
              const a = findUnit(dim, pair.from)
              const b = findUnit(dim, pair.to)
              if (!a || !b) return null
              // Offset scales have no meaningful "1 unit =" ratio, so anchor at zero.
              const probe = hasOffset ? 0 : 1
              const one = convert(probe, a, b, dim, mode)
              const isActive = a.id === fromUnit.id && b.id === toUnit.id
              return (
                <li key={`${pair.from}-${pair.to}`}>
                  <a
                    href={`?from=${encodeURIComponent(a.id)}&to=${encodeURIComponent(b.id)}`}
                    onClick={(e) => {
                      e.preventDefault()
                      applyPair(a.id, b.id)
                    }}
                    className={cn(
                      'hover:bg-background focus-visible:ring-ring flex items-baseline justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
                      isActive && 'bg-background ring-2 ring-foreground',
                    )}
                  >
                    <span className="font-medium">
                      {a.symbol} → {b.symbol}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {probe} = {one.ok ? displayValue(one.value, 'auto', 'auto') : '–'}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      {/* ── conversion chart ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {fromUnit.name} to {toUnit.name} chart
          </CardTitle>
          <CardDescription>
            Rounded to the precision you picked above. Both directions are shown.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {([
            [fromUnit, toUnit],
            [toUnit, fromUnit],
          ] as const).map(([a, b], i) => (
            <div key={i} className="overflow-x-auto rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">{a.symbol}</TableHead>
                    <TableHead className="whitespace-nowrap">{b.symbol}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartValues.map((v) => {
                    const r = convert(v, a, b, dim, mode)
                    return (
                      <TableRow key={v}>
                        <TableCell className="font-mono whitespace-nowrap">
                          {displayValue(v, 'auto', 'auto')}
                        </TableCell>
                        <TableCell className="font-mono whitespace-nowrap">
                          {r.ok ? displayValue(r.value, precision, notation) : '–'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── full reference ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Every {dim.name.toLowerCase()} unit in this converter</CardTitle>
          <CardDescription>
            {hasOffset
              ? `Each unit expressed as a formula relative to ${base.name.toLowerCase()} (${base.symbol}), the scale used internally.`
              : `Each unit expressed in ${base.name.toLowerCase()} (${base.symbol}), the base used internally.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead className="whitespace-nowrap">Symbol</TableHead>
                  <TableHead className="whitespace-nowrap">
                    {hasOffset ? `Relation to ${base.symbol}` : `Value in ${base.symbol}`}
                  </TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dim.units.map((u) => {
                  const one = convert(1, u, base, dim, mode)
                  const rel = describeFormula(u, base, mode)
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.name}
                        <span className="text-muted-foreground block text-xs">{u.group}</span>
                      </TableCell>
                      <TableCell className="font-mono whitespace-nowrap">{u.symbol}</TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {hasOffset
                          ? rel.text
                          : one.ok
                            ? `1 ${u.symbol} = ${displayValue(one.value, 'auto', 'auto')} ${base.symbol}`
                            : '–'}
                      </TableCell>
                      <TableCell className="text-muted-foreground min-w-56 text-xs">
                        {unitNote(u, mode) ?? '–'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
