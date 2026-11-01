import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { ArrowRightLeft, Check, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula } from '@/components/shared/Formula'
import { ErrorNote } from '@/components/shared/ErrorNote'
import {
  D,
  UNITS,
  belowAbsoluteZero,
  convert,
  convertBatch,
  formatComposite,
  formatFraction,
  formatValue,
  parseError,
  parseQuantity,
  ratio,
  type Dec,
  type Precision,
  type UnitId,
} from './units-life-engine'
import { getPairSpec, type ExtraReadout, type PairSpec } from './units-life-pairs'

interface Props {
  /** Key into PAIR_SPECS — the page slug. */
  spec: string
}

type Side = 'left' | 'right'

const PRECISION_OPTIONS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '0', label: '0 decimals' },
  { value: '1', label: '1 decimal' },
  { value: '2', label: '2 decimals' },
  { value: '3', label: '3 decimals' },
  { value: '4', label: '4 decimals' },
  { value: '6', label: '6 decimals' },
  { value: '8', label: '8 decimals' },
]

const TONE_ICON: Record<'info' | 'ok' | 'warn' | 'bad', LucideIcon> = {
  info: Info,
  ok: CircleCheck,
  warn: TriangleAlert,
  bad: TriangleAlert,
}

function extraValue(canonical: Dec, spec: PairSpec, extra: ExtraReadout, precision: Precision): string {
  switch (extra.kind) {
    case 'fraction':
      return `${formatFraction(convert(canonical, spec.from, extra.unit), extra.denominator)} ${
        UNITS[extra.unit].symbol
      }`
    case 'composite':
      return formatComposite(convert(canonical, spec.from, extra.major), extra.major, extra.minor, extra.decimals)
    case 'unit':
      return `${formatValue(convert(canonical, spec.from, extra.unit), precision)} ${UNITS[extra.unit].symbol}`
  }
}

