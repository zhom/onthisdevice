import type { Answer } from './types'
import { toNumber } from './types'
import { grouped, plain } from './format'

type Family =
  | 'length' | 'mass' | 'temperature' | 'volume' | 'area' | 'speed'
  | 'data' | 'time' | 'pressure' | 'energy' | 'power' | 'angle'

interface Unit {
  id: string
  family: Family
  /** value * factor + offset = value in the family's base unit. */
  factor: number
  offset: number
  sym: string
  name: string
}

/** id, factor to the base unit, symbol, plural name, aliases, offset. Plurals and metre/litre spellings are added. */
type Row = [string, number, string, string, string, number?]

const F = 5 / 9
const ROWS: Record<Family, Row[]> = {
  length: [
    ['nm', 1e-9, 'nm', 'nanometers', 'nm|nanometer'],
    ['um', 1e-6, 'µm', 'micrometers', 'um|µm|micrometer|micron'],
    ['mm', 1e-3, 'mm', 'millimeters', 'mm|millimeter'],
    ['cm', 0.01, 'cm', 'centimeters', 'cm|centimeter'],
    ['m', 1, 'm', 'meters', 'm|meter|mtr'],
    ['km', 1000, 'km', 'kilometers', 'km|kms|kilometer|klick'],
    ['in', 0.0254, 'in', 'inches', 'in|inch|inches|"'],
    ['ft', 0.3048, 'ft', 'feet', "ft|foot|feet|'"],
    ['yd', 0.9144, 'yd', 'yards', 'yd|yds|yard'],
    ['mi', 1609.344, 'mi', 'miles', 'mi|mile'],
    ['nmi', 1852, 'nmi', 'nautical miles', 'nmi|nautical mile'],
  ],
  mass: [
    ['mg', 1e-6, 'mg', 'milligrams', 'mg|milligram'],
    ['g', 1e-3, 'g', 'grams', 'g|gm|gram|gramme'],
    ['kg', 1, 'kg', 'kilograms', 'kg|kgs|kilo|kilogram|kilogramme'],
    ['t', 1000, 't', 'tonnes', 't|tonne|metric ton'],
    ['oz', 0.028349523125, 'oz', 'ounces', 'oz|ounce'],
    ['lb', 0.45359237, 'lb', 'pounds', 'lb|lbs|pound'],
    ['st', 6.35029318, 'st', 'stone', 'st|stone'],
    ['ton', 907.18474, 'US tons', 'US tons', 'ton|short ton|us ton'],
  ],
  temperature: [
    ['c', 1, '°C', 'Celsius', 'c|°c|celsius|centigrade|degree c|degrees c|deg c|degree celsius|degrees celsius', 273.15],
    ['f', F, '°F', 'Fahrenheit', 'f|°f|fahrenheit|degree f|degrees f|deg f|degree fahrenheit|degrees fahrenheit', 273.15 - 32 * F],
    ['k', 1, 'K', 'Kelvin', 'k|°k|kelvin'],
  ],
  volume: [
    ['ml', 1e-3, 'mL', 'milliliters', 'ml|milliliter|cc|cm3|cubic centimeter'],
    ['cl', 0.01, 'cL', 'centiliters', 'cl|centiliter'],
    ['dl', 0.1, 'dL', 'deciliters', 'dl|deciliter'],
    ['l', 1, 'L', 'liters', 'l|liter|ltr'],
    ['m3', 1000, 'm³', 'cubic meters', 'm3|cubic meter'],
    ['tsp', 0.00492892159375, 'tsp', 'teaspoons', 'tsp|teaspoon'],
    ['tbsp', 0.01478676478125, 'tbsp', 'tablespoons', 'tbsp|tbs|tablespoon'],
    ['floz', 0.0295735295625, 'fl oz', 'fluid ounces', 'fl oz|floz|fluid ounce|oz|ounce'],
    ['cup', 0.2365882365, 'cups', 'cups', 'cup'],
    ['pt', 0.473176473, 'pt', 'pints', 'pt|pint'],
    ['qt', 0.946352946, 'qt', 'quarts', 'qt|quart'],
    ['gal', 3.785411784, 'gal', 'gallons', 'gal|gallon|us gallon'],
    ['impgal', 4.54609, 'imp gal', 'imperial gallons', 'imp gal|imperial gallon|uk gallon'],
    ['in3', 0.016387064, 'in³', 'cubic inches', 'in3|cu in|cubic inch|cubic inches'],
    ['ft3', 28.316846592, 'ft³', 'cubic feet', 'ft3|cu ft|cubic foot|cubic feet'],
  ],
  area: [
    ['mm2', 1e-6, 'mm²', 'square millimeters', 'mm2|sq mm|square millimeter'],
    ['cm2', 1e-4, 'cm²', 'square centimeters', 'cm2|sq cm|square centimeter'],
    ['m2', 1, 'm²', 'square meters', 'm2|sq m|sqm|square meter'],
    ['ha', 1e4, 'ha', 'hectares', 'ha|hectare'],
    ['km2', 1e6, 'km²', 'square kilometers', 'km2|sq km|square kilometer'],
    ['in2', 0.00064516, 'sq in', 'square inches', 'in2|sq in|square inch|square inches'],
    ['ft2', 0.09290304, 'sq ft', 'square feet', 'ft2|sq ft|sqft|square foot|square feet'],
    ['yd2', 0.83612736, 'sq yd', 'square yards', 'yd2|sq yd|square yard'],
    ['acre', 4046.8564224, 'acres', 'acres', 'ac|acre'],
    ['mi2', 2589988.110336, 'sq mi', 'square miles', 'mi2|sq mi|square mile'],
  ],
  speed: [
    ['mps', 1, 'm/s', 'meters per second', 'm/s|mps|meter per second|meters per second'],
    ['kph', 1 / 3.6, 'km/h', 'kilometers per hour', 'km/h|kph|kmh|kmph|km per hour|kilometer per hour|kilometers per hour'],
    ['mph', 0.44704, 'mph', 'miles per hour', 'mph|mi/h|mile per hour|miles per hour'],
    ['fps', 0.3048, 'ft/s', 'feet per second', 'ft/s|fps|feet per second'],
    ['kn', 1852 / 3600, 'kn', 'knots', 'kn|kt|kts|knot'],
  ],
  data: [
    ['bit', 0.125, 'bits', 'bits', 'bit'],
    ['b', 1, 'B', 'bytes', 'b|byte'],
    ['kb', 1e3, 'kB', 'kilobytes', 'kb|kilobyte'],
    ['mb', 1e6, 'MB', 'megabytes', 'mb|megabyte'],
    ['gb', 1e9, 'GB', 'gigabytes', 'gb|gig|gigabyte'],
    ['tb', 1e12, 'TB', 'terabytes', 'tb|terabyte'],
    ['pb', 1e15, 'PB', 'petabytes', 'pb|petabyte'],
    ['kib', 1024, 'KiB', 'kibibytes', 'kib|kibibyte'],
    ['mib', 1024 ** 2, 'MiB', 'mebibytes', 'mib|mebibyte'],
    ['gib', 1024 ** 3, 'GiB', 'gibibytes', 'gib|gibibyte'],
    ['tib', 1024 ** 4, 'TiB', 'tebibytes', 'tib|tebibyte'],
  ],
  time: [
    ['ms', 1e-3, 'ms', 'milliseconds', 'ms|msec|millisecond'],
    ['s', 1, 'sec', 'seconds', 's|sec|secs|second'],
    ['min', 60, 'min', 'minutes', 'min|mins|minute'],
    ['h', 3600, 'hours', 'hours', 'h|hr|hrs|hour'],
    ['d', 86400, 'days', 'days', 'd|day'],
    ['wk', 604800, 'weeks', 'weeks', 'wk|wks|week'],
    ['mo', 2629746, 'months', 'months', 'mo|month'],
    ['yr', 31556952, 'years', 'years', 'yr|yrs|year'],
  ],
  pressure: [
    ['pa', 1, 'Pa', 'pascals', 'pa|pascal'],
    ['hpa', 100, 'hPa', 'hectopascals', 'hpa|hectopascal'],
    ['kpa', 1e3, 'kPa', 'kilopascals', 'kpa|kilopascal'],
    ['mpa', 1e6, 'MPa', 'megapascals', 'mpa|megapascal'],
    ['mbar', 100, 'mbar', 'millibars', 'mbar|millibar'],
    ['bar', 1e5, 'bar', 'bar', 'bar'],
    ['psi', 6894.757293168361, 'psi', 'psi', 'psi'],
    ['atm', 101325, 'atm', 'atmospheres', 'atm|atmosphere'],
    ['mmhg', 133.322387415, 'mmHg', 'mmHg', 'mmhg|torr'],
    ['inhg', 3386.389, 'inHg', 'inHg', 'inhg'],
  ],
  energy: [
    ['j', 1, 'J', 'joules', 'j|joule'],
    ['kj', 1e3, 'kJ', 'kilojoules', 'kj|kilojoule'],
    ['mj', 1e6, 'MJ', 'megajoules', 'mj|megajoule'],
    ['cal', 4.184, 'cal', 'calories', 'cal|calorie'],
    ['kcal', 4184, 'kcal', 'kilocalories', 'kcal|kilocalorie'],
    ['wh', 3600, 'Wh', 'watt-hours', 'wh|watt hour'],
    ['kwh', 3.6e6, 'kWh', 'kilowatt-hours', 'kwh|kilowatt hour'],
    ['btu', 1055.05585262, 'BTU', 'BTU', 'btu'],
    ['ev', 1.602176634e-19, 'eV', 'electronvolts', 'ev|electronvolt'],
  ],
  power: [
    ['w', 1, 'W', 'watts', 'w|watt'],
    ['kw', 1e3, 'kW', 'kilowatts', 'kw|kilowatt'],
    ['mw', 1e6, 'MW', 'megawatts', 'mw|megawatt'],
    ['hp', 745.69987158227022, 'hp', 'horsepower', 'hp|bhp|horsepower'],
    ['ps', 735.49875, 'PS', 'metric horsepower', 'ps|metric horsepower'],
    ['btuh', 0.29307107, 'BTU/h', 'BTU per hour', 'btu/h|btu/hr|btuh'],
  ],
  angle: [
    ['deg', Math.PI / 180, '°', 'degrees', 'deg|degree|°'],
    ['rad', 1, 'rad', 'radians', 'rad|radian'],
    ['grad', Math.PI / 200, 'grad', 'gradians', 'grad|gradian|gon'],
    ['turn', 2 * Math.PI, 'turns', 'turns', 'turn|rev|revolution'],
    ['arcmin', Math.PI / 10800, 'arcmin', 'arcminutes', 'arcmin|arcminute'],
    ['arcsec', Math.PI / 648000, 'arcsec', 'arcseconds', 'arcsec|arcsecond'],
  ],
}

