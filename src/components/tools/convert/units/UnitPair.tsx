/**
 * The island behind every unit pair page (mm-to-cm, psi-to-bar, mpg-to-l-per-100km …).
 * The page passes one `PairProps`; everything here is generic: two linked inputs, exact
 * decimal results, the working, a dual-scale visual, a reference table and a list mode.
 */
import { useId, useMemo, useState } from 'react'
import { ArrowLeftRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { Formula } from '@/components/shared/Formula'
import { AnimatedNumber } from '@/components/viz'
import {
  D,
  convert,
  formatValue,
  formulaFor,
  formulaSymbol,
  isDefinedAt,
  isSpecial,
  parseNumber,
  plainValue,
  splitParts,
  toBase,
  type Dec,
  type Precision,
  withUnit,
  type UnitLite,
} from '@/lib/convert/units/engine'
import type { PairProps } from '@/lib/convert/units/catalog'
import { DualScale } from './DualScale'

const PRECISIONS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Auto (10 digits)' },
  { value: '0', label: '0 decimals' },
  { value: '1', label: '1 decimal' },
  { value: '2', label: '2 decimals' },
  { value: '3', label: '3 decimals' },
  { value: '4', label: '4 decimals' },
  { value: '6', label: '6 decimals' },
  { value: '10', label: '10 decimals' },
]

type Side = 'left' | 'right'

