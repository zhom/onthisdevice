import { useId, useMemo, useState } from 'react'
import { Info, Ruler } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { cn } from '@/lib/utils'
import {
  CLOTHING_MEN,
  CLOTHING_WOMEN,
  CREDIT_CARD_WIDTH_MM,
  JEANS,
  RING_SIZES,
  SHOE_KIDS,
  SHOE_MEN,
  SHOE_WIDTHS,
  SHOE_WOMEN,
  type RingRow,
  type ShoeRow,
} from './units-life-size-data'

export type SizeMode = 'shoe' | 'clothing' | 'ring'

interface Props {
  mode: SizeMode
}

function readNum(raw: string): number | null {
  const s = raw.trim().replace(/,/g, '')
  const m = /-?\d+(?:\.\d+)?/.exec(s)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

/**
 * Nearest row to `value`, or null when the value is off the chart (further
 * out than one average step past the first or last row).
 */
function nearestBy<T>(rows: T[], value: number, key: (row: T) => number): T | null {
  const keys = rows.map(key).filter(Number.isFinite)
  const lo = Math.min(...keys)
  const hi = Math.max(...keys)
  const step = keys.length > 1 ? (hi - lo) / (keys.length - 1) : 1
  if (value < lo - step || value > hi + step) return null
  return rows.reduce((best, row) =>
    Math.abs(key(row) - value) < Math.abs(key(best) - value) ? row : best,
  )
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString()
}

/* ================================================================== *
 * Shoes
 * ================================================================== */

type ShoeGroup = 'men' | 'women' | 'kids'
type ShoeSystem = 'cm' | 'in' | 'us' | 'uk' | 'eu'

const SHOE_TABLES: Record<ShoeGroup, ShoeRow[]> = {
  men: SHOE_MEN,
  women: SHOE_WOMEN,
  kids: SHOE_KIDS,
}

function ShoeConverter() {
  const uid = useId()
  const [group, setGroup] = useState<ShoeGroup>('men')
  const [system, setSystem] = useState<ShoeSystem>('cm')
  const [text, setText] = useState('26.5')

  const rows = SHOE_TABLES[group]
  const n = readNum(text)
  const typed = text.trim().toLowerCase().replace(/\s+/g, '')

  const match = useMemo(() => {
    if (!typed) return null
    if (system === 'us' || system === 'uk' || system === 'eu') {
      const exact = rows.find((r) => r[system].toLowerCase().replace(/\s+/g, '') === typed)
      if (exact) return exact
      if (n === null) return null
      return nearestBy(rows, n, (r) => parseFloat(r[system]))
    }
    if (n === null) return null
    const cm = system === 'in' ? n * 2.54 : n
    return nearestBy(rows, cm, (r) => r.cm)
  }, [n, rows, system, typed])

  const copy = match
    ? `Foot ${match.cm} cm: US ${match.us}, UK ${match.uk}, EU ${match.eu}, JP/Mondo ${match.cm}`
    : ''

  return (
    <div className="space-y-6">
      <ToolPanel
        title="Find your size"
        description="Foot length is the only measurement that converts reliably. Start there if you can."
      >
        <Tabs value={group} onValueChange={(v) => setGroup(v as ShoeGroup)}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="men" className="flex-1 sm:flex-none">
              Men
            </TabsTrigger>
            <TabsTrigger value="women" className="flex-1 sm:flex-none">
              Women
            </TabsTrigger>
            <TabsTrigger value="kids" className="flex-1 sm:flex-none">
              Kids
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-system`}>I know my…</Label>
            <Select value={system} onValueChange={(v) => setSystem(v as ShoeSystem)}>
              <SelectTrigger id={`${uid}-system`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cm">Foot length in centimetres (best)</SelectItem>
                <SelectItem value="in">Foot length in inches</SelectItem>
                <SelectItem value="us">US size</SelectItem>
                <SelectItem value="uk">UK size</SelectItem>
                <SelectItem value="eu">EU size</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-value`}>Value</Label>
            <Input
              id={`${uid}-value`}
              autoComplete="off"
              className="text-lg tabular-nums"
              placeholder={system === 'cm' ? '26.5' : system === 'in' ? '10.4' : '9'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              {system === 'cm' || system === 'in'
                ? 'Stand on paper against a wall, mark your longest toe, measure heel to mark. Do both feet and use the longer one.'
                : 'Half sizes are fine: type 9.5.'}
            </p>
          </div>
        </div>
      </ToolPanel>

      {text.trim() && !match ? (
        <ErrorNote
          title="No size matched"
          message={
            n === null
              ? `We could not read “${text.trim()}”. Try a number such as 26.5, 9 or 42.`
              : `“${text.trim()}” is outside this size chart. Check the unit and the Men / Women / Kids tab.`
          }
        />
      ) : null}

      <div role="status" aria-live="polite" className="space-y-4">
        {match ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ResultStat label="US" value={match.us} emphasis />
              <ResultStat label="UK" value={match.uk} emphasis />
              <ResultStat label="EU" value={match.eu} emphasis />
              <ResultStat label="Japan (cm)" value={`${match.cm}`} hint={`Japanese sizes are the foot length in centimetres. Mondopoint is the same in millimetres: ${Math.round(match.cm * 10)}.`} emphasis />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat
                label="Foot length"
                value={`${match.cm} cm`}
                hint={`${round1(match.cm / 2.54)} inches. This is the measurement all four labels are derived from.`}
              />
              <ResultStat
                label="Recommended shoe interior"
                value={`${round1(match.cm + 1)}–${round1(match.cm + 1.5)} cm`}
                hint="Leave 10–15 mm of toe room. Less than that and you will lose a toenail on a long walk."
              />
            </div>
            <CopyButton value={copy} label="Copy all sizes" />
          </>
        ) : (
          <p className="rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
            Enter a foot length or a size you already know.
          </p>
        )}
      </div>

      <ToolPanel
        title={`${group === 'men' ? "Men's" : group === 'women' ? "Women's" : "Children's"} shoe size chart`}
        description="Anchored to foot length, which is what Japanese sizing (cm) and Mondopoint (mm) already use."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Foot length (cm)</TableHead>
                <TableHead>Inches</TableHead>
                <TableHead>US</TableHead>
                <TableHead>UK</TableHead>
                <TableHead>EU</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.cm}-${r.us}`} className={cn(match === r && 'bg-background font-semibold')}>
                  <TableCell className="font-medium tabular-nums">{r.cm}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{round1(r.cm / 2.54)}</TableCell>
                  <TableCell className="tabular-nums">{r.us}</TableCell>
                  <TableCell className="tabular-nums">{r.uk}</TableCell>
                  <TableCell className="tabular-nums">{r.eu}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ToolPanel>

      <ToolPanel title="Width letters" description="The second half of a fit, and the half most size charts ignore.">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Means</TableHead>
                <TableHead>Usually</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SHOE_WIDTHS.map((w) => (
                <TableRow key={w.code}>
                  <TableCell className="font-medium">{w.code}</TableCell>
                  <TableCell>{w.meaning}</TableCell>
                  <TableCell className="text-muted-foreground">{w.who}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ToolPanel>
    </div>
  )
}

/* ================================================================== *
 * Clothing
 * ================================================================== */

type ClothingGroup = 'women' | 'men' | 'jeans'
type Measure = 'bust' | 'waist' | 'hip'

function ClothingConverter() {
  const uid = useId()
  const [group, setGroup] = useState<ClothingGroup>('women')
  const [measure, setMeasure] = useState<Measure>('bust')
  const [unit, setUnit] = useState<'cm' | 'in'>('cm')
  const [text, setText] = useState('90')

  const n = readNum(text)
  const cm = n === null ? null : unit === 'in' ? n * 2.54 : n
  // Men's charts have chest and waist only; a hip choice from the women's tab falls back to chest.
  const measureShown: Measure = group === 'men' && measure === 'hip' ? 'bust' : measure

  const womenMatch = useMemo(() => {
    if (cm === null || group !== 'women') return null
    return nearestBy(CLOTHING_WOMEN, cm, (r) =>
      measure === 'bust' ? r.bust : measure === 'waist' ? r.waist : r.hip,
    )
  }, [cm, group, measure])

  const menMatch = useMemo(() => {
    if (cm === null || group !== 'men') return null
    return nearestBy(CLOTHING_MEN, cm, (r) => (measure === 'waist' ? r.waist : r.chest))
  }, [cm, group, measure])

  const jeansMatch = useMemo(() => {
    if (cm === null || group !== 'jeans') return null
    return nearestBy(JEANS, cm, (r) => r.waistCm)
  }, [cm, group])

  const measureLabel =
    group === 'men' ? (measure === 'waist' ? 'Waist' : 'Chest') : measure === 'bust' ? 'Bust' : measure === 'waist' ? 'Waist' : 'Hip'

  return (
    <div className="space-y-6">
      <ToolPanel
        title="Convert by body measurement, not by label"
        description="Labels differ by brand and by country. A tape measure does not."
      >
        <Tabs value={group} onValueChange={(v) => setGroup(v as ClothingGroup)}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="women" className="flex-1 sm:flex-none">
              Women
            </TabsTrigger>
            <TabsTrigger value="men" className="flex-1 sm:flex-none">
              Men
            </TabsTrigger>
            <TabsTrigger value="jeans" className="flex-1 sm:flex-none">
              Jeans
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-4 sm:grid-cols-3">
          {group !== 'jeans' ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-measure`}>Measurement</Label>
              <Select value={measureShown} onValueChange={(v) => setMeasure(v as Measure)}>
                <SelectTrigger id={`${uid}-measure`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bust">{group === 'men' ? 'Chest' : 'Bust'}</SelectItem>
                  <SelectItem value="waist">Waist</SelectItem>
                  {group === 'women' ? <SelectItem value="hip">Hip</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-value`}>{group === 'jeans' ? 'Waist' : measureLabel}</Label>
            <Input
              id={`${uid}-value`}
              inputMode="decimal"
              autoComplete="off"
              className="text-lg tabular-nums"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-unit`}>Units</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as 'cm' | 'in')}>
              <SelectTrigger id={`${uid}-unit`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cm">Centimetres</SelectItem>
                <SelectItem value="in">Inches</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-sm text-muted-foreground text-pretty">
          Measure over light clothing, tape level and snug but not pulled tight. Bust and chest go
          around the fullest point; waist goes around the narrowest, usually just above the navel.
        </p>
      </ToolPanel>

      {text.trim() && cm === null ? (
        <ErrorNote title="Check that measurement" message={`“${text.trim()}” isn’t a number. Try 90 or 36.`} />
      ) : null}
      {cm !== null && !(group === 'women' ? womenMatch : group === 'men' ? menMatch : jeansMatch) ? (
        <ErrorNote title="Off the chart" message={`“${text.trim()} ${unit}” is outside this size chart. Check the unit.`} />
      ) : null}

      <div role="status" aria-live="polite" className="space-y-4">
        {womenMatch ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ResultStat label="US" value={womenMatch.us} emphasis />
              <ResultStat label="UK / AU" value={womenMatch.uk} emphasis />
              <ResultStat label="EU (DE)" value={womenMatch.de} emphasis />
              <ResultStat label="Letter" value={womenMatch.letter} emphasis />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ResultStat label="France" value={womenMatch.fr} />
              <ResultStat label="Italy" value={womenMatch.it} />
              <ResultStat label="Japan" value={womenMatch.jp} />
              <ResultStat
                label="Chart measurements"
                value={`${womenMatch.bust}/${womenMatch.waist}/${womenMatch.hip}`}
                hint="Bust / waist / hip in centimetres for this row."
              />
            </div>
            <CopyButton
              value={`US ${womenMatch.us} · UK ${womenMatch.uk} · EU ${womenMatch.de} · FR ${womenMatch.fr} · IT ${womenMatch.it} · JP ${womenMatch.jp} · ${womenMatch.letter}`}
              label="Copy all sizes"
            />
          </>
        ) : null}

        {menMatch ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ResultStat label="Letter" value={menMatch.letter} emphasis />
              <ResultStat label="US / UK" value={menMatch.usUk} emphasis />
              <ResultStat label="EU" value={menMatch.eu} emphasis />
              <ResultStat label="Collar" value={`${menMatch.neck} cm`} hint={`${round1(menMatch.neck / 2.54)} in shirt collar size.`} emphasis />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat label="Chart chest" value={`${menMatch.chest} cm`} hint={`${round1(menMatch.chest / 2.54)} inches.`} />
              <ResultStat label="Chart waist" value={`${menMatch.waist} cm`} hint={`${round1(menMatch.waist / 2.54)} inches.`} />
            </div>
            <CopyButton
              value={`${menMatch.letter} · US/UK ${menMatch.usUk} · EU ${menMatch.eu} · chest ${menMatch.chest} cm`}
              label="Copy all sizes"
            />
          </>
        ) : null}

        {jeansMatch ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ResultStat label="Waist (inches)" value={`W${jeansMatch.waistIn}`} emphasis />
              <ResultStat label="Waist (cm)" value={`${jeansMatch.waistCm} cm`} emphasis />
              <ResultStat label="EU men's" value={jeansMatch.euMen} emphasis />
              <ResultStat label="US women's" value={jeansMatch.usWomen} emphasis />
            </div>
            <ResultStat label="UK women's" value={jeansMatch.ukWomen} hint="Denim brands differ by a size or more. Use this as a starting point." />
            <CopyButton
              value={`W${jeansMatch.waistIn} (${jeansMatch.waistCm} cm) · EU ${jeansMatch.euMen} · US women's ${jeansMatch.usWomen}`}
              label="Copy all sizes"
            />
          </>
        ) : null}
      </div>

      {group === 'women' ? (
        <ToolPanel title="Women's clothing size chart" description="US, UK, EU, French, Italian and Japanese labels against body measurements in centimetres.">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>US</TableHead>
                  <TableHead>UK</TableHead>
                  <TableHead>DE/EU</TableHead>
                  <TableHead>FR</TableHead>
                  <TableHead>IT</TableHead>
                  <TableHead>JP</TableHead>
                  <TableHead>Letter</TableHead>
                  <TableHead>Bust</TableHead>
                  <TableHead>Waist</TableHead>
                  <TableHead>Hip</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CLOTHING_WOMEN.map((r) => (
                  <TableRow key={r.us} className={cn(womenMatch === r && 'bg-background font-semibold')}>
                    <TableCell className="font-medium tabular-nums">{r.us}</TableCell>
                    <TableCell className="tabular-nums">{r.uk}</TableCell>
                    <TableCell className="tabular-nums">{r.de}</TableCell>
                    <TableCell className="tabular-nums">{r.fr}</TableCell>
                    <TableCell className="tabular-nums">{r.it}</TableCell>
                    <TableCell className="tabular-nums">{r.jp}</TableCell>
                    <TableCell>{r.letter}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{r.bust}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{r.waist}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{r.hip}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      ) : null}

      {group === 'men' ? (
        <ToolPanel title="Men's clothing size chart" description="Letter sizes against chest, waist and collar in centimetres.">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Letter</TableHead>
                  <TableHead>US / UK</TableHead>
                  <TableHead>EU</TableHead>
                  <TableHead>Chest (cm)</TableHead>
                  <TableHead>Waist (cm)</TableHead>
                  <TableHead>Collar (cm)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CLOTHING_MEN.map((r) => (
                  <TableRow key={r.letter} className={cn(menMatch === r && 'bg-background font-semibold')}>
                    <TableCell className="font-medium">{r.letter}</TableCell>
                    <TableCell className="tabular-nums">{r.usUk}</TableCell>
                    <TableCell className="tabular-nums">{r.eu}</TableCell>
                    <TableCell className="tabular-nums">{r.chest}</TableCell>
                    <TableCell className="tabular-nums">{r.waist}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{r.neck}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      ) : null}

      {group === 'jeans' ? (
        <ToolPanel title="Jeans waist chart" description="Inch waist, centimetres, European men's numbering and US/UK women's equivalents.">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waist (in)</TableHead>
                  <TableHead>Waist (cm)</TableHead>
                  <TableHead>EU men's</TableHead>
                  <TableHead>US women's</TableHead>
                  <TableHead>UK women's</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {JEANS.map((r) => (
                  <TableRow key={r.waistIn} className={cn(jeansMatch === r && 'bg-background font-semibold')}>
                    <TableCell className="font-medium tabular-nums">W{r.waistIn}</TableCell>
                    <TableCell className="tabular-nums">{r.waistCm}</TableCell>
                    <TableCell className="tabular-nums">{r.euMen}</TableCell>
                    <TableCell className="tabular-nums">{r.usWomen}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{r.ukWomen}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      ) : null}
    </div>
  )
}

/* ================================================================== *
 * Rings
 * ================================================================== */

type RingSystem = 'us' | 'uk' | 'eu' | 'jp' | 'diameter' | 'circumference'

function RingConverter() {
  const uid = useId()
  const [system, setSystem] = useState<RingSystem>('us')
  const [text, setText] = useState('7')
  const [cardPx, setCardPx] = useState(324) // ≈ 85.6 mm at 96 dpi

  const pxPerMm = cardPx / CREDIT_CARD_WIDTH_MM
  const n = readNum(text)
  const typed = text.trim().toLowerCase().replace(/\s+/g, '')

  const match: RingRow | null = useMemo(() => {
    if (!typed) return null
    if (system === 'uk') {
      const exact = RING_SIZES.find((r) => r.uk.toLowerCase().replace(/\s+/g, '') === typed)
      if (exact) return exact
      const letterOnly = RING_SIZES.find(
        (r) => r.uk.toLowerCase().replace(/[^a-z]/g, '') === typed.replace(/[^a-z]/g, ''),
      )
      return letterOnly ?? null
    }
    if (n === null) return null
    switch (system) {
      case 'us':
        return nearestBy(RING_SIZES, n, (r) => parseFloat(r.us))
      case 'eu':
        return nearestBy(RING_SIZES, n, (r) => parseFloat(r.eu))
      case 'jp':
        return nearestBy(RING_SIZES, n, (r) => parseFloat(r.jp))
      case 'diameter':
        return nearestBy(RING_SIZES, n, (r) => r.diameterMm)
      case 'circumference':
        return nearestBy(RING_SIZES, n, (r) => r.circumferenceMm)
      default:
        return null
    }
  }, [n, system, typed])

  const circleSizeMm = match ? match.diameterMm : 17.3

  return (
    <div className="space-y-6">
      <ToolPanel title="Convert a ring size" description="Every system below is a relabelling of one physical number: the inside diameter of the band.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-system`}>I know the…</Label>
            <Select value={system} onValueChange={(v) => setSystem(v as RingSystem)}>
              <SelectTrigger id={`${uid}-system`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us">US / Canada size (number)</SelectItem>
                <SelectItem value="uk">UK / Australia size (letter)</SelectItem>
                <SelectItem value="eu">EU / ISO 8653 size</SelectItem>
                <SelectItem value="jp">Japan / China size</SelectItem>
                <SelectItem value="diameter">Inside diameter in mm</SelectItem>
                <SelectItem value="circumference">Inside circumference in mm</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-value`}>Value</Label>
            <Input
              id={`${uid}-value`}
              autoComplete="off"
              className="text-lg tabular-nums"
              placeholder={system === 'uk' ? 'N' : '7'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              {system === 'uk'
                ? 'Letters A to Z, with or without a half: N, N 1/2, Q.'
                : 'Half sizes are fine.'}
            </p>
          </div>
        </div>
      </ToolPanel>

      {text.trim() && !match ? (
        <ErrorNote
          title="No size matched"
          message={
            system === 'uk'
              ? `“${text.trim()}” isn’t a UK ring letter we hold. Try F to Z.`
              : n === null
                ? `“${text.trim()}” isn’t a number we can read.`
                : `“${text.trim()}” is outside this ring size chart.`
          }
        />
      ) : null}

      <div role="status" aria-live="polite" className="space-y-4">
        {match ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ResultStat label="US / Canada" value={match.us} emphasis />
              <ResultStat label="UK / Australia" value={match.uk} emphasis />
              <ResultStat label="EU / ISO" value={match.eu} emphasis />
              <ResultStat label="Japan / China" value={match.jp} emphasis />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat
                label="Inside diameter"
                value={`${match.diameterMm} mm`}
                hint={`${(match.diameterMm / 25.4).toFixed(3)} inches across the inside of the band.`}
              />
              <ResultStat label="Inside circumference" value={`${match.circumferenceMm} mm`} hint="The ISO 8653 size is this number, rounded." />
            </div>
            <CopyButton
              value={`US ${match.us} · UK ${match.uk} · EU ${match.eu} · JP ${match.jp} · ${match.diameterMm} mm inside diameter`}
              label="Copy all sizes"
            />
          </>
        ) : null}
      </div>

      <ToolPanel
        title="On-screen ring sizer"
        description="Calibrate the screen against a bank card first, then lay a ring you already own over the circle."
      >
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">
            Step 1: drag until the box is exactly the size of a credit or debit card
          </div>
          <Slider
            min={200}
            max={520}
            step={1}
            value={[cardPx]}
            onValueChange={(v) => setCardPx(v[0])}
            aria-label="Screen calibration: card width in pixels"
          />
          <div
            className="flex items-center justify-center rounded-lg border-2 border-foreground text-xs text-muted-foreground"
            style={{ width: `${cardPx}px`, height: `${cardPx / 1.5858}px`, maxWidth: '100%' }}
          >
            85.6 × 53.98 mm, the size of any bank, loyalty or ID card
          </div>
          <p className="text-sm text-muted-foreground">
            Your screen is showing about{' '}
            <strong className="text-foreground">{round1(pxPerMm)} pixels per millimetre</strong>.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <div className="text-sm font-medium text-foreground">
            Step 2: place a ring over this circle. The inside edge should touch it
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div
              className="shrink-0 rounded-full border-2 border-foreground"
              style={{
                width: `${circleSizeMm * pxPerMm}px`,
                height: `${circleSizeMm * pxPerMm}px`,
              }}
              aria-hidden="true"
            />
            <div className="text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Ruler className="size-4" aria-hidden="true" />
                {circleSizeMm} mm inside diameter
              </div>
              <p className="mt-1 max-w-sm text-pretty">
                Change the size above and the circle resizes. Measure a ring that already fits the
                right finger. This is far more reliable than measuring the finger itself.
              </p>
            </div>
          </div>
        </div>
      </ToolPanel>

      <ToolPanel
        title="Printable ring sizer"
        description="Print this page at exactly 100% scale (no “fit to page”) and these circles come out life size."
      >
        <div className="flex flex-wrap gap-4">
          {RING_SIZES.filter((_, i) => i % 2 === 0).map((r) => (
            <div key={r.us} className="flex flex-col items-center gap-1">
              <div
                className="rounded-full border border-foreground"
                style={{ width: `${r.diameterMm}mm`, height: `${r.diameterMm}mm` }}
                aria-hidden="true"
              />
              <span className="text-[11px] tabular-nums text-muted-foreground">
                US {r.us} · {r.diameterMm} mm
              </span>
            </div>
          ))}
        </div>
        <p className="flex items-start gap-2 text-sm text-muted-foreground text-pretty">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Check the print before you trust it: lay a bank card on the paper next to the circles. If
            the card is not 85.6 mm wide, the scale is wrong and so are the circles.
          </span>
        </p>
      </ToolPanel>

      <ToolPanel title="Ring size conversion chart" description="US, UK, EU/ISO and Japanese sizes against inside diameter and circumference.">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>US</TableHead>
                <TableHead>UK</TableHead>
                <TableHead>EU / ISO</TableHead>
                <TableHead>JP</TableHead>
                <TableHead>Diameter (mm)</TableHead>
                <TableHead>Circumference (mm)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RING_SIZES.map((r) => (
                <TableRow key={r.us} className={cn(match === r && 'bg-background font-semibold')}>
                  <TableCell className="font-medium tabular-nums">{r.us}</TableCell>
                  <TableCell>{r.uk}</TableCell>
                  <TableCell className="tabular-nums">{r.eu}</TableCell>
                  <TableCell className="tabular-nums">{r.jp}</TableCell>
                  <TableCell className="tabular-nums">{r.diameterMm}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{r.circumferenceMm}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ToolPanel>
    </div>
  )
}

export default function UnitsLifeSizeConverter({ mode }: Props) {
  if (mode === 'shoe') return <ShoeConverter />
  if (mode === 'clothing') return <ClothingConverter />
  return <RingConverter />
}