const familySlug = (f: Family) => (f === 'mass' ? 'weight' : f === 'data' ? 'data-storage' : f) + '-converter'

/** Tools for one exact pair, keyed "from>to" by unit id. */
const PAIR_SLUG: Record<string, string> = {
  'kg>lb': 'kg-to-lbs', 'lb>kg': 'lbs-to-kg', 'kg>st': 'kg-to-stone', 'st>lb': 'stone-to-pounds',
  'g>oz': 'grams-to-ounces', 'oz>g': 'ounces-to-grams', 'km>mi': 'km-to-miles', 'mi>km': 'miles-to-km',
  'cm>in': 'cm-to-inches', 'in>cm': 'inches-to-cm', 'in>mm': 'inches-to-mm', 'mm>in': 'mm-to-inches',
  'ft>m': 'feet-to-meters', 'm>ft': 'meters-to-feet', 'yd>m': 'yards-to-meters',
  'c>f': 'celsius-to-fahrenheit', 'f>c': 'fahrenheit-to-celsius', 'c>k': 'celsius-to-kelvin',
  'ml>cup': 'ml-to-cups', 'tbsp>cup': 'tablespoons-to-cups', 'floz>cup': 'oz-to-cups',
}

/** Alias -> units. Most aliases name one unit; "oz" is mass first, then fluid ounces. */
const ALIASES = new Map<string, Unit[]>()
for (const family of Object.keys(ROWS) as Family[]) {
  for (const [id, factor, sym, name, aliases, offset = 0] of ROWS[family]) {
    const unit: Unit = { id, family, factor, offset, sym, name }
    for (const alias of aliases.split('|')) {
      const forms = [alias]
      if (/[a-z]{3}$/.test(alias) && !alias.endsWith('s')) forms.push(alias + 's')
      for (const f of forms.slice()) if (/meter|liter/.test(f)) forms.push(f.replace('meter', 'metre').replace('liter', 'litre'))
      for (const f of forms) {
        const list = ALIASES.get(f)
        if (!list) ALIASES.set(f, [unit])
        else if (!list.includes(unit)) list.push(unit)
      }
    }
  }
}

