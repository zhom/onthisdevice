import { useMemo, useState } from 'react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula } from '@/components/shared/Formula'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatNumber } from '@/components/tools/finance/format'
import {
  Breakdown,
  CurrencySelect,
  D,
  EmptyState,
  NumField,
  Note,
  ScrollTable,
  Segmented,
  StatGrid,
  cents,
  money,
  num,
  parseNum,
  summaryLines,
  useCurrency,
} from './common'

const KM_PER_MILE = 1.609344
const LITRES_PER_US_GAL = 3.785411784
const LITRES_PER_IMP_GAL = 4.54609

type DistanceUnit = 'mi' | 'km'
type EconomyUnit = 'mpg-us' | 'mpg-uk' | 'l100' | 'kml'
type PriceUnit = 'usgal' | 'impgal' | 'litre'

const ECONOMY_LABEL: Record<EconomyUnit, string> = {
  'mpg-us': 'miles per US gallon',
  'mpg-uk': 'miles per imperial gallon',
  l100: 'litres per 100 km',
  kml: 'kilometres per litre',
}

const PRICE_LABEL: Record<PriceUnit, string> = {
  usgal: 'per US gallon',
  impgal: 'per imperial gallon',
  litre: 'per litre',
}

/** Convert any economy figure to litres per 100 km, the common denominator. */
function toL100(value: number, unit: EconomyUnit): number | null {
  if (!Number.isFinite(value) || value <= 0) return null
  switch (unit) {
    case 'mpg-us':
      return 235.214583 / value
    case 'mpg-uk':
      return 282.480936 / value
    case 'kml':
      return 100 / value
    case 'l100':
      return value
  }
}

function litresPerUnitPrice(unit: PriceUnit): number {
  if (unit === 'usgal') return LITRES_PER_US_GAL
  if (unit === 'impgal') return LITRES_PER_IMP_GAL
  return 1
}