/** Reads "12", "12 cm", "1,5", "1 1/2". Returns null for text that is not a number. */
function readInput(raw: string): Dec | null {
  const direct = parseNumber(raw)
  if (direct) return direct
  const stripped = raw.replace(/[\sa-zA-Zµ°′″'"/²³·()%]+$/u, '')
  return stripped && stripped !== raw ? parseNumber(stripped) : null
}

function checkValue(value: Dec, unit: UnitLite, other: UnitLite): string | null {
  if (unit.offset && toBase(value, unit).isNegative()) {
    return 'That is below absolute zero (0 K, −273.15 °C, −459.67 °F). Nothing can be colder.'
  }
  if (unit.offset === undefined && unit.id === 'k' && value.isNegative()) {
    return 'A temperature in kelvin cannot be negative: 0 K is absolute zero.'
  }
  if (!isDefinedAt(value, unit, other)) return `The conversion is undefined at 0 ${unit.symbol}.`
  if ((unit.inverse || other.inverse) && value.isNegative()) return 'Fuel economy cannot be negative.'
  return null
}

export default function UnitPair({ pair }: { pair: PairProps }) {
  const uid = useId()
  const [swapped, setSwapped] = useState(false)
  const [driver, setDriver] = useState<{ side: Side; text: string }>({ side: 'left', text: pair.dflt })
  const [precisionKey, setPrecisionKey] = useState('auto')
  const [binary, setBinary] = useState(false)
  const [list, setList] = useState('')

  const precision: Precision = precisionKey === 'auto' ? 'auto' : Number(precisionKey)
  const left = swapped ? pair.to : pair.from
  const right = swapped ? pair.from : pair.to
  const useBinary = pair.binary && binary

  const driverUnit = driver.side === 'left' ? left : right
  const otherUnit = driver.side === 'left' ? right : left
  const parsed = useMemo(() => {
    if (!driver.text.trim()) return { state: 'empty' as const }
    const value = readInput(driver.text)
    if (!value) return { state: 'error' as const, message: `“${driver.text.trim()}” is not a number. Try 12, 12.5, 1,5 or 1 1/2.` }
    const problem = checkValue(value, driverUnit, otherUnit)
    if (problem) return { state: 'error' as const, message: problem }
    return { state: 'ok' as const, value }
  }, [driver.text, driverUnit, otherUnit])

  /** The quantity in the page's source unit. */
  const source: Dec | null = parsed.state === 'ok' ? convert(parsed.value, driverUnit, pair.from, useBinary) : null
  const target: Dec | null = source ? convert(source, pair.from, pair.to, useBinary) : null
  const inUnit = (u: UnitLite) => (source ? convert(source, pair.from, u, useBinary) : null)

  const textFor = (side: Side): string => {
    if (driver.side === side) return driver.text
    const v = inUnit(side === 'left' ? left : right)
    if (!v) return ''
    const text = formatValue(v, precision)
    // Scientific values go into the box in a form the box can read back.
    if (text.includes('×')) return v.toSignificantDigits(10).toExponential().replace(/\.?0+e/, 'e')
    return text.replace(/,/g, '').replace('−', '-')
  }

  const swap = () => {
    setSwapped((s) => !s)
    setDriver((d) => ({ side: d.side === 'left' ? 'right' : 'left', text: d.text }))
  }

  const heroValue = inUnit(right)
  const heroText = heroValue ? `${formatValue(heroValue, precision)} ${right.symbol}` : '–'
  const leftValue = inUnit(left)
  const copyText = heroValue && leftValue ? `${formatValue(leftValue, precision)} ${left.symbol} = ${heroText}` : ''

  /* ---- working, always in the page direction ---- */
  const working = useMemo(() => {
    if (!source || !target) return null
    const f = formulaFor(pair.from, pair.to, useBinary)
    const a = formulaSymbol(pair.from)
    const b = formulaSymbol(pair.to)
    const vin = formatValue(source)
    const out = withUnit(formatValue(target, precision), pair.to)
    switch (f.kind) {
      case 'multiply':
        return [`${b} = ${a} × ${formatValue(f.k, 'auto', 14)}`, `= ${vin} × ${formatValue(f.k, 'auto', 14)}`, `= ${out}`]
      case 'divide':
        return [`${b} = ${a} ÷ ${formatValue(f.k, 'auto', 14)}`, `= ${vin} ÷ ${formatValue(f.k, 'auto', 14)}`, `= ${out}`]
      case 'reciprocal':
        return [`${b} = ${formatValue(f.k, 'auto', 12)} ÷ ${a}`, `= ${formatValue(f.k, 'auto', 12)} ÷ ${vin}`, `= ${out}`]
      case 'affine': {
        const sign = f.b.isNegative() ? '−' : '+'
        const k = formatValue(f.a, 'auto', 12)
        const c = formatValue(f.b.abs(), 'auto', 12)
        return [`${b} = ${a} × ${k} ${sign} ${c}`, `= ${vin} × ${k} ${sign} ${c}`, `= ${out}`]
      }
    }
  }, [source, target, pair.from, pair.to, useBinary, precision])

  const unitRatio = useMemo(() => {
    if (isSpecial(pair.from, pair.to)) return null
    return `${withUnit('1', pair.from)} = ${withUnit(formatValue(convert(new D(1), pair.from, pair.to, useBinary), 'auto', 12), pair.to)}`
  }, [pair.from, pair.to, useBinary])

  /* ---- reference table ---- */
  const rows = useMemo(
    () =>
      pair.table.map((n) => {
        const v = new D(n)
        const ok = isDefinedAt(v, pair.from, pair.to)
        return {
          key: String(n),
          from: formatValue(v, 'auto', 8),
          to: ok ? formatValue(convert(v, pair.from, pair.to, useBinary), 'auto', 8) : '–',
          plainFrom: plainValue(v),
          plainTo: ok ? plainValue(convert(v, pair.from, pair.to, useBinary), 10) : '',
        }
      }),
    [pair.table, pair.from, pair.to, useBinary],
  )
  const tableText = [`${pair.from.symbol}\t${pair.to.symbol}`, ...rows.map((r) => `${r.plainFrom}\t${r.plainTo}`)].join('\n')

  /* ---- list mode ---- */
  const listResult = useMemo(() => {
    if (!list.trim()) return null
    const lines = list.split(/\r?\n/).slice(0, 5000)
    let bad = 0
    const out = lines.map((line) => {
      if (!line.trim()) return ''
      const v = readInput(line)
      if (!v || checkValue(v, left, right)) {
        bad += 1
        return ''
      }
      return plainValue(convert(v, left, right, useBinary), 10)
    })
    return { text: out.join('\n'), bad, count: lines.filter((l) => l.trim()).length - bad }
  }, [list, left, right, useBinary])

  const mixedText = useMemo(() => {
    if (!pair.mixed || !source) return null
    const m = pair.mixed
    const v = convert(source, pair.from, m.unit)
    if (v.abs().gt(1e9)) return null
    return splitParts(v, m.steps, m.symbols, m.decimals)
  }, [pair.mixed, pair.from, source])

  return (
    <div className="space-y-6">
      <ToolPanel title={`${cap(left.plural)} to ${right.plural}`} description="Type in either box. The other box updates as you type.">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-l`}>
              {cap(left.plural)} ({left.symbol})
            </Label>
            <Input
              id={`${uid}-l`}
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              className="num text-lg"
              value={textFor('left')}
              onChange={(e) => setDriver({ side: 'left', text: e.target.value })}
            />
          </div>
          <div className="flex justify-center sm:pb-0.5">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={swap}
              aria-label={`Swap: convert ${right.plural} to ${left.plural}`}
              title="Swap direction"
            >
              <ArrowLeftRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-r`}>
              {cap(right.plural)} ({right.symbol})
            </Label>
            <Input
              id={`${uid}-r`}
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              className="num text-lg"
              value={textFor('right')}
              onChange={(e) => setDriver({ side: 'right', text: e.target.value })}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-p`}>Round to</Label>
            <Select value={precisionKey} onValueChange={setPrecisionKey}>
              <SelectTrigger id={`${uid}-p`} className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRECISIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {pair.binary ? (
            <div className="flex items-center gap-2 pb-2">
              <Switch id={`${uid}-b`} checked={binary} onCheckedChange={setBinary} />
              <Label htmlFor={`${uid}-b`}>Binary units (1 KB = 1,024 bytes)</Label>
            </div>
          ) : null}
          {copyText ? <CopyButton value={copyText} label="Copy result" /> : null}
          {pair.reverse ? (
            <a href={`/${pair.reverse.slug}`} className="pb-2 text-sm font-[560] text-foreground underline underline-offset-4">
              {pair.reverse.label}
            </a>
          ) : null}
        </div>
      </ToolPanel>

      {parsed.state === 'error' ? <ErrorNote message={parsed.message} /> : null}

      <div role="status" aria-live="polite" className="space-y-3">
        <ResultStat
          label={`${cap(left.plural)} in ${right.plural}`}
          value={
            heroValue ? (
              // Rolling digits do not wrap, so long results are plain text.
              heroText.length <= 14 ? <AnimatedNumber value={heroValue.toNumber()} format={() => heroText} /> : heroText
            ) : (
              '–'
            )
          }
          hint={
            parsed.state === 'empty'
              ? 'Enter a value to see the result.'
              : leftValue
                ? `${formatValue(leftValue, precision)} ${left.symbol}, converted exactly, then rounded for display.`
                : undefined
          }
          emphasis
        />
        {source && (mixedText || pair.also.length > 0) ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mixedText ? <ResultStat label={pair.mixed?.label} value={mixedText} /> : null}
            {pair.also.map((u) => {
              const v = inUnit(u)
              return v && v.isFinite() ? (
                <ResultStat key={u.id} label={cap(u.plural)} value={`${formatValue(v, 'auto', 8)} ${u.symbol}`} />
              ) : null
            })}
          </div>
        ) : null}
      </div>

      <ToolPanel title="The two scales" description={unitRatio ?? `Each tick on the top scale is in ${pair.from.plural}; each tick below it is in ${pair.to.plural}.`}>
        <DualScale from={pair.from} to={pair.to} value={source} binary={useBinary} />
      </ToolPanel>

      {working ? (
        <ToolPanel title="The working">
          <Formula caption="Exact decimal arithmetic at 40 significant digits. Only the last line is rounded.">{working.join('\n')}</Formula>
        </ToolPanel>
      ) : null}

      <ToolPanel title={`${cap(pair.from.plural)} to ${pair.to.plural} table`} footer={<CopyButton value={tableText} label="Copy table" />}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{cap(pair.from.plural)}</TableHead>
                <TableHead>{cap(pair.to.plural)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="num font-[560]">
                    {r.from} {pair.from.symbol}
                  </TableCell>
                  <TableCell className="num">
                    {r.to} {pair.to.symbol}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ToolPanel>

      <ToolPanel
        title="Convert a list"
        description={`Paste values in ${left.plural}, one per line. Lines that are not numbers stay blank, so the result pastes back into the same rows.`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-li`}>{cap(left.plural)}</Label>
            <Textarea
              id={`${uid}-li`}
              rows={6}
              spellCheck={false}
              className="num font-mono text-sm"
              placeholder={'1\n2.5\n10'}
              value={list}
              onChange={(e) => setList(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-lo`}>{cap(right.plural)}</Label>
            <Textarea id={`${uid}-lo`} rows={6} readOnly spellCheck={false} className="num font-mono text-sm" value={listResult?.text ?? ''} />
          </div>
        </div>
        {listResult ? (
          <div className="flex flex-wrap items-center gap-3">
            <CopyButton value={listResult.text} label="Copy results" />
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground" role="status">
              <Check className="size-4 text-foreground" aria-hidden="true" />
              {listResult.count} converted{listResult.bad > 0 ? `, ${listResult.bad} not read` : ''}
            </p>
          </div>
        ) : null}
      </ToolPanel>
    </div>
  )
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