export default function UnitsLifePairConverter({ spec: specKey }: Props) {
  const spec = useMemo(() => getPairSpec(specKey), [specKey])
  const uid = useId()

  const [swapped, setSwapped] = useState(false)
  const [driver, setDriver] = useState<{ side: Side; text: string }>({
    side: 'left',
    text: spec.defaultInput,
  })
  const [precisionKey, setPrecisionKey] = useState<string>(String(spec.defaultPrecision))
  const [batchText, setBatchText] = useState('')

  const precision: Precision = precisionKey === 'auto' ? 'auto' : Number(precisionKey)

  const leftUnit: UnitId = swapped ? spec.to : spec.from
  const rightUnit: UnitId = swapped ? spec.from : spec.to
  const driverUnit: UnitId = driver.side === 'left' ? leftUnit : rightUnit

  const parsed = useMemo(() => {
    if (!driver.text.trim()) return { state: 'empty' as const }
    const result = parseQuantity(driver.text, driverUnit)
    if (!result) return { state: 'error' as const, message: parseError(driver.text, driverUnit) }
    if (belowAbsoluteZero(result.value, driverUnit)) {
      return {
        state: 'error' as const,
        message: 'That is below absolute zero (0 K = −273.15 °C = −459.67 °F), the coldest possible temperature.',
      }
    }
    return { state: 'ok' as const, ...result }
  }, [driver.text, driverUnit])

  /** The quantity, always expressed in the page's canonical `spec.from` unit. */
  const canonical: Dec | null =
    parsed.state === 'ok' ? convert(parsed.value, driverUnit, spec.from) : null

  const textFor = useCallback(
    (side: Side): string => {
      if (driver.side === side) return driver.text
      if (!canonical) return ''
      const unit = side === 'left' ? leftUnit : rightUnit
      return formatValue(convert(canonical, spec.from, unit), precision)
    },
    [canonical, driver, leftUnit, rightUnit, precision, spec.from],
  )

  const leftText = textFor('left')
  const rightText = textFor('right')

  const swap = useCallback(() => {
    setSwapped((s) => !s)
    setDriver((d) => ({ side: d.side === 'left' ? 'right' : 'left', text: d.text }))
  }, [])

  /* The slider always drives the value in the page's source unit. */
  const sliderValue = useMemo(() => {
    if (!spec.slider || !canonical) return spec.slider ? spec.slider.min : 0
    const n = canonical.toNumber()
    return Math.min(spec.slider.max, Math.max(spec.slider.min, n))
  }, [canonical, spec.slider])

  const onSlider = useCallback(
    (values: number[]) => {
      const v = values[0]
      const side: Side = leftUnit === spec.from ? 'left' : 'right'
      setDriver({ side, text: String(v) })
    },
    [leftUnit, spec.from],
  )

  /* ---- formula, always rendered in the page's headline direction ---- */
  const formulaLines = useMemo(() => {
    if (!canonical) return null
    const target = convert(canonical, spec.from, spec.to)
    const inText = formatValue(canonical, 'auto')
    const outText = formatValue(target, precision)
    const fromSym = UNITS[spec.from].symbol
    const toSym = UNITS[spec.to].symbol
    if (spec.formula.kind === 'affine') {
      return [spec.formula.expression, ...spec.formula.steps(inText), `= ${outText} ${toSym}`]
    }
    const op = spec.formula.kind === 'multiply' ? '×' : '÷'
    const perOne = formatValue(ratio(spec.from, spec.to), 'auto')
    return [
      `${UNITS[spec.to].plural} = ${UNITS[spec.from].plural} ${op} ${spec.formula.operand}`,
      `= ${inText} ${op} ${spec.formula.operand}`,
      `= ${outText} ${toSym}`,
      ``,
      `1 ${fromSym} = ${perOne} ${toSym}`,
    ]
  }, [canonical, precision, spec])

  /* ---- reference table ---- */
  const extraColumn = useMemo(
    () => spec.extras.find((e) => e.kind === 'fraction' || e.kind === 'composite'),
    [spec.extras],
  )

  const tableRows = useMemo(() => {
    return spec.tableValues.map((v) => {
      const source = new D(v)
      const target = convert(source, spec.from, spec.to)
      return {
        source: formatValue(source, 'auto'),
        target: formatValue(target, precision === 'auto' ? 'auto' : Math.min(Number(precision), 4)),
        extra: extraColumn ? extraValue(source, spec, extraColumn, 'auto') : null,
      }
    })
  }, [extraColumn, precision, spec])

  /* ---- batch ---- */
  const batch = useMemo(() => {
    if (!batchText.trim()) return null
    return convertBatch(batchText, leftUnit, rightUnit, precision)
  }, [batchText, leftUnit, rightUnit, precision])

  const batchOutput = useMemo(() => {
    if (!batch) return ''
    return batch.rows.map((r) => (r.output === null ? '' : r.output)).join('\n')
  }, [batch])

  const batchFailures = batch ? batch.rows.filter((r) => r.output === null).length : 0

  /* ---- fever-style interpretation bands ---- */
  const band = useMemo(() => {
    if (!spec.bands || !canonical) return null
    const n = canonical.toNumber()
    return spec.bands.find((b) => n < b.max) ?? spec.bands[spec.bands.length - 1]
  }, [canonical, spec.bands])
  const BandIcon = band ? TONE_ICON[band.tone] : null

  /* Keep the driver text in sync if the spec key ever changes (it does not in
     practice, but React does not know that and the island is reused in dev). */
  useEffect(() => {
    setDriver({ side: 'left', text: spec.defaultInput })
    setSwapped(false)
    setPrecisionKey(String(spec.defaultPrecision))
  }, [spec])

  const heroValue =
    canonical === null
      ? '–'
      : `${formatValue(convert(canonical, spec.from, rightUnit), precision)} ${UNITS[rightUnit].symbol}`

  const copyText =
    canonical === null
      ? ''
      : `${formatValue(convert(canonical, spec.from, leftUnit), precision)} ${
          UNITS[leftUnit].symbol
        } = ${formatValue(convert(canonical, spec.from, rightUnit), precision)} ${UNITS[rightUnit].symbol}`

  return (
    <div className="space-y-6">
      <Tabs defaultValue="convert" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="convert" className="flex-1 sm:flex-none">
            Convert
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex-1 sm:flex-none">
            Batch (paste a column)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="convert" className="mt-4 space-y-6">
          <ToolPanel
            title={`${UNITS[leftUnit].plural} to ${UNITS[rightUnit].plural}`}
            description="Type in either box. The other one updates as you type."
          >
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-left`}>
                  {swapped ? spec.toLabel : spec.fromLabel} ({UNITS[leftUnit].symbol})
                </Label>
                <Input
                  id={`${uid}-left`}
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  className="text-lg tabular-nums"
                  placeholder={spec.placeholder}
                  value={leftText}
                  onChange={(e) => setDriver({ side: 'left', text: e.target.value })}
                />
              </div>

              <div className="flex justify-center sm:pb-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={swap}
                  aria-label={`Swap direction: convert ${UNITS[rightUnit].plural} to ${UNITS[leftUnit].plural} instead`}
                  title="Swap direction"
                >
                  <ArrowRightLeft className="size-4" aria-hidden="true" />
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-right`}>
                  {swapped ? spec.fromLabel : spec.toLabel} ({UNITS[rightUnit].symbol})
                </Label>
                <Input
                  id={`${uid}-right`}
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  className="text-lg tabular-nums"
                  placeholder="result"
                  value={rightText}
                  onChange={(e) => setDriver({ side: 'right', text: e.target.value })}
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground text-pretty">{spec.inputHint}</p>

            {spec.slider ? (
              <div className="space-y-2 pt-1">
                <div className="text-sm font-medium text-foreground">
                  Drag through the {UNITS[spec.from].plural} scale
                </div>
                <Slider
                  min={spec.slider.min}
                  max={spec.slider.max}
                  step={spec.slider.step}
                  value={[sliderValue]}
                  onValueChange={onSlider}
                  aria-label={`${UNITS[spec.from].name} value`}
                />
                <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
                  {spec.slider.marks.map((m) => (
                    <span key={m}>
                      {m}
                      {UNITS[spec.from].symbol}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-end gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-precision`} className="text-sm">
                  Round the result to
                </Label>
                <Select value={precisionKey} onValueChange={setPrecisionKey}>
                  <SelectTrigger id={`${uid}-precision`} className="w-[150px]">
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
              {copyText ? <CopyButton value={copyText} label="Copy result" className="mb-0.5" /> : null}
              {spec.reverseSlug ? (
                <a
                  href={`/${spec.reverseSlug}`}
                  className="mb-2.5 text-sm font-medium text-primary underline decoration-muted-foreground underline-offset-4 hover:decoration-primary"
                >
                  {spec.reverseLabel ?? 'Convert the other way'}
                </a>
              ) : null}
            </div>
          </ToolPanel>

          {parsed.state === 'error' ? <ErrorNote title="Check that value" message={parsed.message} /> : null}

          {parsed.state === 'ok' && parsed.interpretedAs ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
              <span>
                Read as <strong className="text-foreground">{parsed.interpretedAs}</strong>.
              </span>
            </p>
          ) : null}

          <div role="status" aria-live="polite" className="space-y-4">
            <ResultStat
              label={`${UNITS[leftUnit].plural} → ${UNITS[rightUnit].plural}`}
              value={heroValue}
              hint={
                canonical === null
                  ? 'Enter a value above to see the conversion.'
                  : `${formatValue(convert(canonical, spec.from, leftUnit), precision)} ${
                      UNITS[leftUnit].symbol
                    } converted exactly, then rounded for display.`
              }
              emphasis
            />

            {canonical !== null && spec.extras.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {spec.extras.map((extra) => (
                  <ResultStat
                    key={`${extra.kind}-${extra.label}`}
                    label={extra.label}
                    value={extraValue(canonical, spec, extra, precision)}
                    hint={extra.hint}
                  />
                ))}
              </div>
            ) : null}

            {band ? (
              <div className="rounded-lg bg-muted p-4 text-foreground">
                <div className="text-xs font-semibold">
                  {spec.bandsTitle ?? 'Interpretation'}
                </div>
                <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                  {BandIcon ? <BandIcon className="size-5 shrink-0" aria-hidden="true" /> : null}
                  {band.label}
                </div>
                <p className="mt-1 text-sm text-muted-foreground text-pretty">{band.note}</p>
              </div>
            ) : null}
          </div>

          {formulaLines ? (
            <ToolPanel title="The working" description="The same arithmetic, written out with your number in it.">
              <Formula caption="Every step runs in this page with decimal arithmetic, so there is no floating-point drift.">
                {formulaLines.join('\n')}
              </Formula>
            </ToolPanel>
          ) : null}

          <ToolPanel title={spec.tableTitle} description={spec.tableCaption}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{UNITS[spec.from].plural}</TableHead>
                    <TableHead>{UNITS[spec.to].plural}</TableHead>
                    {extraColumn ? <TableHead>{extraColumn.label}</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row) => (
                    <TableRow key={row.source}>
                      <TableCell className="tabular-nums font-medium">
                        {row.source} {UNITS[spec.from].symbol}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.target} {UNITS[spec.to].symbol}
                      </TableCell>
                      {extraColumn ? (
                        <TableCell className="tabular-nums text-muted-foreground">{row.extra}</TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ToolPanel>
        </TabsContent>

        <TabsContent value="batch" className="mt-4 space-y-4">
          <ToolPanel
            title="Convert a whole column"
            description={`Paste values in ${UNITS[leftUnit].plural}, one per line, from a spreadsheet column. Blank lines are kept, so the result pastes back into the same rows.`}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-batch-in`}>Input ({UNITS[leftUnit].symbol})</Label>
                <Textarea
                  id={`${uid}-batch-in`}
                  rows={12}
                  spellCheck={false}
                  className="font-mono text-sm"
                  placeholder={`12\n15.5\n20`}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-batch-out`}>Output ({UNITS[rightUnit].symbol})</Label>
                <Textarea
                  id={`${uid}-batch-out`}
                  rows={12}
                  readOnly
                  spellCheck={false}
                  className="font-mono text-sm"
                  placeholder="Converted values appear here."
                  value={batchOutput}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <CopyButton value={batchOutput} label="Copy column" />
              <Button type="button" variant="ghost" size="sm" onClick={() => setBatchText('')}>
                Clear
              </Button>
              {batch ? (
                <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                  {batch.rows.filter((r) => r.output).length} converted
                  {batchFailures > 0 ? ` · ${batchFailures} line(s) could not be read` : ''}
                  {batch.truncated ? ' · only the first 5,000 lines were processed' : ''}
                </p>
              ) : null}
            </div>

            {batchFailures > 0 && batch ? (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="flex items-start gap-2">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    Skipped:{' '}
                    {batch.rows
                      .filter((r) => r.output === null)
                      .slice(0, 5)
                      .map((r) => `“${r.input.trim()}”`)
                      .join(', ')}
                    {batchFailures > 5 ? ` and ${batchFailures - 5} more` : ''}. Those lines are left
                    blank in the output so the columns still line up.
                  </span>
                </p>
              </div>
            ) : null}
          </ToolPanel>
        </TabsContent>
      </Tabs>
    </div>
  )
}