const SEPARATORS = new Set(['in', 'to', 'into', 'as', '=', '->', '→'])
const NUMBER = /^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$|^-?\.\d+$/
const HOW_MANY = /^how many (.+?) (?:are )?(?:in|per|make) (?:a |an |one )?(.+)$/

/** "11.0231 lb", "90°", "1 cup". */
const show = (n: number, u: Unit, sig = 6) => {
  const sym = n === 1 && /^[a-z]{3,}s$/.test(u.sym) ? u.sym.slice(0, -1) : u.sym
  return grouped(n, sig) + (sym === '°' ? sym : ' ' + sym)
}

/** The first pair of units from the two alias lists that share a family. */
function pair(a: Unit[], b: Unit[], family?: Family): [Unit, Unit] | null {
  for (const x of a) for (const y of b) if (x.family === y.family && x !== y && (!family || x.family === family)) return [x, y]
  return null
}

/** "5 kg in lbs", "72f to c", "5'10\" in cm", "5 ft 10 in to cm", "10 miles km", "how many ounces in a pound". */
export function unitAnswer(s: string): Answer | null {
  const how = HOW_MANY.exec(s)
  if (how) {
    const [, target, source] = how
    return unitAnswer(/^[-\d.]/.test(source) ? `${source} in ${target}` : `1 ${source} in ${target}`)
  }
  if (!/^-?[\d.]/.test(s)) return null
  const words = s
    .replace(/[′’]/g, "'")
    .replace(/[″”]|''/g, '"')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/(\d)(?=[a-z°µ'"])/g, '$1 ')
    .replace(/(['"=])/g, ' $1 ')
    .replace(/([a-z])-([a-z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
  if (words.length < 3 || !NUMBER.test(words[0])) return null

  // "5 ft 10 in to cm": a second number makes a compound amount in one family.
  let lead: { n: number; units: Unit[] } | null = null
  let n = toNumber(words[0])
  let rest = words.slice(1)
  const second = rest.findIndex((w) => NUMBER.test(w))
  if (second > 0) {
    const units = ALIASES.get(rest.slice(0, second).join(' '))
    if (!units) return null
    lead = { n, units }
    n = toNumber(rest[second])
    rest = rest.slice(second + 1)
  } else if (second === 0) return null

  for (let i = 1; i < rest.length; i++) {
    const from = ALIASES.get(rest.slice(0, i).join(' '))
    if (!from) continue
    for (const skip of SEPARATORS.has(rest[i]) ? [1, 0] : [0]) {
      const to = ALIASES.get(rest.slice(i + skip).join(' '))
      if (!to) continue
      let leadUnit: Unit | null = null
      let found = pair(from, to)
      if (lead) {
        leadUnit = lead.units.find((u) => u.family !== 'temperature' && from.some((f) => f.family === u.family && f !== u)) ?? null
        found = leadUnit ? pair(from, to, leadUnit.family) : null
      }
      if (!found) continue
      const [a, b] = found
      const base = (leadUnit && lead ? lead.n * leadUnit.factor : 0) + n * a.factor + a.offset
      const out = (base - b.offset) / b.factor
      if (!Number.isFinite(out)) return null
      const asked = leadUnit && lead ? `${show(lead.n, leadUnit, 12)} ${show(n, a, 12)} to` : `${show(n, a, 12)} in`
      return {
        kind: 'unit',
        value: show(out, b),
        label: `${asked} ${b.name}`,
        copy: plain(out, 6),
        slug: (!leadUnit && PAIR_SLUG[`${a.id}>${b.id}`]) || familySlug(b.family),
        more: a.offset || b.offset || leadUnit ? undefined : [`${show(1, a)} = ${show(a.factor / b.factor, b)}`],
      }
    }
  }
  return null
}