export default function FuelCostCalculator() {
  const [currency, setCurrency] = useCurrency()
  const [distance, setDistance] = useState('320')
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('mi')
  const [roundTrip, setRoundTrip] = useState(true)
  const [economy, setEconomy] = useState('32')
  const [economyUnit, setEconomyUnit] = useState<EconomyUnit>('mpg-us')
  const [price, setPrice] = useState('3.45')
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('usgal')
  const [people, setPeople] = useState('2')
  const [compare, setCompare] = useState(false)
  const [economyB, setEconomyB] = useState('45')
  const [tripsPerWeek, setTripsPerWeek] = useState('0')

  const result = useMemo(() => {
    const dist = parseNum(distance)
    const econ = parseNum(economy)
    const unitPrice = parseNum(price)
    if (dist === null || dist <= 0 || econ === null || unitPrice === null || unitPrice < 0) return null

    const l100 = toL100(econ, economyUnit)
    if (l100 === null) return { error: 'Fuel economy has to be a number greater than zero.' as const }

    const oneWayKm = distanceUnit === 'mi' ? dist * KM_PER_MILE : dist
    const totalKm = roundTrip ? oneWayKm * 2 : oneWayKm
    const perLitre = unitPrice / litresPerUnitPrice(priceUnit)

    const litresOneWay = (oneWayKm * l100) / 100
    const litresTotal = (totalKm * l100) / 100
    const costOneWay = D(litresOneWay).times(perLitre)
    const costTotal = D(litresTotal).times(perLitre)
    const headcount = Math.max(1, Math.round(num(people, 1)))

    const l100B = compare ? toL100(num(economyB), economyUnit) : null
    const comparison =
      l100B !== null
        ? {
            l100: l100B,
            litres: (totalKm * l100B) / 100,
            cost: D((totalKm * l100B) / 100).times(perLitre),
          }
        : null

    const weekly = Math.max(0, num(tripsPerWeek))

    return {
      error: null,
      dist,
      oneWayKm,
      totalKm,
      l100,
      perLitre,
      litresOneWay,
      litresTotal,
      costOneWay: cents(costOneWay),
      costTotal: cents(costTotal),
      headcount,
      perPerson: cents(costTotal.div(headcount)),
      costPerDistance: cents(
        costTotal.div(distanceUnit === 'mi' ? totalKm / KM_PER_MILE : totalKm).times(100),
      ),
      comparison: comparison
        ? {
            ...comparison,
            cost: cents(comparison.cost),
            saving: cents(costTotal.minus(comparison.cost)),
          }
        : null,
      weekly:
        weekly > 0
          ? {
              perWeek: cents(costTotal.times(weekly)),
              perMonth: cents(costTotal.times(weekly).times(52).div(12)),
              perYear: cents(costTotal.times(weekly).times(52)),
            }
          : null,
    }
  }, [
    compare,
    distance,
    distanceUnit,
    economy,
    economyB,
    economyUnit,
    people,
    price,
    priceUnit,
    roundTrip,
    tripsPerWeek,
  ])

  const distanceWord = distanceUnit === 'mi' ? 'miles' : 'km'

  const summary =
    result && !result.error
      ? summaryLines([
          `Distance: ${formatNumber(result.dist, 2)} ${distanceWord}${roundTrip ? ' each way (round trip)' : ' one way'}`,
          `Economy: ${formatNumber(num(economy), 2)} ${ECONOMY_LABEL[economyUnit]} = ${formatNumber(result.l100, 2)} L/100 km`,
          `Fuel price: ${money(num(price), currency)} ${PRICE_LABEL[priceUnit]}`,
          `Fuel used: ${formatNumber(result.litresTotal, 2)} L (${formatNumber(result.litresTotal / LITRES_PER_US_GAL, 2)} US gal)`,
          `Trip cost: ${money(result.costTotal, currency)}`,
          result.headcount > 1 ? `Each of ${result.headcount} people: ${money(result.perPerson, currency)}` : null,
        ])
      : ''

  return (
    <div className="space-y-6">
      <ToolPanel title="The trip">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField
            label={roundTrip ? 'Distance one way' : 'Distance'}
            value={distance}
            onChange={setDistance}
            placeholder="0"
            invalid={distance.trim() !== '' && parseNum(distance) === null}
          />
          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">Distance unit</span>
            <Segmented
              label="Distance unit"
              value={distanceUnit}
              onChange={setDistanceUnit}
              options={[
                { value: 'mi', label: 'Miles' },
                { value: 'km', label: 'Kilometres' },
              ]}
            />
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
          <div className="min-w-0">
            <Label htmlFor="round-trip" className="text-sm font-medium">
              Round trip
            </Label>
            <p className="mt-1 text-xs text-pretty text-muted-foreground">
              Doubles the distance so you see the there-and-back cost.
            </p>
          </div>
          <Switch id="round-trip" checked={roundTrip} onCheckedChange={setRoundTrip} aria-label="Round trip" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="Number of people sharing the cost" value={people} onChange={setPeople} />
          <NumField
            label="Trips like this per week"
            value={tripsPerWeek}
            onChange={setTripsPerWeek}
            hint="Optional. Set it to see the weekly, monthly and annual cost of a commute."
          />
        </div>
      </ToolPanel>

      <ToolPanel title="The car and the fuel">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField
            label="Fuel economy"
            value={economy}
            onChange={setEconomy}
            invalid={economy.trim() !== '' && (parseNum(economy) === null || num(economy) <= 0)}
          />
          <div className="space-y-1.5">
            <Label htmlFor="econ-unit">Economy measured in</Label>
            <Select value={economyUnit} onValueChange={(v) => setEconomyUnit(v as EconomyUnit)}>
              <SelectTrigger id="econ-unit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mpg-us">MPG (US gallons)</SelectItem>
                <SelectItem value="mpg-uk">MPG (imperial gallons)</SelectItem>
                <SelectItem value="l100">L / 100 km</SelectItem>
                <SelectItem value="kml">km / L</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <NumField label="Fuel price" value={price} onChange={setPrice} placeholder="0.00" />
          <div className="space-y-1.5">
            <Label htmlFor="price-unit">Price is</Label>
            <Select value={priceUnit} onValueChange={(v) => setPriceUnit(v as PriceUnit)}>
              <SelectTrigger id="price-unit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usgal">Per US gallon</SelectItem>
                <SelectItem value="impgal">Per imperial gallon</SelectItem>
                <SelectItem value="litre">Per litre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CurrencySelect value={currency} onChange={setCurrency} />
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
          <div className="min-w-0">
            <Label htmlFor="compare-toggle" className="text-sm font-medium">
              Compare a second vehicle
            </Label>
            <p className="mt-1 text-xs text-pretty text-muted-foreground">
              Same trip, same fuel price, different economy. See which car to take.
            </p>
          </div>
          <Switch
            id="compare-toggle"
            checked={compare}
            onCheckedChange={setCompare}
            aria-label="Compare a second vehicle"
          />
        </div>

        {compare && (
          <NumField
            label={`Second vehicle economy (${ECONOMY_LABEL[economyUnit]})`}
            value={economyB}
            onChange={setEconomyB}
          />
        )}
      </ToolPanel>

      <ToolPanel
        title="Trip cost"
        footer={result && !result.error ? <CopyButton value={summary} label="Copy the estimate" /> : undefined}
      >
        {!result ? (
          <EmptyState message="Enter a distance, a fuel economy and a fuel price to cost the trip." />
        ) : result.error ? (
          <Note tone="warning">{result.error}</Note>
        ) : (
          <div className="space-y-4">
            <StatGrid cols={3}>
              <ResultStat
                label={roundTrip ? 'Round-trip fuel cost' : 'Trip fuel cost'}
                value={money(result.costTotal, currency)}
                hint={`${formatNumber(result.litresTotal, 2)} litres of fuel`}
                emphasis
              />
              <ResultStat
                label="Each person pays"
                value={money(result.perPerson, currency)}
                hint={`Split ${result.headcount} way${result.headcount === 1 ? '' : 's'}`}
              />
              <ResultStat
                label={`Cost per 100 ${distanceWord}`}
                value={money(result.costPerDistance, currency)}
                hint="Useful for comparing routes"
              />
            </StatGrid>

            <Breakdown
              rows={[
                {
                  label: 'Total distance driven',
                  value: `${formatNumber(distanceUnit === 'mi' ? result.totalKm / KM_PER_MILE : result.totalKm, 2)} ${distanceWord}`,
                },
                { label: 'Economy in L/100 km', value: formatNumber(result.l100, 2) },
                {
                  label: 'Fuel needed',
                  value: `${formatNumber(result.litresTotal, 2)} L · ${formatNumber(result.litresTotal / LITRES_PER_US_GAL, 2)} US gal · ${formatNumber(result.litresTotal / LITRES_PER_IMP_GAL, 2)} imp gal`,
                },
                { label: 'Price per litre', value: money(result.perLitre, currency) },
                ...(roundTrip ? [{ label: 'One-way cost', value: money(result.costOneWay, currency) }] : []),
                { label: roundTrip ? 'Round-trip cost' : 'Trip cost', value: money(result.costTotal, currency), strong: true },
              ]}
            />

            {result.weekly && (
              <ScrollTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>If you drive this every week</TableHead>
                      <TableHead className="text-right">Fuel cost</TableHead>
                      <TableHead className="text-right">Per person</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Per week</TableCell>
                      <TableCell className="text-right tabular-nums">{money(result.weekly.perWeek, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(cents(result.weekly.perWeek.div(result.headcount)), currency)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Per month</TableCell>
                      <TableCell className="text-right tabular-nums">{money(result.weekly.perMonth, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(cents(result.weekly.perMonth.div(result.headcount)), currency)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Per year</TableCell>
                      <TableCell className="text-right tabular-nums">{money(result.weekly.perYear, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(cents(result.weekly.perYear.div(result.headcount)), currency)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollTable>
            )}

            {result.comparison && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Vehicle comparison</h3>
                <ScrollTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead className="text-right">Economy</TableHead>
                        <TableHead className="text-right">Fuel used</TableHead>
                        <TableHead className="text-right">Trip cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Vehicle A</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(num(economy), 2)} {economyUnit === 'l100' ? 'L/100km' : economyUnit === 'kml' ? 'km/L' : 'mpg'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(result.litresTotal, 2)} L</TableCell>
                        <TableCell className="text-right tabular-nums">{money(result.costTotal, currency)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Vehicle B</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(num(economyB), 2)} {economyUnit === 'l100' ? 'L/100km' : economyUnit === 'kml' ? 'km/L' : 'mpg'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(result.comparison.litres, 2)} L
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{money(result.comparison.cost, currency)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </ScrollTable>
                <Note tone={result.comparison.saving.gte(0) ? 'success' : 'warning'}>
                  {result.comparison.saving.gte(0)
                    ? `Vehicle B saves ${money(result.comparison.saving, currency)} on this trip.`
                    : `Vehicle B costs ${money(result.comparison.saving.abs(), currency)} more on this trip.`}
                </Note>
              </div>
            )}

            <Formula caption="Everything is converted to litres and kilometres first, then priced.">
              {[
                `distance = ${formatNumber(result.totalKm, 2)} km`,
                `economy  = ${formatNumber(result.l100, 3)} L per 100 km`,
                `fuel     = ${formatNumber(result.totalKm, 2)} × ${formatNumber(result.l100, 3)} ÷ 100 = ${formatNumber(result.litresTotal, 2)} L`,
                `cost     = ${formatNumber(result.litresTotal, 2)} L × ${money(result.perLitre, currency)}/L = ${money(result.costTotal, currency)}`,
              ].join('\n')}
            </Formula>

            <Note>
              This is fuel only. Real trip cost also includes tyres, servicing, depreciation and tolls.
              The widely used all-in figures put those at roughly the same again as fuel for an average
              car.
            </Note>
          </div>
        )}
      </ToolPanel>
    </div>
  )
}
